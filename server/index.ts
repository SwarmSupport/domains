import express from 'express'
import cors from 'cors'
import { initDatabase } from './db'
import authRoutes from './routes/auth'
import userRoutes from './routes/users'
import domainRoutes from './routes/domains'
import dnsRoutes from './routes/dns'
import settingRoutes from './routes/settings'

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

initDatabase()

app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/domains', domainRoutes)
app.use('/api/dns', dnsRoutes)
app.use('/api/settings', settingRoutes)

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is running' })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
