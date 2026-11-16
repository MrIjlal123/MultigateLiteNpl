<script setup lang="ts">
import axios from 'axios'
import { computed, onMounted, reactive, ref } from 'vue'
import api from '@/services/api'

interface Barang {
  noSeq?: number | string
  mbrgKode?: string
  mbrgNama?: string
  noBlAwb: string
  consignee?: string
  [key: string]: unknown
}

interface Gudang {
  gudlapId: string
  gudlapNama: string
  kdGudlapD: string
  nmGudlapD: string
  tipePenumpukan?: string
}

interface VesselReceivingData {
  id?: string | number
  noPpk: string
  noPkk: string
  noSpmk: string
  nmKapal: string
  nmKegiatan?: string
  siklus?: string | number
  barang: Barang[]
  gudang: Gudang[]
}

interface ReceivingPayload {
  noSpmk: string
  jumlah: number
  colli: number
  gudlapId: string
  kdGudlapD: string
  tglRls: string
  noBlAwb: string
  keterangan: string
  programName: 'NPL'
}

interface ApiResponse<T> {
  status?: string
  message?: string
  data?: T
}

const noPkkSearch = ref('')
const receivingItems = ref<VesselReceivingData[]>([])
const activeVessel = ref<VesselReceivingData | null>(null)
const loading = ref(false)
const sending = ref(false)
const error = ref('')
const success = ref('')

function currentDateTimeLocal() {
  const now = new Date()
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 16)
}

const form = reactive({
  noBlAwb: '',
  jumlah: null as number | null,
  colli: null as number | null,
  tglRls: currentDateTimeLocal(),
  gudangIndex: '',
  keterangan: 'Realisasi dari NPL',
})

const selectedGudang = computed(() => {
  if (!form.gudangIndex) return undefined
  const index = Number(form.gudangIndex)
  return activeVessel.value?.gudang.find((_, itemIndex) => itemIndex === index)
})
const busy = computed(() => loading.value || sending.value)

function apiErrorMessage(errorValue: unknown) {
  if (axios.isAxiosError(errorValue)) {
    const responseData: unknown = errorValue.response?.data
    if (responseData && typeof responseData === 'object' && 'message' in responseData) {
      const message = (responseData as { message?: unknown }).message
      if (typeof message === 'string' && message) return message
    }
    return errorValue.message
  }
  return errorValue instanceof Error ? errorValue.message : 'Terjadi kesalahan yang tidak diketahui.'
}

function resetForm() {
  activeVessel.value = null
  form.noBlAwb = ''
  form.jumlah = null
  form.colli = null
  form.tglRls = currentDateTimeLocal()
  form.gudangIndex = ''
  form.keterangan = 'Realisasi dari NPL'
}

function selectVessel(vessel: VesselReceivingData) {
  activeVessel.value = vessel
  form.noBlAwb = ''
  form.jumlah = null
  form.colli = null
  form.tglRls = currentDateTimeLocal()
  form.gudangIndex = ''
  form.keterangan = 'Realisasi dari NPL'
  error.value = ''
  success.value = ''
}

async function loadReceiving() {
  loading.value = true
  error.value = ''
  success.value = ''
  try {
    const { data } = await api.post<ApiResponse<VesselReceivingData[]>>(
      '/getDataVesselReceivingPtosm',
      { noPkk: noPkkSearch.value.trim(), page: 1, size: 50 },
    )
    if (data.status === 'E') throw new Error(data.message || 'Gagal mengambil daftar receiving.')
    if (!Array.isArray(data.data)) {
      throw new Error(data.message || 'Format data receiving dari server tidak valid.')
    }
    receivingItems.value = data.data
  } catch (requestError) {
    error.value = apiErrorMessage(requestError)
  } finally {
    loading.value = false
  }
}

