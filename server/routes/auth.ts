import { Router } from 'express'
import bcrypt from 'bcryptjs'
import db from '../db'
import { generateToken, authMiddleware, AuthRequest } from '../middleware/auth'
import { verifyTurnstile } from '../utils/turnstile'
import { sendVerificationEmail } from '../utils/email'

const router = Router()

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Username validation: alphanumeric and underscore only, 3-20 chars
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/

function getSetting(key: string): string | null {
  const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  return setting?.value || null
}

function isEmailEnabled(): boolean {
  const enabled = getSetting('EMAIL_ENABLED')
  return enabled === 'true'
}

function isEmailVerificationRequired(): boolean {
  return isEmailEnabled()
}

router.post('/register', async (req, res) => {
  const { username, email, password, turnstileToken } = req.body

  if (!username || !email || !password) {
    return res.status(400).json({ success: false, error: 'Please fill in all fields' })
  }

  // Validate email format
  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ success: false, error: 'Invalid email format' })
  }

  // Validate username format
  if (!USERNAME_REGEX.test(username)) {
    return res.status(400).json({ success: false, error: 'Username must be 3-20 alphanumeric characters or underscore' })
  }

  if (password.length < 6) {
    return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' })
  }

  // Verify Turnstile (passes token, secret key check is inside verifyTurnstile)
  const turnstileValid = await verifyTurnstile(turnstileToken || '')
  if (!turnstileValid) {
    return res.status(400).json({ success: false, error: 'Turnstile verification failed' })
  }

  const existingUser = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(email, username)
  if (existingUser) {
    return res.status(400).json({ success: false, error: 'Email or username already exists' })
  }

  const hashedPassword = bcrypt.hashSync(password, 10)
  const result = db.prepare(`
    INSERT INTO users (username, email, password, role, email_verified)
    VALUES (?, ?, ?, 'user', ?)
  `).run(username, email.toLowerCase(), hashedPassword, isEmailVerificationRequired() ? 0 : 1)

  const userId = result.lastInsertRowid as number

  // Send verification email if email is enabled
  if (isEmailVerificationRequired()) {
    await sendVerificationEmail(email, username)
    res.json({
      success: true,
      data: {
        message: 'Registration successful. Please check your email to verify your account.',
        userId
      }
    })
  } else {
    res.json({
      success: true,
      data: {
        message: 'Registration successful. You can now login.',
        userId
      }
    })
  }
})

router.post('/login', async (req, res) => {
  const { email, password, turnstileToken } = req.body

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Please fill in all fields' })
  }

  // Validate email format
  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ success: false, error: 'Invalid email format' })
  }

  // Verify Turnstile (skip if disabled or not configured)
  const turnstileValid = await verifyTurnstile(turnstileToken || '')
  if (!turnstileValid) {
    return res.status(400).json({ success: false, error: 'Turnstile verification failed. Please try again.' })
  }

  // Use case-insensitive email lookup
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase()) as any
  if (!user) {
    return res.status(401).json({ success: false, error: 'Invalid email or password' })
  }

  // Verify password
  if (!bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ success: false, error: 'Invalid email or password' })
  }

  // Check if user is banned
  if (user.banned) {
    return res.status(403).json({ success: false, error: 'Your account has been suspended. Please contact the administrator.' })
  }

  // Check email verification if email is enabled
  if (isEmailVerificationRequired() && !user.email_verified) {
    return res.status(401).json({
      success: false,
      error: 'Please verify your email first',
      needsVerification: true
    })
  }

  const token = generateToken(user)

  res.json({
    success: true,
    data: {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        email_verified: user.email_verified
      }
    }
  })
})

router.get('/me', authMiddleware, (req: AuthRequest, res) => {
  res.json({
    success: true,
    data: req.user
  })
})

export default router
