import { defineStore } from 'pinia'
import { ref } from 'vue'
import { domainApi, dnsApi } from '@/api'
import type { Domain, DnsRecord } from '@/types'

export const useDomainStore = defineStore('domains', () => {
  const domains = ref<Domain[]>([])
  const records = ref<DnsRecord[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchDomains() {
    loading.value = true
    error.value = null
    try {
      const { data } = await domainApi.getList()
      if (data.success && data.data) {
        domains.value = data.data
      }
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function createDomain(name: string, purpose?: string) {
    loading.value = true
    error.value = null
    try {
      const { data } = await domainApi.create(name, purpose)
      if (data.success && data.data) {
        domains.value.unshift(data.data)
        return true
      }
      error.value = data.error || 'Failed to create domain'
      return false
    } catch (e: any) {
      error.value = e.message || 'Failed to create domain'
      if (import.meta.env.DEV) {
        console.error('Failed to create domain:', e.message)
      }
      return false
    } finally {
      loading.value = false
    }
  }

  async function deleteDomain(id: number) {
    error.value = null
    try {
      const { data } = await domainApi.delete(id)
      if (data.success) {
        domains.value = domains.value.filter(d => d.id !== id)
        return true
      }
      error.value = data.error || 'Failed to delete domain'
      return false
    } catch (e: any) {
      error.value = e.message || 'Failed to delete domain'
      if (import.meta.env.DEV) {
        console.error('Failed to delete domain:', e.message)
      }
      return false
    }
  }

  async function approveDomain(id: number, userId: number) {
    error.value = null
    try {
      const { data } = await domainApi.approve(id, userId)
      if (data.success) {
        await fetchDomains()
        return true
      }
      error.value = data.error || 'Failed to approve domain'
      return false
    } catch (e: any) {
      error.value = e.message || 'Failed to approve domain'
      if (import.meta.env.DEV) {
        console.error('Failed to approve domain:', e.message)
      }
      return false
    }
  }

  async function rejectDomain(id: number, reason?: string) {
    error.value = null
    try {
      const { data } = await domainApi.reject(id, reason)
      if (data.success) {
        await fetchDomains()
        return true
      }
      error.value = data.error || 'Failed to reject domain'
      return false
    } catch (e: any) {
      error.value = e.message || 'Failed to reject domain'
      if (import.meta.env.DEV) {
        console.error('Failed to reject domain:', e.message)
      }
      return false
    }
  }

  async function suspendDomain(id: number) {
    error.value = null
    try {
      const { data } = await domainApi.suspend(id)
      if (data.success) {
        const index = domains.value.findIndex(d => d.id === id)
        if (index !== -1 && domains.value[index]) {
          domains.value[index].suspended = 1
        }
        return true
      }
      error.value = data.error || 'Failed to suspend domain'
      return false
    } catch (e: any) {
      error.value = e.message || 'Failed to suspend domain'
      if (import.meta.env.DEV) {
        console.error('Failed to suspend domain:', e.message)
      }
      return false
    }
  }

  async function resumeDomain(id: number) {
    error.value = null
    try {
      const { data } = await domainApi.resume(id)
      if (data.success) {
        const index = domains.value.findIndex(d => d.id === id)
        if (index !== -1 && domains.value[index]) {
          domains.value[index].suspended = 0
        }
        return true
      }
      error.value = data.error || 'Failed to resume domain'
      return false
    } catch (e: any) {
      error.value = e.message || 'Failed to resume domain'
      if (import.meta.env.DEV) {
        console.error('Failed to resume domain:', e.message)
      }
      return false
    }
  }

  async function deleteFromDnspod(id: number) {
    error.value = null
    try {
      const { data } = await domainApi.deleteFromDnspod(id)
      if (data.success) {
        domains.value = domains.value.filter(d => d.id !== id)
        return true
      }
      error.value = data.error || 'Failed to delete domain from DNSPod'
      return false
    } catch (e: any) {
      error.value = e.message || 'Failed to delete domain from DNSPod'
      if (import.meta.env.DEV) {
        console.error('Failed to delete domain from DNSPod:', e.message)
      }
      return false
    }
  }

  async function fetchRecords(domainName: string) {
    loading.value = true
    error.value = null
    try {
      const { data } = await dnsApi.getRecords(domainName)
      if (data.success && data.data) {
        records.value = data.data
      }
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function createRecord(domain: string, record: Partial<DnsRecord>) {
    try {
      const { data } = await dnsApi.createRecord(domain, record)
      if (data.success && data.data) {
        records.value.push(data.data)
        return true
      }
      throw new Error(data.error || 'Failed to create record')
    } catch (error: any) {
      throw error
    }
  }

  async function updateRecord(domain: string, recordId: number, record: Partial<DnsRecord>) {
    error.value = null
    try {
      const { data } = await dnsApi.updateRecord(domain, recordId, record)
      if (data.success && data.data) {
        const index = records.value.findIndex(r => r.id === recordId)
        if (index !== -1) {
          records.value[index] = data.data
        }
        return true
      }
      error.value = data.error || 'Failed to update record'
      return false
    } catch (e: any) {
      error.value = e.message || 'Failed to update record'
      if (import.meta.env.DEV) {
        console.error('Failed to update DNS record:', e.message)
      }
      return false
    }
  }

  async function deleteRecord(domain: string, recordId: number) {
    error.value = null
    try {
      const { data } = await dnsApi.deleteRecord(domain, recordId)
      if (data.success) {
        records.value = records.value.filter(r => r.id !== recordId)
        return true
      }
      error.value = data.error || 'Failed to delete record'
      return false
    } catch (e: any) {
      error.value = e.message || 'Failed to delete record'
      if (import.meta.env.DEV) {
        console.error('Failed to delete DNS record:', e.message)
      }
      return false
    }
  }

  return {
    domains,
    records,
    loading,
    error,
    fetchDomains,
    createDomain,
    deleteDomain,
    approveDomain,
    rejectDomain,
    suspendDomain,
    resumeDomain,
    deleteFromDnspod,
    fetchRecords,
    createRecord,
    updateRecord,
    deleteRecord
  }
})
