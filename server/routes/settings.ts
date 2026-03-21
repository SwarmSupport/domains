import { Router } from 'express'
import jwt from 'jsonwebtoken'
import db from '../db'
import { adminMiddleware, AuthRequest } from '../middleware/auth'

const router = Router()

// Public settings that don't require authentication (for login/register pages)
const PUBLIC_SETTINGS = ['TURNSTILE_SITE_KEY', 'TURNSTILE_ENABLED']

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

// GET settings - public for some, requires auth for others
router.get('/:key', (req, res) => {
  const { key } = req.params

  // Check if this is a public setting
  if (PUBLIC_SETTINGS.includes(key)) {
    const setting = db.prepare('SELECT * FROM settings WHERE key = ?').get(key)
    res.json({ success: true, data: setting || { value: '' } })
    return
  }

  // For non-public settings, require authentication
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  const token = authHeader.substring(7)

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any
    const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(decoded.id) as { id: number; role: string } | undefined

    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' })
    }

    const setting = db.prepare('SELECT * FROM settings WHERE key = ?').get(key)
    res.json({ success: true, data: setting || { value: '' } })
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ success: false, error: 'Invalid token' })
    }
    console.error('Settings GET error:', err)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// POST (update) settings - requires admin authentication
router.post('/', adminMiddleware, (req, res) => {
  const { key, value } = req.body

  if (!key) {
    return res.status(400).json({ success: false, error: 'Key is required' })
  }

  // Use compatible upsert: try update first, then insert if no rows affected
  const updateResult = db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(value ?? '', key)
  if (updateResult.changes === 0) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(key, value ?? '')
  }

  res.json({ success: true })
})

export default router
