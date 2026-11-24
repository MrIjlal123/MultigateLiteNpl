<script setup lang="ts">
import axios from 'axios'
import { onMounted, reactive, ref, watch } from 'vue'
import api from '@/services/api'
import { showError, showSuccess } from '@/utils/feedback'

interface BarangItem {
  noSeq?: number | string
  mbrgKode?: string
  mbrgNama?: string
  noBlAwb: string
  consignee?: string
}

interface GudangItem {
  gudlapId: string
  gudlapNama?: string
  kdGudlapD: string
  nmGudlapD?: string
}

interface VesselDeliveryData {
  id?: string | number
  noPpk?: string | null
  noPkk?: string | null
  noSpmk: string
  nmKapal: string
  nmKegiatan: string
  siklus?: string | number | null
  barang: BarangItem[]
  gudang: GudangItem[]
}

interface DeliveryRealisasiPayload {
  noSpmk: string
  noBlAwb: string
  jumlah: number
  colli: number
  gudlapId: string
  kdGudlapD: string
  tglRls: string
  keterangan: string
  programName: 'NPL'
}

interface DeliveryRealisasiResult {
  rowNumber: number
  message: string
  status: string
}

interface DeliveryRealisasiResponse {
  status?: string
  message?: string
  failedCount?: number
  successCount?: number
  totalCount?: number
  results?: DeliveryRealisasiResult[]
}

interface VesselDeliveryResponse {
  status?: string
  message?: string
  data?: VesselDeliveryData[]
  results?: DeliveryRealisasiResult[]
}

const noPkkSearch = ref('')
const vessels = ref<VesselDeliveryData[]>([])
const activeVessel = ref<VesselDeliveryData | null>(null)
const selectedGudangIndex = ref<number | null>(null)
const loading = ref(false)
const sending = ref(false)
const error = ref('')
const success = ref('')
watch(error, (message) => { if (message) void showError(message) })
watch(success, (message) => { if (message) void showSuccess(message) })

const form = reactive({
  noBlAwb: '',
  jumlah: null as number | null,
  colli: null as number | null,
  gudlapId: '',
  kdGudlapD: '',
  tglRls: currentDateTimeLocal(),
  keterangan: 'Delivery dari NPL',
})

function currentDateTimeLocal() {
  const now = new Date()
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 16)
}

function busy() {
  return loading.value || sending.value
}

function responseMessage(response: unknown, fallback: string) {
  if (!response || typeof response !== 'object') return fallback

  const body = response as DeliveryRealisasiResponse
  const resultMessages = body.results
    ?.map((result) => result.message)
    .filter((message) => Boolean(message))
  if (resultMessages?.length) return resultMessages.join('; ')
  return body.message || fallback
}

function apiErrorMessage(requestError: unknown) {
  if (axios.isAxiosError(requestError)) {
    return responseMessage(requestError.response?.data, requestError.message)
  }
  return requestError instanceof Error
    ? requestError.message
    : 'Terjadi kesalahan yang tidak diketahui.'
}

function vesselBookingPkk(vessel: VesselDeliveryData) {
  return vessel.noPkk?.trim() || vessel.noPpk?.trim() || ''
}

function formatDateTime(value: string) {
  const dateTime = value.replace('T', ' ')
  return dateTime.length === 16 ? `${dateTime}:00` : dateTime
}

function resetForm() {
  activeVessel.value = null
  selectedGudangIndex.value = null
  form.noBlAwb = ''
  form.jumlah = null
  form.colli = null
  form.gudlapId = ''
  form.kdGudlapD = ''
  form.tglRls = currentDateTimeLocal()
  form.keterangan = 'Delivery dari NPL'
}

function selectVessel(vessel: VesselDeliveryData) {
  activeVessel.value = vessel
  selectedGudangIndex.value = null
  form.noBlAwb = ''
  form.jumlah = null
  form.colli = null
  form.gudlapId = ''
  form.kdGudlapD = ''
  form.tglRls = currentDateTimeLocal()
  form.keterangan = 'Delivery dari NPL'
  error.value = ''
  success.value = ''
}

function selectGudang(index: number | null) {
  selectedGudangIndex.value = index
  const gudang = index === null ? undefined : activeVessel.value?.gudang[index]
  form.gudlapId = gudang?.gudlapId || ''
  form.kdGudlapD = gudang?.kdGudlapD || ''
}

function preventInvalidNumberKeys(event: KeyboardEvent) {
  if (['e', 'E', '+', '-'].includes(event.key)) event.preventDefault()
}

