import axios from 'axios'
import crypto from 'crypto'
import db from '../db'

const DNSPOD_API_BASE = 'https://dnspod.tencentcloudapi.com'
const DNSPOD_API_VERSION = '2021-03-23'

interface DnspodRecord {
  id: string
  name: string
  type: string
  value: string
  priority: number
  ttl: number
  enabled: boolean
}

interface DnspodCredentials {
  secretId: string
  secretKey: string
}

function getCredentials(): DnspodCredentials | null {
  const secretIdSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('DNSPOD_SECRET_ID') as { value: string } | undefined
  const secretKeySetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('DNSPOD_SECRET_KEY') as { value: string } | undefined

  const secretId = secretIdSetting?.value || null
  const secretKey = secretKeySetting?.value || null

  if (!secretId || !secretKey) {
    return null
  }

  return { secretId, secretKey }
}

function sha256Encrypt(secretKey: string, signStr: string): string {
  const hmac = crypto.createHmac('sha256', secretKey)
  hmac.update(signStr)
  return hmac.digest('hex')
}

async function dnspodRequest(action: string, data: Record<string, string | number>) {
  const credentials = getCredentials()
  if (!credentials) {
    throw new Error('DNSPod credentials not configured')
  }

  const { secretId, secretKey } = credentials
  const timestamp = Math.floor(Date.now() / 1000)
  const nonce = Math.floor(Math.random() * 1000000)

  // Build the string to sign for Signature
  const signedParams = {
    Action: action,
    Version: DNSPOD_API_VERSION,
    Timestamp: timestamp,
    Nonce: nonce,
    SecretId: secretId,
    ...data
  }

  // Sort parameters alphabetically
  const sortedKeys = Object.keys(signedParams).sort()
  const signStr = sortedKeys.map(key => `${key}=${signedParams[key]}`).join('&')

  // Calculate signature
  const signature = sha256Encrypt(secretKey, signStr)

  try {
    const response = await axios.post(DNSPOD_API_BASE, {
      Action: action,
      Version: DNSPOD_API_VERSION,
      Timestamp: timestamp,
      Nonce: nonce,
      SecretId: secretId,
      Signature: signature,
      ...data
    })

    if (response.data.Response?.Error) {
      throw new Error(response.data.Response.Error.Message || 'DNSPod API error')
    }

    return response.data.Response || response.data
  } catch (error: any) {
    if (error.response?.data) {
      throw new Error(error.response.data.status?.message || 'DNSPod API error')
    }
    throw error
  }
}

export async function createDomain(domainName: string): Promise<string | null> {
  try {
    const result = await dnspodRequest('CreateDomain', {
      DomainName: domainName
    })
    return result.Domain?.DomainId?.toString() || null
  } catch (error: any) {
    console.error('Failed to create domain in DNSPod:', error.message)
    return null
  }
}

export async function deleteDomain(domainName: string): Promise<boolean> {
  try {
    await dnspodRequest('DeleteDomain', {
      DomainName: domainName
    })
    return true
  } catch (error: any) {
    console.error('Failed to delete domain from DNSPod:', error.message)
    return false
  }
}

export async function pauseDomain(domainName: string): Promise<boolean> {
  try {
    await dnspodRequest('PauseDomain', {
      DomainName: domainName
    })
    return true
  } catch (error: any) {
    console.error('Failed to pause domain in DNSPod:', error.message)
    return false
  }
}

export async function resumeDomain(domainName: string): Promise<boolean> {
  try {
    await dnspodRequest('StartDomain', {
      DomainName: domainName
    })
    return true
  } catch (error: any) {
    console.error('Failed to resume domain in DNSPod:', error.message)
    return false
  }
}

export async function createRecord(
  domainName: string,
  record: { name: string; type: string; value: string; priority: number; ttl: number }
): Promise<string | null> {
  try {
    const result = await dnspodRequest('CreateRecord', {
      DomainName: domainName,
      SubDomain: record.name,
      RecordType: record.type,
      Value: record.value,
      Priority: record.priority,
      TTL: record.ttl
    })
    return result.RecordId?.toString() || null
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
    await dnspodRequest('ModifyRecord', {
      DomainName: domainName,
      RecordId: parseInt(recordId),
      SubDomain: record.name,
      RecordType: record.type,
      Value: record.value,
      Priority: record.priority,
      TTL: record.ttl
    })
    return true
  } catch (error: any) {
    console.error('Failed to update record in DNSPod:', error.message)
    return false
  }
}

export async function deleteRecord(domainName: string, recordId: string): Promise<boolean> {
  try {
    await dnspodRequest('DeleteRecord', {
      DomainName: domainName,
      RecordId: parseInt(recordId)
    })
    return true
  } catch (error: any) {
    console.error('Failed to delete record from DNSPod:', error.message)
    return false
  }
}

export async function syncRecordsFromDnspod(domainName: string, domainId: number): Promise<DnspodRecord[]> {
  try {
    const result = await dnspodRequest('DescribeRecordList', {
      DomainName: domainName
    })

    const records = result.Records || []

    const existingRecords = db.prepare('SELECT record_id FROM dns_records WHERE domain_id = ?').all(domainId) as { record_id: string }[]
    const existingIds = new Set(existingRecords.map(r => r.record_id))

    for (const record of records) {
      if (!existingIds.has(record.RecordId.toString())) {
        db.prepare(`
          INSERT INTO dns_records (domain_id, record_id, name, type, value, priority, ttl, enabled)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          domainId,
          record.RecordId.toString(),
          record.Name,
          record.Type,
          record.Value,
          record.Priority || 10,
          record.TTL || 600,
          record.Status === 'ENABLED' ? 1 : 0
        )
      }
    }

    return records.map((r: any) => ({
      id: r.RecordId.toString(),
      name: r.Name,
      type: r.Type,
      value: r.Value,
      priority: r.Priority || 10,
      ttl: r.TTL || 600,
      enabled: r.Status === 'ENABLED'
    }))
  } catch (error: any) {
    console.error('Failed to sync records from DNSPod:', error.message)
    return []
  }
}

export { getCredentials as getToken }
