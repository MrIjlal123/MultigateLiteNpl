<script setup lang="ts">
import axios from 'axios'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import api from '@/services/api'
import { showError, showSuccess } from '@/utils/feedback'

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
watch(error, (message) => { if (message) void showError(message) })
watch(success, (message) => { if (message) void showSuccess(message) })

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
  <main class="page">
    <div class="mx-auto max-w-7xl space-y-6">
      <div>
        <p class="page-eyebrow">Operasional Pelabuhan</p>
        <h1 class="page-title">Receiving</h1>
        <p class="page-subtitle">Daftar kegiatan vessel dan pengiriman realisasi receiving.</p>
      </div>

      <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <section class="card">
          <header class="card-header">
            <div class="flex items-center justify-between gap-3">
              <h2 class="card-title">Kegiatan Vessel Receiving</h2>
              <span class="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                {{ receivingItems.length }} data
              </span>
            </div>
            <form class="mt-4 flex gap-2" @submit.prevent="loadReceiving">
              <input
                v-model="noPkkSearch"
                type="search"
                placeholder="Cari No. PKK"
                aria-label="Cari berdasarkan No. PKK"
                class="input mt-0 min-w-0 flex-1"
              />
              <button :disabled="loading" class="btn btn-primary px-5">
                <span v-if="loading" class="spinner" aria-hidden="true" />
                {{ loading ? 'Memuat' : 'Cari' }}
              </button>
            </form>
          </header>

          <div v-if="loading && !receivingItems.length" class="empty-state">
            <span class="spinner size-6 text-brand-600" aria-hidden="true" />
            Memuat daftar kegiatan...
          </div>
          <div v-else-if="!receivingItems.length" class="empty-state">
            Tidak ada kegiatan receiving yang ditemukan.
          </div>
          <ul v-else class="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto">
            <li
              v-for="(vessel, index) in receivingItems"
              :key="vessel.id ?? `${vessel.noSpmk}-${index}`"
              class="border-l-4 px-5 py-4 transition sm:px-6"
              :class="
                activeVessel === vessel
                  ? 'border-brand-600 bg-brand-50/60'
                  : 'border-transparent hover:bg-slate-50'
              "
            >
              <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div class="min-w-0 flex-1">
                  <p class="font-semibold text-slate-900">{{ vessel.nmKapal || '-' }}</p>
                  <p class="mt-0.5 text-sm text-slate-500">{{ vessel.nmKegiatan || '-' }}</p>
                  <dl class="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                    <div>
                      <dt class="meta-label">No. PPK</dt>
                      <dd class="meta-value">{{ vessel.noPpk || '-' }}</dd>
                    </div>
                    <div>
                      <dt class="meta-label">No. PKK</dt>
                      <dd class="meta-value">{{ vessel.noPkk || '-' }}</dd>
                    </div>
                    <div>
                      <dt class="meta-label">No. SPMK</dt>
                      <dd class="meta-value">{{ vessel.noSpmk || '-' }}</dd>
                    </div>
                    <div>
                      <dt class="meta-label">Siklus</dt>
                      <dd class="meta-value">{{ vessel.siklus ?? '-' }}</dd>
                    </div>
                  </dl>
                </div>
                <button
                  type="button"
                  class="btn shrink-0 px-4 py-2"
                  :class="activeVessel === vessel ? 'btn-ghost' : 'btn-primary'"
                  @click="selectVessel(vessel)"
                >
                  {{ activeVessel === vessel ? 'Dipilih' : 'Proses' }}
                </button>
              </div>
            </li>
          </ul>
        </section>

        <section v-if="activeVessel" class="card lg:sticky lg:top-24">
          <header class="card-header bg-slate-50/70">
            <h2 class="card-title">Form Realisasi Receiving</h2>
            <dl class="mt-3 grid grid-cols-2 gap-3">
              <div>
                <dt class="meta-label">Nama Kapal</dt>
                <dd class="meta-value font-semibold">{{ activeVessel.nmKapal || '-' }}</dd>
              </div>
              <div>
                <dt class="meta-label">No. SPMK</dt>
                <dd class="meta-value font-semibold">{{ activeVessel.noSpmk || '-' }}</dd>
              </div>
            </dl>
          </header>

          <form class="space-y-4 p-5 sm:p-6" @submit.prevent="submitReceiving">
            <label class="field-label">
              Nomor BL <span class="text-red-600">*</span>
              <select v-model="form.noBlAwb" required class="input">
                <option disabled value="">Pilih Nomor BL</option>
                <option v-for="barang in activeVessel.barang" :key="barang.noBlAwb" :value="barang.noBlAwb">
                  {{ barang.noBlAwb }} — {{ barang.mbrgNama || 'Nama barang tidak tersedia' }}
                </option>
              </select>
            </label>

            <div class="grid grid-cols-2 gap-3">
              <label class="field-label">
                Jumlah (Tonase) <span class="text-red-600">*</span>
                <input
                  v-model.number="form.jumlah"
                  type="number"
                  min="0"
                  step="any"
                  required
                  class="input text-right tabular-nums"
                />
              </label>
              <label class="field-label">
                Colli <span class="text-red-600">*</span>
                <input
                  v-model.number="form.colli"
                  type="number"
                  min="0"
                  step="1"
                  required
                  class="input text-right tabular-nums"
                />
              </label>
            </div>

            <label class="field-label">
              Tanggal Realisasi <span class="text-red-600">*</span>
              <input v-model="form.tglRls" type="datetime-local" required class="input" />
            </label>

            <label class="field-label">
              Gudang &amp; Blok <span class="text-red-600">*</span>
              <select v-model="form.gudangIndex" required class="input">
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

            <label class="field-label">
              Keterangan
              <textarea v-model="form.keterangan" rows="3" class="input resize-y" />
            </label>

            <p
              v-if="!activeVessel.barang.length || !activeVessel.gudang.length"
              class="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
            >
              Data BL atau gudang tidak tersedia untuk kegiatan ini.
            </p>
            <button
              :disabled="busy || !activeVessel.barang.length || !activeVessel.gudang.length"
              class="btn btn-success w-full py-3"
            >
              <span v-if="sending" class="spinner" aria-hidden="true" />
              {{ sending ? 'Mengirim...' : 'Kirim Realisasi' }}
            </button>
          </form>
        </section>

        <aside
          v-else
          class="empty-state rounded-2xl border-2 border-dashed border-slate-300 bg-white/50 lg:sticky lg:top-24"
        >
          <p>Pilih kegiatan dan tekan <strong class="text-slate-700">Proses</strong> untuk membuka form realisasi.</p>
        </aside>
      </div>
    </div>
  </main>
</template>
