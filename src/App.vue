<template>
  <div class="min-h-screen">
    <header
      v-if="showNavigation"
      class="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl"
    >
      <div
        class="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:flex-nowrap lg:py-0"
      >
        <RouterLink
          to="/gate"
          class="flex shrink-0 items-center gap-3"
          aria-label="Port Operations"
        >
          <img src="/Logo-PTOSM.png" alt="" class="h-9 w-auto object-contain" />
          <span class="hidden flex-col leading-tight sm:flex">
            <span class="text-sm font-bold text-slate-900">Port Operations</span>
            <span class="text-[11px] font-medium text-slate-500">Multigate NPL Lite</span>
          </span>
        </RouterLink>

        <nav
          class="order-3 -mx-1 flex w-full items-center gap-1 overflow-x-auto px-1 pb-1 lg:order-none lg:w-auto lg:pb-0"
          aria-label="Navigasi utama"
        >
          <RouterLink
            v-for="link in links"
            :key="link.to"
            :to="link.to"
            class="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            active-class="!bg-brand-50 !text-brand-700 font-semibold ring-1 ring-brand-100"
          >
            {{ link.label }}
          </RouterLink>
        </nav>

        <button type="button" class="btn btn-ghost shrink-0 px-3 py-2" @click="logout">
          <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true">
            <path
              fill-rule="evenodd"
              d="M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2a.75.75 0 0 1 1.5 0v2A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75V4.25Zm10.72 2.47a.75.75 0 0 1 1.06 0l2.75 2.75a.75.75 0 0 1 0 1.06l-2.75 2.75a.75.75 0 1 1-1.06-1.06l1.47-1.47H8.75a.75.75 0 0 1 0-1.5h6.44l-1.47-1.47a.75.75 0 0 1 0-1.06Z"
              clip-rule="evenodd"
            />
          </svg>
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

const links = [
  { to: '/gate', label: 'Gate Operation' },
  { to: '/receiving', label: 'Receiving' },
  { to: '/booking', label: 'Booking Slot' },
  { to: '/ebast', label: 'Verifikasi eBAST' },
]

async function logout() {
  localStorage.removeItem('access_token')
  await router.replace('/login')
}
</script>
