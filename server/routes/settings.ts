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

  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value || '')

  res.json({ success: true })
})

export default router
