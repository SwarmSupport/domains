import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import path from 'path'
import fs from 'fs'

const dbDir = process.cwd()
const dbPath = path.join(dbDir, 'data.db')

// Ensure database directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}

const db = new Database(dbPath)

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL')

export function initDatabase() {
  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      email_verified INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS domains (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      user_id INTEGER,
      purpose TEXT,
      status TEXT DEFAULT 'pending',
      rejection_reason TEXT,
      expires_at DATETIME DEFAULT (datetime('now', '+1 year')),
      dnspod_domain_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS dns_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain_id INTEGER NOT NULL,
      record_id TEXT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      value TEXT NOT NULL,
      priority INTEGER DEFAULT 10,
      ttl INTEGER DEFAULT 600,
      enabled INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (domain_id) REFERENCES domains(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `)

  // Create indexes for better performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_domains_user_id ON domains(user_id);
    CREATE INDEX IF NOT EXISTS idx_domains_status ON domains(status);
    CREATE INDEX IF NOT EXISTS idx_dns_records_domain_id ON dns_records(domain_id);
    CREATE INDEX IF NOT EXISTS idx_email_tokens_email ON email_verification_tokens(email);
  `)

  // Migration: Add email_verified column if it doesn't exist (for existing databases)
  try {
    const userColumns = db.prepare("PRAGMA table_info(users)").all() as { name: string }[]
    const hasEmailVerified = userColumns.some(col => col.name === 'email_verified')
    if (!hasEmailVerified) {
      db.exec('ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0')
      console.log('Migration: Added email_verified column to users table')
    }
  } catch (err) {
    console.warn('Migration check failed (this is normal for new databases):', err)
  }

  // Migration: Add rejection_reason column to domains if it doesn't exist
  try {
    const domainColumns = db.prepare("PRAGMA table_info(domains)").all() as { name: string }[]
    const hasRejectionReason = domainColumns.some(col => col.name === 'rejection_reason')
    if (!hasRejectionReason) {
      db.exec('ALTER TABLE domains ADD COLUMN rejection_reason TEXT')
      console.log('Migration: Added rejection_reason column to domains table')
    }
  } catch (err) {
    console.warn('Migration check for rejection_reason failed:', err)
  }

  // Migration: Add dnspod_domain_id column to domains if it doesn't exist
  try {
    const domainColumns = db.prepare("PRAGMA table_info(domains)").all() as { name: string }[]
    const hasDnspodDomainId = domainColumns.some(col => col.name === 'dnspod_domain_id')
    if (!hasDnspodDomainId) {
      db.exec('ALTER TABLE domains ADD COLUMN dnspod_domain_id TEXT')
      console.log('Migration: Added dnspod_domain_id column to domains table')
    }
  } catch (err) {
    console.warn('Migration check for dnspod_domain_id failed:', err)
  }

  // Migration: Add banned column to users if it doesn't exist
  try {
    const userColumns = db.prepare("PRAGMA table_info(users)").all() as { name: string }[]
    const hasBanned = userColumns.some(col => col.name === 'banned')
    if (!hasBanned) {
      db.exec('ALTER TABLE users ADD COLUMN banned INTEGER DEFAULT 0')
      console.log('Migration: Added banned column to users table')
    }
  } catch (err) {
    console.warn('Migration check for banned failed:', err)
  }

  // Migration: Add suspended column to domains if it doesn't exist
  try {
    const domainColumns = db.prepare("PRAGMA table_info(domains)").all() as { name: string }[]
    const hasSuspended = domainColumns.some(col => col.name === 'suspended')
    if (!hasSuspended) {
      db.exec('ALTER TABLE domains ADD COLUMN suspended INTEGER DEFAULT 0')
      console.log('Migration: Added suspended column to domains table')
    }
  } catch (err) {
    console.warn('Migration check for suspended failed:', err)
  }

  // Migration: Add purpose column to domains if it doesn't exist
  try {
    const domainColumns = db.prepare("PRAGMA table_info(domains)").all() as { name: string }[]
    const hasPurpose = domainColumns.some(col => col.name === 'purpose')
    if (!hasPurpose) {
      db.exec('ALTER TABLE domains ADD COLUMN purpose TEXT')
      console.log('Migration: Added purpose column to domains table')
    }
  } catch (err) {
    console.warn('Migration check for purpose failed:', err)
  }

  // Migration: Add role column to users if it doesn't exist (for databases created before role was added)
  try {
    const userColumns = db.prepare("PRAGMA table_info(users)").all() as { name: string }[]
    const hasRole = userColumns.some(col => col.name === 'role')
    if (!hasRole) {
      db.exec('ALTER TABLE users ADD COLUMN role TEXT DEFAULT \'user\'')
      console.log('Migration: Added role column to users table')
    }
  } catch (err) {
    console.warn('Migration check for role failed:', err)
  }

  // Ensure admin user exists and always has admin role
  const adminEmail = 'admin@example.com'
  const admin = db.prepare('SELECT id, role FROM users WHERE email = ?').get(adminEmail) as { id: number; role: string } | undefined

  if (!admin) {
    // Create admin if doesn't exist
    const hashedPassword = bcrypt.hashSync('admin123', 10)
    db.prepare(`
      INSERT INTO users (username, email, password, role, email_verified)
      VALUES (?, ?, ?, ?, 1)
    `).run('admin', adminEmail, hashedPassword, 'admin')
    console.log('Default admin created: admin@example.com / admin123')
  } else if (admin.role !== 'admin') {
    // Ensure existing admin user always has admin role
    db.prepare('UPDATE users SET role = ? WHERE email = ?').run('admin', adminEmail)
    console.log('Admin role ensured for admin@example.com')
  }

  // Initialize default settings with proper upsert (compatible with all SQLite versions)
  const defaultSettings = [
    ['TURNSTILE_ENABLED', 'false'],
    ['EMAIL_ENABLED', 'false'],
  ]

  for (const [key, value] of defaultSettings) {
    // Try update first, then insert if no rows affected
    const updateResult = db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(value, key)
    if (updateResult.changes === 0) {
      db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(key, value)
    }
  }

  console.log('Database initialized successfully')
}

export default db
