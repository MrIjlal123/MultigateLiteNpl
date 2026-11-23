<script setup lang="ts">
import axios from 'axios'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import ShipScene from '@/components/ShipScene.vue'

type LoginResponse = {
  token: string
  name?: string
  username?: string
  kd_terminal?: number
  status?: string
  message?: string
}

const router = useRouter()
const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')
const docking = ref(false)
const shipScene = ref<InstanceType<typeof ShipScene> | null>(null)

async function login() {
  loading.value = true
  error.value = ''

  try {
    const response = await axios.post<LoginResponse>('/auth/loginRDS', {
      username: username.value,
      password: password.value,
    })
    const token = response.data.token
    if (!token) throw new Error(response.data.message || 'Token autentikasi tidak tersedia.')

    localStorage.setItem('access_token', token)
    docking.value = true
    await shipScene.value?.berth()
    await router.push('/gate')
  } catch (err: unknown) {
    error.value = axios.isAxiosError(err)
      ? err.response?.data?.message || err.message
      : (err as Error).message || 'Login gagal.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="grid min-h-screen lg:grid-cols-2">
    <section
      class="relative hidden overflow-hidden bg-gradient-to-br from-brand-900 via-brand-700 to-sky-600 p-12 text-white lg:flex lg:flex-col"
    >
      <div
        class="absolute -right-24 -top-24 size-96 rounded-full bg-white/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        class="absolute -bottom-32 -left-16 size-96 rounded-full bg-sky-300/20 blur-3xl"
        aria-hidden="true"
      />
      <div class="relative flex items-center gap-3">
        <span class="grid size-12 place-items-center rounded-xl bg-white p-1.5 shadow-lg">
          <img src="/Logo-PTOSM.png" alt="" class="h-full w-full object-contain" />
        </span>
        <span class="text-lg font-semibold">Integrasi NPL Lite</span>
      </div>
      <div class="relative -mx-12 my-6 min-h-64 flex-1">
        <ShipScene ref="shipScene" />
      </div>
      <div class="relative max-w-md">
        <h2 class="text-4xl font-bold leading-tight tracking-tight">
          Operasional pelabuhan dalam satu layar.
        </h2>
        <p class="mt-4 text-base text-blue-100">
          Gate In/Out, receiving, booking slot truk, dan verifikasi eBAST — terintegrasi dengan
          PTOSM.
        </p>
      </div>
      <p class="relative mt-8 text-xs text-blue-200">&copy; {{ new Date().getFullYear() }} PTOSM</p>
    </section>

    <section class="grid place-items-center p-6">
      <form class="card w-full max-w-md p-8 sm:p-10" @submit.prevent="login">
        <img src="/Logo-PTOSM.png" alt="PTOSM" class="mb-6 h-10 w-auto lg:hidden" />
        <h1 class="text-2xl font-bold tracking-tight text-slate-900">Selamat datang</h1>
        <p class="mb-6 mt-1 text-sm text-slate-500">Masuk menggunakan akun operasional Anda.</p>
        <p v-if="error" role="alert" class="alert-error mb-5">{{ error }}</p>
        <p v-if="docking" role="status" class="alert-success mb-5">
          Login berhasil. Kapal sedang sandar...
        </p>
        <label class="field-label mb-4">
          Username
          <input
            v-model.trim="username"
            required
            autocomplete="username"
            placeholder="nama.pengguna"
            :disabled="loading || docking"
            class="input"
          />
        </label>
        <label class="field-label">
          Password
          <input
            v-model="password"
            required
            type="password"
            autocomplete="current-password"
            placeholder="••••••••"
            :disabled="loading || docking"
            class="input"
          />
        </label>
        <button :disabled="loading || docking" class="btn btn-primary mt-7 w-full py-3">
          <span v-if="loading || docking" class="spinner" aria-hidden="true" />
          {{ docking ? 'Menyandarkan kapal...' : loading ? 'Memproses...' : 'Masuk' }}
        </button>
      </form>
    </section>
  </main>
</template>
