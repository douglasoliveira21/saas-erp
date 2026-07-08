import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { PrivateRoute } from './components/PrivateRoute'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { ForgotPassword } from './pages/ForgotPassword'
import { ResetPassword } from './pages/ResetPassword'
import { Dashboard } from './pages/Dashboard'
import { Products } from './pages/Products'
import { Services } from './pages/Services'
import { Customers } from './pages/Customers'
import { Sales } from './pages/Sales'
import { NewSale } from './pages/NewSale'
import { Commissions } from './pages/Commissions'
import { Users } from './pages/Users'
import { Reports } from './pages/Reports'
import { Stock } from './pages/Stock'
import { Routes as RoutesPage } from './pages/Routes'
import { Contracts } from './pages/Contracts'
import { Sla } from './pages/Sla'
import { Profile } from './pages/Profile'
import { Fiscal } from './pages/Fiscal'
import { Financial } from './pages/Financial'
import { Payments } from './pages/Payments'
import { Reconciliation } from './pages/Reconciliation'
import { Vehicles } from './pages/Vehicles'
import { Purchases } from './pages/Purchases'
import { Pdv } from './pages/Pdv'
import { Orcamentos } from './pages/Orcamentos'
import { PreVendas } from './pages/PreVendas'
import { VendasRecorrentes } from './pages/VendasRecorrentes'
import { Cashback } from './pages/Cashback'
import { Fidelidade } from './pages/Fidelidade'
import { Assinaturas } from './pages/Assinaturas'
import { EmailSettings } from './pages/EmailSettings'
import { Bills } from './pages/Bills'
import { Dre } from './pages/Dre'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          
          <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/products" element={<Products />} />
            <Route path="/services" element={<Services />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/sales" element={<Sales />} />
            <Route path="/sales/new" element={<NewSale />} />
            <Route path="/commissions" element={<Commissions />} />
            <Route path="/stock" element={<Stock />} />
            <Route path="/routes" element={<RoutesPage />} />
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
            <Route path="/contas-pagar" element={<Bills />} />
            <Route path="/dre" element={<Dre />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
