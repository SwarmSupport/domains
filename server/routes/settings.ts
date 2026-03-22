import { Router } from 'express'
import jwt from 'jsonwebtoken'
import axios from 'axios'
import db from '../db'
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth'

const router = Router()

// Public settings that don't require authentication (for login/register pages)
const PUBLIC_SETTINGS = ['TURNSTILE_SITE_KEY', 'TURNSTILE_ENABLED']

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

// GET settings - public for some, requires auth for all users
router.get('/:key', (req, res) => {
  const { key } = req.params

  // Check if this is a public setting
  if (PUBLIC_SETTINGS.includes(key)) {
    const setting = db.prepare('SELECT * FROM settings WHERE key = ?').get(key)
    res.json({ success: true, data: setting || { value: '' } })
    return
  }

  // For non-public settings, require authentication (any authenticated user can read)
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  const token = authHeader.substring(7)

  try {
    jwt.verify(token, JWT_SECRET)
    // Any authenticated user can read settings (only admins can write)
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

// POST (update) settings - requires admin authentication (both authMiddleware and adminMiddleware)
router.post('/', authMiddleware, adminMiddleware, (req, res) => {
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

// Test DNSPod API connection
router.post('/test-dnspod', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  const token = db.prepare('SELECT value FROM settings WHERE key = ?').get('DNSPOD_TOKEN') as { value: string } | undefined

  if (!token?.value) {
    return res.json({ success: false, message: 'DNSPod token not configured' })
  }

  try {
    const response = await axios.post(
      'https://api.dnspod.com/Domain.List',
      new URLSearchParams({ login_token: token.value, format: 'json' }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    )

    if (response.data.status?.code === 'error') {
      return res.json({ success: false, message: response.data.status?.message || 'API error' })
    }

    return res.json({ success: true, message: 'Connection successful' })
  } catch (error: any) {
    return res.json({ success: false, message: error.response?.data?.status?.message || error.message })
  }
})

// Test Turnstile verification
router.post('/test-turnstile', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  const secretKey = db.prepare('SELECT value FROM settings WHERE key = ?').get('TURNSTILE_SECRET_KEY') as { value: string } | undefined

  if (!secretKey?.value) {
    return res.json({ success: false, message: 'Turnstile secret key not configured' })
  }

  // Just return success since we can't test without a token
  return res.json({ success: true, message: 'Turnstile secret key configured' })
})

// Test Resend email API
router.post('/test-resend', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  const apiKey = db.prepare('SELECT value FROM settings WHERE key = ?').get('RESEND_API_KEY') as { value: string } | undefined
  const domain = db.prepare('SELECT value FROM settings WHERE key = ?').get('RESEND_DOMAIN') as { value: string } | undefined

  if (!apiKey?.value) {
    return res.json({ success: false, message: 'Resend API key not configured' })
  }

  if (!domain?.value) {
    return res.json({ success: false, message: 'Resend domain not configured' })
  }

  try {
    const { Resend } = await import('resend')
    const resend = new Resend(apiKey.value)
    const { error } = await resend.domains.list()

    if (error) {
      return res.json({ success: false, message: error.message })
    }

    return res.json({ success: true, message: 'Connection successful' })
  } catch (error: any) {
    return res.json({ success: false, message: error.message })
  }
})

export default router