async function submitReceiving() {
  if (!activeVessel.value || !selectedGudang.value || !form.noBlAwb) return
  if (form.jumlah == null || form.colli == null || !form.tglRls || sending.value) return

  const realizationDate = form.tglRls.replace('T', ' ')
  const payload: ReceivingPayload[] = [
    {
      noSpmk: activeVessel.value.noSpmk,
      jumlah: form.jumlah,
      colli: form.colli,
      gudlapId: selectedGudang.value.gudlapId,
      kdGudlapD: selectedGudang.value.kdGudlapD,
      tglRls: realizationDate.length === 16 ? `${realizationDate}:00` : realizationDate,
      noBlAwb: form.noBlAwb,
      keterangan: form.keterangan,
      programName: 'NPL',
    },
  ]

  sending.value = true
  error.value = ''
  success.value = ''
  try {
    const { data } = await api.post<ApiResponse<unknown>>(
      '/sendDataRealisasiReceivingPtosm',
      payload,
    )
    if (data.status !== 'S') {
      throw new Error(data.message || 'Realisasi receiving gagal dikirim.')
    }
    const successMessage = data.message || 'Realisasi receiving berhasil dikirim.'
    resetForm()
    await loadReceiving()
    success.value = successMessage
  } catch (requestError) {
    error.value = apiErrorMessage(requestError)
  } finally {
    sending.value = false
  }
}

onMounted(loadReceiving)
</script>

