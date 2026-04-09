import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { useToast } from '../components/Toast'

const GENDERS = ['Male', 'Female', 'Unisex']
const fmt = n => '₹' + parseFloat(n || 0).toFixed(2)

// ── Category cascade hook ───────────────────────────────────────────────────
function useCategoryData() {
  const [catData, setCatData] = useState(null) // full L3 data from /category-l3
  const [categories, setCategories] = useState({}) // from /categories

  const loadAll = useCallback(async () => {
    try {
      const [catsRes, l3Res] = await Promise.all([
        fetch('/categories'),
        fetch('/category-l3'),
      ])
      setCategories(await catsRes.json())
      setCatData(await l3Res.json())
    } catch {}
  }, [])

  useEffect(() => { loadAll() }, [loadAll])
  return { catData, categories, reload: loadAll }
}

function useBrands() {
  const [brands, setBrands] = useState([])
  const load = useCallback(async () => {
    try { const r = await fetch('/brands'); setBrands(await r.json()) } catch {}
  }, [])
  useEffect(() => { load() }, [load])
  return [brands, load]
}

function useColors() {
  const [colors, setColors] = useState([])
  const load = useCallback(async () => {
    try { const r = await fetch('/colors'); setColors(await r.json()) } catch {}
  }, [])
  useEffect(() => { load() }, [load])
  return [colors, load]
}

function useFits() {
  const [fits, setFits] = useState([])
  const load = useCallback(async () => {
    try { const r = await fetch('/fits'); setFits(await r.json()) } catch {}
  }, [])
  useEffect(() => { load() }, [load])
  return [fits, load]
}

function useGstConfig() {
  const [gstConfig, setGstConfig] = useState([])
  const load = useCallback(async () => {
    try { const r = await fetch('/gst-config'); setGstConfig(await r.json()) } catch {}
  }, [])
  useEffect(() => { load() }, [load])
  return [gstConfig, load]
}

// ── Cascade selects helpers ──────────────────────────────────────────────────
function getSubcategories(categories, category) {
  if (!category || !categories[category]) return []
  return categories[category]
}

function getL3Options(catData, category, subcategory) {
  if (!catData || !category || !subcategory) return []
  return catData.filter(r => r.category === category && r.subcategory === subcategory)
}

function getSizes(catData, category, subcategory, subsubcategory) {
  if (!catData || !subsubcategory) return []
  const row = catData.find(r =>
    r.category === category && r.subcategory === subcategory && r.subsubcategory === subsubcategory
  )
  if (!row || !row.sizes) return []
  return row.sizes.split(',').map(s => s.trim()).filter(Boolean)
}

