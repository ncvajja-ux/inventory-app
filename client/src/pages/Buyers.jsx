import { useState, useEffect, useCallback } from 'react'
import Sidebar from '../components/Sidebar'
import { useToast } from '../components/Toast'
import { INDIAN_STATES, INDIAN_CITIES, COUNTRIES, PAYMENT_TERMS } from '../data/referenceData'

function BuyerForm({ initial = {}, onSubmit, onCancel, title, sub, badgeLabel, badgeValue }) {
  const [form, setForm] = useState({
    company_name: '', phone: '', email: '', gstin: '', tax_id: '', export_id: '',
    payment_terms: '', addr1: '', addr2: '', city: '', state: '', country: 'India',
    zip: '', ship_city: '',
    ...initial,
  })

  function set(field) { return e => setForm(f => ({ ...f, [field]: e.target.value })) }

  return (
    <>
      <h1 className="page-title">{title}</h1>
      <p className="page-sub">{sub}</p>
      <div className="card">
        {badgeLabel && (
          <div style={{ marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
            <label>{badgeLabel}</label>
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="id-badge">{badgeValue}</div>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>Assigned automatically on save</span>
            </div>
          </div>
        )}

        <div className="form-grid">
          <div className="form-group">
            <label>Company Name *</label>
            <input value={form.company_name} onChange={set('company_name')} placeholder="e.g. ABC Textiles Pvt Ltd" />
          </div>
          <div className="form-group">
            <label>Phone</label>
            <input value={form.phone} onChange={set('phone')} placeholder="+91 98765 43210" type="tel" />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input value={form.email} onChange={set('email')} placeholder="contact@supplier.com" type="email" />
          </div>
          <div className="form-group">
            <label>GSTIN</label>
            <input value={form.gstin} onChange={set('gstin')} placeholder="GST number" />
          </div>
          <div className="form-group">
            <label>PAN / Tax ID</label>
            <input value={form.tax_id} onChange={set('tax_id')} placeholder="PAN / Tax ID" />
          </div>
          <div className="form-group">
            <label>Export ID</label>
            <input value={form.export_id} onChange={set('export_id')} placeholder="IEC / Export code" />
          </div>
          <div className="form-group">
            <label>Payment Terms</label>
            <select value={form.payment_terms} onChange={set('payment_terms')}>
              <option value="">Select…</option>
              {PAYMENT_TERMS.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>

          <div className="form-group full" style={{ marginTop: 8, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em' }}>BILLING ADDRESS</label>
          </div>
          <div className="form-group full">
            <label>Address Line 1</label>
            <input value={form.addr1} onChange={set('addr1')} placeholder="Street address" />
          </div>
          <div className="form-group full">
            <label>Address Line 2</label>
            <input value={form.addr2} onChange={set('addr2')} placeholder="Building, floor, landmark" />
          </div>
          <div className="form-group">
            <label>City</label>
            <select value={form.city} onChange={set('city')}>
              <option value="">Select city…</option>
              {INDIAN_CITIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>State</label>
            <select value={form.state} onChange={set('state')}>
              <option value="">Select state…</option>
              {INDIAN_STATES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Country</label>
            <select value={form.country} onChange={set('country')}>
              <option value="">Select country…</option>
              {COUNTRIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>ZIP / Pincode</label>
            <input value={form.zip} onChange={set('zip')} placeholder="500001" />
          </div>

          <div className="form-group full" style={{ marginTop: 8, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em' }}>SHIPPING</label>
          </div>
          <div className="form-group">
            <label>Default Shipping City</label>
            <select value={form.ship_city} onChange={set('ship_city')}>
              <option value="">Select city…</option>
              {INDIAN_CITIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="btn-row">
          <button className="btn btn-primary" onClick={() => onSubmit(form)}>
            {title.startsWith('Edit') ? 'Save Changes' : 'Add Buyer'}
          </button>
          <button className="btn btn-ghost" onClick={onCancel}>
            {title.startsWith('Edit') ? 'Cancel' : 'Clear'}
          </button>
        </div>
      </div>
    </>
  )
}

function AddTab({ onAdded }) {
  const showToast = useToast()
  const [nextId, setNextId] = useState('—')

  const loadNextId = useCallback(async () => {
    try { const r = await fetch('/next-buyer-id'); const d = await r.json(); setNextId(d.buyer_id || '—') } catch { setNextId('Auto') }
  }, [])

  useEffect(() => { loadNextId() }, [loadNextId])

  async function submit(form) {
    if (!form.company_name.trim()) return showToast('Company name is required', 'error')
    try {
      const res = await fetch('/buyers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add buyer')
      showToast(`✅ ${form.company_name} added! ID: ${data.buyer_id}`)
      loadNextId()
      onAdded()
    } catch (err) {
      showToast(`❌ ${err.message}`, 'error')
    }
  }

  return (
    <BuyerForm
      title="Add Buyer"
      sub="Register a new vendor or supplier."
      badgeLabel="Auto-Assigned Buyer ID"
      badgeValue={nextId}
      onSubmit={submit}
      onCancel={() => loadNextId()}
    />
  )
}

function EditModal({ buyer, onClose, onSaved }) {
  const showToast = useToast()

  async function submit(form) {
    if (!form.company_name.trim()) return showToast('Company name is required', 'error')
    try {
      const res = await fetch(`/buyers/${buyer.buyer_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Update failed')
      showToast(`✅ ${form.company_name} updated!`)
      onSaved()
      onClose()
    } catch (err) {
      showToast(`❌ ${err.message}`, 'error')
    }
  }

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 680, width: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, marginBottom: 4 }}>Edit Buyer</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24 }}>Editing: {buyer.buyer_id}</div>
        <BuyerForm
          initial={buyer}
          title="Edit Buyer"
          sub={`Editing Buyer ID: ${buyer.buyer_id}`}
          onSubmit={submit}
          onCancel={onClose}
        />
      </div>
    </div>
  )
}

function ViewTab() {
  const showToast = useToast()
  const [allData, setAllData] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [editingBuyer, setEditingBuyer] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/buyers')
      if (!res.ok) throw new Error()
      setAllData(await res.json())
    } catch { showToast('❌ Could not load buyers', 'error') } finally { setLoading(false) }
  }, [showToast])

  useEffect(() => { loadData() }, [loadData])

  async function deleteBuyer(id, name) {
    if (!confirm(`Delete "${name}" (${id})? This cannot be undone.`)) return
    try {
      const res = await fetch(`/buyers/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      showToast(`🗑️ ${name} deleted`)
      loadData()
    } catch (err) { showToast(`❌ ${err.message}`, 'error') }
  }

  const filtered = query
    ? allData.filter(r => Object.values(r).some(v => String(v ?? '').toLowerCase().includes(query.toLowerCase())))
    : allData

  return (
    <>
      <h1 className="page-title">All Buyers</h1>
      <p className="page-sub">All registered vendors and suppliers.</p>

      <div className="toolbar">
        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input placeholder="Search by name, ID, city…" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <button className="btn btn-ghost" onClick={loadData}>↺ Refresh</button>
      </div>

      <div className="stats">
        <div className="stat-pill">Total Buyers <strong>{allData.length}</strong></div>
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Buyer ID</th><th>Company Name</th><th>Phone</th><th>Email</th>
              <th>City</th><th>State</th><th>GSTIN</th><th>Payment Terms</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="state-row"><td colSpan={9}><span className="spinner" /> Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr className="state-row"><td colSpan={9}>No buyers found.</td></tr>
            ) : filtered.map(row => (
              <tr key={row.buyer_id}>
                <td><span className="mono">{row.buyer_id}</span></td>
                <td><strong>{row.company_name || '—'}</strong></td>
                <td>{row.phone || '—'}</td>
                <td>{row.email || '—'}</td>
                <td>{row.city || '—'}</td>
                <td>{row.state || '—'}</td>
                <td>{row.gstin || '—'}</td>
                <td>{row.payment_terms || '—'}</td>
                <td>
                  <div className="actions">
                    <button className="action-btn btn-edit" onClick={() => setEditingBuyer(row)}>Edit</button>
                    <button className="action-btn btn-delete" onClick={() => deleteBuyer(row.buyer_id, row.company_name)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingBuyer && (
        <EditModal
          buyer={editingBuyer}
          onClose={() => setEditingBuyer(null)}
          onSaved={loadData}
        />
      )}
    </>
  )
}

export default function Buyers() {
  const [tab, setTab] = useState('add')
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="page-layout">
      <Sidebar section="Buyers" activeTab={tab} onTabChange={t => { setTab(t); if (t === 'view') setRefreshKey(k => k + 1) }} />
      <div className="main">
        {tab === 'add' && <AddTab onAdded={() => { setTab('view'); setRefreshKey(k => k + 1) }} />}
        {tab === 'view' && <ViewTab key={refreshKey} />}
      </div>
    </div>
  )
}
