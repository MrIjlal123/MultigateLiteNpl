<template>
  <div class="min-h-screen">
    <header
      v-if="showNavigation"
      class="sticky top-0 z-20 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur"
    >
      <div
        class="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:flex-nowrap sm:gap-4 sm:px-6 sm:py-0"
      >
        <RouterLink
          to="/gate"
          class="flex shrink-0 items-center gap-3"
          aria-label="Port Operations"
        >
          <img src="/Logo-PTOSM.png" alt="" class="h-9 w-auto object-contain" />
          <span class="hidden text-sm font-bold text-slate-900 sm:inline">Port Operations</span>
        </RouterLink>

        <nav
          class="order-3 flex w-full items-center justify-center gap-1 sm:order-none sm:w-auto"
          aria-label="Navigasi utama"
        >
          <RouterLink
            to="/receiving"
            class="rounded-lg px-3 py-2 text-sm font-semibold transition"
            active-class="bg-blue-50 text-blue-700"
            exact-active-class="bg-blue-50 text-blue-700"
          >
            Receiving Module
          </RouterLink>

          <RouterLink
            to="/booking"
            class="rounded-lg px-3 py-2 text-sm font-semibold transition"
            active-class="bg-blue-50 text-blue-700"
            exact-active-class="bg-blue-50 text-blue-700"
          >
            Booking Slot
          </RouterLink>

          <RouterLink
            to="/ebast"
            class="rounded-lg px-3 py-2 text-sm font-semibold transition"
            active-class="bg-blue-50 text-blue-700"
            exact-active-class="bg-blue-50 text-blue-700"
          >
            Verifikasi eBAST
          </RouterLink>

          <RouterLink
            to="/gate"
            class="rounded-lg px-3 py-2 text-sm font-semibold transition"
            active-class="bg-blue-50 text-blue-700"
            exact-active-class="bg-blue-50 text-blue-700"
          >
            Gate Operation
          </RouterLink>
        </nav>

        <button
          type="button"
          class="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          @click="logout"
        >
          Logout
        </button>
      </div>
    </header>
    <RouterView />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const showNavigation = computed(
  () => route.name !== 'login' && Boolean(localStorage.getItem('access_token')),
)

async function logout() {
  localStorage.removeItem('access_token')
  await router.replace('/login')
}
</script>
