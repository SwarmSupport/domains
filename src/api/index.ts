import axios from 'axios'
import type { ApiResponse, User, Domain, DnsRecord, LoginForm, RegisterForm } from '@/types'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      // Use pushState instead of window.location.href to avoid page refresh
      window.history.pushState(null, '', '/login')
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
