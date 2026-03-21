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

      // Handle email verification required
      if (data.needsVerification) {
        return { success: false, needsVerification: true }
      }

      // Must have success and valid data with token and user
      if (!data.success || !data.data?.token || !data.data?.user) {
        return { success: false, error: data.error || 'Login failed' }
      }

      // Set token and user
      token.value = data.data.token
      user.value = data.data.user
      localStorage.setItem('token', data.data.token)

      // Verify token is valid by calling /auth/me and wait for result
      const fetchSuccess = await fetchUser()
      if (!fetchSuccess) {
        // fetchUser failed (cleared auth state), don't return success
        return { success: false, error: 'Session invalid, please login again' }
      }

      return { success: true }
    } catch (error: any) {
      // Handle network errors or API errors
      if (error.response?.status === 401) {
        return { success: false, error: 'Invalid credentials' }
      }
      if (error.response?.status === 403) {
        return { success: false, error: error.response?.data?.error || 'Account suspended' }
      }
      console.error('Login error:', error)
      return { success: false, error: error.message || 'Network error' }
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
    // If no token, do nothing
    if (!token.value) return

    try {
      const { data } = await authApi.getMe()
      if (data.success && data.data) {
        user.value = data.data
        return true
      } else {
        // API returned an error response (but not 401)
        user.value = null
        token.value = null
        localStorage.removeItem('token')
        return false
      }
    } catch (error: any) {
      // If 401, the token is invalid - clear everything
      if (error.response?.status === 401 || error.response?.status === 403) {
        console.warn('Token invalid or expired')
        user.value = null
        token.value = null
        localStorage.removeItem('token')
      } else {
        // Network error or other error - keep user state but log warning
        console.warn('Failed to fetch user:', error.message)
      }
      return false
    }
  }

  function logout() {
    user.value = null
    token.value = null
    localStorage.removeItem('token')
  }

  // When token changes externally (e.g., cleared by API interceptor), sync user state
  function syncAuthState() {
    const storedToken = localStorage.getItem('token')
    if (!storedToken && token.value) {
      // Token was cleared externally
      token.value = null
      user.value = null
    }
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
    logout,
    syncAuthState
  }
})
