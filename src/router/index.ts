import { createRouter, createWebHistory } from 'vue-router'
import Login from '@/views/Login.vue'
import GateTransaction from '@/views/GateTransaction.vue'
import ReceivingModule from '@/views/ReceivingModule.vue'
import BookingSlotModule from '@/views/BookingSlotModule.vue'
import DeliveryConveyorModule from '@/views/DeliveryConveyorModule.vue'
import VerifikasiEbastModule from '@/views/VerifikasiEbastModule.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: () => (localStorage.getItem('access_token') ? '/gate' : '/login') },
    { path: '/login', name: 'login', component: Login },
    { path: '/gate', name: 'gate', component: GateTransaction, meta: { requiresAuth: true } },
    {
      path: '/receiving',
      name: 'receiving',
      component: ReceivingModule,
      meta: { requiresAuth: true },
    },
    {
      path: '/booking',
      name: 'booking',
      component: BookingSlotModule,
      meta: { requiresAuth: true },
    },
    {
      path: '/delivery-conveyor',
      name: 'delivery-conveyor',
      component: DeliveryConveyorModule,
      meta: { requiresAuth: true },
    },
    {
      path: '/ebast',
      name: 'ebast',
      component: VerifikasiEbastModule,
      meta: { requiresAuth: true },
    },
  ],
})

router.beforeEach((to) => {
  const hasToken = Boolean(localStorage.getItem('access_token'))
  if (to.meta.requiresAuth && !hasToken) return { name: 'login' }
  if (to.name === 'login' && hasToken) return { name: 'gate' }
})

export default router
