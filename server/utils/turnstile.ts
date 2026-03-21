import db from '../db'

interface TurnstileResponse {
  success: boolean
  'error-codes'?: string[]
}

function getSetting(key: string): string | null {
  const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  return setting?.value || null
}

function isTurnstileEnabled(): boolean {
  const enabled = getSetting('TURNSTILE_ENABLED')
  return enabled !== 'false' && enabled !== '0'
}

export async function verifyTurnstile(token: string): Promise<boolean> {
  // If token is 'disabled', Turnstile is not enabled, skip verification
  if (token === 'disabled') {
    return true
  }

  if (!isTurnstileEnabled()) {
    console.warn('Turnstile is disabled, skipping verification')
    return true
  }

  const secretKey = getSetting('TURNSTILE_SECRET_KEY')
  if (!secretKey) {
    console.warn('Turnstile secret key not configured, skipping verification')
    return true
  }

  if (!token) {
    return false
  }

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        secret: secretKey,
        response: token
      })
    })

    const data = await response.json() as TurnstileResponse
    return data.success
  } catch (error) {
    console.error('Turnstile verification error:', error)
    return false
  }
}
