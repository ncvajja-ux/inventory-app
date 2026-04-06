import { Routes, Route } from 'react-router-dom'
import { ToastProvider } from './components/Toast'
import LandingPage from './pages/LandingPage'
import Customers from './pages/Customers'
import Inventory from './pages/Inventory'
import Sales from './pages/Sales'
import Invoice from './pages/Invoice'

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/sales" element={<Sales />} />
        <Route path="/invoice" element={<Invoice />} />
      </Routes>
    </ToastProvider>
  )
}
