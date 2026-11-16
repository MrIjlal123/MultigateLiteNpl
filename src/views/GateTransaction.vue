<script setup lang="ts">
import axios from 'axios'
import { computed, nextTick, ref } from 'vue'
import api from '@/services/api'

type Mode = 'in' | 'out'
type RecordData = Record<string, unknown>
type ApiResponse = { status?: string; message?: string; data?: RecordData[] }
type GatePayload = {
  noSpmk: string
  noJob: string
  noBlAwb: string
  platNo: string
  gateInDate: string
  beratIn: number
  gateOutDate?: string
  beratOut?: number
  netto?: number
  colli: number
}

const mode = ref<Mode>('in')
const noJob = ref('')
const job = ref<RecordData | null>(null)
const weight = ref('')
const loading = ref(false)
const sending = ref(false)
const error = ref('')
const success = ref('')
const weightInput = ref<HTMLInputElement | null>(null)
const busy = computed(() => loading.value || sending.value)
const beratIn = computed(() => Number(read(job.value, ['beratIn', 'BERAT_IN', 'berat_in'])) || 0)
const netto = computed(() => Math.abs(beratIn.value - Number(weight.value || 0)))

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
function asNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
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
function reset() {
  noJob.value = ''
  job.value = null
  weight.value = ''
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
    await nextTick()
    weightInput.value?.focus()
  } catch (e) {
    error.value = axios.isAxiosError(e)
      ? (e.response?.data as ApiResponse)?.message || e.message
      : (e as Error).message
  } finally {
    loading.value = false
  }
}
async function submit() {
  if (!job.value || !weight.value || busy.value) return
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  const gateDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  sending.value = true
  error.value = ''
  success.value = ''
  const items = inspections(job.value)
  const payloadItems: (RecordData | null)[] = items.length ? items : [null]
  const payload: GatePayload[] = payloadItems.map((inspeksi) => ({
    noSpmk: asString(read(job.value, ['noSpmk'])),
    noJob: asString(read(job.value, ['noJob']) ?? noJob.value),
    noBlAwb: asString(read(inspeksi, ['noBlAwb'])),
    platNo: asString(read(job.value, ['platNo'])),
    gateInDate:
      mode.value === 'in' ? gateDate : asString(read(job.value, ['gateInDate'])),
    beratIn: mode.value === 'in' ? asNumber(weight.value) : beratIn.value,
    ...(mode.value === 'out'
      ? {
          gateOutDate: gateDate,
          beratOut: asNumber(weight.value),
          netto: Math.abs(beratIn.value - Number(weight.value)),
        }
      : {}),
    colli: asNumber(read(inspeksi, ['colli']) ?? read(job.value, ['colli'])),
  }))
  try {
    const { data } = await api.post<ApiResponse>('/sendDataGatePtosm', payload)
    if (data.status === 'E') throw new Error(message(data))
    reset()
    success.value =
      data.message || `Data Gate ${mode.value === 'in' ? 'In' : 'Out'} berhasil dikirim.`
  } catch (e) {
    error.value = axios.isAxiosError(e)
      ? (e.response?.data as ApiResponse)?.message || e.message
      : (e as Error).message
  } finally {
    sending.value = false
  }
}
function numberOnly(e: KeyboardEvent) {
  if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault()
}
</script>

<template>
  <main class="min-h-screen bg-slate-100 p-4 sm:p-8">
    <section
      class="mx-auto max-w-3xl overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200"
    >
      <header class="bg-blue-700 px-6 py-5 text-white">
        <div>
          <h1 class="text-xl font-bold">Port Gate Operation</h1>
          <p class="text-sm text-blue-100">Transaksi Gate In &amp; Gate Out</p>
        </div>
      </header>
      <div class="p-6">
        <div class="mb-6 grid grid-cols-2 rounded-lg bg-slate-100 p-1">
          <button
            @click="
              mode = 'in';
              reset()
            "
            :disabled="busy"
            :class="mode === 'in' ? 'bg-white text-blue-700 shadow' : ''"
            class="rounded-md py-2 font-semibold"
          >
            Gate In</button
          ><button
            @click="
              mode = 'out';
              reset()
            "
            :disabled="busy"
            :class="mode === 'out' ? 'bg-white text-emerald-700 shadow' : ''"
            class="rounded-md py-2 font-semibold"
          >
            Gate Out
          </button>
        </div>
        <p
          v-if="success"
          role="status"
          class="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700"
        >
          {{ success }}
        </p>
        <p v-if="error" role="alert" class="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {{ error }}
        </p>
        <form class="flex gap-3" @submit.prevent="lookup">
          <input
            id="no-job"
            v-model="noJob"
            :disabled="busy"
            required
            class="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5"
            placeholder="Nomor Job Order"
          /><button
            :disabled="busy"
            class="rounded-lg bg-blue-700 px-5 font-semibold text-white disabled:bg-slate-300"
          >
            {{ loading ? 'Memuat...' : 'Cari' }}
          </button>
        </form>
        <div v-if="job" class="mt-6">
          <dl class="mb-5 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-4 text-sm">
            <template v-for="(value, key) in job" :key="String(key)"
              ><dt class="text-slate-500">{{ key }}</dt>
              <dd class="font-medium">{{ value }}</dd></template
            >
          </dl>
          <form @submit.prevent="submit">
            <label class="block text-sm font-medium"
              >Berat {{ mode === 'in' ? 'In' : 'Out' }} (kg)<input
                ref="weightInput"
                v-model="weight"
                @keydown="numberOnly"
                type="number"
                min="0"
                required
                class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"
            /></label>
            <p
              v-if="mode === 'out'"
              class="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"
            >
              Netto: <strong>{{ netto.toLocaleString('id-ID') }} kg</strong>
            </p>
            <button
              :disabled="busy"
              class="mt-5 w-full rounded-lg bg-emerald-600 py-3 font-semibold text-white disabled:bg-slate-300"
            >
              {{ sending ? 'Mengirim...' : `Submit Gate ${mode === 'in' ? 'In' : 'Out'}` }}
            </button>
          </form>
        </div>
      </div>
    </section>
  </main>
</template>
