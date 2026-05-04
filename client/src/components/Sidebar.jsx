// client/src/components/Sidebar.jsx
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTheme } from './ThemeContext'
import { useRole } from './RoleContext'
import { supabase } from '../lib/supabase'

const ALL_NAV = [
  { href: '/',                icon: '🏠', label: 'Home' },
  { href: '/customers',       icon: '👤', label: 'Customers' },
  { href: '/inventory',       icon: '🏷️', label: 'Inventory' },
  { href: '/sales',           icon: '🧾', label: 'Sales' },
  { href: '/buyers',          icon: '🏢', label: 'Buyers' },
  { href: '/purchase-orders', icon: '📦', label: 'Purchase Orders' },
  { href: '/analytics',       icon: '📊', label: 'Analytics' },
  { href: '/hr',              icon: '👷', label: 'HR' },
  { href: '/config',          icon: '⚙️', label: 'Config' },
]

const ALLOWED = {
  admin: null,
  sales: new Set(['/', '/customers', '/sales', '/invoice', '/inventory', '/analytics']),
}

export default function Sidebar() {
  const location = useLocation()
  const { theme, toggleTheme } = useTheme()
  const role = useRole()

  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebarCollapsed') === 'true' } catch { return false }
  })

  function toggle() {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem('sidebarCollapsed', String(next)) } catch {}
  }

  function canSee(path) {
    if (role === 'admin' || !ALLOWED[role]) return true
    return ALLOWED[role].has(path)
  }

  return (
    <div className={`sidebar${collapsed ? ' sidebar-collapsed' : ''}`}>
      {/* Brand */}
      <div className="sidebar-brand-row">
        <Link className="sidebar-brand" to="/" style={{ textDecoration: 'none' }}>
          {collapsed ? 'FC' : 'Fat Closet'}
        </Link>
        <button
          className="sidebar-toggle"
          onClick={toggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '▶' : '◀'}
        </button>
      </div>

      {/* Navigation */}
      <>
        {!collapsed && <span className="nav-section">Navigate</span>}
        {collapsed && <div className="nav-divider" />}
        {ALL_NAV.filter(link => canSee(link.href)).map(link => {
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

      {/* Theme toggle + Sign out */}
      <div className="sidebar-footer">
        <button
          className="nav-item"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          <span className="nav-icon">{theme === 'dark' ? '☀️' : '🌙'}</span>
          {!collapsed && <span className="nav-label">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>
        <button
          className="nav-item"
          onClick={() => supabase.auth.signOut()}
          title="Sign out"
          style={{ color: 'var(--danger)' }}
        >
          <span className="nav-icon">🚪</span>
          {!collapsed && <span className="nav-label">Sign Out</span>}
        </button>
      </div>
    </div>
  )
}
