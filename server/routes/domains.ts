import { Router } from 'express'
import db from '../db'
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth'
import { createDomain } from '../utils/dnspod'

const router = Router()

router.use(authMiddleware)

router.get('/', (req: AuthRequest, res) => {
  const isAdmin = req.user?.role === 'admin'

  let domains
  if (isAdmin) {
    domains = db.prepare(`
      SELECT d.*, u.username
      FROM domains d
      LEFT JOIN users u ON d.user_id = u.id
      ORDER BY d.created_at DESC
    `).all()
  } else {
    domains = db.prepare(`
      SELECT d.*, u.username
      FROM domains d
      LEFT JOIN users u ON d.user_id = u.id
      WHERE d.user_id = ?
      ORDER BY d.created_at DESC
    `).all(req.user?.id)
  }

  res.json({ success: true, data: domains })
})

router.post('/', authMiddleware, (req: AuthRequest, res) => {
  const { name } = req.body

  if (!name) {
    return res.status(400).json({ success: false, error: '请输入域名' })
  }

  const existing = db.prepare('SELECT id FROM domains WHERE name = ?').get(name)
  if (existing) {
    return res.status(400).json({ success: false, error: '域名已存在' })
  }

  const result = db.prepare(`
    INSERT INTO domains (name, user_id, status)
    VALUES (?, ?, 'pending')
  `).run(name, req.user?.id)

  const domain = db.prepare('SELECT * FROM domains WHERE id = ?').get(result.lastInsertRowid)

  res.json({ success: true, data: domain })
})

router.put('/:id', authMiddleware, (req: AuthRequest, res) => {
  const { id } = req.params
  const { status } = req.body

  const domain = db.prepare('SELECT * FROM domains WHERE id = ?').get(id) as any
  if (!domain) {
    return res.status(404).json({ success: false, error: '域名不存在' })
  }

  if (req.user?.role !== 'admin' && domain.user_id !== req.user?.id) {
    return res.status(403).json({ success: false, error: '无权限操作' })
  }

  db.prepare('UPDATE domains SET status = ? WHERE id = ?').run(status, id)

  const updated = db.prepare('SELECT * FROM domains WHERE id = ?').get(id)
  res.json({ success: true, data: updated })
})

router.delete('/:id', authMiddleware, (req: AuthRequest, res) => {
  const { id } = req.params

  const domain = db.prepare('SELECT * FROM domains WHERE id = ?').get(id) as any
  if (!domain) {
    return res.status(404).json({ success: false, error: '域名不存在' })
  }

  if (req.user?.role !== 'admin' && domain.user_id !== req.user?.id) {
    return res.status(403).json({ success: false, error: '无权限操作' })
  }

  db.prepare('DELETE FROM dns_records WHERE domain_id = ?').run(id)
  db.prepare('DELETE FROM domains WHERE id = ?').run(id)

  res.json({ success: true })
})

router.post('/:id/assign', adminMiddleware, async (req: AuthRequest, res) => {
  const { id } = req.params
  const { userId } = req.body

  if (!userId) {
    return res.status(400).json({ success: false, error: '请选择用户' })
  }

  const domain = db.prepare('SELECT * FROM domains WHERE id = ?').get(id) as any
  if (!domain) {
    return res.status(404).json({ success: false, error: '域名不存在' })
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
  if (!user) {
    return res.status(404).json({ success: false, error: '用户不存在' })
  }

  let dnspodDomainId = domain.dnspod_domain_id

  if (!dnspodDomainId) {
    dnspodDomainId = await createDomain(domain.name)
  }

  db.prepare(`
    UPDATE domains SET user_id = ?, status = 'active', dnspod_domain_id = ? WHERE id = ?
  `).run(userId, dnspodDomainId, id)

  const updated = db.prepare(`
    SELECT d.*, u.username
    FROM domains d
    LEFT JOIN users u ON d.user_id = u.id
    WHERE d.id = ?
  `).get(id)

  res.json({ success: true, data: updated })
})

export default router
