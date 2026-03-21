import { Router } from 'express'
import db from '../db'
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth'

const router = Router()

router.use(authMiddleware)

router.get('/:key', adminMiddleware, (req, res) => {
  const { key } = req.params

  const setting = db.prepare('SELECT * FROM settings WHERE key = ?').get(key)

  res.json({ success: true, data: setting || { value: '' } })
})

router.post('/', adminMiddleware, (req, res) => {
  const { key, value } = req.body

  if (!key) {
    return res.status(400).json({ success: false, error: 'Key is required' })
  }

  // Use INSERT OR REPLACE for SQLite upsert
  db.prepare(`
    INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)
  `).run(key, value || '')

  res.json({ success: true })
})

export default router
