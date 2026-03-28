import { Router } from 'express'
import db from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { createRecord, updateRecord, deleteRecord, syncRecordsFromDnspod } from '../utils/dnspod'

const router = Router()

// Valid DNS record types
const VALID_RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA', 'DS', 'NAPTR', 'PTR', 'SSHFP', 'TLSA', 'URI']

// DNS record type validation
function isValidRecordType(type: string): boolean {
  return VALID_RECORD_TYPES.includes(type.toUpperCase())
}

// Input sanitization for DNS record values
function sanitizeRecordValue(type: string, value: string): string {
  // Remove any null bytes
  let sanitized = value.replace(/\0/g, '').trim()

  // Basic validation based on record type
  switch (type.toUpperCase()) {
    case 'A':
      // Validate IPv4 address format
      if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(sanitized)) {
        throw new Error('Invalid IPv4 address format')
      }
      break
    case 'AAAA':
      // Validate IPv6 address format (simplified)
      if (!/^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/.test(sanitized) && !/^::1$/.test(sanitized)) {
        throw new Error('Invalid IPv6 address format')
      }
      break
    case 'CNAME':
    case 'NS':
    case 'MX':
    case 'PTR':
    case 'SRV':
      // Validate domain name format
      if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.?$/.test(sanitized)) {
        throw new Error('Invalid domain name format')
      }
      break
    case 'TXT':
      // TXT records can contain almost anything, but limit length
      if (sanitized.length > 255) {
        throw new Error('TXT record value too long (max 255 characters)')
      }
      break
    case 'CAA':
      // Basic CAA format validation
      if (!/^0 (issue|issuewild|iodef) "?[^\"]+"?$/.test(sanitized)) {
        throw new Error('Invalid CAA record format')
      }
      break
  }

  return sanitized
}

router.use(authMiddleware)

router.get('/:domain/records', (req: AuthRequest, res) => {
  const { domain } = req.params

  const domainRecord = db.prepare('SELECT * FROM domains WHERE name = ?').get(domain) as any
  if (!domainRecord) {
    return res.status(404).json({ success: false, error: '域名不存在' })
  }

  if (req.user?.role !== 'admin' && domainRecord.user_id !== req.user?.id) {
    return res.status(403).json({ success: false, error: '无权限访问' })
  }

  syncRecordsFromDnspod(domain, domainRecord.id)

  const records = db.prepare('SELECT * FROM dns_records WHERE domain_id = ?').all(domainRecord.id)

  res.json({ success: true, data: records })
})

