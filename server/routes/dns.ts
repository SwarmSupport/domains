import { Router } from 'express'
import db from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { createRecord, updateRecord, deleteRecord, syncRecordsFromDnspod } from '../utils/dnspod'

const router = Router()

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
    return res.status(404).json({ success: false, error: '域名不存在' })
  }

  if (req.user?.role !== 'admin' && domainRecord.user_id !== req.user?.id) {
    return res.status(403).json({ success: false, error: '无权限访问' })
  }

  if (!name || !type || !value) {
    return res.status(400).json({ success: false, error: '请填写所有必填字段' })
  }

  const dnspodRecordId = await createRecord(domain, {
    name,
    type,
    value,
    priority: priority || 10,
    ttl: ttl || 600
  })

  const result = db.prepare(`
    INSERT INTO dns_records (domain_id, record_id, name, type, value, priority, ttl)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    domainRecord.id,
    dnspodRecordId || '',
    name,
    type,
    value,
    priority || 10,
    ttl || 600
  )

  const record = db.prepare('SELECT * FROM dns_records WHERE id = ?').get(result.lastInsertRowid)

  res.json({ success: true, data: record })
})

router.put('/:domain/records/:id', async (req: AuthRequest, res) => {
  const { domain, id } = req.params
  const { name, type, value, priority, ttl } = req.body

  const domainRecord = db.prepare('SELECT * FROM domains WHERE name = ?').get(domain) as any
  if (!domainRecord) {
    return res.status(404).json({ success: false, error: '域名不存在' })
  }

  if (req.user?.role !== 'admin' && domainRecord.user_id !== req.user?.id) {
    return res.status(403).json({ success: false, error: '无权限访问' })
  }

  const record = db.prepare('SELECT * FROM dns_records WHERE id = ? AND domain_id = ?').get(id, domainRecord.id) as any
  if (!record) {
    return res.status(404).json({ success: false, error: '记录不存在' })
  }

  if (record.record_id) {
    await updateRecord(domain, record.record_id, {
      name: name || record.name,
      type: type || record.type,
      value: value || record.value,
      priority: priority || record.priority,
      ttl: ttl || record.ttl
    })
  }

  db.prepare(`
    UPDATE dns_records
    SET name = ?, type = ?, value = ?, priority = ?, ttl = ?
    WHERE id = ?
  `).run(
    name ?? record.name,
    type ?? record.type,
    value ?? record.value,
    priority ?? record.priority,
    ttl ?? record.ttl,
    id
  )

  const updated = db.prepare('SELECT * FROM dns_records WHERE id = ?').get(id)
  res.json({ success: true, data: updated })
})

router.delete('/:domain/records/:id', async (req: AuthRequest, res) => {
  const { domain, id } = req.params

  const domainRecord = db.prepare('SELECT * FROM domains WHERE name = ?').get(domain) as any
  if (!domainRecord) {
    return res.status(404).json({ success: false, error: '域名不存在' })
  }

  if (req.user?.role !== 'admin' && domainRecord.user_id !== req.user?.id) {
    return res.status(403).json({ success: false, error: '无权限访问' })
  }

  const record = db.prepare('SELECT * FROM dns_records WHERE id = ? AND domain_id = ?').get(id, domainRecord.id) as any
  if (!record) {
    return res.status(404).json({ success: false, error: '记录不存在' })
  }

  if (record.record_id) {
    await deleteRecord(domain, record.record_id)
  }

  db.prepare('DELETE FROM dns_records WHERE id = ?').run(id)

  res.json({ success: true })
})

export default router
