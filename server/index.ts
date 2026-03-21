import express from 'express'
import cors from 'cors'
import { initDatabase } from './db'
import authRoutes from './routes/auth'
import userRoutes from './routes/users'
import domainRoutes from './routes/domains'
import dnsRoutes from './routes/dns'
import settingRoutes from './routes/settings'
import emailRoutes from './routes/email'

const app = express()
const PORT = process.env.PORT || 3000

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  next()
})

// Rate limiting store (in-memory)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX = 100 // requests per window

function rateLimitMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const ip = req.ip || 'unknown'
  const now = Date.now()
  const record = rateLimitStore.get(ip)

  if (!record || now > record.resetTime) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return next()
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return res.status(429).json({ success: false, error: 'Too many requests, please try again later' })
  }

  record.count++
  next()
}

// Strict rate limiting for sensitive routes (auth, users)
const strictRateLimitStore = new Map<string, { count: number; resetTime: number }>()
const STRICT_RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const STRICT_RATE_LIMIT_MAX = 20 // requests per window for auth routes

function strictRateLimitMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const ip = req.ip || 'unknown'
  const now = Date.now()
  const record = strictRateLimitStore.get(ip)

  if (!record || now > record.resetTime) {
    strictRateLimitStore.set(ip, { count: 1, resetTime: now + STRICT_RATE_LIMIT_WINDOW })
    return next()
  }

  if (record.count >= STRICT_RATE_LIMIT_MAX) {
    return res.status(429).json({ success: false, error: 'Too many requests, please try again later' })
  }

  record.count++
  next()
}

// Input sanitization middleware
function sanitizeInput(req: express.Request, res: express.Response, next: express.NextFunction) {
  // Remove null bytes from string inputs
  if (req.body) {
    for (const key of Object.keys(req.body)) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].replace(/\0/g, '')
      }
    }
  }
  next()
}

app.use(cors())
app.use(express.json({ limit: '10kb' })) // Limit body size
app.use(sanitizeInput)

initDatabase()

// Apply rate limiting to all routes
app.use('/api', rateLimitMiddleware)

// Apply strict rate limiting to sensitive routes
app.use('/api/auth', strictRateLimitMiddleware, authRoutes)
app.use('/api/users', strictRateLimitMiddleware, userRoutes)
app.use('/api/domains', domainRoutes)
app.use('/api/dns', dnsRoutes)
app.use('/api/settings', settingRoutes)
app.use('/api/email', strictRateLimitMiddleware, emailRoutes)

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is running' })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