router.post('/:domain/records', async (req: AuthRequest, res) => {
  const { domain } = req.params
  const { name, type, value, priority, ttl } = req.body

  const domainRecord = db.prepare('SELECT * FROM domains WHERE name = ?').get(domain) as any
  if (!domainRecord) {
    return res.status(404).json({ success: false, error: 'Domain not found' })
  }

  if (req.user?.role !== 'admin' && domainRecord.user_id !== req.user?.id) {
    return res.status(403).json({ success: false, error: 'Permission denied' })
  }

  // Validate required fields
  if (!name || !type || !value) {
    return res.status(400).json({ success: false, error: 'Please fill in all required fields' })
  }

  // Validate record type
  if (!isValidRecordType(type)) {
    return res.status(400).json({
      success: false,
      error: `Invalid record type. Valid types: ${VALID_RECORD_TYPES.join(', ')}`
    })
  }

  // Validate and sanitize record value
  let sanitizedValue: string
  try {
    sanitizedValue = sanitizeRecordValue(type, value)
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message })
  }

  // Validate TTL range
  const ttlNum = ttl ? parseInt(ttl) : 600
  if (isNaN(ttlNum) || ttlNum < 1 || ttlNum > 86400) {
    return res.status(400).json({ success: false, error: 'TTL must be between 1 and 86400 seconds' })
  }

  // Validate priority (required for MX, SRV, URI records)
  const priorityNum = priority ? parseInt(priority) : 10
  if (['MX', 'SRV', 'URI'].includes(type.toUpperCase()) && priorityNum < 0) {
    return res.status(400).json({ success: false, error: 'Priority must be a non-negative number' })
  }

  try {
    const dnspodRecordId = await createRecord(domain, {
      name: name.trim(),
      type: type.toUpperCase(),
      value: sanitizedValue,
      priority: priorityNum,
      ttl: ttlNum
    })

    // If DNSPod API failed (parent domain not found or other error), return error
    if (!dnspodRecordId) {
      return res.status(400).json({
        success: false,
        error: 'Failed to create record in DNSPod. Please ensure: 1) The parent domain is added in DNSPod; 2) DNSPod Token has correct permissions; 3) Test DNSPod connection in settings'
      })
    }

    const result = db.prepare(`
      INSERT INTO dns_records (domain_id, record_id, name, type, value, priority, ttl)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      domainRecord.id,
      dnspodRecordId,
      name.trim(),
      type.toUpperCase(),
      sanitizedValue,
      priorityNum,
      ttlNum
    )

    const record = db.prepare('SELECT * FROM dns_records WHERE id = ?').get(result.lastInsertRowid)

    res.json({ success: true, data: record })
  } catch (error: any) {
    console.error('[DNS] Create record error:', error.message)
    res.status(500).json({
      success: false,
      error: `DNSPod API error: ${error.message}`
    })
  }
})

router.put('/:domain/records/:id', async (req: AuthRequest, res) => {
  const { domain, id } = req.params
  const { name, type, value, priority, ttl } = req.body

  const domainRecord = db.prepare('SELECT * FROM domains WHERE name = ?').get(domain) as any
  if (!domainRecord) {
    return res.status(404).json({ success: false, error: 'Domain not found' })
  }

  if (req.user?.role !== 'admin' && domainRecord.user_id !== req.user?.id) {
    return res.status(403).json({ success: false, error: 'Permission denied' })
  }

  const record = db.prepare('SELECT * FROM dns_records WHERE id = ? AND domain_id = ?').get(id, domainRecord.id) as any
  if (!record) {
    return res.status(404).json({ success: false, error: 'Record not found' })
  }

  // Validate record type if provided
  const newType = type || record.type
  if (type && !isValidRecordType(type)) {
    return res.status(400).json({
      success: false,
      error: `Invalid record type. Valid types: ${VALID_RECORD_TYPES.join(', ')}`
    })
  }

  // Validate and sanitize record value if provided
  let sanitizedValue = value || record.value
  if (value) {
    try {
      sanitizedValue = sanitizeRecordValue(newType, value)
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message })
    }
  }

  // Validate TTL if provided
  const ttlNum = ttl ? parseInt(ttl) : record.ttl
  if (ttl && (isNaN(ttlNum) || ttlNum < 1 || ttlNum > 86400)) {
    return res.status(400).json({ success: false, error: 'TTL must be between 1 and 86400 seconds' })
  }

  // If record has a DNSPod record_id, update it
  if (record.record_id) {
    const updated = await updateRecord(domain, record.record_id, {
      name: name || record.name,
      type: newType.toUpperCase(),
      value: sanitizedValue,
      priority: priority || record.priority,
      ttl: ttlNum
    })
    if (!updated) {
      return res.status(400).json({
        success: false,
        error: 'Failed to update record in DNSPod. Please ensure the parent domain is added in DNSPod'
      })
    }
  }

  db.prepare(`
    UPDATE dns_records
    SET name = ?, type = ?, value = ?, priority = ?, ttl = ?
    WHERE id = ?
  `).run(
    name?.trim() ?? record.name,
    newType.toUpperCase(),
    sanitizedValue,
    priority || record.priority,
    ttlNum,
    id
  )

  const updatedRecord = db.prepare('SELECT * FROM dns_records WHERE id = ?').get(id)
  res.json({ success: true, data: updatedRecord })
})

router.delete('/:domain/records/:id', async (req: AuthRequest, res) => {
  const { domain, id } = req.params

  const domainRecord = db.prepare('SELECT * FROM domains WHERE name = ?').get(domain) as any
  if (!domainRecord) {
    return res.status(404).json({ success: false, error: 'Domain not found' })
  }

  if (req.user?.role !== 'admin' && domainRecord.user_id !== req.user?.id) {
    return res.status(403).json({ success: false, error: 'Permission denied' })
  }

  const record = db.prepare('SELECT * FROM dns_records WHERE id = ? AND domain_id = ?').get(id, domainRecord.id) as any
  if (!record) {
    return res.status(404).json({ success: false, error: 'Record not found' })
  }

  // If record has a DNSPod record_id, delete it
  if (record.record_id) {
    const deleted = await deleteRecord(domain, record.record_id)
    if (!deleted) {
      return res.status(400).json({
        success: false,
        error: 'Failed to delete record from DNSPod. Please ensure the parent domain is added in DNSPod'
      })
    }
  }

  db.prepare('DELETE FROM dns_records WHERE id = ?').run(id)

  res.json({ success: true })
})

export default router
