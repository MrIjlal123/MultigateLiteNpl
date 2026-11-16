<script setup lang="ts">
import axios from 'axios'
import { onMounted, ref } from 'vue'
import api from '@/services/api'

type NumericValue = number | string | null

interface EbastDetail {
  noSeq?: NumericValue
  consigne?: string | null
  consignee?: string | null
  noBl?: string | null
  tonaseBl?: NumericValue
  tonaseWb?: NumericValue
  shortOver?: NumericValue
  colli?: NumericValue
  [key: string]: unknown
}

interface EbastApproval {
  levelApprove?: NumericValue
  nama?: string | null
  jabatan?: string | null
  statusApprove?: NumericValue
  [key: string]: unknown
}

interface EbastData {
  id?: NumericValue
  kdCabang?: string | null
  noBast: string
  tglBast?: string | null
  nmKapal?: string | null
  voyage?: string | null
  totalBl?: NumericValue
  totalWb?: NumericValue
  totalShortOver?: NumericValue
  status?: NumericValue
  detail?: EbastDetail[]
  approval?: EbastApproval[]
  [key: string]: unknown
}

interface ApiResponse<T> {
  status?: string
  message?: string
  data?: T
}

const noBastSearch = ref('')
const ebastItems = ref<EbastData[]>([])
const selectedEbast = ref<EbastData | null>(null)
const loading = ref(false)
const error = ref('')
const note = ref('')

function apiErrorMessage(requestError: unknown) {
  if (axios.isAxiosError(requestError)) {
    const responseData: unknown = requestError.response?.data
    if (responseData && typeof responseData === 'object' && 'message' in responseData) {
      const message = (responseData as { message?: unknown }).message
      if (typeof message === 'string' && message) return message
    }
    return requestError.message
  }
  return requestError instanceof Error
    ? requestError.message
    : 'Terjadi kesalahan yang tidak diketahui.'
}

function displayValue(value: NumericValue | undefined) {
  return value == null || value === '' ? '-' : value
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(date)
}

function statusLabel(status: NumericValue | undefined) {
  if (status === 0 || status === '0') return 'Menunggu'
  if (status === 1 || status === '1') return 'Disetujui'
  if (status === 2 || status === '2') return 'Ditolak'
  return displayValue(status)
}

function statusClass(status: NumericValue | undefined) {
  if (status === 0 || status === '0') return 'bg-amber-100 text-amber-800'
  if (status === 1 || status === '1') return 'bg-emerald-100 text-emerald-800'
  if (status === 2 || status === '2') return 'bg-red-100 text-red-800'
  return 'bg-slate-100 text-slate-700'
}

async function loadEbast() {
  loading.value = true
  error.value = ''
  selectedEbast.value = null
  note.value = ''
  try {
    const { data } = await api.post<ApiResponse<EbastData[]>>(
      'http://192.168.111.200:8079/npl/getDataEBastPtosm',
      { noBast: noBastSearch.value.trim(), page: 1, size: 50 },
    )
    if (data.status === 'E') {
      throw new Error(data.message || 'Gagal mengambil daftar eBAST.')
    }
    if (!Array.isArray(data.data)) {
      throw new Error(data.message || 'Format data eBAST dari server tidak valid.')
    }
    ebastItems.value = data.data
  } catch (requestError) {
    error.value = apiErrorMessage(requestError)
    ebastItems.value = []
  } finally {
    loading.value = false
  }
}

function selectEbast(item: EbastData) {
  selectedEbast.value = item
  note.value = ''
  error.value = ''
}

function handleApprove() {
  if (window.confirm(`Setujui eBAST ${selectedEbast.value?.noBast || ''}?`)) {
    window.alert('Konfirmasi approve diterima. Pengiriman ke server akan tersedia setelah endpoint verifikasi ditambahkan.')
  }
}

function handleReject() {
  if (window.confirm(`Tolak eBAST ${selectedEbast.value?.noBast || ''}?`)) {
    window.alert(
      note.value.trim()
        ? 'Konfirmasi reject diterima. Pengiriman catatan ke server akan tersedia setelah endpoint verifikasi ditambahkan.'
        : 'Konfirmasi reject diterima tanpa catatan. Pengiriman ke server akan tersedia setelah endpoint verifikasi ditambahkan.',
    )
  }
}

onMounted(loadEbast)
</script>

