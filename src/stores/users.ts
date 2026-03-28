import { defineStore } from 'pinia'
import { ref } from 'vue'
import { userApi } from '@/api'
import type { User } from '@/types'

export const useUserStore = defineStore('users', () => {
  const users = ref<User[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchUsers() {
    loading.value = true
    error.value = null
    try {
      const { data } = await userApi.getList()
      if (data.success && data.data) {
        users.value = data.data
      } else {
        error.value = data.error || 'Failed to load users'
      }
    } catch (e: any) {
      error.value = 'Failed to load users'
      if (import.meta.env.DEV) {
        console.error('Failed to fetch users:', e.message)
      }
    } finally {
      loading.value = false
    }
  }

  async function createUser(userData: { username: string; email: string; password: string; role?: string }) {
    loading.value = true
    error.value = null
    try {
      const { data } = await userApi.create(userData)
      if (data.success && data.data) {
        await fetchUsers() // Refresh list
        return { success: true, data: data.data }
      }
      error.value = data.error || 'Failed to create user'
      return { success: false, error: data.error }
    } catch (e: any) {
      error.value = e.response?.data?.error || 'Failed to create user'
      if (import.meta.env.DEV) {
        console.error('Failed to create user:', e.message)
      }
      return { success: false, error: e.response?.data?.error || 'Failed to create user' }
    } finally {
      loading.value = false
    }
  }

  async function updateUser(id: number, updates: Partial<User>) {
    error.value = null
    try {
      const { data } = await userApi.update(id, updates)
      if (data.success) {
        const index = users.value.findIndex(u => u.id === id)
        if (index !== -1) {
          const current = users.value[index]
          if (current) {
            users.value[index] = { ...current, ...updates } as User
          }
        }
        return true
      }
      error.value = data.error || 'Failed to update user'
      return false
    } catch (e: any) {
      error.value = e.message || 'Failed to update user'
      if (import.meta.env.DEV) {
        console.error('Failed to update user:', e.message)
      }
      return false
    }
  }

  async function updatePassword(id: number, password: string) {
    error.value = null
    try {
      const { data } = await userApi.updatePassword(id, password)
      if (!data.success) {
        error.value = data.error || 'Failed to update password'
      }
      return data.success
    } catch (e: any) {
      error.value = e.message || 'Failed to update password'
      if (import.meta.env.DEV) {
        console.error('Failed to update password:', e.message)
      }
      return false
    }
  }

  async function deleteUser(id: number) {
    error.value = null
    try {
      const { data } = await userApi.delete(id)
      if (data.success) {
        users.value = users.value.filter(u => u.id !== id)
        return true
      }
      error.value = data.error || 'Failed to delete user'
      return false
    } catch (e: any) {
      error.value = e.message || 'Failed to delete user'
      if (import.meta.env.DEV) {
        console.error('Failed to delete user:', e.message)
      }
      return false
    }
  }

  async function banUser(id: number) {
    error.value = null
    try {
      const { data } = await userApi.ban(id)
      if (data.success) {
        const index = users.value.findIndex(u => u.id === id)
        if (index !== -1 && users.value[index]) {
          users.value[index].banned = 1
        }
        return true
      }
      error.value = data.error || 'Failed to ban user'
      return false
    } catch (e: any) {
      error.value = e.message || 'Failed to ban user'
      if (import.meta.env.DEV) {
        console.error('Failed to ban user:', e.message)
      }
      return false
    }
  }

  async function unbanUser(id: number) {
    error.value = null
    try {
      const { data } = await userApi.unban(id)
      if (data.success) {
        const index = users.value.findIndex(u => u.id === id)
        if (index !== -1 && users.value[index]) {
          users.value[index].banned = 0
        }
        return true
      }
      error.value = data.error || 'Failed to unban user'
      return false
    } catch (e: any) {
      error.value = e.message || 'Failed to unban user'
      if (import.meta.env.DEV) {
        console.error('Failed to unban user:', e.message)
      }
      return false
    }
  }

  return {
    users,
    loading,
    error,
    fetchUsers,
    createUser,
    updateUser,
    updatePassword,
    deleteUser,
    banUser,
    unbanUser
  }
})