<template>
  <main class="min-h-[calc(100vh-4rem)] bg-slate-100 p-4 sm:p-6">
    <div class="mx-auto max-w-7xl">
      <div class="mb-6">
        <p class="text-sm font-semibold uppercase tracking-wide text-blue-700">Operasional Pelabuhan</p>
        <h1 class="mt-1 text-2xl font-bold text-slate-900">Receiving Module</h1>
        <p class="mt-1 text-sm text-slate-500">Daftar kegiatan vessel dan pengiriman realisasi.</p>
      </div>

      <p v-if="success" role="status" class="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
        {{ success }}
      </p>
      <p v-if="error" role="alert" class="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
        {{ error }}
      </p>

      <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <section class="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <header class="border-b border-slate-200 px-5 py-4 sm:px-6">
            <h2 class="text-lg font-bold text-slate-900">Daftar Kegiatan Vessel Receiving</h2>
            <p class="mt-1 text-sm text-slate-500">Cari kegiatan berdasarkan nomor PKK.</p>
            <form class="mt-4 flex gap-2" @submit.prevent="loadReceiving">
              <input
                v-model="noPkkSearch"
                type="search"
                placeholder="No. PKK"
                class="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
              <button
                :disabled="loading"
                class="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {{ loading ? 'Memuat...' : 'Cari' }}
              </button>
            </form>
          </header>

          <div v-if="loading && !receivingItems.length" class="p-8 text-center text-sm text-slate-500">
            Memuat daftar kegiatan...
          </div>
          <div v-else-if="!receivingItems.length" class="p-8 text-center text-sm text-slate-500">
            Tidak ada kegiatan receiving yang ditemukan.
          </div>
          <div v-else class="divide-y divide-slate-100">
            <article
              v-for="(vessel, index) in receivingItems"
              :key="vessel.id ?? `${vessel.noSpmk}-${index}`"
              class="p-5 transition hover:bg-slate-50 sm:px-6"
            >
              <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <dl class="grid min-w-0 flex-1 grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div class="col-span-2">
                    <dt class="text-xs font-medium text-slate-500">Nama Kapal</dt>
                    <dd class="mt-0.5 font-semibold text-slate-900">{{ vessel.nmKapal || '-' }}</dd>
                  </div>
                  <div>
                    <dt class="text-xs font-medium text-slate-500">No. PPK</dt>
                    <dd class="mt-0.5 break-words text-slate-800">{{ vessel.noPpk || '-' }}</dd>
                  </div>
                  <div>
                    <dt class="text-xs font-medium text-slate-500">No. PKK</dt>
                    <dd class="mt-0.5 break-words text-slate-800">{{ vessel.noPkk || '-' }}</dd>
                  </div>
                  <div>
                    <dt class="text-xs font-medium text-slate-500">No. SPMK</dt>
                    <dd class="mt-0.5 break-words text-slate-800">{{ vessel.noSpmk || '-' }}</dd>
                  </div>
                  <div>
                    <dt class="text-xs font-medium text-slate-500">Siklus</dt>
                    <dd class="mt-0.5 text-slate-800">{{ vessel.siklus ?? '-' }}</dd>
                  </div>
                  <div class="col-span-2">
                    <dt class="text-xs font-medium text-slate-500">Kegiatan</dt>
                    <dd class="mt-0.5 text-slate-800">{{ vessel.nmKegiatan || '-' }}</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  class="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
                  @click="selectVessel(vessel)"
                >
                  Proses
                </button>
              </div>
            </article>
          </div>
        </section>

        <section
          v-if="activeVessel"
          class="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200"
        >
          <header class="border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
            <h2 class="text-lg font-bold text-slate-900">Form Realisasi Receiving</h2>
            <dl class="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt class="text-xs text-slate-500">Nama Kapal</dt>
                <dd class="mt-0.5 font-semibold text-slate-800">{{ activeVessel.nmKapal || '-' }}</dd>
              </div>
              <div>
                <dt class="text-xs text-slate-500">No. SPMK</dt>
                <dd class="mt-0.5 font-semibold text-slate-800">{{ activeVessel.noSpmk || '-' }}</dd>
              </div>
            </dl>
          </header>

          <form class="space-y-4 p-5 sm:p-6" @submit.prevent="submitReceiving">
            <label class="block text-sm font-medium text-slate-700">
              Nomor BL <span class="text-red-600">*</span>
              <select
                v-model="form.noBlAwb"
                required
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              >
                <option disabled value="">Pilih Nomor BL</option>
                <option v-for="barang in activeVessel.barang" :key="barang.noBlAwb" :value="barang.noBlAwb">
                  {{ barang.noBlAwb }} — {{ barang.mbrgNama || 'Nama barang tidak tersedia' }}
                </option>
              </select>
            </label>

            <div class="grid grid-cols-2 gap-3">
              <label class="block text-sm font-medium text-slate-700">
                Jumlah (Tonase) <span class="text-red-600">*</span>
                <input
                  v-model.number="form.jumlah"
                  type="number"
                  min="0"
                  step="any"
                  required
                  class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label class="block text-sm font-medium text-slate-700">
                Colli <span class="text-red-600">*</span>
                <input
                  v-model.number="form.colli"
                  type="number"
                  min="0"
                  step="1"
                  required
                  class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
              </label>
            </div>

            <label class="block text-sm font-medium text-slate-700">
              Tanggal Realisasi <span class="text-red-600">*</span>
              <input
                v-model="form.tglRls"
                type="datetime-local"
                required
                class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <label class="block text-sm font-medium text-slate-700">
              Gudang &amp; Blok
              <select
                v-model="form.gudangIndex"
                required
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              >
                <option disabled value="">Pilih Gudang &amp; Blok</option>
                <option
                  v-for="(gudang, index) in activeVessel.gudang"
                  :key="`${gudang.gudlapId}-${gudang.kdGudlapD}-${index}`"
                  :value="String(index)"
                >
                  {{ gudang.gudlapNama }} — {{ gudang.nmGudlapD }}
                </option>
              </select>
            </label>

            <label class="block text-sm font-medium text-slate-700">
              Keterangan
              <textarea
                v-model="form.keterangan"
                rows="3"
                class="mt-1 w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <button
              :disabled="busy || !activeVessel.barang.length || !activeVessel.gudang.length"
              class="w-full rounded-lg bg-emerald-600 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {{ sending ? 'Mengirim...' : 'Kirim Realisasi' }}
            </button>
            <p
              v-if="!activeVessel.barang.length || !activeVessel.gudang.length"
              class="text-xs text-amber-700"
            >
              Data BL atau gudang tidak tersedia untuk kegiatan ini.
            </p>
          </form>
        </section>

        <aside
          v-else
          class="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center text-sm text-slate-500"
        >
          Pilih kegiatan dan tekan <strong>Proses</strong> untuk membuka form realisasi.
        </aside>
      </div>
    </div>
  </main>
</template>
