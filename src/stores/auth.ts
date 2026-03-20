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

  async function login(email: string, password: string) {
    loading.value = true
    try {
      const { data } = await authApi.login({ email, password })
      if (data.success && data.data) {
        token.value = data.data.token
        user.value = data.data.user
        localStorage.setItem('token', data.data.token)
        return true
      }
      return false
    } finally {
      loading.value = false
    }
  }

  async function register(username: string, email: string, password: string) {
    loading.value = true
    try {
      const { data } = await authApi.register({ username, email, password, confirmPassword: password })
      if (data.success && data.data) {
        token.value = data.data.token
        user.value = data.data.user
        localStorage.setItem('token', data.data.token)
        return true
      }
      return false
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
      }
    } catch {
      logout()
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
    login,
    register,
    fetchUser,
    logout
  }
})
