// client/src/components/ERPLayout.jsx
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import { useBreakpoint } from '../hooks/useBreakpoint'

export default function ERPLayout({ children }) {
  const bp = useBreakpoint()
  return (
    <div className="erp-shell">
      {bp !== 'mobile' && <Sidebar />}
      <main className="erp-main">
        {children}
      </main>
      {bp === 'mobile' && <BottomNav />}
    </div>
  )
}
