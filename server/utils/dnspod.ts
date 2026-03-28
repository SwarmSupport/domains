import axios from 'axios'
import db from '../db'

// DNSPod API endpoint (International version)
const DNSPOD_API_BASE = 'https://api.dnspod.com'

// DNS record type returned by sync
export interface DnspodRecord {
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

// Cache for domain lookups to avoid repeated API calls
const domainCache = new Map<string, { domain: DnspodDomain | null; timestamp: number }>()
const CACHE_TTL = 60000 // 1 minute cache

/**
 * Get DNSPod API token from database settings
 */
function getToken(): string | null {
  const tokenSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('DNSPOD_TOKEN') as { value: string } | undefined
  return tokenSetting?.value || null
}

/**
 * Get domain suffixes from settings (cached)
 */
let cachedSuffixes: string[] | null = null
let suffixesCacheTime = 0

function getDomainSuffixes(): string[] {
  const now = Date.now()
  if (cachedSuffixes && now - suffixesCacheTime < CACHE_TTL) {
    return cachedSuffixes
  }
  const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get('DOMAIN_SUFFIXES') as { value: string } | undefined
  cachedSuffixes = setting?.value
    ? setting.value.split('\n').map(s => s.trim().toLowerCase()).filter(s => s.length > 0)
    : []
  suffixesCacheTime = now
  return cachedSuffixes
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
export function extractParentAndSubDomain(fullDomain: string): { parentDomain: string; subDomain: string } | null {
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
 * Find domain in DNSPod by name (with caching)
 */
async function findDomainInDnspod(domainName: string): Promise<DnspodDomain | null> {
  const now = Date.now()
  const cached = domainCache.get(domainName.toLowerCase())

  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.domain
  }

  try {
    const listResult = await dnspodRequest('Domain.List', {})

    // Log the response for debugging
    console.log('[DNSPod] Domain.List response:', JSON.stringify(listResult).slice(0, 500))

    if (!listResult.domains || !Array.isArray(listResult.domains)) {
      console.error('[DNSPod] No domains returned or invalid response format')
      domainCache.set(domainName.toLowerCase(), { domain: null, timestamp: now })
      return null
    }

    const domain = listResult.domains.find((d: any) => d.name.toLowerCase() === domainName.toLowerCase()) || null

    if (!domain) {
      console.error('[DNSPod] Domain not found:', domainName, 'Available domains:', listResult.domains.map((d: any) => d.name))
    }

    domainCache.set(domainName.toLowerCase(), { domain, timestamp: now })
    return domain
  } catch (error: any) {
    console.error('[DNSPod] Failed to fetch domains:', error.message)
    domainCache.set(domainName.toLowerCase(), { domain: null, timestamp: now })
    return null
  }
}

/**
 * Find a specific record in a parent domain
 */
async function findRecordInDomain(
  parentDomainId: string,
  recordName: string
): Promise<DnspodRecordItem | null> {
  const recordResult = await dnspodRequest('Record.List', { domain_id: parentDomainId })
  const records = recordResult.records || []
  return records.find((r: any) => r.name === recordName) || null
}

/**
 * Build the full record name for DNSPod
 * e.g., subDomain = "mysite", recordName = "www" -> "www.mysite"
 * e.g., subDomain = "mysite", recordName = "@" -> "mysite"
 */
function buildRecordName(subDomain: string, recordName: string): string {
  if (recordName === '@' || recordName === '') {
    return subDomain
  }
  return `${recordName}.${subDomain}`
}

// ==================== Domain Operations ====================

export async function createDomain(domainName: string): Promise<string | null> {
  try {
    const domainInfo = extractParentAndSubDomain(domainName)

    if (domainInfo) {
      // This is a subdomain - just record locally, DNS records created later
      return domainName
    } else {
      // Root domain - create in DNSPod
      const result = await dnspodRequest('Domain.Create', { domain: domainName })
      // Clear cache since we added a new domain
      domainCache.clear()
      return result.domain?.id || null
    }
  } catch (error: any) {
    console.error('Failed to create domain in DNSPod:', error.message)
    return null
  }
}

export async function deleteDomain(fullDomain: string): Promise<boolean> {
  try {
    const domainInfo = extractParentAndSubDomain(fullDomain)

    if (!domainInfo) {
      // Root domain - delete entire domain
      const domain = await findDomainInDnspod(fullDomain)
      if (!domain) {
        console.error('Domain not found in DNSPod:', fullDomain)
        return false
      }
      await dnspodRequest('Domain.Remove', { domain_id: domain.id })
      domainCache.clear()
      return true
    }

    // Subdomain - find and delete the specific record
    const parentDomain = await findDomainInDnspod(domainInfo.parentDomain)
    if (!parentDomain) {
      console.error('Parent domain not found in DNSPod:', domainInfo.parentDomain)
      return false
    }

    const recordName = buildRecordName(domainInfo.subDomain, domainInfo.subDomain)
    const targetRecord = await findRecordInDomain(parentDomain.id, recordName)
    if (!targetRecord) {
      console.error('Subdomain record not found in DNSPod:', recordName)
      return false
    }

    await dnspodRequest('Record.Remove', {
      domain_id: parentDomain.id,
      record_id: targetRecord.id
    })
    return true
  } catch (error: any) {
    console.error('Failed to delete domain from DNSPod:', error.message)
    return false
  }
}

export async function pauseDomain(fullDomain: string): Promise<boolean> {
  try {
    const domainInfo = extractParentAndSubDomain(fullDomain)

    if (!domainInfo) {
      // Root domain - pause entire domain
      const domain = await findDomainInDnspod(fullDomain)
      if (!domain) {
        console.error('Domain not found in DNSPod:', fullDomain)
        return false
      }
      await dnspodRequest('Domain.Pause', { domain_id: domain.id })
      return true
    }

    // Subdomain - disable the specific record
    const parentDomain = await findDomainInDnspod(domainInfo.parentDomain)
    if (!parentDomain) {
      console.error('Parent domain not found in DNSPod:', domainInfo.parentDomain)
      return false
    }

    const recordName = buildRecordName(domainInfo.subDomain, domainInfo.subDomain)
    const targetRecord = await findRecordInDomain(parentDomain.id, recordName)
    if (!targetRecord) {
      console.error('Subdomain record not found in DNSPod:', recordName)
      return false
    }

    await dnspodRequest('Record.Status', {
      domain_id: parentDomain.id,
      record_id: targetRecord.id,
      status: 'disable'
    })
    return true
  } catch (error: any) {
    console.error('Failed to pause domain in DNSPod:', error.message)
    return false
  }
}

export async function resumeDomain(fullDomain: string): Promise<boolean> {
  try {
    const domainInfo = extractParentAndSubDomain(fullDomain)

    if (!domainInfo) {
      // Root domain - resume entire domain
      const domain = await findDomainInDnspod(fullDomain)
      if (!domain) {
        console.error('Domain not found in DNSPod:', fullDomain)
        return false
      }
      await dnspodRequest('Domain.Start', { domain_id: domain.id })
      return true
    }

    // Subdomain - enable the specific record
    const parentDomain = await findDomainInDnspod(domainInfo.parentDomain)
    if (!parentDomain) {
      console.error('Parent domain not found in DNSPod:', domainInfo.parentDomain)
      return false
    }

    const recordName = buildRecordName(domainInfo.subDomain, domainInfo.subDomain)
    const targetRecord = await findRecordInDomain(parentDomain.id, recordName)
    if (!targetRecord) {
      console.error('Subdomain record not found in DNSPod:', recordName)
      return false
    }

    await dnspodRequest('Record.Status', {
      domain_id: parentDomain.id,
      record_id: targetRecord.id,
      status: 'enable'
    })
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
    const domainInfo = extractParentAndSubDomain(fullDomain)
    if (!domainInfo) {
      console.error('Could not determine parent domain for:', fullDomain)
      return null
    }

    const { parentDomain, subDomain } = domainInfo
    console.log('[DNSPod] Creating record - parentDomain:', parentDomain, 'subDomain:', subDomain, 'recordName:', record.name)

    const domain = await findDomainInDnspod(parentDomain)
    if (!domain) {
      console.error('Parent domain not found in DNSPod:', parentDomain)
      return null
    }

    console.log('[DNSPod] Found domain in DNSPod:', domain.id, domain.name)

    const recordName = buildRecordName(subDomain, record.name)
    console.log('[DNSPod] Calling Record.Create with:', { domain_id: domain.id, sub_domain: recordName, record_type: record.type, value: record.value, priority: record.priority, ttl: record.ttl })

    const result = await dnspodRequest('Record.Create', {
      domain_id: domain.id,
      sub_domain: recordName,
      record_type: record.type,
      value: record.value,
      priority: record.priority,
      ttl: record.ttl,
      record_line: 'default' // DNSPod International API uses English line names
    })

    console.log('[DNSPod] Record.Create response:', JSON.stringify(result))

    // DNSPod API returns record.id in the response
    const recordId = result.record?.id
    if (!recordId) {
      console.error('[DNSPod] Record.Create did not return record ID. Response:', result)
      return null
    }

    return recordId
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
    const domainInfo = extractParentAndSubDomain(fullDomain)
    if (!domainInfo) {
      return false
    }

    const { parentDomain, subDomain } = domainInfo
    const domain = await findDomainInDnspod(parentDomain)
    if (!domain) {
      return false
    }

    const recordName = buildRecordName(subDomain, record.name)

    await dnspodRequest('Record.Modify', {
      domain_id: domain.id,
      record_id: recordId,
      sub_domain: recordName,
      record_type: record.type,
      value: record.value,
      priority: record.priority,
      ttl: record.ttl,
      record_line: 'default'
    })
    return true
  } catch (error: any) {
    console.error('Failed to update record in DNSPod:', error.message)
    return false
  }
}

export async function deleteRecord(fullDomain: string, recordId: string): Promise<boolean> {
  try {
    const domainInfo = extractParentAndSubDomain(fullDomain)
    if (!domainInfo) {
      return false
    }

    const { parentDomain } = domainInfo
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

    const recordResult = await dnspodRequest('Record.List', { domain_id: domain.id })
    const records = recordResult.records || []

    // Build the prefix we expect for this subdomain
    // e.g., if subDomain = "mysite", we look for records starting with "mysite." or equals "mysite"
    const subdomainPrefix = domainInfo.subDomain + '.'

    // Filter records that belong to this subdomain
    const matchingRecords = records.filter(r =>
      r.name === domainInfo.subDomain || r.name.startsWith(subdomainPrefix)
    )

    // Get existing record IDs in local database
    const existingRecords = db.prepare('SELECT record_id FROM dns_records WHERE domain_id = ?').all(domainId) as { record_id: string }[]
    const existingIds = new Set(existingRecords.map(r => r.record_id))

    // Insert new records that don't exist locally
    for (const record of matchingRecords) {
      if (!existingIds.has(record.id)) {
        // Extract the relative record name (remove subdomain prefix)
        let relativeName = record.name
        if (record.name.startsWith(subdomainPrefix)) {
          relativeName = record.name.slice(subdomainPrefix.length)
        } else if (record.name === domainInfo.subDomain) {
          relativeName = '@'
        }

        db.prepare(`
          INSERT INTO dns_records (domain_id, record_id, name, type, value, priority, ttl, enabled)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          domainId,
          record.id,
          relativeName,
          record.type,
          record.value,
          parseInt(record.priority) || 10,
          parseInt(record.ttl) || 600,
          record.enabled === '1' ? 1 : 0
        )
      }
    }

    return matchingRecords.map(r => {
      let relativeName = r.name
      if (r.name.startsWith(subdomainPrefix)) {
        relativeName = r.name.slice(subdomainPrefix.length)
      } else if (r.name === domainInfo.subDomain) {
        relativeName = '@'
      }

      return {
        id: r.id,
        name: relativeName,
        type: r.type,
        value: r.value,
        priority: parseInt(r.priority) || 10,
        ttl: parseInt(r.ttl) || 600,
        enabled: r.enabled === '1'
      }
    })
  } catch (error: any) {
    console.error('Failed to sync records from DNSPod:', error.message)
    return []
  }
}

export { getToken as getCredentials }
