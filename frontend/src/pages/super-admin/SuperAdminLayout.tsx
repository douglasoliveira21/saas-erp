import { NavLink, Navigate, Outlet } from 'react-router-dom'
import { ShieldCheck, Building2, PackageCheck, LogOut, MapPin, Landmark, UserCircle } from 'lucide-react'
import { getSuperAdminToken, setSuperAdminToken } from '../../services/superAdminApi'

export function SuperAdminLayout() {
  const token = getSuperAdminToken()
  if (!token) return <Navigate to="/super-admin/login" replace />

  function logout() {
    setSuperAdminToken(null)
    window.location.href = '/super-admin/login'
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? 'bg-amber-500/20 text-amber-300' : 'text-gray-300 hover:bg-gray-800'}`

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-amber-400" aria-hidden="true" />
          <span className="font-bold">Super Admin</span>
        </div>
        <nav className="flex items-center gap-2">
          <NavLink to="/super-admin/tenants" className={linkClass}><Building2 className="h-4 w-4" aria-hidden="true" />Clientes</NavLink>
          <NavLink to="/super-admin/plans" className={linkClass}><PackageCheck className="h-4 w-4" aria-hidden="true" />Planos</NavLink>
          <NavLink to="/super-admin/municipalities" className={linkClass}><MapPin className="h-4 w-4" aria-hidden="true" />Municípios</NavLink>
          <NavLink to="/super-admin/banks" className={linkClass}><Landmark className="h-4 w-4" aria-hidden="true" />Bancos</NavLink>
          <NavLink to="/super-admin/account" className={linkClass}><UserCircle className="h-4 w-4" aria-hidden="true" />Minha conta</NavLink>
          <button onClick={logout} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800">
            <LogOut className="h-4 w-4" aria-hidden="true" />Sair
          </button>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl p-6">
        <Outlet />
      </main>
    </div>
  )
}
