// client/src/components/BottomNav.jsx
import { useState, useEffect } from 'react'
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
const MORE_HREFS = new Set(MORE_ITEMS.map(i => i.href))

export default function BottomNav() {
  const location = useLocation()
  const role = useRole()
  const [moreOpen, setMoreOpen] = useState(false)
  const items = role === 'admin' ? ADMIN_ITEMS : SALES_ITEMS

  // Close More sheet on Escape key
  useEffect(() => {
    if (!moreOpen) return
    const handler = e => { if (e.key === 'Escape') setMoreOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [moreOpen])

  function isActive(href) {
    if (!href) return false
    return href === '/' ? location.pathname === '/' : location.pathname.startsWith(href)
  }

  // More button is "active" when sheet is open OR current path is in MORE_ITEMS
  const moreActive = moreOpen || MORE_HREFS.has(location.pathname) ||
    [...MORE_HREFS].some(h => location.pathname.startsWith(h))

  return (
    <>
      {moreOpen && (
        <div
          className="erp-more-backdrop"
          onClick={() => setMoreOpen(false)}
          aria-hidden="true"
        >
          <div
            className="erp-more-sheet"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="More navigation"
          >
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
      <nav className="erp-bottom-nav" aria-label="Main navigation">
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
              className={`erp-bottom-item${moreActive ? ' active' : ''}`}
              onClick={() => setMoreOpen(o => !o)}
              aria-expanded={moreOpen}
              aria-haspopup="dialog"
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
