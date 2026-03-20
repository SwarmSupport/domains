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

  async function createDomain(name: string) {
    loading.value = true
    try {
      const { data } = await domainApi.create(name)
      if (data.success && data.data) {
        domains.value.unshift(data.data)
        return true
      }
      return false
    } finally {
      loading.value = false
    }
  }

  async function deleteDomain(id: number) {
    try {
      const { data } = await domainApi.delete(id)
      if (data.success) {
        domains.value = domains.value.filter(d => d.id !== id)
        return true
      }
      return false
    } catch {
      return false
    }
  }

  async function assignDomain(id: number, userId: number) {
    try {
      const { data } = await domainApi.assign(id, userId)
      if (data.success) {
        await fetchDomains()
        return true
      }
      return false
    } catch {
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
      return false
    } catch {
      return false
    }
  }

  async function updateRecord(domain: string, recordId: number, record: Partial<DnsRecord>) {
    try {
      const { data } = await dnsApi.updateRecord(domain, recordId, record)
      if (data.success && data.data) {
        const index = records.value.findIndex(r => r.id === recordId)
        if (index !== -1) {
          records.value[index] = data.data
        }
        return true
      }
      return false
    } catch {
      return false
    }
  }

  async function deleteRecord(domain: string, recordId: number) {
    try {
      const { data } = await dnsApi.deleteRecord(domain, recordId)
      if (data.success) {
        records.value = records.value.filter(r => r.id !== recordId)
        return true
      }
      return false
    } catch {
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
    assignDomain,
    fetchRecords,
    createRecord,
    updateRecord,
    deleteRecord
  }
})
