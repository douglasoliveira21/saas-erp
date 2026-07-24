import axios from 'axios'

let memoryToken: string | null = null
export function setSessionToken(token: string | null) { memoryToken = token }

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  if (memoryToken) config.headers.Authorization = `Bearer ${memoryToken}`
  return config
})

// Interceptor para tratar erros de autenticação
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (!window.location.pathname.startsWith('/login')) window.location.href = '/login'
    }
    
    return Promise.reject(error)
  }
)
