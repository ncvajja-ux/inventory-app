import { Link } from 'react-router-dom'

const SECTION_CONFIG = {
  Customers: {
    tabs: [
      { id: 'add',    icon: '➕', label: 'Add Customer' },
      { id: 'view',   icon: '👥', label: 'View Customers' },
      { id: 'upload', icon: '📥', label: 'Mass Upload' },
    ],
    navLinks: [{ href: '/inventory', icon: '🏷️', label: 'Inventory' }],
  },
  Inventory: {
    tabs: [
      { id: 'add',    icon: '🆕', label: 'New Product' },
      { id: 'view',   icon: '📦', label: 'View Stock' },
      { id: 'cats',   icon: '🗂️', label: 'Config' },
      { id: 'upload', icon: '📥', label: 'Mass Upload' },
    ],
    navLinks: [
      { href: '/customers', icon: '👤', label: 'Customers' },
      { href: '/sales',     icon: '🧾', label: 'Sales' },
    ],
  },
  Sales: {
    tabs: [
      { id: 'new',     icon: '🧾', label: 'New Order' },
      { id: 'orders',  icon: '📋', label: 'All Orders' },
      { id: 'returns', icon: '↩️', label: 'Returns' },
      { id: 'pricing', icon: '💰', label: 'Sales Pricing' },
    ],
    navLinks: [
      { href: '/customers', icon: '👤', label: 'Customers' },
      { href: '/inventory', icon: '🏷️', label: 'Inventory' },
    ],
  },
  Buyers: {
    tabs: [
      { id: 'add',  icon: '➕', label: 'Add Buyer' },
      { id: 'view', icon: '🏢', label: 'View Buyers' },
    ],
    navLinks: [
      { href: '/purchase-orders', icon: '📦', label: 'Purchase Orders' },
      { href: '/customers',       icon: '👤', label: 'Customers' },
      { href: '/inventory',       icon: '🏷️', label: 'Inventory' },
    ],
  },
  PurchaseOrders: {
    tabs: [
      { id: 'new', icon: '➕', label: 'New PO' },
      { id: 'all', icon: '📋', label: 'All POs' },
    ],
    navLinks: [
      { href: '/buyers',    icon: '🏢', label: 'Buyers' },
      { href: '/inventory', icon: '🏷️', label: 'Inventory' },
      { href: '/sales',     icon: '🧾', label: 'Sales' },
    ],
  },
  Analytics: {
    tabs: [],
    navLinks: [
      { href: '/customers', icon: '👤', label: 'Customers' },
      { href: '/inventory', icon: '🏷️', label: 'Inventory' },
      { href: '/sales',     icon: '🧾', label: 'Sales' },
    ],
  },
}

export default function Sidebar({ section, activeTab, onTabChange }) {
  const cfg = SECTION_CONFIG[section] || { tabs: [], navLinks: [] }

  return (
    <div className="sidebar">
      <Link className="sidebar-brand" to="/" style={{ textDecoration: 'none' }}>
        Fat Closet
      </Link>
      <div className="sidebar-sub">{section}</div>

      {cfg.tabs.length > 0 && (
        <>
          <span className="nav-section">{section}</span>
          {cfg.tabs.map(tab => (
            <button
              key={tab.id}
              className={`nav-item${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => onTabChange && onTabChange(tab.id)}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </>
      )}

      {cfg.navLinks.length > 0 && (
        <>
          <span className="nav-section">Navigation</span>
          {cfg.navLinks.map(link => (
            <Link key={link.href} className="nav-item" to={link.href}>
              {link.icon} {link.label}
            </Link>
          ))}
        </>
      )}

      <div className="sidebar-footer">
        <Link className="back-link" to="/">← Home</Link>
      </div>
    </div>
  )
}
