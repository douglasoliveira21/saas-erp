import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { api } from '../services/api'

interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'financeiro' | 'tecnico'
}

interface AuthContextData {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  isAdmin: boolean
  isFinanceiro: boolean
  isTecnico: boolean
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('@GestaoTI:token')
    const storedUser = localStorage.getItem('@GestaoTI:user')

    if (token && storedUser) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
      setUser(JSON.parse(storedUser))
    }

    setLoading(false)
  }, [])

  async function login(email: string, password: string) {
    const response = await api.post('/auth/login', { email, password })
    const { access_token, user: userData } = response.data

    localStorage.setItem('@GestaoTI:token', access_token)
    localStorage.setItem('@GestaoTI:user', JSON.stringify(userData))

    api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`
    setUser(userData)
  }

  function logout() {
    localStorage.removeItem('@GestaoTI:token')
    localStorage.removeItem('@GestaoTI:user')
    delete api.defaults.headers.common['Authorization']
    setUser(null)
  }

  const isAdmin = user?.role === 'admin'
  const isFinanceiro = user?.role === 'financeiro'
  const isTecnico = user?.role === 'tecnico'

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAdmin,
        isFinanceiro,
        isTecnico,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
