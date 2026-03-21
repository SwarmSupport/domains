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

  return {
    users,
    loading,
    error,
    fetchUsers,
    updateUser,
    updatePassword,
    deleteUser
  }
})
