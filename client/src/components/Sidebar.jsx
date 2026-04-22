import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTheme } from './ThemeContext'

const ALL_NAV = [
  { href: '/',                icon: '🏠', label: 'Home' },
  { href: '/customers',       icon: '👤', label: 'Customers' },
  { href: '/groups',          icon: '👥', label: 'Customer Groups' },
  { href: '/inventory',       icon: '🏷️', label: 'Inventory' },
  { href: '/sales',           icon: '🧾', label: 'Sales' },
  { href: '/buyers',          icon: '🏢', label: 'Buyers' },
  { href: '/purchase-orders', icon: '📦', label: 'Purchase Orders' },
  { href: '/analytics',       icon: '📊', label: 'Analytics' },
  { href: '/hr',              icon: '👷', label: 'HR' },
]

const SECTION_TABS = {
  Customers: [
    { id: 'view',   icon: '👥', label: 'View Customers' },
    { id: 'add',    icon: '➕', label: 'Add Customer' },
    { id: 'upload', icon: '📥', label: 'Mass Upload' },
  ],
  Inventory: [
    { id: 'view',   icon: '📦', label: 'View Stock' },
    { id: 'cats',   icon: '🗂️', label: 'Config' },
    { id: 'add',    icon: '🆕', label: 'New Product' },
    { id: 'upload', icon: '📥', label: 'Mass Upload' },
  ],
  Sales: [
    { id: 'orders',  icon: '📋', label: 'All Orders' },
    { id: 'returns', icon: '↩️', label: 'Returns' },
    { id: 'pricing', icon: '💰', label: 'Sales Pricing' },
    { id: 'new',     icon: '🧾', label: 'New Order' },
  ],
  Buyers: [
    { id: 'view', icon: '🏢', label: 'View Buyers' },
    { id: 'add',  icon: '➕', label: 'Add Buyer' },
  ],
  PurchaseOrders: [
    { id: 'all', icon: '📋', label: 'All POs' },
    { id: 'new', icon: '➕', label: 'New PO' },
  ],
  Groups: [
    { id: 'view', icon: '👥', label: 'View Groups' },
    { id: 'new',  icon: '➕', label: 'New Group' },
  ],
  Analytics: [],
  HR: [
    { id: 'view',       icon: '👥', label: 'Employees' },
    { id: 'payroll',    icon: '💸', label: 'Payroll' },
    { id: 'attendance', icon: '🗓️', label: 'Attendance' },
    { id: 'config',     icon: '⚙️', label: 'Config' },
    { id: 'add',        icon: '➕', label: 'Add Employee' },
  ],
}

export default function Sidebar({ section, activeTab, onTabChange }) {
  const location = useLocation()
  const { theme, toggleTheme } = useTheme()
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

      {/* Theme toggle */}
      <div className="sidebar-footer">
        <button
          className="nav-item"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          <span className="nav-icon">{theme === 'dark' ? '☀️' : '🌙'}</span>
          {!collapsed && <span className="nav-label">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>
      </div>
    </div>
  )
}
