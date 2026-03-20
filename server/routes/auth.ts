import { Router } from 'express'
import bcrypt from 'bcryptjs'
import db from '../db'
import { generateToken, authMiddleware, AuthRequest } from '../middleware/auth'

const router = Router()

router.post('/register', (req, res) => {
  const { username, email, password } = req.body

  if (!username || !email || !password) {
    return res.status(400).json({ success: false, error: '请填写所有字段' })
  }

  if (username.length < 3 || username.length > 20) {
    return res.status(400).json({ success: false, error: '用户名需要 3-20 个字符' })
  }

  if (password.length < 6) {
    return res.status(400).json({ success: false, error: '密码至少需要 6 个字符' })
  }

  const existingUser = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(email, username)
  if (existingUser) {
    return res.status(400).json({ success: false, error: '邮箱或用户名已存在' })
  }

  const hashedPassword = bcrypt.hashSync(password, 10)
  const result = db.prepare(`
    INSERT INTO users (username, email, password, role)
    VALUES (?, ?, ?, 'user')
  `).run(username, email, hashedPassword)

  const user = {
    id: result.lastInsertRowid as number,
    username,
    email,
    role: 'user'
  }

  const token = generateToken(user)

  res.json({
    success: true,
    data: { token, user }
  })
})

router.post('/login', (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ success: false, error: '请填写所有字段' })
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ success: false, error: '邮箱或密码错误' })
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
        role: user.role
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
