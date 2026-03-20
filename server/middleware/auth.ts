import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import db from '../db'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

export interface AuthRequest extends Request {
  user?: {
    id: number
    username: string
    email: string
    role: string
  }
}

export function generateToken(user: { id: number; username: string; email: string; role: string }): string {
  return jwt.sign(
    { id: user.id, username: user.username, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  )
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: '未授权访问' })
  }

  const token = authHeader.substring(7)

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any
    const user = db.prepare('SELECT id, username, email, role FROM users WHERE id = ?').get(decoded.id)

    if (!user) {
      return res.status(401).json({ success: false, error: '用户不存在' })
    }

    req.user = user as any
    next()
  } catch {
    return res.status(401).json({ success: false, error: 'Token 无效' })
  }
}

export function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, error: '需要管理员权限' })
  }
  next()
}
