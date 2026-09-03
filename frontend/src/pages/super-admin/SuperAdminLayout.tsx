import { useEffect, useState } from 'react'
import { NavLink, Navigate, Outlet } from 'react-router-dom'
import { LayoutDashboard, ShieldCheck, Building2, PackageCheck, LogOut, MapPin, Landmark, UserCircle, Users2, Menu, X } from 'lucide-react'
import { getSuperAdminToken, setSuperAdminToken, superAdminApi } from '../../services/superAdminApi'

const navItems = [
  { to: '/super-admin/dashboard', label: 'Visão geral', icon: LayoutDashboard },
  { to: '/super-admin/tenants', label: 'Clientes', icon: Building2 },
  { to: '/super-admin/plans', label: 'Planos', icon: PackageCheck },
  { to: '/super-admin/municipalities', label: 'Municípios', icon: MapPin },
  { to: '/super-admin/banks', label: 'Bancos', icon: Landmark },
  { to: '/super-admin/admins', label: 'Administradores', icon: Users2 },
]

export function SuperAdminLayout() {
  const token = getSuperAdminToken()
  const [me, setMe] = useState<{ name: string; email: string } | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (token) superAdminApi.get('/auth/me').then(r => setMe(r.data)).catch(() => {})
  }, [token])

  if (!token) return <Navigate to="/super-admin/login" replace />

  function logout() {
    setSuperAdminToken(null)
    window.location.href = '/super-admin/login'
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? 'bg-amber-500/15 text-amber-300' : 'text-gray-400 hover:bg-gray-800/70 hover:text-gray-100'}`

  const sidebarContent = (
    <>
      <div className="flex items-center gap-2 px-2 py-1">
        <ShieldCheck className="h-6 w-6 text-amber-400" aria-hidden="true" />
        <span className="font-bold text-white">Super Admin</span>
      </div>
      <nav className="mt-6 flex-1 space-y-1">
        {navItems.map(item => (
          <NavLink key={item.to} to={item.to} className={linkClass} onClick={() => setMobileOpen(false)}>
            <item.icon className="h-4 w-4" aria-hidden="true" />{item.label}
          </NavLink>
        ))}
      </nav>
      <div className="space-y-1 border-t border-gray-800 pt-3">
        <NavLink to="/super-admin/account" className={linkClass} onClick={() => setMobileOpen(false)}>
          <UserCircle className="h-4 w-4" aria-hidden="true" />Minha conta
        </NavLink>
        <button onClick={logout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-400 hover:bg-gray-800/70 hover:text-gray-100">
          <LogOut className="h-4 w-4" aria-hidden="true" />Sair
        </button>
      </div>
    </>
  )

  return (
    <div className="flex min-h-screen bg-gray-950 text-white">
      <aside className="hidden w-64 flex-col border-r border-gray-800 bg-gray-950 p-4 lg:flex">
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="relative z-50 flex w-64 flex-col border-r border-gray-800 bg-gray-950 p-4">
            <button className="absolute right-3 top-3 rounded-lg p-1.5 text-gray-400 hover:bg-gray-800" onClick={() => setMobileOpen(false)}>
              <X className="h-4 w-4" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-gray-800 px-4 py-3 lg:justify-end lg:px-8">
          <button className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 lg:hidden" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          {me && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <UserCircle className="h-5 w-5" />
              <span>{me.name}</span>
            </div>
          )}
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
