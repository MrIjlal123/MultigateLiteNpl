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
  form.kuotaTruck = null
}

function selectVessel(vessel: VesselDeliveryData) {
  activeVessel.value = vessel
  form.startDate = ''
  form.endDate = ''
  form.customerCode = ''
  form.customerName = ''
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

  const payload: BookingSlotPayload[] = [
    {
      startDate: formatDateTime(form.startDate),
      endDate: formatDateTime(form.endDate),
      noPkk: vesselBookingPkk(activeVessel.value),
      customerCode: form.customerCode.trim(),
      customerName: form.customerName.trim(),
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
  <main class="min-h-[calc(100vh-4rem)] bg-slate-100 p-4 sm:p-6">
    <div class="mx-auto max-w-7xl">
      <div class="mb-6">
        <p class="text-sm font-semibold uppercase tracking-wide text-blue-700">Operasional Pelabuhan</p>
        <h1 class="mt-1 text-2xl font-bold text-slate-900">Booking Slot</h1>
        <p class="mt-1 text-sm text-slate-500">Atur jadwal dan kuota truk untuk kegiatan vessel delivery.</p>
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
            <h2 class="text-lg font-bold text-slate-900">Daftar Kegiatan Vessel Delivery</h2>
            <p class="mt-1 text-sm text-slate-500">Cari kegiatan berdasarkan nomor PKK.</p>
            <form class="mt-4 flex gap-2" @submit.prevent="loadVessels">
              <input
                v-model="noPkkSearch"
                type="search"
                placeholder="No. PKK"
                aria-label="Cari berdasarkan No. PKK"
                class="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
              <button
                type="submit"
                :disabled="busy()"
                class="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {{ loading ? 'Memuat...' : 'Cari' }}
              </button>
            </form>
          </header>

          <div v-if="loading && !vessels.length" class="p-8 text-center text-sm text-slate-500">
            Memuat daftar kegiatan...
          </div>
          <div v-else-if="!vessels.length" class="p-8 text-center text-sm text-slate-500">
            Tidak ada kegiatan vessel delivery yang ditemukan.
          </div>
          <div v-else class="divide-y divide-slate-100">
            <article
              v-for="(vessel, index) in vessels"
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
                    <dd class="mt-0.5 break-words text-slate-800">{{ vesselBookingPkk(vessel) || '-' }}</dd>
                  </div>
                  <div>
                    <dt class="text-xs font-medium text-slate-500">No. SPMK</dt>
                    <dd class="mt-0.5 break-words text-slate-800">{{ vessel.noSpmk || '-' }}</dd>
                  </div>
                  <div class="col-span-2">
                    <dt class="text-xs font-medium text-slate-500">Kegiatan</dt>
                    <dd class="mt-0.5 text-slate-800">{{ vessel.nmKegiatan || '-' }}</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  :disabled="busy()"
                  class="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400"
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
            <h2 class="text-lg font-bold text-slate-900">Form Booking Slot</h2>
            <dl class="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div class="col-span-2">
                <dt class="text-xs text-slate-500">Nama Kapal</dt>
                <dd class="mt-0.5 font-semibold text-slate-800">{{ activeVessel.nmKapal || '-' }}</dd>
              </div>
              <div>
                <dt class="text-xs text-slate-500">No. PKK</dt>
                <dd class="mt-0.5 font-semibold text-slate-800">{{ vesselBookingPkk(activeVessel) || '-' }}</dd>
              </div>
              <div>
                <dt class="text-xs text-slate-500">No. SPMK</dt>
                <dd class="mt-0.5 font-semibold text-slate-800">{{ activeVessel.noSpmk || '-' }}</dd>
              </div>
            </dl>
          </header>

          <form class="space-y-4 p-5 sm:p-6" @submit.prevent="submitBooking">
            <fieldset :disabled="busy()" class="space-y-4 disabled:opacity-70">
              <label class="block text-sm font-medium text-slate-700">
                Tanggal Awal Kegiatan <span class="text-red-600">*</span>
                <input
                  v-model="form.startDate"
                  type="datetime-local"
                  class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label class="block text-sm font-medium text-slate-700">
                Tanggal Akhir Kegiatan <span class="text-red-600">*</span>
                <input
                  v-model="form.endDate"
                  type="datetime-local"
                  class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label class="block text-sm font-medium text-slate-700">
                Kode Pelanggan <span class="text-red-600">*</span>
                <input
                  v-model="form.customerCode"
                  type="text"
                  class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label class="block text-sm font-medium text-slate-700">
                Nama Pelanggan <span class="text-red-600">*</span>
                <input
                  v-model="form.customerName"
                  type="text"
                  class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label class="block text-sm font-medium text-slate-700">
                Kuota Truk <span class="text-red-600">*</span>
                <input
                  v-model.number="form.kuotaTruck"
                  type="number"
                  step="1"
                  class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
              </label>
            </fieldset>

            <button
              type="submit"
              :disabled="busy()"
              class="w-full rounded-lg bg-emerald-600 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {{ sending ? 'Mengirim...' : 'Kirim Jadwal Truk' }}
            </button>
          </form>
        </section>

        <aside
          v-else
          class="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center text-sm text-slate-500"
        >
          Pilih kegiatan dan tekan <strong>Proses</strong> untuk membuka form booking slot.
        </aside>
      </div>
    </div>
  </main>
</template>
