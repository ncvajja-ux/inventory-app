import { Routes, Route } from 'react-router-dom'
import { ToastProvider } from './components/Toast'
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

export default function App() {
  return (
    <ToastProvider>
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
      </Routes>
    </ToastProvider>
  )
}
