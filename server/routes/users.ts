import { Router } from 'express'
import db from '../db'
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth'

const router = Router()

router.use(authMiddleware)

router.get('/', adminMiddleware, (req, res) => {
  const users = db.prepare('SELECT id, username, email, role, created_at FROM users').all()
  res.json({ success: true, data: users })
})

router.put('/:id', adminMiddleware, (req, res) => {
  const { id } = req.params
  const { role } = req.body

  if (!role || !['user', 'admin'].includes(role)) {
    return res.status(400).json({ success: false, error: '无效的角色' })
  }

  const result = db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id)

  if (result.changes === 0) {
    return res.status(404).json({ success: false, error: '用户不存在' })
  }

  res.json({ success: true })
})

router.delete('/:id', adminMiddleware, (req, res) => {
  const { id } = req.params

  if (req.user?.id === parseInt(id)) {
    return res.status(400).json({ success: false, error: '不能删除自己' })
  }

  const result = db.prepare('DELETE FROM users WHERE id = ?').run(id)

  if (result.changes === 0) {
    return res.status(404).json({ success: false, error: '用户不存在' })
  }

  res.json({ success: true })
})

export default router
