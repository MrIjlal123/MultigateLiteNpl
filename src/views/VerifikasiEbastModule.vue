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
  <main class="page">
    <div class="mx-auto max-w-7xl space-y-6">
      <div>
        <p class="page-eyebrow">Operasional Pelabuhan</p>
        <h1 class="page-title">Verifikasi eBAST</h1>
        <p class="page-subtitle">Tinjau detail eBAST dan status persetujuannya.</p>
      </div>

      <p v-if="error" role="alert" class="alert-error">{{ error }}</p>

      <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        <section class="card">
          <header class="card-header">
            <div class="flex items-center justify-between gap-3">
              <h2 class="card-title">Daftar eBAST</h2>
              <span class="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                {{ ebastItems.length }} data
              </span>
            </div>
            <form class="mt-4 flex gap-2" @submit.prevent="loadEbast">
              <input
                v-model="noBastSearch"
                type="search"
                placeholder="Cari No. BAST"
                aria-label="Cari berdasarkan No. BAST"
                class="input mt-0 min-w-0 flex-1"
              />
              <button type="submit" :disabled="loading" class="btn btn-primary px-5">
                <span v-if="loading" class="spinner" aria-hidden="true" />
                {{ loading ? 'Memuat' : 'Cari' }}
              </button>
            </form>
          </header>

          <div v-if="loading && !ebastItems.length" class="empty-state">
            <span class="spinner size-6 text-brand-600" aria-hidden="true" />
            Memuat daftar eBAST...
          </div>
          <div v-else-if="!ebastItems.length" class="empty-state">Tidak ada eBAST yang ditemukan.</div>
          <ul v-else class="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto">
            <li v-for="(item, index) in ebastItems" :key="item.id ?? `${item.noBast}-${index}`">
              <button
                type="button"
                class="block w-full border-l-4 px-5 py-4 text-left transition sm:px-6"
                :class="
                  selectedEbast === item
                    ? 'border-brand-600 bg-brand-50/60'
                    : 'border-transparent hover:bg-slate-50'
                "
                @click="selectEbast(item)"
              >
                <div class="flex items-start justify-between gap-3">
                  <p class="min-w-0 break-words font-semibold text-slate-900">{{ item.noBast || '-' }}</p>
                  <span
                    class="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                    :class="statusClass(item.status)"
                  >
                    {{ statusLabel(item.status) }}
                  </span>
                </div>
                <p class="mt-1 text-sm text-slate-600">{{ item.nmKapal || '-' }}</p>
                <p class="mt-1 text-xs text-slate-400">{{ formatDate(item.tglBast) }}</p>
              </button>
            </li>
          </ul>
        </section>

        <section v-if="selectedEbast" class="card">
          <header class="card-header bg-slate-50/70">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="meta-label">No. BAST</p>
                <h2 class="mt-0.5 break-words text-lg font-bold text-slate-900">{{ selectedEbast.noBast || '-' }}</h2>
                <p class="mt-1 text-sm text-slate-500">
                  {{ selectedEbast.nmKapal || '-' }} · Voyage {{ selectedEbast.voyage || '-' }} ·
                  {{ formatDate(selectedEbast.tglBast) }}
                </p>
              </div>
              <span class="rounded-full px-3 py-1 text-xs font-semibold" :class="statusClass(selectedEbast.status)">
                {{ statusLabel(selectedEbast.status) }}
              </span>
            </div>
            <dl class="mt-4 grid grid-cols-3 gap-3">
              <div class="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <dt class="meta-label">Total BL</dt>
                <dd class="mt-1 text-lg font-bold tabular-nums text-slate-900">{{ displayValue(selectedEbast.totalBl) }}</dd>
              </div>
              <div class="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <dt class="meta-label">Total WB</dt>
                <dd class="mt-1 text-lg font-bold tabular-nums text-slate-900">{{ displayValue(selectedEbast.totalWb) }}</dd>
              </div>
              <div class="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <dt class="meta-label">Short/Over</dt>
                <dd class="mt-1 text-lg font-bold tabular-nums text-slate-900">
                  {{ displayValue(selectedEbast.totalShortOver) }}
                </dd>
              </div>
            </dl>
          </header>

          <div class="space-y-6 p-5 sm:p-6">
            <section>
              <h3 class="mb-3 text-sm font-semibold text-slate-900">Detail Barang</h3>
              <div class="overflow-x-auto rounded-xl border border-slate-200">
                <table class="w-full min-w-[680px] text-left text-sm">
                  <thead class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th class="px-4 py-3 font-semibold">Consignee</th>
                      <th class="px-4 py-3 font-semibold">No. BL</th>
                      <th class="px-4 py-3 text-right font-semibold">Tonase BL</th>
                      <th class="px-4 py-3 text-right font-semibold">Tonase WB</th>
                      <th class="px-4 py-3 text-right font-semibold">Short/Over</th>
                      <th class="px-4 py-3 text-right font-semibold">Colli</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    <tr
                      v-for="(detail, index) in selectedEbast.detail ?? []"
                      :key="detail.noSeq ?? index"
                      class="hover:bg-slate-50/70"
                    >
                      <td class="px-4 py-3 text-slate-800">{{ detail.consigne || detail.consignee || '-' }}</td>
                      <td class="px-4 py-3 font-medium text-slate-800">{{ detail.noBl || '-' }}</td>
                      <td class="px-4 py-3 text-right tabular-nums text-slate-800">{{ displayValue(detail.tonaseBl) }}</td>
                      <td class="px-4 py-3 text-right tabular-nums text-slate-800">{{ displayValue(detail.tonaseWb) }}</td>
                      <td class="px-4 py-3 text-right tabular-nums text-slate-800">{{ displayValue(detail.shortOver) }}</td>
                      <td class="px-4 py-3 text-right tabular-nums text-slate-800">{{ displayValue(detail.colli) }}</td>
                    </tr>
                    <tr v-if="!selectedEbast.detail?.length">
                      <td colspan="6" class="px-4 py-6 text-center text-slate-500">Tidak ada detail barang.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h3 class="mb-3 text-sm font-semibold text-slate-900">Status Approval</h3>
              <ol v-if="selectedEbast.approval?.length" class="space-y-2">
                <li
                  v-for="(approval, index) in selectedEbast.approval"
                  :key="`${approval.levelApprove ?? index}-${approval.nama ?? ''}`"
                  class="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3"
                >
                  <span
                    class="grid size-8 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-600"
                  >
                    {{ displayValue(approval.levelApprove) }}
                  </span>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-semibold text-slate-900">{{ approval.nama || '-' }}</p>
                    <p class="truncate text-xs text-slate-500">{{ approval.jabatan || '-' }}</p>
                  </div>
                  <span
                    class="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                    :class="statusClass(approval.statusApprove)"
                  >
                    {{ statusLabel(approval.statusApprove) }}
                  </span>
                </li>
              </ol>
              <p v-else class="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
                Belum ada data approval.
              </p>
            </section>

            <section class="border-t border-slate-100 pt-6">
              <label class="field-label">
                Catatan / Keterangan Reject
                <textarea
                  v-model="note"
                  rows="3"
                  placeholder="Opsional — isi alasan jika eBAST ditolak"
                  class="input resize-y"
                />
              </label>
              <div class="mt-4 grid gap-3 sm:grid-cols-2">
                <button type="button" class="btn btn-success py-3 text-base" @click="handleApprove">
                  Setuju (Approve)
                </button>
                <button type="button" class="btn btn-danger py-3 text-base" @click="handleReject">
                  Tolak (Reject)
                </button>
              </div>
            </section>
          </div>
        </section>

        <aside
          v-else
          class="empty-state rounded-2xl border-2 border-dashed border-slate-300 bg-white/50"
        >
          <p>Pilih eBAST dari daftar untuk membuka data verifikasi.</p>
        </aside>
      </div>
    </div>
  </main>
</template>
