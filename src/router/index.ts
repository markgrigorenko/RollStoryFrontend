import { createRouter, createWebHistory } from 'vue-router'
import { isAuthenticated } from '@/shared/lib/authSession'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: { name: 'map' },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
    },
    {
      path: '/signin/success',
      redirect: (to) => ({
        name: 'login',
        query: { ...to.query, verified: '1' },
      }),
    },
    {
      path: '/signin/error',
      redirect: (to) => ({
        name: 'login',
        query: to.query,
      }),
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../views/RegisterView.vue'),
    },
    {
      path: '/register/confirm',
      name: 'confirmEmail',
      component: () => import('../views/ConfirmEmailView.vue'),
    },
    {
      path: '/map',
      name: 'map',
      component: () => import('../views/MapView.vue'),
    },
  ],
})

router.beforeEach((to) => {
  const isAuthed = isAuthenticated()
  const publicRouteNames = new Set([
    'login',
    'register',
    'confirmEmail',
  ])
  const isPublic =
    (typeof to.name === 'string' && publicRouteNames.has(to.name)) ||
    to.path === '/signin/success' ||
    to.path === '/signin/error'

  if (!isAuthed && !isPublic) {
    return { name: 'login' }
  }

  if (isAuthed && to.name === 'login') {
    return { name: 'map' }
  }

  return true
})

export default router
