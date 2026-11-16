<script setup lang="ts">
import axios from 'axios'
import { computed, nextTick, ref } from 'vue'
import api from '@/services/api'

type RecordData = Record<string, unknown>
type ApiResponse = { status?: string; message?: string; data?: RecordData[] }
type GatePayload = {
  noSpmk: string
  noJob: string
  noBlAwb: string
  platNo: string
  gateInDate: string
  beratIn: number
  gateOutDate: string
  beratOut: number
  netto: number
  colli: number
}

const noJob = ref('')
const job = ref<RecordData | null>(null)
const gateInDate = ref('')
const beratIn = ref('')
const gateOutDate = ref('')
const beratOut = ref('')
const colli = ref<number | ''>('')
const loading = ref(false)
const sending = ref(false)
const error = ref('')
const success = ref('')
const gateInWeightInput = ref<HTMLInputElement | null>(null)
const busy = computed(() => loading.value || sending.value)

const netto = computed(() => {
  if (beratIn.value === '' || beratOut.value === '') return null
  const inWeight = Number(beratIn.value)
  const outWeight = Number(beratOut.value)
  return Number.isFinite(inWeight) && Number.isFinite(outWeight)
    ? Math.abs(inWeight - outWeight)
    : null
})

const jobSummary = computed(() => {
  if (!job.value) return []
  return [
    { label: 'No. Job Order', value: read(job.value, ['noJob']) ?? noJob.value },
    { label: 'No. SPMK', value: read(job.value, ['noSpmk']) },
    { label: 'Plat No', value: read(job.value, ['platNo', 'noPolisi']) },
    { label: 'Kapal', value: read(job.value, ['nmKapal', 'namaKapal']) },
    { label: 'PBM', value: read(job.value, ['nmPbm', 'namaPbm', 'pbm']) },
    { label: 'No. PKK', value: read(job.value, ['noPkk']) },
  ].filter((item) => item.value != null && item.value !== '')
})

function read(source: RecordData | null, keys: string[]) {
  const key =
    source &&
    Object.keys(source).find((item) =>
      keys.some((name) => name.toLowerCase() === item.toLowerCase()),
    )
  return key && source ? source[key] : undefined
}

function asString(value: unknown): string {
  return value == null ? '' : String(value)
}

function apiMessage(data: unknown, fallback: string) {
  if (data && typeof data === 'object' && 'message' in data) {
    const message = (data as { message?: unknown }).message
    if (typeof message === 'string' && message) return message
  }
  return fallback
}

function errorMessage(requestError: unknown) {
  if (axios.isAxiosError(requestError)) {
    return apiMessage(requestError.response?.data, requestError.message)
  }
  return requestError instanceof Error ? requestError.message : 'Terjadi kesalahan yang tidak diketahui.'
}

function message(data: ApiResponse) {
  return data.message || 'Permintaan gagal.'
}

function inspections(source: RecordData): RecordData[] {
  const value = read(source, ['inspeksi'])
  return Array.isArray(value)
    ? value.filter((item): item is RecordData => typeof item === 'object' && item !== null)
    : []
}

function currentDateTimeLocal() {
  const now = new Date()
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 16)
}

function formatDateTime(value: string) {
  const dateTime = value.replace('T', ' ')
  return dateTime.length === 16 ? `${dateTime}:00` : dateTime
}

function reset() {
  noJob.value = ''
  job.value = null
  gateInDate.value = ''
  beratIn.value = ''
  gateOutDate.value = ''
  beratOut.value = ''
  colli.value = ''
  error.value = ''
  success.value = ''
  nextTick(() => document.getElementById('no-job')?.focus())
}

async function lookup() {
  if (!noJob.value.trim() || busy.value) return
  loading.value = true
  error.value = ''
  success.value = ''
  job.value = null
  try {
    const { data } = await api.post<ApiResponse>('/getDataGatePtosm', { noJob: noJob.value.trim() })
    if (data.status === 'E') throw new Error(message(data))
    const result = data.data?.[0]
    if (!result) throw new Error('Data Job Order tidak ditemukan.')

    job.value = result
    gateInDate.value = currentDateTimeLocal()
    gateOutDate.value = currentDateTimeLocal()
    colli.value = 0
    await nextTick()
    gateInWeightInput.value?.focus()
  } catch (requestError) {
    error.value = errorMessage(requestError)
  } finally {
    loading.value = false
  }
}

async function submit() {
  if (
    !job.value ||
    beratIn.value === '' ||
    beratOut.value === '' ||
    colli.value === '' ||
    !gateInDate.value ||
    !gateOutDate.value ||
    busy.value
  ) {
    return
  }

  const inWeight = Number(beratIn.value)
  const outWeight = Number(beratOut.value)
  const colliCount = Number(colli.value)
  const nettoValue = netto.value
  if (
    !Number.isFinite(inWeight) ||
    inWeight < 0 ||
    !Number.isFinite(outWeight) ||
    outWeight < 0 ||
    !Number.isInteger(colliCount) ||
    colliCount < 0 ||
    nettoValue == null
  ) {
    error.value = 'Berat harus berupa angka non-negatif dan colli harus bilangan bulat minimal 0.'
    return
  }

  sending.value = true
  error.value = ''
  success.value = ''
  const items = inspections(job.value)
  const payloadItems: (RecordData | null)[] = items.length ? items : [null]
  const payload: GatePayload[] = payloadItems.map((inspection) => ({
    noSpmk: asString(read(job.value, ['noSpmk'])),
    noJob: asString(read(job.value, ['noJob']) ?? noJob.value),
    noBlAwb: asString(read(inspection, ['noBlAwb'])),
    platNo: asString(read(job.value, ['platNo', 'noPolisi'])),
    gateInDate: formatDateTime(gateInDate.value),
    beratIn: inWeight,
    gateOutDate: formatDateTime(gateOutDate.value),
    beratOut: outWeight,
    netto: nettoValue,
    colli: colliCount,
  }))

  try {
    const { data } = await api.post<ApiResponse>('/sendDataGatePtosm', payload)
    if (data.status === 'E') throw new Error(message(data))
    const successMessage = data.message || 'Transaksi Gate berhasil dikirim.'
    reset()
    success.value = successMessage
  } catch (requestError) {
    error.value = errorMessage(requestError)
  } finally {
    sending.value = false
  }
}

