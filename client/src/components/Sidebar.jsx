import { Link } from 'react-router-dom'

export default function Sidebar({ section, activeTab, onTabChange }) {
  return (
    <div className="sidebar">
      <Link className="sidebar-brand" to="/">Store CRM</Link>
      <div className="sidebar-sub">{section}</div>

      {section === 'Customers' && (
        <>
          <span className="nav-section">Customers</span>
          <button className={`nav-item ${activeTab === 'add' ? 'active' : ''}`} onClick={() => onTabChange('add')}>
            ➕ Add Customer
          </button>
          <button className={`nav-item ${activeTab === 'view' ? 'active' : ''}`} onClick={() => onTabChange('view')}>
            👥 View Customers
          </button>
          <span className="nav-section">Navigation</span>
          <Link className="nav-item" to="/inventory">🏷️ Inventory</Link>
        </>
      )}

      {section === 'Inventory' && (
        <>
          <span className="nav-section">Inventory</span>
          <button className={`nav-item ${activeTab === 'add' ? 'active' : ''}`} onClick={() => onTabChange('add')}>
            ➕ Add Item
          </button>
          <button className={`nav-item ${activeTab === 'view' ? 'active' : ''}`} onClick={() => onTabChange('view')}>
            📦 View Stock
          </button>
          <button className={`nav-item ${activeTab === 'cats' ? 'active' : ''}`} onClick={() => onTabChange('cats')}>
            🗂️ Categories
          </button>
          <span className="nav-section">Navigation</span>
          <Link className="nav-item" to="/customers">👤 Customers</Link>
        </>
      )}

      {section === 'Sales' && (
        <>
          <span className="nav-section">Sales</span>
          <span className="nav-item active">🧾 New Order</span>
          <span className="nav-section">Navigation</span>
          <Link className="nav-item" to="/customers">👤 Customers</Link>
          <Link className="nav-item" to="/inventory">🏷️ Inventory</Link>
        </>
      )}

      <div className="sidebar-footer">
        <Link className="back-link" to="/">← Home</Link>
      </div>
    </div>
  )
}
