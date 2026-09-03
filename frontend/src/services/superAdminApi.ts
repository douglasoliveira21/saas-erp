import axios from 'axios'

// Instância isolada da usada pelo app do tenant (services/api.ts): token próprio, chave de
// storage própria — evita qualquer risco de um token vazar para o outro contexto. Persistido em
// localStorage (diferente do app do tenant, que guarda só em memória) porque o super admin é uso
// esporádico e reautenticar a cada F5 seria só atrito, sem ganho de segurança real aqui.
const STORAGE_KEY = 'saas_erp_super_admin_token'
let memoryToken: string | null = localStorage.getItem(STORAGE_KEY)
export function setSuperAdminToken(token: string | null) {
  memoryToken = token
  if (token) localStorage.setItem(STORAGE_KEY, token)
  else localStorage.removeItem(STORAGE_KEY)
}
export function getSuperAdminToken() { return memoryToken }

export const superAdminApi = axios.create({
  baseURL: '/api/super-admin',
  timeout: 30000,
})

superAdminApi.interceptors.request.use((config) => {
  if (memoryToken) config.headers.Authorization = `Bearer ${memoryToken}`
  return config
})

superAdminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.startsWith('/super-admin/login')) {
      setSuperAdminToken(null)
      window.location.href = '/super-admin/login'
    }
    return Promise.reject(error)
  }
)
