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

// Tencent Cloud API v3.0 Signature
function getSignature(
  method: string,
  endpoint: string,
  action: string,
  payload: Record<string, any>,
  secretId: string,
  secretKey: string
): string {
  const service = 'dnspod'
  const host = 'dnspod.tencentcloudapi.com'
  const region = 'ap-guangzhou'
  const version = DNSPOD_API_VERSION
  const algorithm = 'TC3-HMAC-SHA256'
  const timestamp = Math.floor(Date.now() / 1000)
  const date = new Date(timestamp * 1000).toISOString().substr(0, 10)

  // Step 1: Build canonical request string
  const httpRequestMethod = method
  const canonicalUri = '/'
  const canonicalQueryString = ''
  const contentType = 'application/json; charset=utf-8'
  const canonicalHeaders = `content-type:${contentType}
host:${host}
x-tc-action:${action.toLowerCase()}
`
  const signedHeaders = 'content-type;host;x-tc-action'

  const hashedRequestPayload = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')
  const canonicalRequest = `${httpRequestMethod}
${canonicalUri}
${canonicalQueryString}
${canonicalHeaders}
${signedHeaders}
${hashedRequestPayload}`

  // Step 2: Build string to sign
  const credentialScope = `${date}/${service}/tc3_request`
  const hashedCanonicalRequest = crypto.createHash('sha256').update(canonicalRequest).digest('hex')
  const stringToSign = `${algorithm}
${timestamp}
${credentialScope}
${hashedCanonicalRequest}`

  // Step 3: Calculate signature
  const secretDate = crypto.createHmac('sha256', `TC3${secretKey}`).update(date).digest()
  const secretService = crypto.createHmac('sha256', secretDate).update(service).digest()
  const secretSigning = crypto.createHmac('sha256', secretService).update('tc3_request').digest()
  const signature = crypto.createHmac('sha256', secretSigning).update(stringToSign).digest('hex')

  // Step 4: Build authorization
  const authorization = `${algorithm} Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  return authorization
}

// Tencent Cloud API v3 signature
async function dnspodRequest(action: string, payload: Record<string, any>) {
  const credentials = getCredentials()
  if (!credentials) {
    throw new Error('DNSPod credentials not configured')
  }

  const { secretId, secretKey } = credentials
  const endpoint = 'dnspod.tencentcloudapi.com'

  // Get signature
  const authorization = getSignature('POST', endpoint, action, payload, secretId, secretKey)

  // Build request headers
  const headers = {
    'Authorization': authorization,
    'Content-Type': 'application/json; charset=utf-8',
    'Host': endpoint,
    'X-TC-Action': action,
    'X-TC-Timestamp': Math.floor(Date.now() / 1000).toString(),
    'X-TC-Version': DNSPOD_API_VERSION,
    'X-TC-Region': 'ap-guangzhou'
  }

  console.log('DNSPod Request URL:', `https://${endpoint}`)
  console.log('DNSPod Request Payload:', JSON.stringify(payload))

  try {
    const response = await axios.post(`https://${endpoint}`, payload, { headers })

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
