import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

const ALL_NAV = [
  { href: '/',                icon: '🏠', label: 'Home' },
  { href: '/customers',       icon: '👤', label: 'Customers' },
  { href: '/inventory',       icon: '🏷️', label: 'Inventory' },
  { href: '/sales',           icon: '🧾', label: 'Sales' },
  { href: '/buyers',          icon: '🏢', label: 'Buyers' },
  { href: '/purchase-orders', icon: '📦', label: 'Purchase Orders' },
  { href: '/analytics',       icon: '📊', label: 'Analytics' },
]

const SECTION_TABS = {
  Customers: [
    { id: 'add',    icon: '➕', label: 'Add Customer' },
    { id: 'view',   icon: '👥', label: 'View Customers' },
    { id: 'upload', icon: '📥', label: 'Mass Upload' },
  ],
  Inventory: [
    { id: 'add',    icon: '🆕', label: 'New Product' },
    { id: 'view',   icon: '📦', label: 'View Stock' },
    { id: 'cats',   icon: '🗂️', label: 'Config' },
    { id: 'upload', icon: '📥', label: 'Mass Upload' },
  ],
  Sales: [
    { id: 'new',     icon: '🧾', label: 'New Order' },
    { id: 'orders',  icon: '📋', label: 'All Orders' },
    { id: 'returns', icon: '↩️', label: 'Returns' },
    { id: 'pricing', icon: '💰', label: 'Sales Pricing' },
  ],
  Buyers: [
    { id: 'add',  icon: '➕', label: 'Add Buyer' },
    { id: 'view', icon: '🏢', label: 'View Buyers' },
  ],
  PurchaseOrders: [
    { id: 'new', icon: '➕', label: 'New PO' },
    { id: 'all', icon: '📋', label: 'All POs' },
  ],
  Analytics: [],
}

export default function Sidebar({ section, activeTab, onTabChange }) {
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebarCollapsed') === 'true' } catch { return false }
  })

  function toggle() {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem('sidebarCollapsed', String(next)) } catch {}
  }

  const tabs = SECTION_TABS[section] || []

  return (
    <div className={`sidebar${collapsed ? ' sidebar-collapsed' : ''}`}>
      {/* Brand */}
      <div className="sidebar-brand-row">
        <Link className="sidebar-brand" to="/" style={{ textDecoration: 'none' }}>
          {collapsed ? 'FC' : 'Fat Closet'}
        </Link>
        <button className="sidebar-toggle" onClick={toggle} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? '▶' : '◀'}
        </button>
      </div>

      {!collapsed && <div className="sidebar-sub">{section}</div>}

      {/* Section tabs */}
      {tabs.length > 0 && (
        <>
          {!collapsed && <span className="nav-section">{section}</span>}
          {collapsed && <div className="nav-divider" />}
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`nav-item${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => onTabChange && onTabChange(tab.id)}
              title={collapsed ? tab.label : undefined}
            >
              <span className="nav-icon">{tab.icon}</span>
              {!collapsed && <span className="nav-label">{tab.label}</span>}
            </button>
          ))}
        </>
      )}

      {/* All navigation */}
      <>
        {!collapsed && <span className="nav-section">Navigate</span>}
        {collapsed && <div className="nav-divider" />}
        {ALL_NAV.map(link => {
          const isActive = link.href === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(link.href)
          return (
            <Link
              key={link.href}
              className={`nav-item${isActive ? ' active' : ''}`}
              to={link.href}
              title={collapsed ? link.label : undefined}
            >
              <span className="nav-icon">{link.icon}</span>
              {!collapsed && <span className="nav-label">{link.label}</span>}
            </Link>
          )
        })}
      </>
    </div>
  )
}
