import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api'
import type { User } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(localStorage.getItem('token'))
  const loading = ref(false)

  const isLoggedIn = computed(() => !!token.value)
  const isAdmin = computed(() => user.value?.role === 'admin')
  const isEmailVerified = computed(() => user.value?.email_verified === 1)

  async function login(email: string, password: string, turnstileToken?: string) {
    loading.value = true
    try {
      const { data } = await authApi.login({ email, password, turnstileToken })
      if (data.success && data.data) {
        token.value = data.data.token
        user.value = data.data.user
        localStorage.setItem('token', data.data.token)
        return { success: true }
      }
      if (data.needsVerification) {
        return { success: false, needsVerification: true }
      }
      return { success: false, error: data.error }
    } finally {
      loading.value = false
    }
  }

  async function register(username: string, email: string, password: string, turnstileToken?: string) {
    loading.value = true
    try {
      const { data } = await authApi.register({ username, email, password, confirmPassword: password, turnstileToken })
      if (data.success) {
        return { success: true, message: data.data?.message || 'Registration successful' }
      }
      return { success: false, error: data.error }
    } finally {
      loading.value = false
    }
  }

  async function fetchUser() {
    if (!token.value) return
    try {
      const { data } = await authApi.getMe()
      if (data.success && data.data) {
        user.value = data.data
      } else {
        // API returned error, clear token
        logout()
      }
    } catch {
      // Network error - don't logout immediately, keep the token
      // The API interceptor will handle 401 responses
      console.warn('Failed to fetch user info')
    }
  }

  function logout() {
    user.value = null
    token.value = null
    localStorage.removeItem('token')
  }

  return {
    user,
    token,
    loading,
    isLoggedIn,
    isAdmin,
    isEmailVerified,
    login,
    register,
    fetchUser,
    logout
  }
})
