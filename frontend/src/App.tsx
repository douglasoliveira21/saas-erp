import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './components/Toast'
import { ActionToastProvider } from './components/ActionToast'
import { PrivateRoute } from './components/PrivateRoute'
import { Layout } from './components/Layout'

const Login = lazy(() => import('./pages/Login').then(module => ({ default: module.Login })))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword').then(module => ({ default: module.ForgotPassword })))
const ResetPassword = lazy(() => import('./pages/ResetPassword').then(module => ({ default: module.ResetPassword })))
const Dashboard = lazy(() => import('./pages/Dashboard').then(module => ({ default: module.Dashboard })))
const Products = lazy(() => import('./pages/Products').then(module => ({ default: module.Products })))
const Services = lazy(() => import('./pages/Services').then(module => ({ default: module.Services })))
const Customers = lazy(() => import('./pages/Customers').then(module => ({ default: module.Customers })))
const Sales = lazy(() => import('./pages/Sales').then(module => ({ default: module.Sales })))
const NewSale = lazy(() => import('./pages/NewSale').then(module => ({ default: module.NewSale })))
const Commissions = lazy(() => import('./pages/Commissions').then(module => ({ default: module.Commissions })))
const Users = lazy(() => import('./pages/Users').then(module => ({ default: module.Users })))
const Reports = lazy(() => import('./pages/Reports').then(module => ({ default: module.Reports })))
const Stock = lazy(() => import('./pages/Stock').then(module => ({ default: module.Stock })))
const RoutesPage = lazy(() => import('./pages/Routes').then(module => ({ default: module.Routes })))
const Contracts = lazy(() => import('./pages/Contracts').then(module => ({ default: module.Contracts })))
const Sla = lazy(() => import('./pages/Sla').then(module => ({ default: module.Sla })))
const Profile = lazy(() => import('./pages/Profile').then(module => ({ default: module.Profile })))
const Fiscal = lazy(() => import('./pages/Fiscal').then(module => ({ default: module.Fiscal })))
const Financial = lazy(() => import('./pages/Financial').then(module => ({ default: module.Financial })))
const Payments = lazy(() => import('./pages/Payments').then(module => ({ default: module.Payments })))
const Reconciliation = lazy(() => import('./pages/Reconciliation').then(module => ({ default: module.Reconciliation })))
const Vehicles = lazy(() => import('./pages/Vehicles').then(module => ({ default: module.Vehicles })))
const Purchases = lazy(() => import('./pages/Purchases').then(module => ({ default: module.Purchases })))
const Pdv = lazy(() => import('./pages/Pdv').then(module => ({ default: module.Pdv })))
const Orcamentos = lazy(() => import('./pages/Orcamentos').then(module => ({ default: module.Orcamentos })))
const PreVendas = lazy(() => import('./pages/PreVendas').then(module => ({ default: module.PreVendas })))
const VendasRecorrentes = lazy(() => import('./pages/VendasRecorrentes').then(module => ({ default: module.VendasRecorrentes })))
const Cashback = lazy(() => import('./pages/Cashback').then(module => ({ default: module.Cashback })))
const Fidelidade = lazy(() => import('./pages/Fidelidade').then(module => ({ default: module.Fidelidade })))
const Assinaturas = lazy(() => import('./pages/Assinaturas').then(module => ({ default: module.Assinaturas })))
const EmailSettings = lazy(() => import('./pages/EmailSettings').then(module => ({ default: module.EmailSettings })))
const Bills = lazy(() => import('./pages/Bills').then(module => ({ default: module.Bills })))
const Dre = lazy(() => import('./pages/Dre').then(module => ({ default: module.Dre })))
const FinancialAdvanced = lazy(() => import('./pages/FinancialAdvanced').then(module => ({ default: module.FinancialAdvanced })))
const StockAdvanced = lazy(() => import('./pages/StockAdvanced').then(module => ({ default: module.StockAdvanced })))
const FiscalAdvanced = lazy(() => import('./pages/FiscalAdvanced').then(module => ({ default: module.FiscalAdvanced })))
const InterAdvanced = lazy(() => import('./pages/InterAdvanced').then(module => ({ default: module.InterAdvanced })))
const PurchasesAdvanced = lazy(() => import('./pages/PurchasesAdvanced').then(module => ({ default: module.PurchasesAdvanced })))
const Operations = lazy(() => import('./pages/Operations').then(module => ({ default: module.Operations })))
const Crm = lazy(() => import('./pages/Crm').then(module => ({ default: module.Crm })))
const ServiceOrders = lazy(() => import('./pages/ServiceOrders').then(module => ({ default: module.ServiceOrders })))
const ServiceOrderForm = lazy(() => import('./pages/ServiceOrderForm').then(module => ({ default: module.ServiceOrderForm })))
const ServiceOrderDetail = lazy(() => import('./pages/ServiceOrderDetail').then(module => ({ default: module.ServiceOrderDetail })))
const WhatsappSettings = lazy(() => import('./pages/WhatsappSettings').then(module => ({ default: module.WhatsappSettings })))
const Tutorial = lazy(() => import('./pages/Tutorial').then(module => ({ default: module.Tutorial })))
const CustomerPortalAdmin = lazy(() => import('./pages/CustomerPortalAdmin').then(module => ({ default: module.CustomerPortalAdmin })))
const SuperAdminLogin = lazy(() => import('./pages/super-admin/SuperAdminLogin').then(module => ({ default: module.SuperAdminLogin })))
const SuperAdminLayout = lazy(() => import('./pages/super-admin/SuperAdminLayout').then(module => ({ default: module.SuperAdminLayout })))
const SuperAdminTenants = lazy(() => import('./pages/super-admin/SuperAdminTenants').then(module => ({ default: module.SuperAdminTenants })))
const SuperAdminPlans = lazy(() => import('./pages/super-admin/SuperAdminPlans').then(module => ({ default: module.SuperAdminPlans })))
const SuperAdminMunicipalities = lazy(() => import('./pages/super-admin/SuperAdminMunicipalities').then(module => ({ default: module.SuperAdminMunicipalities })))
const SuperAdminBanks = lazy(() => import('./pages/super-admin/SuperAdminBanks').then(module => ({ default: module.SuperAdminBanks })))
const SuperAdminAccount = lazy(() => import('./pages/super-admin/SuperAdminAccount').then(module => ({ default: module.SuperAdminAccount })))

