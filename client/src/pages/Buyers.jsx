import { useState, useEffect, useCallback } from 'react'
import Sidebar from '../components/Sidebar'
import { useToast } from '../components/Toast'
import { INDIAN_STATES, INDIAN_CITIES, COUNTRIES, PAYMENT_TERMS } from '../data/referenceData'
import { db } from '../lib/supabase'

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
  const [formKey, setFormKey] = useState(0)

  const loadNextId = useCallback(async () => {
    const { data, error } = await db.buyers().from('buyers').select('buyer_id').order('buyer_id', { ascending: false }).limit(1)
    if (error) { setNextId('Auto'); return }
    const maxNum = data && data.length > 0 ? parseInt(data[0].buyer_id, 10) || 0 : 0
    setNextId(String(maxNum + 1).padStart(6, '0'))
  }, [])

  useEffect(() => { loadNextId() }, [loadNextId])

  async function submit(form) {
    if (!form.company_name.trim()) return showToast('Company name is required', 'error')
    try {
      const { company_name, ...rest } = form
      const { data, error } = await db.buyers().from('buyers').insert({ ...rest, buyer_id: nextId, name: company_name })
      if (error) throw new Error(error.message || 'Failed to add buyer')
      showToast(`✅ ${form.company_name} added!`)
      loadNextId()
      setFormKey(k => k + 1)
      onAdded()
    } catch (err) {
      showToast(`❌ ${err.message}`, 'error')
    }
  }

  function handleClear() {
    setFormKey(k => k + 1)
    loadNextId()
  }

  return (
    <BuyerForm
      key={formKey}
      title="Add Buyer"
      sub="Register a new vendor or supplier."
      badgeLabel="Auto-Assigned Buyer ID"
      badgeValue={nextId}
      onSubmit={submit}
      onCancel={handleClear}
    />
  )
}

function ViewModal({ buyer, onClose, onEdit }) {
  const row = buyer
  const field = (label, value) => value ? (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.1em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14 }}>{value}</div>
    </div>
  ) : null

  const billingParts = [row.addr1, row.addr2, row.city, row.state, row.zip, row.country].filter(Boolean)

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 600, width: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, marginBottom: 4 }}>
              {row.name || '—'}
            </div>
            <div className="id-badge" style={{ display: 'inline-block' }}>{row.buyer_id}</div>
          </div>
          <button className="btn btn-ghost" style={{ fontSize: 18, lineHeight: 1, padding: '4px 10px' }} onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px', marginBottom: 16 }}>
          {field('Phone', row.phone)}
          {field('Email', row.email)}
          {field('GSTIN', row.gstin)}
          {field('PAN / Tax ID', row.tax_id)}
          {field('Export ID', row.export_id)}
          {field('Payment Terms', row.payment_terms)}
        </div>

        {billingParts.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.1em', marginBottom: 2 }}>BILLING ADDRESS</div>
            <div style={{ fontSize: 14 }}>{billingParts.join(', ')}</div>
          </div>
        )}
        {field('Default Shipping City', row.ship_city)}

        <div className="modal-actions" style={{ marginTop: 24, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={() => { onClose(); onEdit(buyer) }}>Edit Buyer</button>
        </div>
      </div>
    </div>
  )
}

function EditModal({ buyer, onClose, onSaved }) {
  const showToast = useToast()

  async function submit(form) {
    if (!form.company_name.trim()) return showToast('Company name is required', 'error')
    try {
      const { company_name, ...rest } = form
      const { error } = await db.buyers().from('buyers').update({ ...rest, name: company_name }).eq('buyer_id', buyer.buyer_id)
      if (error) throw new Error(error.message || 'Update failed')
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
          initial={{ ...buyer, company_name: buyer.name }}
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
  const [viewingBuyer, setViewingBuyer] = useState(null)
  const [editingBuyer, setEditingBuyer] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await db.buyers().from('buyers').select('*').order('name')
      if (error) throw new Error(error.message)
      setAllData(data || [])
    } catch (err) {
      showToast(`❌ Could not load buyers: ${err.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { loadData() }, [loadData])

  async function updateStatus(id, name, status) {
    try {
      const { error } = await db.buyers().from('buyers').update({ status }).eq('buyer_id', id)
      if (error) throw new Error(error.message)
      showToast(`✅ ${name} status set to ${status}`)
      loadData()
    } catch (err) {
      showToast(`❌ ${err.message}`, 'error')
    }
  }

  async function searchBuyers(q) {
    const { data, error } = await db.buyers().from('buyers').select('*').or(`name.ilike.%${q}%,buyer_id.ilike.%${q}%`).limit(10)
    if (error) return allData.filter(r => Object.values(r).some(v => String(v ?? '').toLowerCase().includes(q.toLowerCase())))
    return data || []
  }

  async function deleteBuyer(buyer_id) {
    const { error } = await db.buyers().from('buyers').delete().eq('buyer_id', buyer_id)
    if (error) { showToast(error.message, 'error'); return }
    showToast('Buyer deleted', 'success')
    loadData()
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

      <div className="table-card" style={{ overflowX: 'auto' }}>
        <table style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th>Buyer ID</th><th>Company Name</th><th>Phone</th><th>Email</th>
              <th>City</th><th>State</th><th>GSTIN</th><th>Payment Terms</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="state-row"><td colSpan={10}><span className="spinner" /> Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr className="state-row"><td colSpan={10}>No buyers found.</td></tr>
            ) : filtered.map(row => (
              <tr key={row.buyer_id} style={{ cursor: 'pointer' }} onClick={() => setViewingBuyer(row)}>
                <td><span className="mono">{row.buyer_id}</span></td>
                <td><strong>{row.name || '—'}</strong></td>
                <td>{row.phone || '—'}</td>
                <td>{row.email || '—'}</td>
                <td>{row.city || '—'}</td>
                <td>{row.state || '—'}</td>
                <td>{row.gstin || '—'}</td>
                <td>{row.payment_terms || '—'}</td>
                <td onClick={e => e.stopPropagation()}>
                  <span className={`badge badge-${row.status === 'Credit Hold' ? 'partial' : row.status === 'Blacklisted' || row.status === 'Duplicate/Deleted' ? 'cancelled' : 'paid'}`}>
                    {row.status || 'Active'}
                  </span>
                </td>
                <td onClick={e => e.stopPropagation()}>
                  <div className="actions">
                    <button className="action-btn btn-edit" onClick={() => setEditingBuyer(row)}>Edit</button>
                    <select
                      className="action-btn"
                      value=""
                      onChange={e => { if (e.target.value) updateStatus(row.buyer_id, row.name, e.target.value) }}
                      style={{ cursor: 'pointer', padding: '4px 6px', fontSize: 12 }}
                    >
                      <option value="">Status ▾</option>
                      <option value="Active">Active</option>
                      <option value="Credit Hold">Credit Hold</option>
                      <option value="Blacklisted">Blacklisted</option>
                      <option value="Duplicate/Deleted">Duplicate/Deleted</option>
                    </select>
                    <button className="action-btn btn-delete" onClick={() => { if (!window.confirm('Delete this buyer?')) return; deleteBuyer(row.buyer_id) }}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {viewingBuyer && (
        <ViewModal
          buyer={viewingBuyer}
          onClose={() => setViewingBuyer(null)}
          onEdit={b => setEditingBuyer(b)}
        />
      )}

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
  const [tab, setTab] = useState('view')
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
