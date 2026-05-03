// client/src/components/BottomNav.jsx
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useRole } from './RoleContext'

const ADMIN_ITEMS = [
  { icon: '🏷️', label: 'Stock',  href: '/inventory' },
  { icon: '🧾', label: 'Sales',  href: '/sales' },
  { icon: '📦', label: 'POs',    href: '/purchase-orders' },
  { icon: '👤', label: 'CRM',    href: '/customers' },
  { icon: '⋯',  label: 'More',   href: null },
]
const SALES_ITEMS = [
  { icon: '🏷️', label: 'Stock',     href: '/inventory' },
  { icon: '🧾', label: 'Sales',     href: '/sales' },
  { icon: '👤', label: 'CRM',       href: '/customers' },
  { icon: '👥', label: 'Groups',    href: '/groups' },
  { icon: '📊', label: 'Analytics', href: '/analytics' },
]
const MORE_ITEMS = [
  { icon: '📊', label: 'Analytics', href: '/analytics' },
  { icon: '🏢', label: 'Buyers',    href: '/buyers' },
  { icon: '👥', label: 'Groups',    href: '/groups' },
  { icon: '👷', label: 'HR',        href: '/hr' },
]

export default function BottomNav() {
  const location = useLocation()
  const role = useRole()
  const [moreOpen, setMoreOpen] = useState(false)
  const items = role === 'admin' ? ADMIN_ITEMS : SALES_ITEMS

  function isActive(href) {
    if (!href) return false
    return href === '/' ? location.pathname === '/' : location.pathname.startsWith(href)
  }

  return (
    <>
      {moreOpen && (
        <div className="erp-more-backdrop" onClick={() => setMoreOpen(false)}>
          <div className="erp-more-sheet" onClick={e => e.stopPropagation()}>
            {MORE_ITEMS.map(item => (
              <Link
                key={item.href}
                to={item.href}
                className="erp-more-item"
                onClick={() => setMoreOpen(false)}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
      <nav className="erp-bottom-nav">
        {items.map(item =>
          item.href ? (
            <Link
              key={item.href}
              to={item.href}
              className={`erp-bottom-item${isActive(item.href) ? ' active' : ''}`}
            >
              <span className="erp-bottom-icon">{item.icon}</span>
              <span className="erp-bottom-label">{item.label}</span>
            </Link>
          ) : (
            <button
              key="more"
              className={`erp-bottom-item${moreOpen ? ' active' : ''}`}
              onClick={() => setMoreOpen(o => !o)}
            >
              <span className="erp-bottom-icon">{item.icon}</span>
              <span className="erp-bottom-label">{item.label}</span>
            </button>
          )
        )}
      </nav>
    </>
  )
}
