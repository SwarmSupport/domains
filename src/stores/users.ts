import { defineStore } from 'pinia'
import { ref } from 'vue'
import { userApi } from '@/api'
import type { User } from '@/types'

export const useUserStore = defineStore('users', () => {
  const users = ref<User[]>([])
  const loading = ref(false)

  async function fetchUsers() {
    loading.value = true
    try {
      const { data } = await userApi.getList()
      if (data.success && data.data) {
        users.value = data.data
      }
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
    fetchUsers,
    updateUser,
    deleteUser
  }
})
