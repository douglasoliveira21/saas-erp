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

// Um 401 de integração externa não significa necessariamente sessão expirada.
let sessionCheck: Promise<boolean> | null = null

async function hasActiveSession(): Promise<boolean> {
  if (!sessionCheck) {
    sessionCheck = axios.get('/api/auth/session', {
      withCredentials: true,
      headers: memoryToken ? { Authorization: 'Bearer ' + memoryToken } : undefined,
    }).then(response => Boolean(response.data?.user)).catch(() => true).finally(() => { sessionCheck = null })
  }
  return sessionCheck
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const requestUrl = String(error.config?.url || '')
    if (error.response?.status === 401 && !requestUrl.startsWith('/auth/')) {
      const authenticated = await hasActiveSession()
      if (!authenticated && !window.location.pathname.startsWith('/login')) {
        setSessionToken(null)
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)
