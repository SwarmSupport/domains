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
    email_verified: number
  }
}

export function generateToken(user: { id: number; username: string; email: string; role: string; email_verified?: number }): string {
  return jwt.sign(
    { id: user.id, username: user.username, email: user.email, role: user.role, email_verified: user.email_verified },
    JWT_SECRET,
    { expiresIn: '7d' }
  )
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const requestId = req.headers['x-request-id'] || 'unknown'
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn(`[Auth] No token provided [${requestId}]`)
    return res.status(401).json({ success: false, error: 'Unauthorized: No token provided' })
  }

  const token = authHeader.substring(7)

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any
    console.log(`[Auth] Token valid for user ID: ${decoded.id} [${requestId}]`)

    const user = db.prepare('SELECT id, username, email, role, email_verified FROM users WHERE id = ?').get(decoded.id)

    if (!user) {
      console.warn(`[Auth] User not found for ID: ${decoded.id} [${requestId}]`)
      return res.status(401).json({ success: false, error: 'User not found' })
    }

    req.user = user as any
    next()
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      console.warn(`[Auth] Token expired [${requestId}]`)
      return res.status(401).json({ success: false, error: 'Token expired' })
    }
    if (error instanceof jwt.JsonWebTokenError) {
      console.warn(`[Auth] Invalid token: ${error.message} [${requestId}]`)
      return res.status(401).json({ success: false, error: 'Invalid token' })
    }
    // SQLite or other database errors
    if (error instanceof Error && error.message.includes('no such column')) {
      console.error(`[Auth] Database schema error: ${error.message} [${requestId}]`)
      return res.status(500).json({ success: false, error: 'Server configuration error' })
    }
    console.error(`[Auth] Unexpected error [${requestId}]`, error)
    return res.status(401).json({ success: false, error: 'Authentication failed' })
  }
}

export function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const requestId = req.headers['x-request-id'] || 'unknown'

  // First check if user exists (auth middleware ran successfully)
  if (!req.user) {
    console.warn(`[Admin] No user in request - auth middleware may not have run [${requestId}]`)
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  if (req.user.role !== 'admin') {
    console.warn(`[Admin] Access denied for user ${req.user.id} with role: ${req.user.role} [${requestId}]`)
    return res.status(403).json({ success: false, error: 'Admin access required' })
  }
  console.log(`[Admin] Access granted for user ${req.user.id} [${requestId}]`)
  next()
}
