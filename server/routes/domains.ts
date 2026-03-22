import { Router } from 'express'
import db from '../db'
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth'
import { createDomain, pauseDomain, resumeDomain, deleteDomain as deleteDomainFromDnspod } from '../utils/dnspod'
import { sendDomainApprovedEmail, sendDomainRejectedEmail } from '../utils/email'

// DNSPod API base URL
const DNSPOD_API_BASE = 'https://api.dnspod.com'

const router = Router()

function getSetting(key: string): string | null {
  const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  return setting?.value || null
}

function getDomainSuffixes(): string[] {
  const setting = getSetting('DOMAIN_SUFFIXES')
  if (!setting) {
    return []
  }
  return setting.split('\n').map(s => s.trim().toLowerCase()).filter(s => s.length > 0)
}

function isSubdomainAllowed(subdomainName: string): { valid: boolean; error?: string } {
  const suffixes = getDomainSuffixes()

  if (suffixes.length === 0) {
    return { valid: true } // If not configured, allow all
  }

  // Subdomain must be like: subdomain1.example.com
  // Where example.com is in the allowed suffixes list
  const parts = subdomainName.toLowerCase().split('.')
  if (parts.length < 2) {
    return { valid: false, error: 'Invalid subdomain format' }
  }

  // Check if the domain ends with any of the allowed suffixes
  for (const suffix of suffixes) {
    if (subdomainName.endsWith('.' + suffix) || subdomainName === suffix) {
      return { valid: true }
    }
  }

  return { valid: false, error: 'Domain suffix not allowed' }
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

router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  const { name, purpose } = req.body
  const isAdmin = req.user?.role === 'admin'

  if (!name) {
    return res.status(400).json({ success: false, error: 'Please enter a domain' })
  }

  // Validate subdomain against allowed suffixes
  const validation = isSubdomainAllowed(name)
  if (!validation.valid) {
    return res.status(400).json({ success: false, error: validation.error || 'Domain not allowed' })
  }

  const existing = db.prepare('SELECT id FROM domains WHERE name = ?').get(name)
  if (existing) {
    return res.status(400).json({ success: false, error: 'Domain already exists' })
  }

  // Regular users need to provide purpose and are pending approval
  // Admins can create domains directly without purpose
  if (!isAdmin && !purpose) {
    return res.status(400).json({ success: false, error: 'Please enter the purpose of this domain' })
  }

  let dnspodDomainId = null
  let status = 'pending'

  // Admin auto-approves: create domain in DNSPod immediately
  if (isAdmin) {
    dnspodDomainId = await createDomain(name)
    status = 'active'
  }

  const result = db.prepare(`
    INSERT INTO domains (name, user_id, purpose, status, dnspod_domain_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, req.user?.id, purpose || '', status, dnspodDomainId)

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

router.post('/:id/approve', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
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

router.post('/:id/reject', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
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

// Admin: Suspend domain (pause DNS in DNSPod)
router.post('/:id/suspend', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  const { id } = req.params

  const domain = db.prepare('SELECT * FROM domains WHERE id = ?').get(id) as any
  if (!domain) {
    return res.status(404).json({ success: false, error: 'Domain not found' })
  }

  if (!domain.dnspod_domain_id) {
    return res.status(400).json({ success: false, error: 'Domain not created in DNSPod yet' })
  }

  // Pause in DNSPod
  const paused = await pauseDomain(domain.name)
  if (!paused) {
    return res.status(500).json({ success: false, error: 'Failed to pause domain in DNSPod' })
  }

  db.prepare('UPDATE domains SET suspended = 1 WHERE id = ?').run(id)

  res.json({ success: true })
})

// Admin: Resume domain (resume DNS in DNSPod)
router.post('/:id/resume', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  const { id } = req.params

  const domain = db.prepare('SELECT * FROM domains WHERE id = ?').get(id) as any
  if (!domain) {
    return res.status(404).json({ success: false, error: 'Domain not found' })
  }

  if (!domain.dnspod_domain_id) {
    return res.status(400).json({ success: false, error: 'Domain not created in DNSPod yet' })
  }

  // Resume in DNSPod
  const resumed = await resumeDomain(domain.name)
  if (!resumed) {
    return res.status(500).json({ success: false, error: 'Failed to resume domain in DNSPod' })
  }

  db.prepare('UPDATE domains SET suspended = 0 WHERE id = ?').run(id)

  res.json({ success: true })
})

// Admin: Delete domain from DNSPod and database
router.delete('/:id/dnspod', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  const { id } = req.params

  const domain = db.prepare('SELECT * FROM domains WHERE id = ?').get(id) as any
  if (!domain) {
    return res.status(404).json({ success: false, error: 'Domain not found' })
  }

  // Delete from DNSPod if exists
  if (domain.dnspod_domain_id) {
    const deleted = await deleteDomainFromDnspod(domain.name)
    if (!deleted) {
      return res.status(500).json({ success: false, error: 'Failed to delete domain from DNSPod' })
    }
  }

  // Delete DNS records from database
  db.prepare('DELETE FROM dns_records WHERE domain_id = ?').run(id)

  // Delete domain from database
  db.prepare('DELETE FROM domains WHERE id = ?').run(id)

  res.json({ success: true })
})

export default router
