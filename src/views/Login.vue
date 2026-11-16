<script setup lang="ts">
import axios from 'axios'
import { ref } from 'vue'
import { useRouter } from 'vue-router'

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
  <main class="grid min-h-screen place-items-center bg-slate-100 p-4">
    <form class="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200" @submit.prevent="login">
      <h1 class="text-2xl font-bold text-slate-900">Masuk ke Port Gate</h1>
      <p class="mb-6 mt-1 text-sm text-slate-500">Gunakan akun operasional Anda.</p>
      <p v-if="error" class="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{{ error }}</p>
      <label class="mb-4 block text-sm font-medium text-slate-700">Username<input v-model.trim="username" required autocomplete="username" :disabled="loading" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" /></label>
      <label class="block text-sm font-medium text-slate-700">Password<input v-model="password" required type="password" autocomplete="current-password" :disabled="loading" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" /></label>
      <button :disabled="loading" class="mt-6 w-full rounded-lg bg-blue-700 py-3 font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-400">{{ loading ? 'Memproses...' : 'Masuk' }}</button>
    </form>
  </main>
</template>
