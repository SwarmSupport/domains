export interface User {
  id: number
  username: string
  email: string
  role: 'user' | 'admin'
  created_at: string
}

export interface Domain {
  id: number
  name: string
  user_id: number | null
  username?: string
  status: 'pending' | 'active' | 'suspended'
  expires_at: string
  dnspod_domain_id: string | null
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
}

export interface RegisterForm {
  username: string
  email: string
  password: string
  confirmPassword: string
}

export interface ApiResponse<T = any> {
  success: boolean
  message?: string
  data?: T
  error?: string
}

export interface Setting {
  key: string
  value: string
}
