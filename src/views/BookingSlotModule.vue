<script setup lang="ts">
import axios from 'axios'
import { onMounted, reactive, ref } from 'vue'
import api from '@/services/api'

interface VesselDeliveryBarang {
  noSeq?: number | string
  mbrgKode?: string
  mbrgNama?: string
  noBlAwb?: string
  consignee?: string
  [key: string]: unknown
}

interface VesselDeliveryGudang {
  gudlapId?: string
  gudlapNama?: string
  kdGudlapD?: string
  nmGudlapD?: string
  tipePenumpukan?: string
}

interface VesselDeliveryData {
  id?: string | number
  noPpk?: string | null
  noPkk?: string | null
  destinationCode?: string | null
  destinationName?: string | null
  noSpmk: string
  nmKapal: string
  nmKegiatan: string
  barang: VesselDeliveryBarang[]
  gudang: VesselDeliveryGudang[]
  [key: string]: unknown
}

interface BookingSlotPayload {
  startDate: string
  endDate: string
  noPkk: string
  customerCode: string
  customerName: string
  destinationCode: string
  destinationName: string
  kuotaTruck: number | null
  programName: 'NPL'
}

interface ApiResponse<T> {
  status?: string
  message?: string
  data?: T
  results?: Array<{ message?: string }>
}

const noPkkSearch = ref('')
const vessels = ref<VesselDeliveryData[]>([])
const activeVessel = ref<VesselDeliveryData | null>(null)
const loading = ref(false)
const sending = ref(false)
const error = ref('')
const success = ref('')

const form = reactive({
  startDate: '',
  endDate: '',
  customerCode: '',
  customerName: '',
  destinationCode: '',
  destinationName: '',
  kuotaTruck: null as number | null,
})

const busy = () => loading.value || sending.value

function responseMessage(response: unknown, fallback: string) {
  if (!response || typeof response !== 'object') return fallback

  const body = response as ApiResponse<unknown>
  const resultMessage = body.results?.find((result) => result.message)?.message
  return resultMessage || body.message || fallback
}

function apiErrorMessage(requestError: unknown) {
  if (axios.isAxiosError(requestError)) {
    return responseMessage(requestError.response?.data, requestError.message)
  }
  return requestError instanceof Error
    ? requestError.message
    : 'Terjadi kesalahan yang tidak diketahui.'
}

function formatDateTime(value: string) {
  const dateTime = value.replace('T', ' ')
  return dateTime.length === 16 ? `${dateTime}:00` : dateTime
}

function vesselBookingPkk(vessel: VesselDeliveryData) {
  return vessel.noPkk?.trim() || vessel.noPpk?.trim() || ''
}

function resetForm() {
  activeVessel.value = null
  form.startDate = ''
  form.endDate = ''
  form.customerCode = ''
  form.customerName = ''
  form.destinationCode = ''
  form.destinationName = ''
  form.kuotaTruck = null
}

function selectVessel(vessel: VesselDeliveryData) {
  activeVessel.value = vessel
  form.startDate = ''
  form.endDate = ''
  form.customerCode = ''
  form.customerName = ''
  form.destinationCode = vessel.destinationCode?.trim() || ''
  form.destinationName = vessel.destinationName?.trim() || ''
  form.kuotaTruck = null
  error.value = ''
  success.value = ''
}

async function loadVessels() {
  loading.value = true
  error.value = ''
  try {
    const { data } = await api.post<ApiResponse<VesselDeliveryData[]>>(
      '/getDataVesselDeliveryPtosm',
      { noPkk: noPkkSearch.value.trim(), page: 1, size: 50 },
    )
    if (data.status === 'E') {
      throw new Error(responseMessage(data, 'Gagal mengambil daftar kegiatan vessel delivery.'))
    }
    if (!Array.isArray(data.data)) {
      throw new Error(responseMessage(data, 'Format data vessel delivery dari server tidak valid.'))
    }
    vessels.value = data.data
  } catch (requestError) {
    error.value = apiErrorMessage(requestError)
  } finally {
    loading.value = false
  }
}

async function submitBooking() {
  if (!activeVessel.value || busy()) return

  const destinationCode = form.destinationCode.trim()
  const destinationName = form.destinationName.trim()
  if (!destinationCode || !destinationName) {
    error.value = 'Kode dan nama tujuan wajib diisi.'
    success.value = ''
    return
  }

  const payload: BookingSlotPayload[] = [
    {
      startDate: formatDateTime(form.startDate),
      endDate: formatDateTime(form.endDate),
      noPkk: vesselBookingPkk(activeVessel.value),
      customerCode: form.customerCode.trim(),
      customerName: form.customerName.trim(),
      destinationCode,
      destinationName,
      kuotaTruck: form.kuotaTruck,
      programName: 'NPL',
    },
  ]

  sending.value = true
  error.value = ''
  success.value = ''
  try {
    const { data } = await api.post<ApiResponse<unknown>>(
      '/sendDataJadwalTruckPtosm',
      payload,
    )
    if (data.status !== 'S') {
      throw new Error(responseMessage(data, 'Booking slot gagal dikirim.'))
    }
    const successMessage = data.message || 'Booking slot berhasil dikirim.'
    resetForm()
    await loadVessels()
    success.value = successMessage
  } catch (requestError) {
    error.value = apiErrorMessage(requestError)
  } finally {
    sending.value = false
  }
}

onMounted(loadVessels)
</script>

