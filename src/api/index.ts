import axios from 'axios'
import type { ApiResponse, User, Domain, DnsRecord, LoginForm, RegisterForm } from '@/types'

// Generate a unique request ID for tracing
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Add request ID to all requests for tracing
api.interceptors.request.use((config) => {
  // Add request ID header for debugging
  config.headers['X-Request-ID'] = generateRequestId()

  // Add CSRF token if available (for same-origin requests)
  const csrfToken = document.cookie.match(/csrftoken=([^;]+)/)?.[1]
  if (csrfToken) {
    config.headers['X-CSRF-Token'] = csrfToken
  }

  // Add auth token from localStorage
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestId = error.config?.headers?.['X-Request-ID']
    const url = error.config?.url || 'unknown'
    const status = error.response?.status

    // Log error for debugging (only in non-production)
    if (import.meta.env.DEV) {
      console.error(`[API Error] ${status} - ${error.message}`, {
        url,
        requestId,
        data: error.response?.data
      })
    }

    // Handle 401 errors
    if (status === 401) {
      // Get current path
      const currentPath = window.location.pathname

      // If we're already on the login page or don't have a token,
      // don't trigger logout/navigation - just reject the promise
      const hasToken = !!localStorage.getItem('token')
      if (currentPath === '/login' || !hasToken) {
        return Promise.reject(error)
      }

      // Clear token and redirect to login
      localStorage.removeItem('token')

      // Only redirect if not already on login page
      if (currentPath !== '/login') {
        window.location.href = '/login'
      }
    }

    return Promise.reject(error)
  }
)

export const authApi = {
  login: (data: LoginForm) => api.post<ApiResponse<{ token: string; user: User }>>('/auth/login', data),
  register: (data: RegisterForm) => api.post<ApiResponse<{ userId: number; message: string }>>('/auth/register', data),
  getMe: () => api.get<ApiResponse<User>>('/auth/me')
}

export const userApi = {
  getList: () => api.get<ApiResponse<User[]>>('/users'),
  update: (id: number, data: Partial<User>) => api.put<ApiResponse>(`/users/${id}`, data),
  updatePassword: (id: number, password: string) => api.put<ApiResponse>(`/users/${id}/password`, { password }),
  delete: (id: number) => api.delete<ApiResponse>(`/users/${id}`)
}

export const domainApi = {
  getList: () => api.get<ApiResponse<Domain[]>>('/domains'),
  create: (name: string, purpose?: string) => api.post<ApiResponse<Domain>>('/domains', { name, purpose }),
  update: (id: number, data: Partial<Domain>) => api.put<ApiResponse>(`/domains/${id}`, data),
  delete: (id: number) => api.delete<ApiResponse>(`/domains/${id}`),
  approve: (id: number, userId: number) => api.post<ApiResponse>(`/domains/${id}/approve`, { userId }),
  reject: (id: number, reason?: string) => api.post<ApiResponse>(`/domains/${id}/reject`, { reason })
}

export const dnsApi = {
  getRecords: (domain: string) => api.get<ApiResponse<DnsRecord[]>>(`/dns/${domain}/records`),
  createRecord: (domain: string, data: Partial<DnsRecord>) => api.post<ApiResponse<DnsRecord>>(`/dns/${domain}/records`, data),
  updateRecord: (domain: string, recordId: number, data: Partial<DnsRecord>) => api.put<ApiResponse>(`/dns/${domain}/records/${recordId}`, data),
  deleteRecord: (domain: string, recordId: number) => api.delete<ApiResponse>(`/dns/${domain}/records/${recordId}`)
}

export const settingApi = {
  get: (key: string) => api.get<ApiResponse<{ value: string }>>(`/settings/${key}`),
  set: (key: string, value: string) => api.post<ApiResponse>('/settings', { key, value })
}

export const emailApi = {
  verify: (token: string) => api.post<ApiResponse>('/email/verify', { token }),
  resendVerification: () => api.post<ApiResponse>('/email/resend-verification')
}

export default api
