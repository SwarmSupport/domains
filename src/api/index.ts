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
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export const authApi = {
  login: (data: LoginForm) => api.post<ApiResponse<{ token: string; user: User }>>('/auth/login', data),
  register: (data: RegisterForm) => api.post<ApiResponse<{ token: string; user: User }>>('/auth/register', data),
  getMe: () => api.get<ApiResponse<User>>('/auth/me')
}

export const userApi = {
  getList: () => api.get<ApiResponse<User[]>>('/users'),
  update: (id: number, data: Partial<User>) => api.put<ApiResponse>(`/users/${id}`, data),
  delete: (id: number) => api.delete<ApiResponse>(`/users/${id}`)
}

export const domainApi = {
  getList: () => api.get<ApiResponse<Domain[]>>('/domains'),
  create: (name: string) => api.post<ApiResponse<Domain>>('/domains', { name }),
  update: (id: number, data: Partial<Domain>) => api.put<ApiResponse>(`/domains/${id}`, data),
  delete: (id: number) => api.delete<ApiResponse>(`/domains/${id}`),
  assign: (id: number, userId: number) => api.post<ApiResponse>(`/domains/${id}/assign`, { userId })
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

export default api