async function loadVessels() {
  loading.value = true
  error.value = ''
  try {
    const { data } = await api.post<VesselDeliveryResponse>(
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

async function submitDelivery() {
  if (!activeVessel.value || busy()) return

  if (
    !form.noBlAwb ||
    typeof form.jumlah !== 'number' ||
    !Number.isFinite(form.jumlah) ||
    form.jumlah < 0 ||
    typeof form.colli !== 'number' ||
    !Number.isFinite(form.colli) ||
    form.colli < 0 ||
    !form.gudlapId ||
    !form.kdGudlapD ||
    !form.tglRls
  ) {
    error.value = 'Lengkapi semua kolom wajib dengan nilai yang valid.'
    success.value = ''
    return
  }

  const payload: DeliveryRealisasiPayload[] = [
    {
      noSpmk: activeVessel.value.noSpmk,
      noBlAwb: form.noBlAwb,
      jumlah: form.jumlah,
      colli: form.colli,
      gudlapId: form.gudlapId,
      kdGudlapD: form.kdGudlapD,
      tglRls: formatDateTime(form.tglRls),
      keterangan: form.keterangan.trim(),
      programName: 'NPL',
    },
  ]

  sending.value = true
  error.value = ''
  success.value = ''
  try {
    const { data } = await api.post<DeliveryRealisasiResponse>(
      '/sendDataRealisasiDeliveryPtosm',
      payload,
    )
    if (data.status !== 'S' || (data.failedCount ?? 0) > 0) {
      throw new Error(responseMessage(data, 'Realisasi delivery gagal dikirim.'))
    }
    const successMessage = data.message || 'Realisasi delivery berhasil dikirim.'
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
        <h1 class="page-title">Realisasi Delivery Conveyor</h1>
        <p class="page-subtitle">Kirim realisasi barang untuk kegiatan vessel delivery.</p>
      </div>

      <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <section class="card">
          <header class="card-header">
            <div class="flex items-center justify-between gap-3">
              <h2 class="card-title">Daftar Kegiatan Vessel Delivery</h2>
              <span class="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                {{ vessels.length }} data
              </span>
            </div>
            <form class="mt-4 flex gap-2" @submit.prevent="loadVessels">
              <input
                v-model="noPkkSearch"
                type="search"
                placeholder="No. PKK"
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
                      <dt class="meta-label">Siklus</dt>
                      <dd class="meta-value">{{ vessel.siklus ?? '-' }}</dd>
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
            <h2 class="card-title">Form Realisasi Delivery Conveyor</h2>
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

          <form class="space-y-5 p-5 sm:p-6" @submit.prevent="submitDelivery">
            <fieldset :disabled="busy()" class="space-y-4 disabled:opacity-70">
              <label class="field-label">
                Nomor BL <span class="text-red-600">*</span>
                <select v-model="form.noBlAwb" required class="input">
                  <option value="" disabled>Pilih Nomor BL</option>
                  <option
                    v-for="(barang, index) in activeVessel.barang"
                    :key="barang.noSeq ?? `${barang.noBlAwb}-${index}`"
                    :value="barang.noBlAwb"
                  >
                    {{ barang.noBlAwb }} - {{ barang.mbrgNama || '-' }}
                  </option>
                </select>
              </label>

              <div class="grid gap-3 sm:grid-cols-2">
                <label class="field-label">
                  Jumlah / Tonase <span class="text-red-600">*</span>
                  <input
                    v-model.number="form.jumlah"
                    type="number"
                    min="0"
                    step="any"
                    required
                    class="input"
                    @keydown="preventInvalidNumberKeys"
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
                    class="input"
                    @keydown="preventInvalidNumberKeys"
                  />
                </label>
              </div>

              <label class="field-label">
                Gudang &amp; Blok <span class="text-red-600">*</span>
                <select
                  :value="selectedGudangIndex ?? ''"
                  required
                  class="input"
                  @change="selectGudang(($event.target as HTMLSelectElement).value === '' ? null : Number(($event.target as HTMLSelectElement).value))"
                >
                  <option value="" disabled>Pilih Gudang &amp; Blok</option>
                  <option
                    v-for="(gudang, index) in activeVessel.gudang"
                    :key="`${gudang.gudlapId}-${gudang.kdGudlapD}-${index}`"
                    :value="index"
                  >
                    {{ gudang.gudlapNama || gudang.gudlapId }} - {{ gudang.nmGudlapD || gudang.kdGudlapD }}
                  </option>
                </select>
              </label>

              <label class="field-label">
                Tanggal Realisasi <span class="text-red-600">*</span>
                <input v-model="form.tglRls" type="datetime-local" required class="input" />
              </label>

              <label class="field-label">
                Keterangan
                <textarea v-model="form.keterangan" rows="3" class="input resize-y" />
              </label>
            </fieldset>

            <button type="submit" :disabled="busy()" class="btn btn-success w-full py-3">
              <span v-if="sending" class="spinner" aria-hidden="true" />
              {{ sending ? 'Mengirim...' : 'Kirim Realisasi Delivery' }}
            </button>
          </form>
        </section>

        <aside
          v-else
          class="empty-state rounded-2xl border-2 border-dashed border-slate-300 bg-white/50 lg:sticky lg:top-24"
        >
          <p>
            Pilih kegiatan dan tekan <strong class="text-slate-700">Proses</strong> untuk membuka
            form realisasi delivery.
          </p>
        </aside>
      </div>
    </div>
  </main>
</template>
