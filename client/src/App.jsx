import { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { ToastProvider } from './components/Toast'
import { ThemeProvider } from './components/ThemeContext'
import LockScreen from './components/LockScreen'
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
    // Already unlocked this session?
    try {
      if (sessionStorage.getItem('app_unlocked') === '1') {
        setIsLocked(false)
        return
      }
    } catch {}

    // Ask server
    fetch('/auth/status')
      .then(r => r.json())
      .then(data => setIsLocked(data.locked))
      .catch(() => setIsLocked(false)) // if server unreachable, don't block
  }, [])

  return (
    <ThemeProvider>
      <ToastProvider>
        {isLocked === null ? null : isLocked ? (
          <LockScreen onUnlock={() => setIsLocked(false)} />
        ) : (
          <AppRoutes />
        )}
      </ToastProvider>
    </ThemeProvider>
  )
}
