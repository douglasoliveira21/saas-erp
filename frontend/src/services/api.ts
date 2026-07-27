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

export async function getSessionUser() {
  const options = {
    withCredentials: true,
    headers: memoryToken ? { Authorization: 'Bearer ' + memoryToken } : undefined,
  }

  try {
    const response = await axios.get('/api/auth/session', options)
    return response.data?.user || null
  } catch (error) {
    if (!axios.isAxiosError(error) || error.response?.status !== 404) throw error
    const response = await axios.get('/api/auth/me', options)
    return response.data || null
  }
}

async function hasActiveSession(): Promise<boolean> {
  if (!sessionCheck) {
    sessionCheck = getSessionUser().then(Boolean).catch(() => true).finally(() => { sessionCheck = null })
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
