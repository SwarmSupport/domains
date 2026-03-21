import { Router } from 'express'
import db from '../db'
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth'
import { createDomain } from '../utils/dnspod'
import { sendDomainApprovedEmail, sendDomainRejectedEmail } from '../utils/email'

const router = Router()

function getSetting(key: string): string | null {
  const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  return setting?.value || null
}

function isDomainAllowed(domainName: string): boolean {
  const allowedDomainsSetting = getSetting('ALLOWED_DOMAINS')
  if (!allowedDomainsSetting) {
    return true // If not configured, allow all
  }

  const allowedDomains = allowedDomainsSetting.split('\n').map(d => d.trim().toLowerCase())
  const domainLower = domainName.toLowerCase()

  // Check if domain matches exactly or has allowed TLD
  return allowedDomains.some(allowed => {
    if (allowed.startsWith('*.')) {
      const tld = allowed.substring(2)
      return domainLower.endsWith(tld)
    }
    return domainLower === allowed || domainLower.endsWith('.' + allowed)
  })
}

router.use(authMiddleware)

router.get('/', (req: AuthRequest, res) => {
  const isAdmin = req.user?.role === 'admin'

  let domains
  if (isAdmin) {
    domains = db.prepare(`
      SELECT d.*, u.username, u.email as user_email
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
  const { name, purpose } = req.body

  if (!name) {
    return res.status(400).json({ success: false, error: 'Please enter a domain' })
  }

  // Validate against allowed domains
  if (!isDomainAllowed(name)) {
    return res.status(400).json({ success: false, error: 'This domain is not in the allowed list' })
  }

  const existing = db.prepare('SELECT id FROM domains WHERE name = ?').get(name)
  if (existing) {
    return res.status(400).json({ success: false, error: 'Domain already exists' })
  }

  const result = db.prepare(`
    INSERT INTO domains (name, user_id, purpose, status)
    VALUES (?, ?, ?, 'pending')
  `).run(name, req.user?.id, purpose || '')

  const domain = db.prepare('SELECT * FROM domains WHERE id = ?').get(result.lastInsertRowid)

  res.json({ success: true, data: domain })
})

router.put('/:id', authMiddleware, (req: AuthRequest, res) => {
  const { id } = req.params
  const { status } = req.body

  const domain = db.prepare('SELECT * FROM domains WHERE id = ?').get(id) as any
  if (!domain) {
    return res.status(404).json({ success: false, error: 'Domain not found' })
  }

  if (req.user?.role !== 'admin' && domain.user_id !== req.user?.id) {
    return res.status(403).json({ success: false, error: 'Permission denied' })
  }

  db.prepare('UPDATE domains SET status = ? WHERE id = ?').run(status, id)

  const updated = db.prepare('SELECT * FROM domains WHERE id = ?').get(id)
  res.json({ success: true, data: updated })
})

router.delete('/:id', authMiddleware, (req: AuthRequest, res) => {
  const { id } = req.params

  const domain = db.prepare('SELECT * FROM domains WHERE id = ?').get(id) as any
  if (!domain) {
    return res.status(404).json({ success: false, error: 'Domain not found' })
  }

  if (req.user?.role !== 'admin' && domain.user_id !== req.user?.id) {
    return res.status(403).json({ success: false, error: 'Permission denied' })
  }

  db.prepare('DELETE FROM dns_records WHERE domain_id = ?').run(id)
  db.prepare('DELETE FROM domains WHERE id = ?').run(id)

  res.json({ success: true })
})

router.post('/:id/approve', adminMiddleware, async (req: AuthRequest, res) => {
  const { id } = req.params
  const { userId } = req.body

  if (!userId) {
    return res.status(400).json({ success: false, error: 'Please select a user' })
  }

  const domain = db.prepare('SELECT d.*, u.username, u.email as user_email FROM domains d LEFT JOIN users u ON d.user_id = u.id WHERE d.id = ?').get(id) as any
  if (!domain) {
    return res.status(404).json({ success: false, error: 'Domain not found' })
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' })
  }

  let dnspodDomainId = domain.dnspod_domain_id

  if (!dnspodDomainId) {
    dnspodDomainId = await createDomain(domain.name)
  }

  db.prepare(`
    UPDATE domains SET user_id = ?, status = 'active', dnspod_domain_id = ? WHERE id = ?
  `).run(userId, dnspodDomainId, id)

  // Send approval email
  await sendDomainApprovedEmail(user.email, user.username, domain.name)

  const updated = db.prepare(`
    SELECT d.*, u.username
    FROM domains d
    LEFT JOIN users u ON d.user_id = u.id
    WHERE d.id = ?
  `).get(id)

  res.json({ success: true, data: updated })
})

router.post('/:id/reject', adminMiddleware, async (req: AuthRequest, res) => {
  const { id } = req.params
  const { reason } = req.body

  const domain = db.prepare('SELECT d.*, u.email as user_email FROM domains d LEFT JOIN users u ON d.user_id = u.id WHERE d.id = ?').get(id) as any
  if (!domain) {
    return res.status(404).json({ success: false, error: 'Domain not found' })
  }

  db.prepare(`
    UPDATE domains SET status = 'rejected', rejection_reason = ? WHERE id = ?
  `).run(reason || '', id)

  // Get user email
  const user = db.prepare('SELECT email, username FROM users WHERE id = ?').get(domain.user_id) as any
  if (user) {
    await sendDomainRejectedEmail(user.email, user.username, domain.name, reason || '')
  }

  res.json({ success: true })
})

export default router
