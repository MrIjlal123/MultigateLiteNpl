<script setup lang="ts">
import axios from 'axios'
import { computed, nextTick, ref, watch } from 'vue'
import { showError, showSuccess } from '@/utils/feedback'
import api from '@/services/api'

type RecordData = Record<string, unknown>
interface DataGatePtosm extends RecordData {
  destinationCode: string | null
  destinationName: string | null
}

type ApiResponse = { status?: string; message?: string; data?: DataGatePtosm[] }
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
const job = ref<DataGatePtosm | null>(null)
const gateInDate = ref('')
const beratIn = ref('')
const gateOutDate = ref('')
const beratOut = ref('')
const colli = ref<number | ''>('')
const loading = ref(false)
const sending = ref(false)
const error = ref('')
const success = ref('')
watch(error, (message) => { if (message) void showError(message) })
watch(success, (message) => { if (message) void showSuccess(message) })
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
    { label: 'Tujuan / Destinasi', value: destinationLabel(job.value) },
  ].filter((item) => item.value != null && item.value !== '')
})

function destinationLabel(data: DataGatePtosm) {
  const name = typeof data.destinationName === 'string' ? data.destinationName.trim() : ''
  if (!name) return '-'
  const code = typeof data.destinationCode === 'string' ? data.destinationCode.trim() : ''
  return code ? `${name} (${code})` : name
}

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
  <main class="page">
    <div class="mx-auto max-w-5xl space-y-6">
      <div>
        <p class="page-eyebrow">Operasional Pelabuhan</p>
        <h1 class="page-title">Gate Operation</h1>
        <p class="page-subtitle">Pencatatan transaksi Gate In &amp; Gate Out berdasarkan Job Order.</p>
      </div>

      <section class="card">
        <div class="card-header flex items-center gap-3">
          <span class="grid size-8 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">1</span>
          <div>
            <h2 class="card-title">Cari Job Order</h2>
            <p class="text-sm text-slate-500">Masukkan nomor Job Order untuk memuat data transaksi.</p>
          </div>
        </div>
        <form class="flex flex-col gap-3 p-5 sm:flex-row sm:p-6" @submit.prevent="lookup">
          <div class="relative min-w-0 flex-1">
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              class="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            >
              <path
                fill-rule="evenodd"
                d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z"
                clip-rule="evenodd"
              />
            </svg>
            <input
              id="no-job"
              v-model.trim="noJob"
              :disabled="busy"
              required
              aria-label="Nomor Job Order"
              class="input mt-0 pl-10"
              placeholder="Nomor Job Order"
            />
          </div>
          <button :disabled="busy" class="btn btn-primary px-6">
            <span v-if="loading" class="spinner" aria-hidden="true" />
            {{ loading ? 'Memuat...' : 'Cari Job' }}
          </button>
        </form>
      </section>

      <section v-if="job" class="card">
        <div class="card-header flex items-center gap-3">
          <span class="grid size-8 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">2</span>
          <div>
            <h2 class="card-title">Ringkasan Kendaraan / Kapal</h2>
            <p class="text-sm text-slate-500">Data dari Job Order yang ditemukan.</p>
          </div>
        </div>
        <dl class="grid gap-3 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
          <div
            v-for="item in jobSummary"
            :key="item.label"
            class="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3"
          >
            <dt class="meta-label">{{ item.label }}</dt>
            <dd class="mt-1 break-words text-sm font-semibold text-slate-900">{{ item.value }}</dd>
          </div>
        </dl>
      </section>

      <section v-if="job" class="card">
        <div class="card-header flex items-center gap-3">
          <span class="grid size-8 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">3</span>
          <div>
            <h2 class="card-title">Data Transaksi Gate</h2>
            <p class="text-sm text-slate-500">Lengkapi data Gate In dan Gate Out sebelum mengirim.</p>
          </div>
        </div>

        <form class="space-y-6 p-5 sm:p-6" @submit.prevent="submit">
          <fieldset :disabled="busy" class="grid gap-5 md:grid-cols-2">
            <section class="space-y-4 rounded-xl border border-brand-100 bg-brand-50/60 p-5">
              <h3 class="flex items-center gap-2 text-sm font-semibold text-brand-900">
                <span class="size-2 rounded-full bg-brand-600" aria-hidden="true" />
                Gate In
              </h3>
              <label class="field-label">
                Tanggal In
                <input v-model="gateInDate" type="datetime-local" required class="input" />
              </label>
              <label class="field-label">
                Berat In (kg)
                <input
                  ref="gateInWeightInput"
                  v-model="beratIn"
                  @keydown="numberOnly"
                  type="number"
                  min="0"
                  step="any"
                  required
                  placeholder="0"
                  class="input text-right tabular-nums"
                />
              </label>
            </section>

            <section class="space-y-4 rounded-xl border border-emerald-100 bg-emerald-50/60 p-5">
              <h3 class="flex items-center gap-2 text-sm font-semibold text-emerald-900">
                <span class="size-2 rounded-full bg-emerald-600" aria-hidden="true" />
                Gate Out
              </h3>
              <label class="field-label">
                Tanggal Out
                <input v-model="gateOutDate" type="datetime-local" required class="input" />
              </label>
              <div class="grid grid-cols-2 gap-3">
                <label class="field-label">
                  Berat Out (kg)
                  <input
                    v-model="beratOut"
                    @keydown="numberOnly"
                    type="number"
                    min="0"
                    step="any"
                    required
                    placeholder="0"
                    class="input text-right tabular-nums"
                  />
                </label>
                <label class="field-label">
                  Colli
                  <input
                    v-model.number="colli"
                    @keydown="numberOnly"
                    type="number"
                    min="0"
                    step="1"
                    required
                    class="input text-right tabular-nums"
                  />
                </label>
              </div>
            </section>
          </fieldset>

          <div class="flex flex-col gap-4 border-t border-slate-100 pt-6 sm:flex-row sm:items-center">
            <div class="flex flex-1 items-baseline gap-2 rounded-xl bg-slate-900 px-5 py-3.5 text-white">
              <span class="text-xs font-medium uppercase tracking-wide text-slate-400">Netto</span>
              <strong class="text-2xl font-bold tabular-nums">
                {{ netto == null ? '—' : netto.toLocaleString('id-ID', { maximumFractionDigits: 10 }) }}
              </strong>
              <span class="text-sm text-slate-400">kg</span>
              <span v-if="netto == null" class="ml-auto text-xs text-slate-400">isi berat In dan Out</span>
            </div>
            <button :disabled="busy" class="btn btn-success px-6 py-3.5">
              <span v-if="sending" class="spinner" aria-hidden="true" />
              {{ sending ? 'Mengirim...' : 'Kirim Transaksi Gate' }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </main>
</template>
