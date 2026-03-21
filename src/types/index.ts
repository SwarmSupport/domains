export interface User {
  id: number
  username: string
  email: string
  role: 'user' | 'admin'
  email_verified?: number
  banned?: number
  created_at: string
}

export interface Domain {
  id: number
  name: string
  user_id: number | null
  username?: string
  user_email?: string
  purpose?: string
  status: 'pending' | 'active' | 'suspended' | 'rejected'
  rejection_reason?: string
  expires_at: string
  dnspod_domain_id: string | null
  suspended?: number
  created_at: string
}

export interface DnsRecord {
  id: number
  domain_id: number
  record_id: string
  name: string
  type: string
  value: string
  priority: number
  ttl: number
  enabled: boolean
  created_at: string
}

export interface LoginForm {
  email: string
  password: string
  turnstileToken?: string
}

export interface RegisterForm {
  username: string
  email: string
  password: string
  confirmPassword: string
  turnstileToken?: string
}

export interface ApiResponse<T = any> {
  success: boolean
  message?: string
  data?: T
  error?: string
  needsVerification?: boolean
}

export interface Setting {
  key: string
  value: string
}