function PageLoader() {
  const [delayed, setDelayed] = useState(false)
  useEffect(() => { const timer = window.setTimeout(() => setDelayed(true), 8000); return () => window.clearTimeout(timer) }, [])
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6" role="status" aria-live="polite">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-primary-100 border-t-primary-600" aria-hidden="true" />
        <p className="mt-4 text-sm text-gray-500">Carregando página...</p>
        {delayed && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm text-amber-800">O carregamento está demorando mais que o esperado.</p><button className="btn btn-primary mt-3" onClick={() => window.location.reload()}>Recarregar aplicação</button></div>}
      </div>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
      <ActionToastProvider>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            {/* Painel do super admin: autenticação e client HTTP totalmente separados do app do
                tenant (services/superAdminApi.ts) — fora da árvore do PrivateRoute/AuthProvider. */}
            <Route path="/super-admin/login" element={<SuperAdminLogin />} />
            <Route path="/super-admin" element={<SuperAdminLayout />}>
              <Route index element={<Navigate to="/super-admin/tenants" replace />} />
              <Route path="tenants" element={<SuperAdminTenants />} />
              <Route path="plans" element={<SuperAdminPlans />} />
              <Route path="municipalities" element={<SuperAdminMunicipalities />} />
              <Route path="banks" element={<SuperAdminBanks />} />
              <Route path="account" element={<SuperAdminAccount />} />
            </Route>
            <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/products" element={<Products />} />
              <Route path="/services" element={<Services />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/crm" element={<Crm />} />
              <Route path="/sales" element={<Sales />} />
              <Route path="/sales/new" element={<NewSale />} />
              <Route path="/commissions" element={<Commissions />} />
              <Route path="/stock" element={<Stock />} />
              <Route path="/routes" element={<RoutesPage />} />
              <Route path="/service-orders" element={<ServiceOrders />} />
              <Route path="/service-orders/new" element={<ServiceOrderForm />} />
              <Route path="/service-orders/:id" element={<ServiceOrderDetail />} />
              <Route path="/vehicles" element={<Vehicles />} />
              <Route path="/contracts" element={<Contracts />} />
              <Route path="/sla" element={<Sla />} />
              <Route path="/users" element={<Users />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/fiscal" element={<Fiscal />} />
              <Route path="/financeiro" element={<Financial />} />
              <Route path="/pagamentos" element={<Payments />} />
              <Route path="/conciliacao" element={<Reconciliation />} />
              <Route path="/compras" element={<Purchases />} />
              <Route path="/pdv" element={<Pdv />} />
              <Route path="/orcamentos" element={<Orcamentos />} />
              <Route path="/pre-vendas" element={<PreVendas />} />
              <Route path="/vendas-recorrentes" element={<VendasRecorrentes />} />
              <Route path="/cashback" element={<Cashback />} />
              <Route path="/fidelidade" element={<Fidelidade />} />
              <Route path="/assinaturas" element={<Assinaturas />} />
              <Route path="/email-settings" element={<EmailSettings />} />
              <Route path="/whatsapp-settings" element={<WhatsappSettings />} />
              <Route path="/contas-pagar" element={<Bills />} />
              <Route path="/dre" element={<Dre />} />
              <Route path="/financeiro-avancado" element={<FinancialAdvanced />} />
              <Route path="/estoque-avancado" element={<StockAdvanced />} />
              <Route path="/fiscal-avancado" element={<FiscalAdvanced />} />
              <Route path="/inter-avancado" element={<InterAdvanced />} />
              <Route path="/compras-avancado" element={<PurchasesAdvanced />} />
              <Route path="/controles-erp" element={<Operations />} />
              <Route path="/tutorial" element={<Tutorial />} />
              <Route path="/customer-portal" element={<CustomerPortalAdmin />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </AuthProvider>
      </ActionToastProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}

export default App