<template>
  <main class="page">
    <div class="mx-auto max-w-7xl space-y-6">
      <div>
        <p class="page-eyebrow">Operasional Pelabuhan</p>
        <h1 class="page-title">Booking Slot</h1>
        <p class="page-subtitle">Atur jadwal dan kuota truk untuk kegiatan vessel delivery.</p>
      </div>

      <p v-if="success" role="status" class="alert-success">{{ success }}</p>
      <p v-if="error" role="alert" class="alert-error">{{ error }}</p>

      <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <section class="card">
          <header class="card-header">
            <div class="flex items-center justify-between gap-3">
              <h2 class="card-title">Kegiatan Vessel Delivery</h2>
              <span class="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                {{ vessels.length }} data
              </span>
            </div>
            <form class="mt-4 flex gap-2" @submit.prevent="loadVessels">
              <input
                v-model="noPkkSearch"
                type="search"
                placeholder="Cari No. PKK"
                aria-label="Cari berdasarkan No. PKK"
                class="input mt-0 min-w-0 flex-1"
              />
              <button type="submit" :disabled="busy()" class="btn btn-primary px-5">
                <span v-if="loading" class="spinner" aria-hidden="true" />
                {{ loading ? 'Memuat' : 'Cari' }}
              </button>
            </form>
          </header>

          <div v-if="loading && !vessels.length" class="empty-state">
            <span class="spinner size-6 text-brand-600" aria-hidden="true" />
            Memuat daftar kegiatan...
          </div>
          <div v-else-if="!vessels.length" class="empty-state">
            Tidak ada kegiatan vessel delivery yang ditemukan.
          </div>
          <ul v-else class="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto">
            <li
              v-for="(vessel, index) in vessels"
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
                  <dl class="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                    <div>
                      <dt class="meta-label">No. PPK</dt>
                      <dd class="meta-value">{{ vessel.noPpk || '-' }}</dd>
                    </div>
                    <div>
                      <dt class="meta-label">No. PKK</dt>
                      <dd class="meta-value">{{ vesselBookingPkk(vessel) || '-' }}</dd>
                    </div>
                    <div>
                      <dt class="meta-label">No. SPMK</dt>
                      <dd class="meta-value">{{ vessel.noSpmk || '-' }}</dd>
                    </div>
                    <div>
                      <dt class="meta-label">Kode Tujuan</dt>
                      <dd class="meta-value">{{ vessel.destinationCode || '-' }}</dd>
                    </div>
                    <div>
                      <dt class="meta-label">Nama Tujuan</dt>
                      <dd class="meta-value">{{ vessel.destinationName || '-' }}</dd>
                    </div>
                  </dl>
                </div>
                <button
                  type="button"
                  :disabled="busy()"
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
            <h2 class="card-title">Form Booking Slot</h2>
            <dl class="mt-3 grid grid-cols-2 gap-3">
              <div class="col-span-2">
                <dt class="meta-label">Nama Kapal</dt>
                <dd class="meta-value font-semibold">{{ activeVessel.nmKapal || '-' }}</dd>
              </div>
              <div>
                <dt class="meta-label">No. PKK</dt>
                <dd class="meta-value font-semibold">{{ vesselBookingPkk(activeVessel) || '-' }}</dd>
              </div>
              <div>
                <dt class="meta-label">No. SPMK</dt>
                <dd class="meta-value font-semibold">{{ activeVessel.noSpmk || '-' }}</dd>
              </div>
            </dl>
          </header>

          <form class="space-y-5 p-5 sm:p-6" @submit.prevent="submitBooking">
            <fieldset :disabled="busy()" class="space-y-4 disabled:opacity-70">
              <div class="grid gap-3 sm:grid-cols-2">
                <label class="field-label">
                  Tanggal Awal <span class="text-red-600">*</span>
                  <input v-model="form.startDate" type="datetime-local" class="input" />
                </label>
                <label class="field-label">
                  Tanggal Akhir <span class="text-red-600">*</span>
                  <input v-model="form.endDate" type="datetime-local" class="input" />
                </label>
              </div>

              <div class="grid gap-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                <label class="field-label">
                  Kode Pelanggan <span class="text-red-600">*</span>
                  <input v-model="form.customerCode" type="text" class="input" />
                </label>
                <label class="field-label">
                  Nama Pelanggan <span class="text-red-600">*</span>
                  <input v-model="form.customerName" type="text" class="input" />
                </label>
              </div>

              <div class="grid gap-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                <label class="field-label">
                  Kode Tujuan <span class="text-red-600">*</span>
                  <input v-model="form.destinationCode" type="text" required class="input" />
                </label>
                <label class="field-label">
                  Nama Tujuan <span class="text-red-600">*</span>
                  <input v-model="form.destinationName" type="text" required class="input" />
                </label>
              </div>

              <label class="field-label">
                Kuota Truk <span class="text-red-600">*</span>
                <input
                  v-model.number="form.kuotaTruck"
                  type="number"
                  step="1"
                  class="input text-right tabular-nums"
                />
              </label>
            </fieldset>

            <button type="submit" :disabled="busy()" class="btn btn-success w-full py-3">
              <span v-if="sending" class="spinner" aria-hidden="true" />
              {{ sending ? 'Mengirim...' : 'Kirim Jadwal Truk' }}
            </button>
          </form>
        </section>

        <aside
          v-else
          class="empty-state rounded-2xl border-2 border-dashed border-slate-300 bg-white/50 lg:sticky lg:top-24"
        >
          <p>Pilih kegiatan dan tekan <strong class="text-slate-700">Proses</strong> untuk membuka form booking slot.</p>
        </aside>
      </div>
    </div>
  </main>
</template>
