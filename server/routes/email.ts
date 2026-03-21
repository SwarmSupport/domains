import { Router } from 'express'
import db from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import {
  sendVerificationEmail,
  sendDomainApprovedEmail,
  sendDomainRejectedEmail
} from '../utils/email'

const router = Router()

// Verify email with token
router.post('/verify', (req, res) => {
  const { token } = req.body

  if (!token) {
    return res.status(400).json({ success: false, error: 'Token is required' })
  }

  const record = db.prepare(`
    SELECT * FROM email_verification_tokens
    WHERE token = ? AND expires_at > datetime('now')
  `).get(token) as any

  if (!record) {
    return res.status(400).json({ success: false, error: 'Invalid or expired token' })
  }

  // Update user email_verified
  db.prepare('UPDATE users SET email_verified = 1 WHERE email = ?').run(record.email)

  // Delete used token
  db.prepare('DELETE FROM email_verification_tokens WHERE token = ?').run(token)

  res.json({ success: true, message: 'Email verified successfully' })
})

// Resend verification email
router.post('/resend-verification', authMiddleware, async (req: AuthRequest, res) => {
  const user = req.user!

  if (user.email_verified) {
    return res.status(400).json({ success: false, error: 'Email already verified' })
  }

  const success = await sendVerificationEmail(user.email, user.username)

  if (success) {
    res.json({ success: true, message: 'Verification email sent' })
  } else {
    res.status(500).json({ success: false, error: 'Failed to send verification email' })
  }
})

// Send domain approval notification
router.post('/domain-approved', async (req, res) => {
  const { email, username, domain } = req.body

  if (!email || !username || !domain) {
    return res.status(400).json({ success: false, error: 'Missing required fields' })
  }

  const success = await sendDomainApprovedEmail(email, username, domain)

  if (success) {
    res.json({ success: true })
  } else {
    res.status(500).json({ success: false, error: 'Failed to send email' })
  }
})

// Send domain rejection notification
router.post('/domain-rejected', async (req, res) => {
  const { email, username, domain, reason } = req.body

  if (!email || !username || !domain) {
    return res.status(400).json({ success: false, error: 'Missing required fields' })
  }

  const success = await sendDomainRejectedEmail(email, username, domain, reason || '')

  if (success) {
    res.json({ success: true })
  } else {
    res.status(500).json({ success: false, error: 'Failed to send email' })
  }
})

export default router