<template>
  <main class="min-h-[calc(100vh-4rem)] bg-slate-100 p-4 sm:p-6">
    <div class="mx-auto max-w-7xl">
      <div class="mb-6">
        <p class="text-sm font-semibold uppercase tracking-wide text-blue-700">Operasional Pelabuhan</p>
        <h1 class="mt-1 text-2xl font-bold text-slate-900">Verifikasi eBAST</h1>
        <p class="mt-1 text-sm text-slate-500">Tinjau detail eBAST dan status persetujuannya.</p>
      </div>

      <p v-if="error" role="alert" class="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
        {{ error }}
      </p>

      <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        <section class="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <header class="border-b border-slate-200 px-5 py-4 sm:px-6">
            <h2 class="text-lg font-bold text-slate-900">Daftar eBAST</h2>
            <p class="mt-1 text-sm text-slate-500">Cari dokumen berdasarkan nomor BAST.</p>
            <form class="mt-4 flex gap-2" @submit.prevent="loadEbast">
              <input
                v-model="noBastSearch"
                type="search"
                placeholder="No. BAST"
                aria-label="Cari berdasarkan No. BAST"
                class="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
              <button
                type="submit"
                :disabled="loading"
                class="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {{ loading ? 'Memuat...' : 'Cari' }}
              </button>
            </form>
          </header>

          <div v-if="loading && !ebastItems.length" class="p-8 text-center text-sm text-slate-500">
            Memuat daftar eBAST...
          </div>
          <div v-else-if="!ebastItems.length" class="p-8 text-center text-sm text-slate-500">
            Tidak ada eBAST yang ditemukan.
          </div>
          <div v-else class="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto">
            <article
              v-for="(item, index) in ebastItems"
              :key="item.id ?? `${item.noBast}-${index}`"
              class="p-5 transition hover:bg-slate-50 sm:px-6"
              :class="{ 'bg-blue-50/60': selectedEbast === item }"
            >
              <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <dl class="grid min-w-0 flex-1 grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div class="col-span-2">
                    <dt class="text-xs font-medium text-slate-500">No. BAST</dt>
                    <dd class="mt-0.5 break-words font-semibold text-slate-900">{{ item.noBast || '-' }}</dd>
                  </div>
                  <div class="col-span-2">
                    <dt class="text-xs font-medium text-slate-500">Nama Kapal</dt>
                    <dd class="mt-0.5 text-slate-800">{{ item.nmKapal || '-' }}</dd>
                  </div>
                  <div>
                    <dt class="text-xs font-medium text-slate-500">Tanggal BAST</dt>
                    <dd class="mt-0.5 text-slate-800">{{ formatDate(item.tglBast) }}</dd>
                  </div>
                  <div>
                    <dt class="text-xs font-medium text-slate-500">Status</dt>
                    <dd class="mt-1">
                      <span class="rounded-full px-2.5 py-1 text-xs font-semibold" :class="statusClass(item.status)">
                        {{ statusLabel(item.status) }}
                      </span>
                    </dd>
                  </div>
                </dl>
                <button
                  type="button"
                  class="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
                  @click="selectEbast(item)"
                >
                  Lihat Detail
                </button>
              </div>
            </article>
          </div>
        </section>

        <section
          v-if="selectedEbast"
          class="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200"
        >
          <header class="border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
            <h2 class="text-lg font-bold text-slate-900">Detail eBAST &amp; Verifikasi</h2>
            <dl class="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
              <div>
                <dt class="text-xs font-medium text-slate-500">No. BAST</dt>
                <dd class="mt-1 break-words text-sm font-semibold text-slate-900">{{ selectedEbast.noBast || '-' }}</dd>
              </div>
              <div>
                <dt class="text-xs font-medium text-slate-500">Tanggal</dt>
                <dd class="mt-1 text-sm text-slate-800">{{ formatDate(selectedEbast.tglBast) }}</dd>
              </div>
              <div>
                <dt class="text-xs font-medium text-slate-500">Kapal</dt>
                <dd class="mt-1 text-sm text-slate-800">{{ selectedEbast.nmKapal || '-' }}</dd>
              </div>
              <div>
                <dt class="text-xs font-medium text-slate-500">Voyage</dt>
                <dd class="mt-1 text-sm text-slate-800">{{ selectedEbast.voyage || '-' }}</dd>
              </div>
              <div>
                <dt class="text-xs font-medium text-slate-500">Total BL</dt>
                <dd class="mt-1 text-sm text-slate-800">{{ displayValue(selectedEbast.totalBl) }}</dd>
              </div>
              <div>
                <dt class="text-xs font-medium text-slate-500">Total WB</dt>
                <dd class="mt-1 text-sm text-slate-800">{{ displayValue(selectedEbast.totalWb) }}</dd>
              </div>
              <div>
                <dt class="text-xs font-medium text-slate-500">Total Short/Over</dt>
                <dd class="mt-1 text-sm text-slate-800">{{ displayValue(selectedEbast.totalShortOver) }}</dd>
              </div>
            </dl>
          </header>

          <div class="space-y-6 p-5 sm:p-6">
            <section>
              <h3 class="mb-3 text-sm font-bold text-slate-900">Detail Barang</h3>
              <div class="overflow-x-auto rounded-lg border border-slate-200">
                <table class="w-full min-w-[680px] text-left text-sm">
                  <thead class="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th class="px-3 py-3 font-semibold">Consignee</th>
                      <th class="px-3 py-3 font-semibold">No. BL</th>
                      <th class="px-3 py-3 text-right font-semibold">Tonase BL</th>
                      <th class="px-3 py-3 text-right font-semibold">Tonase WB</th>
                      <th class="px-3 py-3 text-right font-semibold">Short/Over</th>
                      <th class="px-3 py-3 text-right font-semibold">Colli</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    <tr v-for="(detail, index) in selectedEbast.detail ?? []" :key="detail.noSeq ?? index">
                      <td class="px-3 py-3 text-slate-800">{{ detail.consigne || detail.consignee || '-' }}</td>
                      <td class="px-3 py-3 text-slate-800">{{ detail.noBl || '-' }}</td>
                      <td class="px-3 py-3 text-right text-slate-800">{{ displayValue(detail.tonaseBl) }}</td>
                      <td class="px-3 py-3 text-right text-slate-800">{{ displayValue(detail.tonaseWb) }}</td>
                      <td class="px-3 py-3 text-right text-slate-800">{{ displayValue(detail.shortOver) }}</td>
                      <td class="px-3 py-3 text-right text-slate-800">{{ displayValue(detail.colli) }}</td>
                    </tr>
                    <tr v-if="!selectedEbast.detail?.length">
                      <td colspan="6" class="px-3 py-5 text-center text-slate-500">Tidak ada detail barang.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h3 class="mb-3 text-sm font-bold text-slate-900">Status Approval</h3>
              <div class="overflow-x-auto rounded-lg border border-slate-200">
                <table class="w-full min-w-[520px] text-left text-sm">
                  <thead class="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th class="px-3 py-3 font-semibold">Level</th>
                      <th class="px-3 py-3 font-semibold">Nama</th>
                      <th class="px-3 py-3 font-semibold">Jabatan</th>
                      <th class="px-3 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    <tr
                      v-for="(approval, index) in selectedEbast.approval ?? []"
                      :key="`${approval.levelApprove ?? index}-${approval.nama ?? ''}`"
                    >
                      <td class="px-3 py-3 text-slate-800">{{ displayValue(approval.levelApprove) }}</td>
                      <td class="px-3 py-3 text-slate-800">{{ approval.nama || '-' }}</td>
                      <td class="px-3 py-3 text-slate-800">{{ approval.jabatan || '-' }}</td>
                      <td class="px-3 py-3 text-slate-800">{{ statusLabel(approval.statusApprove) }}</td>
                    </tr>
                    <tr v-if="!selectedEbast.approval?.length">
                      <td colspan="4" class="px-3 py-5 text-center text-slate-500">Belum ada data approval.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section class="border-t border-slate-200 pt-5">
              <label class="block text-sm font-medium text-slate-700">
                Catatan / Keterangan Reject
                <textarea
                  v-model="note"
                  rows="3"
                  placeholder="Opsional — isi alasan jika eBAST ditolak"
                  class="mt-1 w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <div class="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  class="rounded-lg bg-emerald-600 px-4 py-3 text-base font-bold text-white transition hover:bg-emerald-700"
                  @click="handleApprove"
                >
                  Setuju (Approve)
                </button>
                <button
                  type="button"
                  class="rounded-lg bg-red-600 px-4 py-3 text-base font-bold text-white transition hover:bg-red-700"
                  @click="handleReject"
                >
                  Tolak (Reject)
                </button>
              </div>
            </section>
          </div>
        </section>

        <aside
          v-else
          class="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center text-sm text-slate-500"
        >
          Pilih eBAST dan tekan <strong>Lihat Detail</strong> untuk membuka data verifikasi.
        </aside>
      </div>
    </div>
  </main>
</template>
