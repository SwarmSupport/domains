import axios from 'axios'
import db from '../db'

// DNSPod API endpoint (International version)
const DNSPOD_API_BASE = 'https://api.dnspod.com'

// DNS record type
interface DnspodRecord {
  id: string
  name: string
  type: string
  value: string
  priority: number
  ttl: number
  enabled: boolean
}

// DNSPod API response
interface DnspodResponse {
  status: { code: string; message: string }
  records?: DnspodRecordItem[]
  domains?: DnspodDomain[]
  domain?: { id: string }
  record?: { id: string }
}

interface DnspodRecordItem {
  id: string
  name: string
  type: string
  value: string
  priority: string
  ttl: string
  enabled: string // '1' = enabled, '0' = disabled
}

interface DnspodDomain {
  id: string
  name: string
}

/**
 * Get DNSPod API token from database settings
 */
function getToken(): string | null {
  const tokenSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('DNSPOD_TOKEN') as { value: string } | undefined
  return tokenSetting?.value || null
}

/**
 * Get domain suffixes from settings
 */
function getDomainSuffixes(): string[] {
  const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get('DOMAIN_SUFFIXES') as { value: string } | undefined
  if (!setting?.value) return []
  return setting.value.split('\n').map(s => s.trim().toLowerCase()).filter(s => s.length > 0)
}

/**
 * Make request to DNSPod API with Token authentication
 */
async function dnspodRequest(action: string, params: Record<string, string | number> = {}): Promise<DnspodResponse> {
  const token = getToken()
  if (!token) {
    throw new Error('DNSPod token not configured')
  }

  const requestParams = {
    login_token: token,
    format: 'json',
    lang: 'en',
    ...params
  }

  try {
    const response = await axios.post(
      `${DNSPOD_API_BASE}/${action}`,
      new URLSearchParams(requestParams as Record<string, string>).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    )

    const data = response.data

    if (data.status?.code === 'error') {
      throw new Error(data.status?.message || 'DNSPod API error')
    }

    return data
  } catch (error: any) {
    if (error.response?.data?.status?.message) {
      throw new Error(error.response.data.status.message)
    }
    throw error
  }
}

/**
 * Extract parent domain and subdomain part from full domain name
 * For example: "sub.example.com" with suffixes ["example.com"]
 * Returns { parentDomain: "example.com", subDomain: "sub" }
 */
function extractParentAndSubDomain(fullDomain: string): { parentDomain: string; subDomain: string } | null {
  const suffixes = getDomainSuffixes()
  const lowerDomain = fullDomain.toLowerCase()

  for (const suffix of suffixes) {
    if (lowerDomain === suffix) {
      // This is the parent domain itself, not a subdomain
      return null
    }
    if (lowerDomain.endsWith('.' + suffix)) {
      const subDomain = lowerDomain.slice(0, -suffix.length - 1)
      return { parentDomain: suffix, subDomain }
    }
  }

  // No matching suffix found - try to find by checking common patterns
  const parts = lowerDomain.split('.')
  if (parts.length >= 2) {
    // Assume last two parts form the parent domain
    const parentDomain = parts.slice(-2).join('.')
    const subDomain = parts.slice(0, -2).join('.')
    return { parentDomain, subDomain: subDomain || '@' }
  }

  return null
}

/**
 * Find domain in DNSPod by name
 */
async function findDomainInDnspod(domainName: string): Promise<DnspodDomain | null> {
  const listResult = await dnspodRequest('Domain.List', {})
  const domain = listResult.domains?.find((d: any) => d.name.toLowerCase() === domainName.toLowerCase())
  return domain || null
}

// ==================== Domain Operations ====================

export async function createDomain(domainName: string): Promise<string | null> {
  try {
    const result = await dnspodRequest('Domain.Create', { domain: domainName })
    return result.domain?.id || null
  } catch (error: any) {
    console.error('Failed to create domain in DNSPod:', error.message)
    return null
  }
}

export async function deleteDomain(domainName: string): Promise<boolean> {
  try {
    const domain = await findDomainInDnspod(domainName)
    if (!domain) {
      console.error('Domain not found in DNSPod:', domainName)
      return false
    }

    await dnspodRequest('Domain.Remove', { domain_id: domain.id })
    return true
  } catch (error: any) {
    console.error('Failed to delete domain from DNSPod:', error.message)
    return false
  }
}

export async function pauseDomain(fullDomain: string): Promise<boolean> {
  try {
    // Extract parent domain from full domain (e.g., "sub.example.com" -> "example.com")
    const domainInfo = extractParentAndSubDomain(fullDomain)
    if (!domainInfo) {
      console.error('Could not determine parent domain for:', fullDomain)
      return false
    }

    const domain = await findDomainInDnspod(domainInfo.parentDomain)
    if (!domain) {
      console.error('Parent domain not found in DNSPod:', domainInfo.parentDomain)
      return false
    }

    await dnspodRequest('Domain.Pause', { domain_id: domain.id })
    return true
  } catch (error: any) {
    console.error('Failed to pause domain in DNSPod:', error.message)
    return false
  }
}

