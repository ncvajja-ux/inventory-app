import { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { ToastProvider } from './components/Toast'
import { ThemeProvider } from './components/ThemeContext'
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
import Groups from './pages/Groups'

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/customers" element={<Customers />} />
      <Route path="/customers/:kunnr" element={<CustomerDetail />} />
      <Route path="/inventory" element={<Inventory />} />
      <Route path="/inventory/:matnr" element={<ItemDetail />} />
      <Route path="/sales" element={<Sales />} />
      <Route path="/invoice" element={<Invoice />} />
      <Route path="/buyers" element={<Buyers />} />
      <Route path="/purchase-orders" element={<PurchaseOrders />} />
      <Route path="/analytics" element={<Analytics />} />
      <Route path="/hr" element={<HR />} />
      <Route path="/groups" element={<Groups />} />
    </Routes>
  )
}

export default function App() {
  // null = checking, true = locked, false = unlocked
  const [isLocked, setIsLocked] = useState(null)

  useEffect(() => {
    // Check for existing Supabase session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLocked(!session)
    }).catch(() => {
      setIsLocked(true)
    })

    // React to sign-in and sign-out
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLocked(!session)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <ThemeProvider>
      <ToastProvider>
        {isLocked === null ? null : isLocked ? (
          <LockScreen />
        ) : (
          <AppRoutes />
        )}
      </ToastProvider>
    </ThemeProvider>
  )
}
