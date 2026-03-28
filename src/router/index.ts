import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { guest: true }
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/views/RegisterView.vue'),
      meta: { guest: true }
    },
    {
      path: '/verify-email',
      name: 'verify-email',
      component: () => import('@/views/VerifyEmailView.vue'),
      meta: { guest: true }
    },
    {
      path: '/',
      component: () => import('@/views/LayoutView.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          redirect: '/dashboard'
        },
        {
          path: 'dashboard',
          name: 'dashboard',
          component: () => import('@/views/DashboardView.vue')
        },
        {
          path: 'domains',
          name: 'domains',
          component: () => import('@/views/DomainsView.vue')
        },
        {
          path: 'dns/:domain',
          name: 'dns',
          component: () => import('@/views/DnsView.vue')
        },
        {
          path: 'admin/users',
          name: 'admin-users',
          component: () => import('@/views/AdminUsersView.vue'),
          meta: { requiresAdmin: true }
        },
        {
          path: 'admin/domains',
          name: 'admin-domains',
          component: () => import('@/views/AdminDomainsView.vue'),
          meta: { requiresAdmin: true }
        },
        {
          path: 'admin/settings',
          name: 'admin-settings',
          component: () => import('@/views/AdminSettingsView.vue'),
          meta: { requiresAdmin: true }
        }
      ]
    }
  ]
})

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()

  // Sync auth state with localStorage (in case it was modified externally)
  authStore.syncAuthState()

  // If logged in but user data not loaded yet, fetch it
  // The store's fetchingUser flag prevents multiple simultaneous fetches
  if (authStore.isLoggedIn && !authStore.user && !authStore.fetchingUser) {
    try {
      await authStore.fetchUser()
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('Failed to fetch user during navigation:', error)
      }
    }
  }

  // Handle route access based on auth state
  if (to.meta.requiresAuth && !authStore.isLoggedIn) {
    // Store intended destination for redirect after login
    sessionStorage.setItem('redirectAfterLogin', to.fullPath)
    next('/login')
  } else if (to.meta.guest && authStore.isLoggedIn) {
    next('/dashboard')
  } else if (to.meta.requiresAdmin && !authStore.isAdmin) {
    // User is logged in but not admin, redirect to dashboard
    next('/dashboard')
  } else {
    next()
  }
})

// Handle successful login redirects
router.afterEach((to, from) => {
  // Check if we should redirect after login
  const redirectPath = sessionStorage.getItem('redirectAfterLogin')
  if (redirectPath && to.name === 'login') {
    sessionStorage.removeItem('redirectAfterLogin')
  }
})

export default router