// ── Add Tab ──────────────────────────────────────────────────────────────────
function AddTab({ onAdded }) {
  const showToast = useToast()
  const [nextMatnr, setNextMatnr] = useState('—')
  const { catData, categories, reload: reloadCats } = useCategoryData()
  const [brands] = useBrands()
  const [colors] = useColors()
  const [fits] = useFits()
  const [gstConfig] = useGstConfig()
  const [showPricingPrompt, setShowPricingPrompt] = useState(false)
  const [lastMatnr, setLastMatnr] = useState(null)

  const [form, setForm] = useState({
    brand: '', brandfamily: '', gender: '',
    category: '', subcategory: '', subsubcategory: '', size: '',
    fit: '', color: '', tax_category: '',
  })

  const loadNextMatnr = useCallback(async () => {
    try {
      const r = await fetch('/next-matnr')
      const d = await r.json()
      setNextMatnr(d.matnr || '—')
    } catch { setNextMatnr('Auto') }
  }, [])

  useEffect(() => { loadNextMatnr() }, [loadNextMatnr])

  function set(field) { return e => setForm(f => ({ ...f, [field]: e.target.value })) }

  function setAndCascade(field) {
    return e => {
      const val = e.target.value
      setForm(f => {
        const next = { ...f, [field]: val }
        if (field === 'category') { next.subcategory = ''; next.subsubcategory = ''; next.size = '' }
        if (field === 'subcategory') { next.subsubcategory = ''; next.size = '' }
        if (field === 'subsubcategory') { next.size = '' }
        return next
      })
    }
  }

  async function save() {
    if (!form.brand) return showToast('Brand is required', 'error')
    if (!form.category) return showToast('Category is required', 'error')
    try {
      const res = await fetch('/addinventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add item')
      setLastMatnr(data.matnr)
      showToast(`✅ ${form.brand} added! MATNR: ${data.matnr}`)
      setShowPricingPrompt(true)
      reset()
      onAdded()
    } catch (err) {
      showToast(`❌ ${err.message}`, 'error')
    }
  }

  function reset() {
    setForm({ brand: '', brandfamily: '', gender: '', category: '', subcategory: '', subsubcategory: '', size: '', fit: '', color: '', tax_category: '' })
    loadNextMatnr()
  }

  const subcats = getSubcategories(categories, form.category)
  const l3options = getL3Options(catData, form.category, form.subcategory)
  const sizes = getSizes(catData, form.category, form.subcategory, form.subsubcategory)

  return (
    <>
      <h1 className="page-title">New Product</h1>
      <p className="page-sub">Add a new product to inventory. Pricing and stock are managed separately via Purchase Orders.</p>

      {showPricingPrompt && (
        <div style={{
          background: 'var(--accent2)', border: '1px solid #e8d0a0', borderRadius: 12,
          padding: '16px 20px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <strong>Product saved!</strong> Would you like to set the sales price for <span className="mono">{lastMatnr}</span>?
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={() => setShowPricingPrompt(false)}>
              Go to Pricing →
            </button>
            <button className="btn btn-ghost" onClick={() => setShowPricingPrompt(false)}>Later</button>
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
          <label>Auto-Assigned MATNR</label>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="id-badge">{nextMatnr}</div>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Assigned automatically on save</span>
          </div>
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label>Brand *</label>
            <select value={form.brand} onChange={set('brand')}>
              <option value="">Select brand…</option>
              {brands.map(b => <option key={b.name || b} value={b.name || b}>{b.name || b}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Brand Family / Line</label>
            <input value={form.brandfamily} onChange={set('brandfamily')} placeholder="e.g. RedLoop, Air Max" />
          </div>
          <div className="form-group">
            <label>Gender</label>
            <select value={form.gender} onChange={set('gender')}>
              <option value="">Select…</option>
              {GENDERS.map(g => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Category *</label>
            <select value={form.category} onChange={setAndCascade('category')}>
              <option value="">Select…</option>
              {Object.keys(categories).map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Sub-Category</label>
            <select value={form.subcategory} onChange={setAndCascade('subcategory')} disabled={!form.category}>
              <option value="">Select category first…</option>
              {subcats.map(s => <option key={s.id} value={s.subcategory}>{s.subcategory}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Sub-Sub-Category</label>
            <select value={form.subsubcategory} onChange={setAndCascade('subsubcategory')} disabled={!form.subcategory}>
              <option value="">Select sub-category first…</option>
              {l3options.map(r => <option key={r.subsubcategory}>{r.subsubcategory}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Size</label>
            <select value={form.size} onChange={set('size')} disabled={!form.subsubcategory}>
              <option value="">Select sub-sub-category first…</option>
              {sizes.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Fit</label>
            <select value={form.fit} onChange={set('fit')}>
              <option value="">Select fit…</option>
              {fits.map(f => <option key={f.name || f} value={f.name || f}>{f.name || f}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Color</label>
            <select value={form.color} onChange={set('color')}>
              <option value="">Select color…</option>
              {colors.map(c => <option key={c.name || c} value={c.name || c}>{c.name || c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Tax Category</label>
            <select value={form.tax_category} onChange={set('tax_category')}>
              <option value="">Select tax category…</option>
              {gstConfig.map(g => <option key={g.id || g.tax_category} value={g.tax_category}>{g.tax_category} ({g.gst_rate}%)</option>)}
            </select>
          </div>
        </div>

        <div className="btn-row">
          <button className="btn btn-primary" onClick={save}>💾 Save Item</button>
          <button className="btn btn-ghost" onClick={reset}>Clear</button>
        </div>
      </div>
    </>
  )
}

// ── View Tab ─────────────────────────────────────────────────────────────────
function ViewTab({ editMatnr }) {
  const showToast = useToast()
  const [allData, setAllData] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [editingItem, setEditingItem] = useState(null)
  const { catData, categories } = useCategoryData()
  const [brands] = useBrands()
  const [colors] = useColors()
  const [fits] = useFits()
  const [gstConfig] = useGstConfig()

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/inventory')
      if (!res.ok) throw new Error()
      setAllData(await res.json())
    } catch {
      showToast('❌ Could not load inventory', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { loadData() }, [loadData])

  // Auto-open edit modal when arriving from ItemDetail via ?edit=MATNR
  useEffect(() => {
    if (!editMatnr || loading || allData.length === 0) return
    const item = allData.find(r => r.matnr === editMatnr)
    if (item) setEditingItem(item)
  }, [editMatnr, loading, allData])

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

  function downloadCSV() {
    if (!allData.length) return
    const headers = ['MATNR', 'Brand', 'BrandFamily', 'Category', 'SubCategory', 'SubSubCategory', 'Size', 'Fit', 'Color', 'Gender', 'TaxCategory', 'InStock', 'Reserved', 'Available', 'CostPrice', 'MRP']
    const rows = allData.map(r => [
      r.matnr, r.brand, r.brandfamily, r.category, r.subcategory, r.subsubcategory,
      r.size, r.fit, r.color, r.gender, r.tax_category,
      r.quantity, r.reserved, (r.quantity || 0) - (r.reserved || 0), r.cost_price, r.mrp,
    ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `inventory_${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const filtered = query
    ? allData.filter(r => Object.values(r).some(v => String(v ?? '').toLowerCase().includes(query.toLowerCase())))
    : allData

  const totalUnits = allData.reduce((s, r) => s + (r.quantity || 0), 0)

  return (
    <>
      <h1 className="page-title">Stock Overview</h1>
      <p className="page-sub">All inventory items from the database.</p>

      <div className="toolbar">
        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input placeholder="Search inventory…" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <button className="btn btn-ghost" onClick={loadData}>↺ Refresh</button>
        <button className="btn btn-ghost" onClick={downloadCSV}>⬇ Download CSV</button>
      </div>

      <div className="stats">
        <div className="stat-pill">Items <strong>{allData.length}</strong></div>
        <div className="stat-pill">Total Units <strong>{totalUnits}</strong></div>
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              {['MATNR', 'Brand', 'Category', 'Sub-Cat', 'L3', 'Size', 'Fit', 'Color', 'Gender', 'In Stock', 'Reserved', 'Available', 'Price', 'Actions'].map(h => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="state-row"><td colSpan={14}><span className="spinner" /> Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr className="state-row"><td colSpan={14}>No items found.</td></tr>
            ) : filtered.map(row => {
              const avail = (row.quantity || 0) - (row.reserved || 0)
              const qClass = row.quantity === 0 ? 'qty-zero' : row.quantity < 5 ? 'qty-low' : 'qty-ok'
              return (
                <tr key={row.matnr}>
                  <td>
                    <Link to={`/inventory/${row.matnr}`} className="mono" style={{ color: '#92650a', textDecoration: 'none', fontWeight: 700 }}>
                      {row.matnr}
                    </Link>
                  </td>
                  <td>{row.brand || '—'}</td>
                  <td>{row.category || '—'}</td>
                  <td>{row.subcategory || '—'}</td>
                  <td>{row.subsubcategory || '—'}</td>
                  <td>{row.size || '—'}</td>
                  <td>{row.fit || '—'}</td>
                  <td>{row.color || '—'}</td>
                  <td>{row.gender || '—'}</td>
                  <td><span className={`qty-badge ${qClass}`}>{row.quantity || 0}</span></td>
                  <td>{row.reserved || 0}</td>
                  <td>{avail < 0 ? 0 : avail}</td>
                  <td>{fmt(row.mrp || row.cost_price)}</td>
                  <td>
                    <div className="actions">
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
        <EditItemModal
          item={editingItem}
          catData={catData}
          categories={categories}
          brands={brands}
          colors={colors}
          fits={fits}
          gstConfig={gstConfig}
          onClose={() => setEditingItem(null)}
          onSaved={loadData}
        />
      )}
    </>
  )
}

function EditItemModal({ item, catData, categories, brands, colors, fits, gstConfig, onClose, onSaved }) {
  const showToast = useToast()
  const [form, setForm] = useState({
    brand: item.brand || '', brandfamily: item.brandfamily || '',
    gender: item.gender || '', category: item.category || '',
    subcategory: item.subcategory || '', subsubcategory: item.subsubcategory || '',
    size: item.size || '', fit: item.fit || '', color: item.color || '',
    tax_category: item.tax_category || '',
  })

  function set(field) { return e => setForm(f => ({ ...f, [field]: e.target.value })) }
  function setAndCascade(field) {
    return e => {
      const val = e.target.value
      setForm(f => {
        const next = { ...f, [field]: val }
        if (field === 'category') { next.subcategory = ''; next.subsubcategory = ''; next.size = '' }
        if (field === 'subcategory') { next.subsubcategory = ''; next.size = '' }
        if (field === 'subsubcategory') { next.size = '' }
        return next
      })
    }
  }

  const subcats = getSubcategories(categories, form.category)
  const l3options = getL3Options(catData, form.category, form.subcategory)
  const sizes = getSizes(catData, form.category, form.subcategory, form.subsubcategory)

  async function save() {
    try {
      const res = await fetch(`/inventory/${item.matnr}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
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
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 640 }}>
        <div className="modal-title">Edit Inventory Item</div>
        <div className="modal-sub">MATNR cannot be changed</div>
        <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="id-badge">{item.matnr}</div>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>Read-only</span>
        </div>
        <div className="modal-grid">
          <div className="form-group">
            <label>Brand</label>
            <select value={form.brand} onChange={set('brand')}>
              <option value="">Select brand…</option>
              {brands.map(b => <option key={b.name || b} value={b.name || b}>{b.name || b}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Brand Family</label>
            <input value={form.brandfamily} onChange={set('brandfamily')} placeholder="e.g. RedLoop" />
          </div>
          <div className="form-group">
            <label>Gender</label>
            <select value={form.gender} onChange={set('gender')}>
              <option value="">Select…</option>
              {GENDERS.map(g => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Category</label>
            <select value={form.category} onChange={setAndCascade('category')}>
              <option value="">Select…</option>
              {Object.keys(categories).map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Sub-Category</label>
            <select value={form.subcategory} onChange={setAndCascade('subcategory')}>
              <option value="">Select category first…</option>
              {subcats.map(s => <option key={s.id} value={s.subcategory}>{s.subcategory}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Sub-Sub-Category</label>
            <select value={form.subsubcategory} onChange={setAndCascade('subsubcategory')}>
              <option value="">Select sub-category first…</option>
              {l3options.map(r => <option key={r.subsubcategory}>{r.subsubcategory}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Size</label>
            <select value={form.size} onChange={set('size')}>
              <option value="">Select…</option>
              {sizes.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Fit</label>
            <select value={form.fit} onChange={set('fit')}>
              <option value="">Select fit…</option>
              {fits.map(f => <option key={f.name || f} value={f.name || f}>{f.name || f}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Color</label>
            <select value={form.color} onChange={set('color')}>
              <option value="">Select color…</option>
              {colors.map(c => <option key={c.name || c} value={c.name || c}>{c.name || c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Tax Category</label>
            <select value={form.tax_category} onChange={set('tax_category')}>
              <option value="">Select tax category…</option>
              {gstConfig.map(g => <option key={g.id || g.tax_category} value={g.tax_category}>{g.tax_category} ({g.gst_rate}%)</option>)}
            </select>
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

// ── Config Tab ────────────────────────────────────────────────────────────────
function ConfigTab() {
  const showToast = useToast()
  const [brands, reloadBrands] = useBrands()
  const [colors, reloadColors] = useColors()
  const [fits, reloadFits] = useFits()
  const [gstConfig, reloadGst] = useGstConfig()
  const { catData, categories, reload: reloadCats } = useCategoryData()
  const [returnReasons, setReturnReasons] = useState([])
  const [l3Data, setL3Data] = useState([])

  const [newBrand, setNewBrand] = useState('')
  const [newColorName, setNewColorName] = useState('')
  const [newColorHex, setNewColorHex] = useState('#808000')
  const [newFit, setNewFit] = useState('')
  const [newReturnReason, setNewReturnReason] = useState('')
  const [newGst, setNewGst] = useState({ tax_category: '', gst_rate: '', valid_from: '', valid_to: '' })
  const [newCatName, setNewCatName] = useState('')
  const [newCatFirstSub, setNewCatFirstSub] = useState('')
  const [newSubCat, setNewSubCat] = useState('')
  const [newSubCatParent, setNewSubCatParent] = useState('')
  const [newL3, setNewL3] = useState({ category: '', subcategory: '', name: '', sizes: '' })

  const loadReturnReasons = useCallback(async () => {
    try { const r = await fetch('/return-reasons'); setReturnReasons(await r.json()) } catch {}
  }, [])

  const loadL3 = useCallback(async () => {
    try { const r = await fetch('/category-l3'); setL3Data(await r.json()) } catch {}
  }, [])

  useEffect(() => { loadReturnReasons(); loadL3() }, [loadReturnReasons, loadL3])

  async function api(path, method, body) {
    const res = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Request failed')
    return data
  }

  async function addBrand() {
    if (!newBrand.trim()) return
    try { await api('/brands', 'POST', { name: newBrand.trim() }); setNewBrand(''); reloadBrands() } catch (e) { showToast('❌ ' + e.message, 'error') }
  }
  async function removeBrand(id) {
    try { await api(`/brands/${id}`, 'DELETE', {}); reloadBrands() } catch (e) { showToast('❌ ' + e.message, 'error') }
  }

  async function addColor() {
    if (!newColorName.trim()) return
    try { await api('/colors', 'POST', { name: newColorName.trim(), hex: newColorHex }); setNewColorName(''); reloadColors() } catch (e) { showToast('❌ ' + e.message, 'error') }
  }
  async function removeColor(id) {
    try { await api(`/colors/${id}`, 'DELETE', {}); reloadColors() } catch (e) { showToast('❌ ' + e.message, 'error') }
  }

  async function addFit() {
    if (!newFit.trim()) return
    try { await api('/fits', 'POST', { name: newFit.trim() }); setNewFit(''); reloadFits() } catch (e) { showToast('❌ ' + e.message, 'error') }
  }
  async function removeFit(id) {
    try { await api(`/fits/${id}`, 'DELETE', {}); reloadFits() } catch (e) { showToast('❌ ' + e.message, 'error') }
  }

  async function addReturnReason() {
    if (!newReturnReason.trim()) return
    try { await api('/return-reasons', 'POST', { reason: newReturnReason.trim() }); setNewReturnReason(''); loadReturnReasons() } catch (e) { showToast('❌ ' + e.message, 'error') }
  }
  async function removeReturnReason(id) {
    try { await api(`/return-reasons/${id}`, 'DELETE', {}); loadReturnReasons() } catch (e) { showToast('❌ ' + e.message, 'error') }
  }

  async function addGst() {
    if (!newGst.tax_category || !newGst.gst_rate) return showToast('Category name and rate required', 'error')
    try {
      await api('/gst-config', 'POST', {
        tax_category: newGst.tax_category,
        gst_rate: parseFloat(newGst.gst_rate),
        valid_from: newGst.valid_from || new Date().toISOString().split('T')[0],
        valid_to: newGst.valid_to || '12319999',
      })
      setNewGst({ tax_category: '', gst_rate: '', valid_from: '', valid_to: '' })
      reloadGst()
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }

  async function addCategory() {
    if (!newCatName.trim()) return showToast('Category name is required', 'error')
    if (!newCatFirstSub.trim()) return showToast('First sub-category name is required', 'error')
    try {
      await api('/categories/new', 'POST', { category: newCatName.trim(), subcategory: newCatFirstSub.trim() })
      setNewCatName('')
      setNewCatFirstSub('')
      reloadCats()
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }

  async function addSubCategory() {
    if (!newSubCat.trim() || !newSubCatParent) return showToast('Select parent category', 'error')
    try { await api('/categories', 'POST', { category: newSubCatParent, subcategory: newSubCat.trim() }); setNewSubCat(''); reloadCats() } catch (e) { showToast('❌ ' + e.message, 'error') }
  }

  async function addL3() {
    if (!newL3.category || !newL3.subcategory || !newL3.name) return showToast('Category, Sub-Category and name required', 'error')
    try {
      await api('/category-l3', 'POST', { category: newL3.category, subcategory: newL3.subcategory, subsubcategory: newL3.name, sizes: newL3.sizes })
      setNewL3({ category: '', subcategory: '', name: '', sizes: '' })
      loadL3()
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }

  async function updateL3Sizes(id, sizes) {
    try { await api(`/category-l3/${id}`, 'PUT', { sizes }); loadL3() } catch (e) { showToast('❌ ' + e.message, 'error') }
  }

  async function removeL3(id) {
    if (!confirm('Remove this sub-sub-category?')) return
    try { await api(`/category-l3/${id}`, 'DELETE', {}); loadL3() } catch (e) { showToast('❌ ' + e.message, 'error') }
  }

  const l3SubsForForm = newL3.category && categories[newL3.category] ? categories[newL3.category] : []

  function Tag({ label, color, onRemove }) {
    return (
      <div className="tag">
        {color && <div className="tag-dot" style={{ background: color }} />}
        {label}
        <button className="tag-remove" onClick={onRemove}>×</button>
      </div>
    )
  }

  return (
    <>
      <h1 className="page-title">Configuration</h1>
      <p className="page-sub">Manage brands, colors, fits, categories and product hierarchy.</p>

      <div className="config-grid">
        {/* Brands */}
        <div className="config-card">
          <div className="config-title">🏷️ Brands</div>
          <div className="config-sub">Add or remove brands used in inventory.</div>
          <div className="tag-list">
            {brands.map(b => <Tag key={b.id} label={b.name} onRemove={() => removeBrand(b.id)} />)}
          </div>
          <div className="add-row">
            <input value={newBrand} onChange={e => setNewBrand(e.target.value)} placeholder="e.g. Calvin Klein" onKeyDown={e => e.key === 'Enter' && addBrand()} />
            <button className="btn btn-primary" onClick={addBrand}>Add</button>
          </div>
        </div>

        {/* Colors */}
        <div className="config-card">
          <div className="config-title">🎨 Colors</div>
          <div className="config-sub">Name is required; color picker is optional.</div>
          <div className="tag-list">
            {colors.map(c => <Tag key={c.id} label={c.name} color={c.hex} onRemove={() => removeColor(c.id)} />)}
          </div>
          <div className="add-row">
            <div className="color-input">
              <input value={newColorName} onChange={e => setNewColorName(e.target.value)} placeholder="e.g. Olive Green" onKeyDown={e => e.key === 'Enter' && addColor()} />
              <input type="color" value={newColorHex} onChange={e => setNewColorHex(e.target.value)} style={{ width: 40, height: 38, padding: 2, borderRadius: 6, cursor: 'pointer', border: '1.5px solid var(--border)' }} />
            </div>
            <button className="btn btn-primary" onClick={addColor}>Add</button>
          </div>
        </div>

        {/* Fits */}
        <div className="config-card">
          <div className="config-title">👕 Fits</div>
          <div className="config-sub">Fit types available when adding products.</div>
          <div className="tag-list">
            {fits.map(f => <Tag key={f.id} label={f.name} onRemove={() => removeFit(f.id)} />)}
          </div>
          <div className="add-row">
            <input value={newFit} onChange={e => setNewFit(e.target.value)} placeholder="e.g. Athletic Fit" onKeyDown={e => e.key === 'Enter' && addFit()} />
            <button className="btn btn-primary" onClick={addFit}>Add</button>
          </div>
        </div>

        {/* GST Config */}
        <div className="config-card">
          <div className="config-title">🧾 GST Tax Categories</div>
          <div className="config-sub">Tax category with GST rate. Leave Valid To blank for open-ended.</div>
          <div style={{ marginBottom: 16 }}>
            {gstConfig.map(g => (
              <div key={g.id || g.tax_category} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <span><strong>{g.tax_category}</strong> — {g.gst_rate}%</span>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{g.valid_from} → {g.valid_to === '12319999' ? 'Open' : g.valid_to}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr 1fr auto', gap: 8, alignItems: 'flex-end' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Category Name</label>
              <input value={newGst.tax_category} onChange={e => setNewGst(g => ({ ...g, tax_category: e.target.value }))} placeholder="e.g. Leather Goods" />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Rate %</label>
              <input type="number" value={newGst.gst_rate} onChange={e => setNewGst(g => ({ ...g, gst_rate: e.target.value }))} placeholder="12" min="0" max="100" step="0.5" />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Valid From</label>
              <input type="date" value={newGst.valid_from} onChange={e => setNewGst(g => ({ ...g, valid_from: e.target.value }))} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Valid To</label>
              <input type="date" value={newGst.valid_to} onChange={e => setNewGst(g => ({ ...g, valid_to: e.target.value }))} placeholder="Leave blank for open-ended" />
            </div>
            <button className="btn btn-primary" style={{ padding: '8px 12px', fontSize: 13, alignSelf: 'flex-end' }} onClick={addGst}>Add</button>
          </div>
        </div>

        {/* Return Reasons */}
        <div className="config-card">
          <div className="config-title">↩️ Return Reasons</div>
          <div className="config-sub">Reasons available when creating a return order.</div>
          <div className="tag-list">
            {returnReasons.map(r => <Tag key={r.id} label={r.reason} onRemove={() => removeReturnReason(r.id)} />)}
          </div>
          <div className="add-row">
            <input value={newReturnReason} onChange={e => setNewReturnReason(e.target.value)} placeholder="e.g. Exchange Request" onKeyDown={e => e.key === 'Enter' && addReturnReason()} />
            <button className="btn btn-primary" onClick={addReturnReason}>Add</button>
          </div>
        </div>

        {/* Category Tree */}
        <div className="config-card">
          <div className="config-title">📁 Category Tree</div>
          <div className="config-sub">Top-level categories and sub-categories.</div>
          <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 16 }}>
            {Object.entries(categories).map(([cat, subs]) => (
              <div key={cat} style={{ marginBottom: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{cat}</div>
                <div style={{ paddingLeft: 16, fontSize: 12, color: 'var(--muted)' }}>
                  {(subs || []).map(s => s.subcategory || s).join(', ') || '(no sub-categories)'}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input value={newSubCat} onChange={e => setNewSubCat(e.target.value)} placeholder="Sub-category name" />
            <select value={newSubCatParent} onChange={e => setNewSubCatParent(e.target.value)} style={{ minWidth: 120 }}>
              <option value="">Parent…</option>
              {Object.keys(categories).map(c => <option key={c}>{c}</option>)}
            </select>
            <button className="btn btn-primary" style={{ padding: '8px 12px', fontSize: 13 }} onClick={addSubCategory}>Add</button>
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 8 }}>
              New Top-Level Category
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                placeholder="Category name (e.g. Footwear)"
                style={{ flex: 1, minWidth: 140 }}
              />
              <input
                value={newCatFirstSub}
                onChange={e => setNewCatFirstSub(e.target.value)}
                placeholder="First sub-category (required)"
                style={{ flex: 1, minWidth: 160 }}
                onKeyDown={e => e.key === 'Enter' && addCategory()}
              />
              <button className="btn btn-ghost" style={{ padding: '8px 12px', fontSize: 13, whiteSpace: 'nowrap' }} onClick={addCategory}>
                + Add Category
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* L3 sub-sub-categories */}
      <div className="config-card" style={{ marginTop: 20 }}>
        <div className="config-title">📂 Sub-Sub-Categories & Sizes</div>
        <div className="config-sub">Define level-3 categories and their valid sizes (comma separated, e.g. 28,30,32 or XS,S,M,L).</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 10, alignItems: 'flex-end', marginBottom: 20 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Category</label>
            <select value={newL3.category} onChange={e => setNewL3(l => ({ ...l, category: e.target.value, subcategory: '' }))}>
              <option value="">Select…</option>
              {Object.keys(categories).map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Sub-Category</label>
            <select value={newL3.subcategory} onChange={e => setNewL3(l => ({ ...l, subcategory: e.target.value }))} disabled={!newL3.category}>
              <option value="">Select category…</option>
              {l3SubsForForm.map(s => <option key={s.id} value={s.subcategory}>{s.subcategory}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Sub-Sub-Category Name</label>
            <input value={newL3.name} onChange={e => setNewL3(l => ({ ...l, name: e.target.value }))} placeholder="e.g. Slim Jeans" />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Valid Sizes</label>
            <input value={newL3.sizes} onChange={e => setNewL3(l => ({ ...l, sizes: e.target.value }))} placeholder="28,30,32,34 or XS,S,M" />
          </div>
          <button className="btn btn-primary" style={{ padding: '10px 16px', fontSize: 13, alignSelf: 'flex-end' }} onClick={addL3}>Add</button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['Category', 'Sub-Category', 'Sub-Sub-Category', 'Valid Sizes', ''].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {l3Data.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20, color: 'var(--muted)' }}>No sub-sub-categories defined yet.</td></tr>
              ) : l3Data.map(r => (
                <L3Row key={r.id} row={r} onUpdate={updateL3Sizes} onRemove={removeL3} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

function L3Row({ row, onUpdate, onRemove }) {
  const [editing, setEditing] = useState(false)
  const [sizes, setSizes] = useState(row.sizes || '')

  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      <td style={{ padding: '8px 10px' }}>{row.category}</td>
      <td style={{ padding: '8px 10px' }}>{row.subcategory}</td>
      <td style={{ padding: '8px 10px' }}><strong>{row.subsubcategory}</strong></td>
      <td style={{ padding: '8px 10px' }}>
        {editing ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input value={sizes} onChange={e => setSizes(e.target.value)} style={{ flex: 1, fontSize: 12, padding: '4px 8px' }} />
            <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => { onUpdate(row.id, sizes); setEditing(false) }}>Save</button>
            <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => setEditing(false)}>✕</button>
          </div>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--muted)' }} onClick={() => setEditing(true)} title="Click to edit">{sizes || '—'}</span>
        )}
      </td>
      <td style={{ padding: '8px 10px' }}>
        <div className="actions">
          <button className="action-btn btn-edit" onClick={() => setEditing(true)}>Edit Sizes</button>
          <button className="action-btn btn-delete" onClick={() => onRemove(row.id)}>Delete</button>
        </div>
      </td>
    </tr>
  )
}

// ── Upload Tab ────────────────────────────────────────────────────────────────
function UploadTab() {
  const showToast = useToast()
  const [dragging, setDragging] = useState(false)
  const [logs, setLogs] = useState([])
  const [summary, setSummary] = useState(null)
  const [uploading, setUploading] = useState(false)

  function addLog(msg, type = 'info') {
    setLogs(l => [...l, { msg, type }])
  }

  function downloadTemplate() {
    const tsv = 'brand\tbrandfamily\tgender\tcategory\tsubcategory\tsubsubcategory\tsize\tfit\tcolor\ttax_category\nNike\tAir Max\tMale\tFootwear\tSneakers\tRunning\t10\tRegular\tBlack\tStandard 12%'
    const blob = new Blob([tsv], { type: 'text/tab-separated-values' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'inventory_template.tsv'; a.click()
    URL.revokeObjectURL(url)
  }

  async function processFile(file) {
    if (!file) return
    setLogs([]); setSummary(null); setUploading(true)
    addLog(`📂 Reading: ${file.name}`)

    const text = await file.text()
    const sep = file.name.endsWith('.tsv') || text.includes('\t') ? '\t' : ','
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length < 2) {
      addLog('❌ File must have a header + at least one data row.', 'error')
      setUploading(false); return
    }

    const headers = lines[0].split(sep).map(h => h.trim().toLowerCase())
    const rows = lines.slice(1)
    addLog(`✅ Found ${rows.length} rows`)

    let ok = 0, fail = 0
    for (let i = 0; i < rows.length; i++) {
      const cols = rows[i].split(sep)
      const obj = {}
      headers.forEach((h, idx) => { obj[h] = (cols[idx] || '').trim() })
      if (!obj.brand || !obj.category) {
        addLog(`Row ${i + 2}: ⚠️ Skipped — missing brand or category`, 'warn')
        fail++; continue
      }
      try {
        const res = await fetch('/addinventory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(obj),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Server error')
        addLog(`Row ${i + 2}: ✅ ${obj.brand} (${data.matnr})`, 'success')
        ok++
      } catch (err) {
        addLog(`Row ${i + 2}: ❌ ${err.message}`, 'error')
        fail++
      }
    }

    setSummary({ ok, fail, total: rows.length })
    setUploading(false)
    showToast(`Upload complete: ${ok} added, ${fail} failed`)
  }

  return (
    <>
      <h1 className="page-title">Mass Upload</h1>
      <p className="page-sub">Upload multiple products at once. Stock is added via Purchase Orders, pricing via Sales Pricing.</p>

      <div className="card">
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>📋 Template Format</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>Values must match your configured brands, categories, fits, colors and tax categories exactly.</div>
          <code style={{ display: 'block', background: 'var(--bg)', borderRadius: 8, padding: '10px 14px', fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'auto' }}>
            brand · brandfamily · gender · category · subcategory · subsubcategory · size · fit · color · tax_category
          </code>
        </div>

        <div
          className={`drop-zone${dragging ? ' drag-over' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); processFile(e.dataTransfer.files[0]) }}
          onClick={() => document.getElementById('inv-file-input').click()}
          style={{
            border: '2px dashed var(--border)', borderRadius: 12, padding: '48px 24px',
            textAlign: 'center', cursor: 'pointer',
            background: dragging ? 'rgba(0,0,0,0.03)' : 'transparent', transition: 'all 0.2s',
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 12 }}>📂</div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Drop your TSV / CSV here</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>CSV or TSV · Max 500 rows</div>
          <input id="inv-file-input" type="file" accept=".tsv,.csv,.txt" style={{ display: 'none' }} onChange={e => processFile(e.target.files[0])} />
        </div>

        <div className="btn-row" style={{ marginTop: 16 }}>
          <button className="btn btn-ghost" onClick={downloadTemplate}>⬇ Download Template</button>
        </div>

        {summary && (
          <div style={{
            marginTop: 20, padding: '12px 16px', borderRadius: 8,
            background: summary.fail === 0 ? 'rgba(34,197,94,0.1)' : 'rgba(234,179,8,0.1)',
            border: `1px solid ${summary.fail === 0 ? '#22c55e' : '#eab308'}`,
          }}>
            <strong>Upload Complete:</strong> {summary.ok} added, {summary.fail} failed out of {summary.total} rows
          </div>
        )}

        {logs.length > 0 && (
          <div style={{
            marginTop: 16, background: '#0f1117', borderRadius: 8,
            padding: '12px 16px', maxHeight: 260, overflowY: 'auto',
            fontFamily: 'monospace', fontSize: 12,
          }}>
            {logs.map((log, i) => (
              <div key={i} style={{
                color: log.type === 'error' ? '#f87171' : log.type === 'warn' ? '#fbbf24' : log.type === 'success' ? '#4ade80' : '#94a3b8',
                marginBottom: 2,
              }}>{log.msg}</div>
            ))}
            {uploading && <div style={{ color: '#60a5fa', marginTop: 4 }}>⏳ Processing…</div>}
          </div>
        )}
      </div>
    </>
  )
}

// ── Root Component ────────────────────────────────────────────────────────────
export default function Inventory() {
  const [searchParams] = useSearchParams()
  const editMatnr = searchParams.get('edit') || null
  const [tab, setTab] = useState('view')
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="page-layout">
      <Sidebar section="Inventory" activeTab={tab} onTabChange={t => { setTab(t); if (t === 'view') setRefreshKey(k => k + 1) }} />
      <div className="main">
        {tab === 'add' && <AddTab onAdded={() => { setTab('view'); setRefreshKey(k => k + 1) }} />}
        {tab === 'view' && <ViewTab key={refreshKey} editMatnr={editMatnr} />}
        {tab === 'cats' && <ConfigTab />}
        {tab === 'upload' && <UploadTab />}
      </div>
    </div>
  )
}
