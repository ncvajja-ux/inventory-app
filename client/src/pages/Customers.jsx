import { useState, useEffect, useCallback } from 'react'
import Sidebar from '../components/Sidebar'
import { useToast } from '../components/Toast'

function EditModal({ customer, onClose, onSaved }) {
  const showToast = useToast()
  const [form, setForm] = useState({
    name: customer.name || '',
    number: customer.number || '',
    email: customer.email || '',
    address: customer.address || '',
    gstin: customer.gstin || '',
  })

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function save() {
    if (!form.name.trim()) return showToast('Name is required', 'error')
    try {
      const res = await fetch(`/customers/${customer.kunnr}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Update failed')
      showToast(`✅ ${form.name} updated!`)
      onSaved()
      onClose()
    } catch (err) {
      showToast(`❌ ${err.message}`, 'error')
    }
  }

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">Edit Customer</div>
        <div className="modal-sub">Editing KUNNR: {customer.kunnr}</div>
        <div className="modal-grid">
          <div className="form-group">
            <label>Full Name</label>
            <input value={form.name} onChange={set('name')} placeholder="Customer name" />
          </div>
          <div className="form-group">
            <label>Phone Number</label>
            <input value={form.number} onChange={set('number')} placeholder="+91 98765 43210" />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input value={form.email} onChange={set('email')} placeholder="customer@email.com" type="email" />
          </div>
          <div className="form-group">
            <label>GSTIN</label>
            <input value={form.gstin} onChange={set('gstin')} placeholder="GST number" />
          </div>
          <div className="form-group full">
            <label>Address</label>
            <input value={form.address} onChange={set('address')} placeholder="Street, City, State" />
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>Save Changes</button>
        </div>
      </div>
    </div>
  )
}

function AddTab({ onAdded }) {
  const showToast = useToast()
  const [nextKunnr, setNextKunnr] = useState('—')
  const [form, setForm] = useState({ name: '', number: '', email: '', address: '', gstin: '' })

  const loadNextKunnr = useCallback(async () => {
    try {
      const res = await fetch('/next-kunnr')
      const data = await res.json()
      setNextKunnr(data.kunnr || '—')
    } catch {
      setNextKunnr('Auto')
    }
  }, [])

  useEffect(() => { loadNextKunnr() }, [loadNextKunnr])

  function set(field) { return e => setForm(f => ({ ...f, [field]: e.target.value })) }

  function reset() {
    setForm({ name: '', number: '', email: '', address: '', gstin: '' })
    loadNextKunnr()
  }

  async function addCustomer() {
    if (!form.name.trim()) return showToast('Name is required', 'error')
    try {
      const res = await fetch('/addcustomer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add customer')
      showToast(`✅ ${form.name} added! KUNNR: ${data.kunnr}`)
      reset()
      onAdded()
    } catch (err) {
      showToast(`❌ ${err.message}`, 'error')
    }
  }

  return (
    <>
      <h1 className="page-title">Add Customer</h1>
      <p className="page-sub">Fill in the details — a KUNNR will be assigned automatically.</p>
      <div className="card">
        <div style={{ marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
          <label>Auto-Assigned KUNNR</label>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="id-badge">{nextKunnr}</div>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Assigned automatically on save</span>
          </div>
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label>Full Name</label>
            <input value={form.name} onChange={set('name')} placeholder="Customer name" />
          </div>
          <div className="form-group">
            <label>Phone Number</label>
            <input value={form.number} onChange={set('number')} placeholder="+91 98765 43210" type="tel" />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input value={form.email} onChange={set('email')} placeholder="customer@email.com" type="email" />
          </div>
          <div className="form-group">
            <label>GSTIN</label>
            <input value={form.gstin} onChange={set('gstin')} placeholder="GST number (optional)" />
          </div>
          <div className="form-group full">
            <label>Address</label>
            <input value={form.address} onChange={set('address')} placeholder="Street, City, State" />
          </div>
        </div>
        <div className="btn-row">
          <button className="btn btn-primary" onClick={addCustomer}>Add Customer</button>
          <button className="btn btn-ghost" onClick={reset}>Clear</button>
        </div>
      </div>
    </>
  )
}

function ViewTab() {
  const showToast = useToast()
  const [allData, setAllData] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [editingCustomer, setEditingCustomer] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/customers')
      if (!res.ok) throw new Error()
      setAllData(await res.json())
    } catch {
      showToast('❌ Could not connect to server.', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { loadData() }, [loadData])

  async function deleteCustomer(kunnr, name) {
    if (!confirm(`Delete "${name}" (${kunnr})?\nThis cannot be undone.`)) return
    try {
      const res = await fetch(`/customers/${kunnr}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      showToast(`🗑️ ${name} deleted`)
      loadData()
    } catch (err) {
      showToast(`❌ ${err.message}`, 'error')
    }
  }

  const filtered = query
    ? allData.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(query.toLowerCase())))
    : allData

  return (
    <>
      <h1 className="page-title">All Customers</h1>
      <p className="page-sub">Live customer records from the database.</p>

      <div className="toolbar">
        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input placeholder="Search by name, KUNNR, email…" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <button className="btn btn-ghost" onClick={loadData}>↺ Refresh</button>
      </div>

      <div className="stats">
        <div className="stat-pill">Total Customers <strong>{allData.length}</strong></div>
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>KUNNR</th><th>Name</th><th>Phone</th><th>Email</th><th>Address</th><th>GSTIN</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="state-row"><td colSpan={7}><span className="spinner" /> Loading customers…</td></tr>
            ) : filtered.length === 0 ? (
              <tr className="state-row"><td colSpan={7}>No customers found.</td></tr>
            ) : filtered.map(row => (
              <tr key={row.kunnr}>
                <td><span className="mono">{row.kunnr || '—'}</span></td>
                <td><strong>{row.name || '—'}</strong></td>
                <td>{row.number || '—'}</td>
                <td>{row.email || '—'}</td>
                <td>{row.address || '—'}</td>
                <td>{row.gstin || '—'}</td>
                <td>
                  <div className="actions">
                    <button className="action-btn btn-edit" onClick={() => setEditingCustomer(row)}>Edit</button>
                    <button className="action-btn btn-delete" onClick={() => deleteCustomer(row.kunnr, row.name)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingCustomer && (
        <EditModal
          customer={editingCustomer}
          onClose={() => setEditingCustomer(null)}
          onSaved={loadData}
        />
      )}
    </>
  )
}

export default function Customers() {
  const [tab, setTab] = useState('add')
  const [refreshKey, setRefreshKey] = useState(0)

  function goToView() {
    setTab('view')
    setRefreshKey(k => k + 1)
  }

  return (
    <div className="page-layout">
      <Sidebar section="Customers" activeTab={tab} onTabChange={setTab} />
      <div className="main">
        <div className="tabs">
          <button className={`tab ${tab === 'add' ? 'active' : ''}`} onClick={() => setTab('add')}>➕ Add Customer</button>
          <button className={`tab ${tab === 'view' ? 'active' : ''}`} onClick={() => setTab('view')}>👥 View Customers</button>
        </div>
        {tab === 'add' && <AddTab onAdded={goToView} />}
        {tab === 'view' && <ViewTab key={refreshKey} />}
      </div>
    </div>
  )
}
