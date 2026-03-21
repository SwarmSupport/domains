import { Resend } from 'resend'
import db from '../db'

function getSetting(key: string): string | null {
  const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  return setting?.value || null
}

function isEmailEnabled(): boolean {
  const enabled = getSetting('EMAIL_ENABLED')
  return enabled !== 'false' && enabled !== '0'
}

function getResendClient(): Resend | null {
  const apiKey = getSetting('RESEND_API_KEY')
  if (!apiKey) {
    console.warn('Resend API key not configured, email sending disabled')
    return null
  }
  return new Resend(apiKey)
}

interface EmailOptions {
  to: string
  subject: string
  html: string
}

export async function sendEmail({ to, subject, html }: EmailOptions): Promise<boolean> {
  if (!isEmailEnabled()) {
    console.log('Email sending is disabled, skipping email to:', to)
    return true
  }

  const resend = getResendClient()
  if (!resend) {
    return false
  }

  const fromEmail = getSetting('FROM_EMAIL') || 'noreply@domain.com'

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [to],
      subject,
      html
    })

    if (error) {
      console.error('Resend error:', error)
      return false
    }

    return true
  } catch (err) {
    console.error('Email send error:', err)
    return false
  }
}

export function generateVerificationToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let token = ''
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}

export async function sendVerificationEmail(email: string, username: string) {
  const token = generateVerificationToken()
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours

  // Store token in database
  db.prepare(`
    INSERT INTO email_verification_tokens (email, token, expires_at)
    VALUES (?, ?, ?)
  `).run(email, token, expiresAt)

  const appUrl = getSetting('APP_URL') || 'http://localhost:5173'
  const verifyUrl = `${appUrl}/verify-email?token=${token}`

  const html = `
    <h1>${username}, 验证您的邮箱地址</h1>
    <p>请点击下面的链接验证您的邮箱地址：</p>
    <a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background: #00d4aa; color: white; text-decoration: none; border-radius: 6px;">验证邮箱</a>
    <p style="margin-top: 20px; color: #666;">或者复制以下链接到浏览器：</p>
    <p style="word-break: break-all; color: #00d4aa;">${verifyUrl}</p>
    <p style="color: #666; margin-top: 20px;">如果您没有创建账户，请忽略此邮件。</p>
  `

  return sendEmail({
    to: email,
    subject: '验证您的邮箱地址',
    html
  })
}

export async function sendDomainApprovedEmail(email: string, username: string, domain: string) {
  const appUrl = getSetting('APP_URL') || 'http://localhost:5173'
  const html = `
    <h1>${username}, 您的域名申请已通过</h1>
    <p>您申请的域名 <strong>${domain}</strong> 已通过审核。</p>
    <p>您现在可以在仪表盘中管理您的域名了。</p>
    <a href="${appUrl}/domains" style="display: inline-block; padding: 12px 24px; background: #00d4aa; color: white; text-decoration: none; border-radius: 6px;">查看域名</a>
  `

  return sendEmail({
    to: email,
    subject: `您的域名申请已通过 - ${domain}`,
    html
  })
}

export async function sendDomainRejectedEmail(email: string, username: string, domain: string, reason: string) {
  const html = `
    <h1>${username}, 您的域名申请已被拒绝</h1>
    <p>您申请的域名 <strong>${domain}</strong> 已被拒绝。</p>
    ${reason ? `<p><strong>原因：</strong>${reason}</p>` : ''}
    <p>如有疑问，请联系客服。</p>
  `

  return sendEmail({
    to: email,
    subject: `您的域名申请已被拒绝 - ${domain}`,
    html
  })
}
