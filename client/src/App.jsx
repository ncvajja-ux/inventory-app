import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider } from './components/Toast'
import { ThemeProvider } from './components/ThemeContext'
import { RoleContext } from './components/RoleContext'
import LockScreen from './components/LockScreen'
import { supabase } from './lib/supabase'
import LandingPage from './pages/LandingPage'
import Customers from './pages/Customers'
import CustomerDetail from './pages/CustomerDetail'
import Inventory from './pages/Inventory'
import ItemDetail from './pages/ItemDetail'
import Sales from './pages/Sales'
import Invoice from './pages/Invoice'
import Buyers from './pages/Buyers'
import PurchaseOrders from './pages/PurchaseOrders'
import Analytics from './pages/Analytics'
import HR from './pages/HR'

const VALID_ROLES = ['admin', 'sales']

function ProtectedRoute({ role, allowedRoles, children }) {
  if (!allowedRoles.includes(role)) {
    return <Navigate to="/" replace />
  }
  return children
}

function AppRoutes({ role }) {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/customers" element={<Customers />} />
      <Route path="/customers/:kunnr" element={<CustomerDetail />} />
      <Route path="/inventory" element={<Inventory />} />
      <Route path="/inventory/:matnr" element={<Navigate to="/inventory" replace />} />
      <Route path="/inventory/product/:skuId" element={<ItemDetail />} />
      <Route path="/sales" element={<Sales />} />
      <Route path="/invoice" element={<Invoice />} />
      <Route path="/buyers" element={
        <ProtectedRoute role={role} allowedRoles={['admin']}>
          <Buyers />
        </ProtectedRoute>
      } />
      <Route path="/purchase-orders" element={
        <ProtectedRoute role={role} allowedRoles={['admin']}>
          <PurchaseOrders />
        </ProtectedRoute>
      } />
      <Route path="/analytics" element={<Analytics />} />
      <Route path="/hr" element={
        <ProtectedRoute role={role} allowedRoles={['admin']}>
          <HR />
        </ProtectedRoute>
      } />
      <Route path="/groups" element={<Navigate to="/customers" replace />} />
    </Routes>
  )
}

export default function App() {
  // null = checking, true = locked, false = unlocked
  const [isLocked, setIsLocked] = useState(null)
  const [role, setRole] = useState(null)

  function resolveRole(session) {
    if (!session) return null
    const r = session.user?.app_metadata?.role
    return VALID_ROLES.includes(r) ? r : 'sales'
  }

  useEffect(() => {
    // Check for existing Supabase session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLocked(!session)
      setRole(resolveRole(session))
    }).catch(() => {
      setIsLocked(true)
      setRole(null)
    })

    // React to sign-in and sign-out
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLocked(!session)
      setRole(resolveRole(session))
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <ThemeProvider>
      <ToastProvider>
        <RoleContext.Provider value={role ?? 'sales'}>
          {isLocked === null ? null : isLocked ? (
            <LockScreen />
          ) : (
            <AppRoutes role={role ?? 'sales'} />
          )}
        </RoleContext.Provider>
      </ToastProvider>
    </ThemeProvider>
  )
}
