import { Router } from 'express'
import db from '../db'
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth'
import bcrypt from 'bcrypt'

const router = Router()

router.use(authMiddleware)

// All user management routes require admin
router.get('/', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const users = db.prepare('SELECT id, username, email, role, created_at, email_verified, banned FROM users').all()
    res.json({ success: true, data: users })
  } catch (error) {
    console.error('Error fetching users:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch users' })
  }
})

// Create new user (admin only)
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  const { username, email, password, role } = req.body

  // Validate required fields
  if (!username || !email || !password) {
    return res.status(400).json({ success: false, error: 'Username, email and password are required' })
  }

  // Validate username (3-20 chars, alphanumeric and underscore)
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/
  if (!usernameRegex.test(username)) {
    return res.status(400).json({ success: false, error: 'Invalid username format' })
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return res.status(400).json({ success: false, error: 'Invalid email format' })
  }

  // Validate password length
  if (password.length < 6) {
    return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' })
  }

  // Validate role
  const validRole = role === 'admin' ? 'admin' : 'user'

  try {
    // Check if username or email already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email)
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'Username or email already exists' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const result = db.prepare(`
      INSERT INTO users (username, email, password, role, email_verified)
      VALUES (?, ?, ?, ?, 1)
    `).run(username, email, hashedPassword, validRole)

    res.json({ success: true, data: { id: result.lastInsertRowid, username, email, role: validRole } })
  } catch (error) {
    console.error('Error creating user:', error)
    res.status(500).json({ success: false, error: 'Failed to create user' })
  }
})

router.put('/:id', authMiddleware, adminMiddleware, (req, res) => {
  const { id } = req.params
  const { username, email, role } = req.body

  try {
    // Build update query dynamically
    const updates: string[] = []
    const values: any[] = []

    if (username !== undefined) {
      // Validate username (3-20 chars, alphanumeric and underscore)
      const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/
      if (!usernameRegex.test(username)) {
        return res.status(400).json({ success: false, error: 'Invalid username format' })
      }
      // Check if username is already taken by another user
      const existing = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, id)
      if (existing) {
        return res.status(400).json({ success: false, error: 'Username already taken' })
      }
      updates.push('username = ?')
      values.push(username)
    }

    if (email !== undefined) {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return res.status(400).json({ success: false, error: 'Invalid email format' })
      }
      // Check if email is already taken by another user
      const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, id)
      if (existing) {
        return res.status(400).json({ success: false, error: 'Email already in use' })
      }
      updates.push('email = ?')
      values.push(email)
    }

    if (role !== undefined) {
      if (!['user', 'admin'].includes(role)) {
        return res.status(400).json({ success: false, error: 'Invalid role' })
      }
      updates.push('role = ?')
      values.push(role)
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No updates provided' })
    }

    values.push(id)
    const result = db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values)

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }

    res.json({ success: true })
  } catch (error) {
    console.error('Error updating user:', error)
    res.status(500).json({ success: false, error: 'Failed to update user' })
  }
})

router.put('/:id/password', authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params
  const { password } = req.body

  if (!password || password.length < 6) {
    return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' })
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10)
    const result = db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, id)

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }

    res.json({ success: true })
  } catch (error) {
    console.error('Error updating user password:', error)
    res.status(500).json({ success: false, error: 'Failed to update password' })
  }
})

router.delete('/:id', authMiddleware, adminMiddleware, (req, res) => {
  const { id } = req.params

  if (req.user?.id === parseInt(id)) {
    return res.status(400).json({ success: false, error: 'Cannot delete yourself' })
  }

  try {
    const result = db.prepare('DELETE FROM users WHERE id = ?').run(id)

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }

    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting user:', error)
    res.status(500).json({ success: false, error: 'Failed to delete user' })
  }
})

// Ban user
router.put('/:id/ban', authMiddleware, adminMiddleware, (req, res) => {
  const { id } = req.params

  if (req.user?.id === parseInt(id)) {
    return res.status(400).json({ success: false, error: 'Cannot ban yourself' })
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' })
  }

  if (user.role === 'admin') {
    return res.status(400).json({ success: false, error: 'Cannot ban an admin' })
  }

  try {
    db.prepare('UPDATE users SET banned = 1 WHERE id = ?').run(id)
    res.json({ success: true })
  } catch (error) {
    console.error('Error banning user:', error)
    res.status(500).json({ success: false, error: 'Failed to ban user' })
  }
})

// Unban user
router.put('/:id/unban', authMiddleware, adminMiddleware, (req, res) => {
  const { id } = req.params

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' })
  }

  try {
    db.prepare('UPDATE users SET banned = 0 WHERE id = ?').run(id)
    res.json({ success: true })
  } catch (error) {
    console.error('Error unbanning user:', error)
    res.status(500).json({ success: false, error: 'Failed to unban user' })
  }
})

export default router
