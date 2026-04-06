import { useState, useEffect, useCallback } from 'react'
import Sidebar from '../components/Sidebar'
import { useToast } from '../components/Toast'

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free Size']
const GENDERS = ['Male', 'Female', 'Unisex']

function useCategories() {
  const [cats, setCats] = useState({})
  const load = useCallback(async () => {
    try {
      const res = await fetch('/categories')
      setCats(await res.json())
    } catch {}
  }, [])
  useEffect(() => { load() }, [load])
  return [cats, load]
}

function EditModal({ item, onClose, onSaved }) {
  const showToast = useToast()
  const [cats] = useCategories()
  const [form, setForm] = useState({
    brand: item.brand || '', brandfamily: item.brandfamily || '',
    size: item.size || '', quantity: item.quantity ?? '', price: item.price ?? '',
    gender: item.gender || '', category: item.category || '', subcategory: item.subcategory || '',
    param1: item.param1 || '', param2: item.param2 || '',
  })

  function set(field) { return e => setForm(f => ({ ...f, [field]: e.target.value })) }

  const subs = form.category && cats[form.category] ? cats[form.category] : []

  async function save() {
    try {
      const res = await fetch(`/inventory/${item.matnr}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, quantity: parseInt(form.quantity) || 0, price: parseFloat(form.price) || 0 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Update failed')
      showToast(`✅ ${item.matnr} updated!`)
      onSaved()
      onClose()
    } catch (err) {
      showToast(`❌ ${err.message}`, 'error')
    }
  }

  return (
    <div className="modal-overlay open" style={{ width: 580 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 580 }}>
        <div className="modal-title">Edit Inventory Item</div>
        <div className="modal-sub">Editing MATNR: {item.matnr}</div>
        <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="id-badge">{item.matnr}</div>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>MATNR cannot be changed</span>
        </div>
        <div className="modal-grid">
          <div className="form-group"><label>Brand</label><input value={form.brand} onChange={set('brand')} placeholder="e.g. Levi's" /></div>
          <div className="form-group"><label>Brand Family</label><input value={form.brandfamily} onChange={set('brandfamily')} placeholder="e.g. Jeans" /></div>
          <div className="form-group">
            <label>Size</label>
            <select value={form.size} onChange={set('size')}>
              <option value="">Select size…</option>
              {SIZES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Quantity</label><input value={form.quantity} onChange={set('quantity')} type="number" min="0" placeholder="0" /></div>
          <div className="form-group"><label>Price (₹)</label><input value={form.price} onChange={set('price')} type="number" min="0" step="0.01" placeholder="0.00" /></div>
          <div className="form-group">
            <label>Gender</label>
            <select value={form.gender} onChange={set('gender')}>
              <option value="">Select…</option>
              {GENDERS.map(g => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Category</label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value, subcategory: '' }))}>
              <option value="">Select…</option>
              {Object.keys(cats).map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Sub-Category</label>
            <select value={form.subcategory} onChange={set('subcategory')}>
              <option value="">{form.category ? 'Select…' : 'Select category first…'}</option>
              {subs.map(s => <option key={s.id}>{s.subcategory}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Param 1</label><input value={form.param1} onChange={set('param1')} placeholder="e.g. Color" /></div>
          <div className="form-group"><label>Param 2</label><input value={form.param2} onChange={set('param2')} placeholder="e.g. Material" /></div>
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
  const [cats] = useCategories()
  const [nextMatnr, setNextMatnr] = useState('—')
  const [form, setForm] = useState({
    brand: '', brandfamily: '', size: '', quantity: '', price: '',
    gender: '', category: '', subcategory: '', param1: '', param2: '',
  })

  const loadNextMatnr = useCallback(async () => {
    try {
      const res = await fetch('/next-matnr')
      const data = await res.json()
      setNextMatnr(data.matnr || '—')
    } catch { setNextMatnr('Auto') }
  }, [])

  useEffect(() => { loadNextMatnr() }, [loadNextMatnr])

  function set(field) { return e => setForm(f => ({ ...f, [field]: e.target.value })) }

  function reset() {
    setForm({ brand: '', brandfamily: '', size: '', quantity: '', price: '', gender: '', category: '', subcategory: '', param1: '', param2: '' })
    loadNextMatnr()
  }

  async function saveItem() {
    if (!form.brand.trim()) return showToast('Brand is required', 'error')
    try {
      const res = await fetch('/addinventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, quantity: parseInt(form.quantity) || 0, price: parseFloat(form.price) || 0 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add item')
      showToast(`✅ Item added! MATNR: ${data.matnr}`)
      reset()
      onAdded()
    } catch (err) {
      showToast(`❌ ${err.message}`, 'error')
    }
  }

  const subs = form.category && cats[form.category] ? cats[form.category] : []

  return (
    <>
      <h1 className="page-title">Add Inventory Item</h1>
      <p className="page-sub">Fill in the details — a MATNR will be assigned automatically.</p>
      <div className="card">
        <div style={{ marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
          <label>Auto-Assigned MATNR</label>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="id-badge">{nextMatnr}</div>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Assigned automatically on save</span>
          </div>
        </div>
        <div className="form-grid">
          <div className="form-group"><label>Brand</label><input value={form.brand} onChange={set('brand')} placeholder="e.g. Levi's" /></div>
          <div className="form-group"><label>Brand Family</label><input value={form.brandfamily} onChange={set('brandfamily')} placeholder="e.g. Jeans, T-Shirts" /></div>
          <div className="form-group">
            <label>Size</label>
            <select value={form.size} onChange={set('size')}>
              <option value="">Select size…</option>
              {SIZES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Quantity</label><input value={form.quantity} onChange={set('quantity')} type="number" min="0" placeholder="0" /></div>
          <div className="form-group"><label>Price (₹)</label><input value={form.price} onChange={set('price')} type="number" min="0" step="0.01" placeholder="0.00" /></div>
          <div className="form-group">
            <label>Gender</label>
            <select value={form.gender} onChange={set('gender')}>
              <option value="">Select…</option>
              {GENDERS.map(g => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Category</label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value, subcategory: '' }))}>
              <option value="">Select…</option>
              {Object.keys(cats).map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Sub-Category</label>
            <select value={form.subcategory} onChange={set('subcategory')}>
              <option value="">{form.category ? 'Select…' : 'Select category first…'}</option>
              {subs.map(s => <option key={s.id}>{s.subcategory}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Param 1 <span style={{ fontWeight: 300, textTransform: 'none', fontSize: 11 }}>(optional)</span></label>
            <input value={form.param1} onChange={set('param1')} placeholder="e.g. Color" />
          </div>
          <div className="form-group">
            <label>Param 2 <span style={{ fontWeight: 300, textTransform: 'none', fontSize: 11 }}>(optional)</span></label>
            <input value={form.param2} onChange={set('param2')} placeholder="e.g. Material" />
          </div>
        </div>
        <div className="btn-row">
          <button className="btn btn-primary" onClick={saveItem}>💾 Save Item</button>
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
  const [editingItem, setEditingItem] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/inventory')
      setAllData(await res.json())
    } catch {
      showToast('❌ Could not connect to server.', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { loadData() }, [loadData])

  async function deleteItem(matnr) {
    if (!confirm(`Delete item ${matnr}? This cannot be undone.`)) return
    try {
      const res = await fetch(`/inventory/${matnr}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      showToast(`🗑️ ${matnr} deleted`)
      loadData()
    } catch (err) {
      showToast(`❌ ${err.message}`, 'error')
    }
  }

  const totalUnits = allData.reduce((s, r) => s + (parseInt(r.quantity) || 0), 0)
  const filtered = query
    ? allData.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(query.toLowerCase())))
    : allData

  return (
    <>
      <h1 className="page-title">Stock Overview</h1>
      <p className="page-sub">All inventory items from the live database.</p>
      <div className="toolbar">
        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input placeholder="Search inventory…" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <button className="btn btn-ghost" onClick={loadData}>↺ Refresh</button>
      </div>
      <div className="stats">
        <div className="stat-pill">Total Items <strong>{allData.length}</strong></div>
        <div className="stat-pill">Total Units <strong>{totalUnits}</strong></div>
      </div>
      <div className="table-card" style={{ overflowX: 'auto' }}>
        <table style={{ minWidth: 960 }}>
          <thead>
            <tr>
              <th>MATNR</th><th>Brand</th><th>Family</th><th>Size</th><th>Gender</th>
              <th>Category</th><th>Sub-Category</th><th>Qty</th><th>Price (₹)</th>
              <th>Param 1</th><th>Param 2</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="state-row"><td colSpan={12}><span className="spinner" /> Loading inventory…</td></tr>
            ) : filtered.length === 0 ? (
              <tr className="state-row"><td colSpan={12}>No items found.</td></tr>
            ) : filtered.map(row => {
              const qty = parseInt(row.quantity) || 0
              const qtyClass = qty === 0 ? 'qty-zero' : qty < 5 ? 'qty-low' : 'qty-ok'
              return (
                <tr key={row.matnr}>
                  <td><span className="mono">{row.matnr}</span></td>
                  <td><strong>{row.brand || '—'}</strong></td>
                  <td>{row.brandfamily || '—'}</td>
                  <td>{row.size || '—'}</td>
                  <td>{row.gender || '—'}</td>
                  <td>{row.category || '—'}</td>
                  <td>{row.subcategory || '—'}</td>
                  <td><span className={`qty-badge ${qtyClass}`}>{qty}</span></td>
                  <td>{row.price != null ? '₹' + parseFloat(row.price).toFixed(2) : '—'}</td>
                  <td>{row.param1 || '—'}</td>
                  <td>{row.param2 || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="action-btn btn-edit" onClick={() => setEditingItem(row)}>Edit</button>
                      <button className="action-btn btn-delete" onClick={() => deleteItem(row.matnr)}>Delete</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {editingItem && (
        <EditModal item={editingItem} onClose={() => setEditingItem(null)} onSaved={loadData} />
      )}
    </>
  )
}

function CatsTab() {
  const showToast = useToast()
  const [cats, reloadCats] = useCategories()
  const [newSubCat, setNewSubCat] = useState('')
  const [newSubName, setNewSubName] = useState('')
  const [newCatName, setNewCatName] = useState('')
  const [newCatFirstSub, setNewCatFirstSub] = useState('')

  async function addSubcategory() {
    if (!newSubCat || !newSubName.trim()) return showToast('Select a category and enter sub-category name', 'error')
    try {
      const res = await fetch('/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: newSubCat, subcategory: newSubName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      showToast('✅ Sub-category added!')
      setNewSubName('')
      reloadCats()
    } catch (err) {
      showToast(`❌ ${err.message}`, 'error')
    }
  }

  async function addNewCategory() {
    if (!newCatName.trim() || !newCatFirstSub.trim()) return showToast('Both fields required', 'error')
    try {
      const res = await fetch('/categories/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: newCatName.trim(), subcategory: newCatFirstSub.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      showToast('✅ Category created!')
      setNewCatName(''); setNewCatFirstSub('')
      reloadCats()
    } catch (err) {
      showToast(`❌ ${err.message}`, 'error')
    }
  }

  async function deleteSub(id, name) {
    if (!confirm(`Remove sub-category "${name}"?`)) return
    try {
      await fetch(`/categories/${id}`, { method: 'DELETE' })
      showToast(`🗑️ Removed`)
      reloadCats()
    } catch (err) {
      showToast(`❌ ${err.message}`, 'error')
    }
  }

  return (
    <>
      <h1 className="page-title">Categories</h1>
      <p className="page-sub">Manage product categories and sub-categories used across inventory.</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
        {/* Category tree */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Category Tree</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>Click ✕ to remove a sub-category.</div>
          {Object.keys(cats).length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>No categories yet.</div>
          ) : Object.entries(cats).map(([cat, subs]) => (
            <div key={cat} style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>📁 {cat}</div>
              <div style={{ paddingLeft: 16 }}>
                {subs.map(s => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: 13 }}>
                    <span>└ {s.subcategory}</span>
                    <button onClick={() => deleteSub(s.id, s.subcategory)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 13 }}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Add forms */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>➕ Add Sub-Category</div>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label>Category</label>
              <select value={newSubCat} onChange={e => setNewSubCat(e.target.value)}>
                <option value="">Select category…</option>
                {Object.keys(cats).map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>Sub-Category Name</label>
              <input value={newSubName} onChange={e => setNewSubName(e.target.value)} placeholder="e.g. Polo Shirts" />
            </div>
            <button className="btn btn-primary" onClick={addSubcategory}>Add Sub-Category</button>
          </div>

          <div className="card" style={{ padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>🆕 Add New Category</div>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label>Category Name</label>
              <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="e.g. Sportswear" />
            </div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>First Sub-Category</label>
              <input value={newCatFirstSub} onChange={e => setNewCatFirstSub(e.target.value)} placeholder="e.g. Jersey" />
            </div>
            <button className="btn btn-primary" onClick={addNewCategory}>Create Category</button>
          </div>
        </div>
      </div>
    </>
  )
}

export default function Inventory() {
  const [tab, setTab] = useState('add')
  const [refreshKey, setRefreshKey] = useState(0)

  function goToView() {
    setTab('view')
    setRefreshKey(k => k + 1)
  }

  return (
    <div className="page-layout">
      <Sidebar section="Inventory" activeTab={tab} onTabChange={setTab} />
      <div className="main" style={{ padding: '32px 28px' }}>
        <div className="tabs">
          <button className={`tab ${tab === 'add' ? 'active' : ''}`} onClick={() => setTab('add')}>➕ Add Item</button>
          <button className={`tab ${tab === 'view' ? 'active' : ''}`} onClick={() => setTab('view')}>📦 View Stock</button>
          <button className={`tab ${tab === 'cats' ? 'active' : ''}`} onClick={() => setTab('cats')}>🗂️ Categories</button>
        </div>
        {tab === 'add'  && <AddTab key={refreshKey} onAdded={goToView} />}
        {tab === 'view' && <ViewTab key={refreshKey} />}
        {tab === 'cats' && <CatsTab />}
      </div>
    </div>
  )
}