export async function resumeDomain(fullDomain: string): Promise<boolean> {
  try {
    // Extract parent domain from full domain (e.g., "sub.example.com" -> "example.com")
    const domainInfo = extractParentAndSubDomain(fullDomain)
    if (!domainInfo) {
      console.error('Could not determine parent domain for:', fullDomain)
      return false
    }

    const domain = await findDomainInDnspod(domainInfo.parentDomain)
    if (!domain) {
      console.error('Parent domain not found in DNSPod:', domainInfo.parentDomain)
      return false
    }

    await dnspodRequest('Domain.Start', { domain_id: domain.id })
    return true
  } catch (error: any) {
    console.error('Failed to resume domain in DNSPod:', error.message)
    return false
  }
}

// ==================== Record Operations ====================

export async function createRecord(
  fullDomain: string,
  record: { name: string; type: string; value: string; priority: number; ttl: number }
): Promise<string | null> {
  try {
    // Extract parent domain and subdomain
    const domainInfo = extractParentAndSubDomain(fullDomain)
    if (!domainInfo) {
      console.error('Could not determine parent domain for:', fullDomain)
      return null
    }

    const { parentDomain, subDomain } = domainInfo

    // Find the parent domain in DNSPod
    const domain = await findDomainInDnspod(parentDomain)
    if (!domain) {
      console.error('Parent domain not found in DNSPod:', parentDomain)
      return null
    }

    // The record name should be combined with subDomain
    const recordName = subDomain === '@' ? record.name : `${subDomain}.${record.name}`

    const result = await dnspodRequest('Record.Create', {
      domain_id: domain.id,
      sub_domain: recordName,
      record_type: record.type,
      value: record.value,
      priority: record.priority,
      ttl: record.ttl
    })

    return result.record?.id || null
  } catch (error: any) {
    console.error('Failed to create record in DNSPod:', error.message)
    return null
  }
}

export async function updateRecord(
  fullDomain: string,
  recordId: string,
  record: { name: string; type: string; value: string; priority: number; ttl: number }
): Promise<boolean> {
  try {
    // Extract parent domain and subdomain
    const domainInfo = extractParentAndSubDomain(fullDomain)
    if (!domainInfo) {
      return false
    }

    const { parentDomain, subDomain } = domainInfo

    // Find the parent domain in DNSPod
    const domain = await findDomainInDnspod(parentDomain)
    if (!domain) {
      return false
    }

    const recordName = subDomain === '@' ? record.name : `${subDomain}.${record.name}`

    await dnspodRequest('Record.Modify', {
      domain_id: domain.id,
      record_id: recordId,
      sub_domain: recordName,
      record_type: record.type,
      value: record.value,
      priority: record.priority,
      ttl: record.ttl
    })
    return true
  } catch (error: any) {
    console.error('Failed to update record in DNSPod:', error.message)
    return false
  }
}

export async function deleteRecord(fullDomain: string, recordId: string): Promise<boolean> {
  try {
    // Extract parent domain and subdomain
    const domainInfo = extractParentAndSubDomain(fullDomain)
    if (!domainInfo) {
      return false
    }

    const { parentDomain } = domainInfo

    // Find the parent domain in DNSPod
    const domain = await findDomainInDnspod(parentDomain)
    if (!domain) {
      return false
    }

    await dnspodRequest('Record.Remove', {
      domain_id: domain.id,
      record_id: recordId
    })
    return true
  } catch (error: any) {
    console.error('Failed to delete record from DNSPod:', error.message)
    return false
  }
}

// ==================== Sync Operations ====================

export async function syncRecordsFromDnspod(fullDomain: string, domainId: number): Promise<DnspodRecord[]> {
  try {
    // Extract parent domain from full domain (e.g., "sub.example.com" -> "example.com")
    const domainInfo = extractParentAndSubDomain(fullDomain)
    if (!domainInfo) {
      console.error('Could not determine parent domain for:', fullDomain)
      return []
    }

    const domain = await findDomainInDnspod(domainInfo.parentDomain)
    if (!domain) {
      console.error('Parent domain not found in DNSPod:', domainInfo.parentDomain)
      return []
    }

    // Get records for this domain
    const recordResult = await dnspodRequest('Record.List', { domain_id: domain.id })
    const records = recordResult.records || []

    // Get existing record IDs in local database
    const existingRecords = db.prepare('SELECT record_id FROM dns_records WHERE domain_id = ?').all(domainId) as { record_id: string }[]
    const existingIds = new Set(existingRecords.map(r => r.record_id))

    // Insert new records that don't exist locally
    for (const record of records) {
      if (!existingIds.has(record.id)) {
        db.prepare(`
          INSERT INTO dns_records (domain_id, record_id, name, type, value, priority, ttl, enabled)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          domainId,
          record.id,
          record.name,
          record.type,
          record.value,
          parseInt(record.priority) || 10,
          parseInt(record.ttl) || 600,
          record.enabled === '1' ? 1 : 0
        )
      }
    }

    return records.map(r => ({
      id: r.id,
      name: r.name,
      type: r.type,
      value: r.value,
      priority: parseInt(r.priority) || 10,
      ttl: parseInt(r.ttl) || 600,
      enabled: r.enabled === '1'
    }))
  } catch (error: any) {
    console.error('Failed to sync records from DNSPod:', error.message)
    return []
  }
}

export { getToken as getCredentials }
