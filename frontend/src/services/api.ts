import axios from 'axios'

export const api = axios.create({
  baseURL: '/api',
})

// Interceptor para adicionar token em todas as requisições
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('@GestaoTI:token')
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  
  return config
})

// Interceptor para tratar erros de autenticação
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('@GestaoTI:token')
      localStorage.removeItem('@GestaoTI:user')
      window.location.href = '/login'
    }
    
    return Promise.reject(error)
  }
)
