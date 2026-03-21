import { Router } from 'express'
import db from '../db'
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth'
import bcrypt from 'bcrypt'

const router = Router()

router.use(authMiddleware)

// All user management routes require admin
router.get('/', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const users = db.prepare('SELECT id, username, email, role, created_at, email_verified FROM users').all()
    res.json({ success: true, data: users })
  } catch (error) {
    console.error('Error fetching users:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch users' })
  }
})

router.put('/:id', authMiddleware, adminMiddleware, (req, res) => {
  const { id } = req.params
  const { role } = req.body

  if (!role || !['user', 'admin'].includes(role)) {
    return res.status(400).json({ success: false, error: 'Invalid role' })
  }

  try {
    const result = db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id)

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }

    res.json({ success: true })
  } catch (error) {
    console.error('Error updating user role:', error)
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

export default router
