import axios from 'axios'
import db from '../db'

const DNSPOD_API_BASE = 'https://dnsapi.cn'

interface DnspodRecord {
  id: string
  name: string
  type: string
  value: string
  priority: number
  ttl: number
  enabled: boolean
}

function getToken(): string | null {
  const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get('DNSPOD_TOKEN') as { value: string } | undefined
  return setting?.value || null
}

async function dnspodRequest(action: string, data: Record<string, string>) {
  const token = getToken()
  if (!token) {
    throw new Error('DNSPod token not configured')
  }

  try {
    const response = await axios.post(`${DNSPOD_API_BASE}/${action}`, {
      login_token: token,
      format: 'json',
      ...data
    })
    return response.data
  } catch (error: any) {
    if (error.response?.data) {
      throw new Error(error.response.data.status?.message || 'DNSPod API error')
    }
    throw error
  }
}

export async function createDomain(domainName: string): Promise<string | null> {
  try {
    const result = await dnspodRequest('Domain.Create', {
      domain: domainName
    })
    return result.domain.id?.toString() || null
  } catch (error: any) {
    console.error('Failed to create domain in DNSPod:', error.message)
    return null
  }
}

export async function deleteDomain(domainName: string): Promise<boolean> {
  try {
    await dnspodRequest('Domain.Remove', {
      domain: domainName
    })
    return true
  } catch (error: any) {
    console.error('Failed to delete domain from DNSPod:', error.message)
    return false
  }
}

export async function createRecord(
  domainName: string,
  record: { name: string; type: string; value: string; priority: number; ttl: number }
): Promise<string | null> {
  try {
    const result = await dnspodRequest('Record.Create', {
      domain: domainName,
      sub_domain: record.name,
      record_type: record.type,
      value: record.value,
      priority: record.priority.toString(),
      ttl: record.ttl.toString()
    })
    return result.record.id?.toString() || null
  } catch (error: any) {
    console.error('Failed to create record in DNSPod:', error.message)
    return null
  }
}

export async function updateRecord(
  domainName: string,
  recordId: string,
  record: { name: string; type: string; value: string; priority: number; ttl: number }
): Promise<boolean> {
  try {
    await dnspodRequest('Record.Modify', {
      domain: domainName,
      record_id: recordId,
      sub_domain: record.name,
      record_type: record.type,
      value: record.value,
      priority: record.priority.toString(),
      ttl: record.ttl.toString()
    })
    return true
  } catch (error: any) {
    console.error('Failed to update record in DNSPod:', error.message)
    return false
  }
}

export async function deleteRecord(domainName: string, recordId: string): Promise<boolean> {
  try {
    await dnspodRequest('Record.Remove', {
      domain: domainName,
      record_id: recordId
    })
    return true
  } catch (error: any) {
    console.error('Failed to delete record from DNSPod:', error.message)
    return false
  }
}

export async function syncRecordsFromDnspod(domainName: string, domainId: number): Promise<DnspodRecord[]> {
  try {
    const result = await dnspodRequest('Record.List', {
      domain: domainName
    })

    const records = result.records || []

    const existingRecords = db.prepare('SELECT record_id FROM dns_records WHERE domain_id = ?').all(domainId) as { record_id: string }[]
    const existingIds = new Set(existingRecords.map(r => r.record_id))

    for (const record of records) {
      if (!existingIds.has(record.id.toString())) {
        db.prepare(`
          INSERT INTO dns_records (domain_id, record_id, name, type, value, priority, ttl, enabled)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          domainId,
          record.id.toString(),
          record.name,
          record.type,
          record.line || record.value,
          record.priority || 10,
          record.ttl || 600,
          record.status === 'enabled' ? 1 : 0
        )
      }
    }

    return records.map((r: any) => ({
      id: r.id.toString(),
      name: r.name,
      type: r.type,
      value: r.value,
      priority: r.priority || 10,
      ttl: r.ttl || 600,
      enabled: r.status === 'enabled'
    }))
  } catch (error: any) {
    console.error('Failed to sync records from DNSPod:', error.message)
    return []
  }
}

export { getToken }
