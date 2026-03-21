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
    } catch (e) {
      error.value = 'Failed to load users'
      console.error('Failed to fetch users:', e)
    } finally {
      loading.value = false
    }
  }

  async function createUser(userData: { username: string; email: string; password: string; role?: string }) {
    try {
      const { data } = await userApi.create(userData)
      if (data.success && data.data) {
        await fetchUsers() // Refresh list
        return { success: true, data: data.data }
      }
      return { success: false, error: data.error }
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error || 'Failed to create user' }
    }
  }

  async function updateUser(id: number, updates: Partial<User>) {
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
      return false
    } catch {
      return false
    }
  }

  async function updatePassword(id: number, password: string) {
    try {
      const { data } = await userApi.updatePassword(id, password)
      return data.success
    } catch {
      return false
    }
  }

  async function deleteUser(id: number) {
    try {
      const { data } = await userApi.delete(id)
      if (data.success) {
        users.value = users.value.filter(u => u.id !== id)
        return true
      }
      return false
    } catch {
      return false
    }
  }

  async function banUser(id: number) {
    try {
      const { data } = await userApi.ban(id)
      if (data.success) {
        const index = users.value.findIndex(u => u.id === id)
        if (index !== -1 && users.value[index]) {
          users.value[index].banned = 1
        }
        return true
      }
      return false
    } catch {
      return false
    }
  }

  async function unbanUser(id: number) {
    try {
      const { data } = await userApi.unban(id)
      if (data.success) {
        const index = users.value.findIndex(u => u.id === id)
        if (index !== -1 && users.value[index]) {
          users.value[index].banned = 0
        }
        return true
      }
      return false
    } catch {
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