function numberOnly(event: KeyboardEvent) {
  if (['e', 'E', '+', '-'].includes(event.key)) event.preventDefault()
}
</script>

<template>
  <main class="min-h-[calc(100vh-4rem)] bg-slate-100 p-4 sm:p-8">
    <section
      class="mx-auto max-w-5xl overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200"
    >
      <header class="bg-blue-700 px-6 py-5 text-white">
        <h1 class="text-xl font-bold">Port Gate Operation</h1>
        <p class="text-sm text-blue-100">Pencatatan transaksi Gate In &amp; Gate Out</p>
      </header>

      <div class="space-y-6 p-5 sm:p-7">
        <p
          v-if="success"
          role="status"
          class="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700"
        >
          {{ success }}
        </p>
        <p v-if="error" role="alert" class="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {{ error }}
        </p>

        <section class="rounded-xl border border-slate-200 p-5">
          <div class="mb-4">
            <h2 class="font-bold text-slate-900">Cari Job Order</h2>
            <p class="mt-1 text-sm text-slate-500">Masukkan nomor Job Order untuk memuat data transaksi.</p>
          </div>
          <form class="flex flex-col gap-3 sm:flex-row" @submit.prevent="lookup">
            <input
              id="no-job"
              v-model.trim="noJob"
              :disabled="busy"
              required
              class="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
              placeholder="Nomor Job Order"
            />
            <button
              :disabled="busy"
              class="rounded-lg bg-blue-700 px-5 py-2.5 font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {{ loading ? 'Memuat...' : 'Cari Job' }}
            </button>
          </form>
        </section>

        <section v-if="job" class="rounded-xl border border-slate-200 p-5">
          <div class="mb-4">
            <h2 class="font-bold text-slate-900">Ringkasan Data Kendaraan / Kapal</h2>
            <p class="mt-1 text-sm text-slate-500">Data berikut berasal dari Job Order yang ditemukan.</p>
          </div>
          <dl class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div
              v-for="item in jobSummary"
              :key="item.label"
              class="rounded-lg bg-slate-50 px-4 py-3"
            >
              <dt class="text-xs font-medium text-slate-500">{{ item.label }}</dt>
              <dd class="mt-1 break-words text-sm font-semibold text-slate-900">
                {{ item.value }}
              </dd>
            </div>
          </dl>
        </section>

        <section v-if="job" class="rounded-xl border border-slate-200 p-5">
          <div class="mb-5">
            <h2 class="font-bold text-slate-900">Data Transaksi Gate Terpadu</h2>
            <p class="mt-1 text-sm text-slate-500">
              Lengkapi data Gate In dan Gate Out sebelum mengirim transaksi.
            </p>
          </div>

          <form class="space-y-5" @submit.prevent="submit">
            <fieldset :disabled="busy" class="grid gap-5 md:grid-cols-2">
              <section class="space-y-4 rounded-lg bg-blue-50/70 p-4">
                <h3 class="font-semibold text-blue-900">Gate In</h3>
                <label class="block text-sm font-medium text-slate-700">
                  Tanggal In
                  <input
                    v-model="gateInDate"
                    type="datetime-local"
                    required
                    class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                <label class="block text-sm font-medium text-slate-700">
                  Berat In (kg)
                  <input
                    ref="gateInWeightInput"
                    v-model="beratIn"
                    @keydown="numberOnly"
                    type="number"
                    min="0"
                    step="any"
                    required
                    class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  />
                </label>
              </section>

              <section class="space-y-4 rounded-lg bg-emerald-50/70 p-4">
                <h3 class="font-semibold text-emerald-900">Gate Out</h3>
                <label class="block text-sm font-medium text-slate-700">
                  Tanggal Out
                  <input
                    v-model="gateOutDate"
                    type="datetime-local"
                    required
                    class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
                <label class="block text-sm font-medium text-slate-700">
                  Berat Out (kg)
                  <input
                    v-model="beratOut"
                    @keydown="numberOnly"
                    type="number"
                    min="0"
                    step="any"
                    required
                    class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
                <label class="block text-sm font-medium text-slate-700">
                  Colli
                  <input
                    v-model.number="colli"
                    @keydown="numberOnly"
                    type="number"
                    min="0"
                    step="1"
                    required
                    class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
              </section>
            </fieldset>

            <div class="flex flex-col gap-4 border-t border-slate-200 pt-5 sm:flex-row sm:items-center">
              <p class="flex-1 rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-700">
                Netto (kg):
                <strong class="ml-1 text-lg text-slate-900">
                  {{
                    netto == null
                      ? '—'
                      : netto.toLocaleString('id-ID', { maximumFractionDigits: 10 })
                  }}
                </strong>
                <span v-if="netto == null" class="ml-1 text-slate-500">
                  (isi berat In dan Out)
                </span>
              </p>
              <button
                :disabled="busy"
                class="rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {{ sending ? 'Mengirim...' : 'Kirim Transaksi Gate' }}
              </button>
            </div>
          </form>
        </section>
      </div>
    </section>
  </main>
</template>
