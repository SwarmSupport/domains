import axios from 'axios'
import crypto from 'crypto'
import db from '../db'

const DNSPOD_API_BASE = 'https://dnspod.tencentcloudapi.com'
const DNSPOD_API_VERSION = '2021-03-23'
const DNSPOD_SERVICE = 'dnspod'
const DNSPOD_REGION = ''

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

// TC3-HMAC-SHA256 signature algorithm for Tencent Cloud API v3
function tc3HmacSha256(secretKey: string, msg: string): Buffer {
  return crypto.createHmac('sha256', secretKey).update(msg, 'utf8').digest()
}

function sha256Hex(msg: string): string {
  return crypto.createHash('sha256').update(msg, 'utf8').digest('hex')
}

// Tencent Cloud API v3 signature
async function dnspodRequest(action: string, payload: Record<string, any>) {
  const credentials = getCredentials()
  if (!credentials) {
    throw new Error('DNSPod credentials not configured')
  }

  const { secretId, secretKey } = credentials
  const timestamp = Math.floor(Date.now() / 1000)
  const nonce = Math.floor(Math.random() * 1000000)

  // Convert timestamp to YYYYMMDD format for credential scope
  const dateObj = new Date(timestamp * 1000)
  const dateStr = dateObj.toISOString().slice(0, 10).replace(/-/g, '')

  // Build the request body
  const body: Record<string, string> = {
    Action: action,
    Version: DNSPOD_API_VERSION,
    Timestamp: String(timestamp),
    Nonce: String(nonce),
    SecretId: secretId
  }

  // Add payload parameters
  for (const [key, value] of Object.entries(payload)) {
    body[key] = String(value)
  }

  // Sort keys alphabetically
  const sortedKeys = Object.keys(body).sort()

  // Build canonical query string (empty for form-urlencoded POST)
  const canonicalQueryString = ''

  // Build form-urlencoded body for request
  const encodedParts: string[] = []
  for (const key of sortedKeys) {
    const encodedKey = encodeURIComponent(key)
    const encodedValue = encodeURIComponent(body[key])
    encodedParts.push(`${encodedKey}=${encodedValue}`)
  }
  const requestBody = encodedParts.join('&')

  // Build canonical headers (must include content-type and host)
  const contentType = 'application/x-www-form-urlencoded'
  const canonicalHeaders = `content-type:${contentType}\nhost:dnspod.tencentcloudapi.com\n`

  // Signed headers
  const signedHeaders = 'content-type;host'

  // Hash of request body
  const hashedRequestBody = sha256Hex(requestBody)

  // Build canonical request
  const canonicalRequest = [
    'POST',                    // HTTP method
    '/',                       // Canonical URI
    canonicalQueryString,      // Canonical query string
    canonicalHeaders,          // Canonical headers
    signedHeaders,             // Signed headers
    hashedRequestBody          // Hashed request body
  ].join('\n')

  // Build string to sign
  const algorithm = 'TC3-HMAC-SHA256'
  const credentialScope = `${dateStr}/${DNSPOD_SERVICE}/tc3_request`
  const hashedCanonicalRequest = sha256Hex(canonicalRequest)

  const stringToSign = [
    algorithm,
    String(timestamp),
    credentialScope,
    hashedCanonicalRequest
  ].join('\n')

  // Calculate signature using TC3-HMAC-SHA256
  const secretDate = tc3HmacSha256(secretKey, dateStr)
  const secretService = tc3HmacSha256(secretDate, DNSPOD_SERVICE)
  const secretSigning = tc3HmacSha256(secretService, 'tc3_request')
  const signature = crypto.createHmac('sha256', secretSigning).update(stringToSign).digest('hex')

  // Add signature to body
  body.Signature = signature

  // Rebuild request body with signature (signature was added after initial body build)
  const finalEncodedParts: string[] = []
  const finalSortedKeys = Object.keys(body).sort()
  for (const key of finalSortedKeys) {
    const encodedKey = encodeURIComponent(key)
    const encodedValue = encodeURIComponent(body[key])
    finalEncodedParts.push(`${encodedKey}=${encodedValue}`)
  }
  const finalRequestBody = finalEncodedParts.join('&')

  console.log('DNSPod Request URL:', DNSPOD_API_BASE)
  console.log('DNSPod Request Body:', finalRequestBody)

  try {
    // Send the form body string directly
    const response = await axios.post(DNSPOD_API_BASE, finalRequestBody, {
      headers: {
        'Content-Type': contentType
      }
    })

    console.log('DNSPod Response:', JSON.stringify(response.data).substring(0, 500))

    if (response.data.Response?.Error) {
      throw new Error(response.data.Response.Error.Message || 'DNSPod API error')
    }

    return response.data.Response || response.data
  } catch (error: any) {
    console.error('DNSPod API Error:', error.message)
    if (error.response?.data) {
      throw new Error(
        error.response.data.Response?.Error?.Message ||
        error.response.data.status?.message ||
        'DNSPod API error'
      )
    }
    throw error
  }
}

export async function createDomain(domainName: string): Promise<string | null> {
  try {
    const result = await dnspodRequest('CreateDomain', {
      Domain: domainName
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
      Domain: domainName
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
      Domain: domainName
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
      Domain: domainName
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
      Domain: domainName,
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
      Domain: domainName,
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
      Domain: domainName,
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
      Domain: domainName
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
