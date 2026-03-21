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
const IS_PRODUCTION = process.env.NODE_ENV === 'production'

// Trust proxy for correct IP detection
app.set('trust proxy', 1)

// CORS configuration
const corsOptions: cors.CorsOptions = {
  origin: IS_PRODUCTION
    ? process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173']
    : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-CSRF-Token']
}

// Security headers middleware
app.use((req, res, next) => {
  // Generate request ID for tracing
  const requestId = req.headers['x-request-id'] || `srv-${Date.now()}`
  res.setHeader('X-Request-ID', requestId)

  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')

  // HSTS (only in production)
  if (IS_PRODUCTION) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  }

  // Content Security Policy
  if (IS_PRODUCTION) {
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'")
  }

  next()
})

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now()
  const requestId = req.headers['x-request-id']

  res.on('finish', () => {
    const duration = Date.now() - start
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info'
    console[logLevel](`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms) [${requestId}]`)
  })

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
    console.warn(`Rate limit exceeded for IP: ${ip}`)
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
    console.warn(`Strict rate limit exceeded for IP: ${ip}`)
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

// Apply middlewares
app.use(cors(corsOptions))
app.use(express.json({ limit: '10kb' })) // Limit body size
app.use(sanitizeInput)

initDatabase()

// Apply rate limiting to all routes
app.use('/api', rateLimitMiddleware)

// Apply strict rate limiting to sensitive routes (before auth middleware)
app.use('/api/auth', strictRateLimitMiddleware, authRoutes)
app.use('/api/users', strictRateLimitMiddleware, userRoutes)
app.use('/api/domains', domainRoutes)
app.use('/api/dns', dnsRoutes)
app.use('/api/settings', settingRoutes)
app.use('/api/email', strictRateLimitMiddleware, emailRoutes)

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is running', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  console.log(`Environment: ${IS_PRODUCTION ? 'production' : 'development'}`)
})
