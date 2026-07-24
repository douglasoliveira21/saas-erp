import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface PrivateRouteProps {
  children: React.ReactNode
}

export function PrivateRoute({ children }: PrivateRouteProps) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" role="status" aria-label="Carregando sessão" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  const adminOnly = ['/users', '/email-settings', '/vehicles']
  const officeOnly = [
    '/contracts', '/sla', '/reports', '/fiscal', '/financeiro', '/pagamentos',
    '/conciliacao', '/compras', '/contas-pagar', '/dre', '/financeiro-avancado',
    '/estoque-avancado', '/fiscal-avancado', '/inter-avancado', '/compras-avancado',
    '/controles-erp', '/cashback', '/fidelidade', '/assinaturas',
  ]
  const matches = (paths: string[]) => paths.some(path => location.pathname === path || location.pathname.startsWith(`${path}/`))
  if (matches(adminOnly) && user.role !== 'admin') return <Navigate to="/dashboard" replace />
  if (matches(officeOnly) && !['admin', 'financeiro'].includes(user.role)) return <Navigate to="/dashboard" replace />

  return <>{children}</>
}