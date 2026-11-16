import { createRouter, createWebHistory } from 'vue-router'
import Login from '@/views/Login.vue'
import GateTransaction from '@/views/GateTransaction.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: () => (localStorage.getItem('access_token') ? '/gate' : '/login') },
    { path: '/login', name: 'login', component: Login },
    { path: '/gate', name: 'gate', component: GateTransaction },
  ],
})

router.beforeEach((to) => {
  const hasToken = Boolean(localStorage.getItem('access_token'))
  if (to.name === 'gate' && !hasToken) return { name: 'login' }
  if (to.name === 'login' && hasToken) return { name: 'gate' }
})

export default router
