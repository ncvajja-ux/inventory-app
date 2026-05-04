import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../components/Toast'
import { db } from '../lib/supabase'
import ERPLayout from '../components/ERPLayout'
import ModuleHeader from '../components/ModuleHeader'
import ModuleTabs from '../components/ModuleTabs'
import StatsStrip from '../components/StatsStrip'
import DataTable from '../components/DataTable'
import CardList from '../components/CardList'
import StatusBadge from '../components/StatusBadge'
import { useBreakpoint } from '../hooks/useBreakpoint'


// ── Category cascade hook ───────────────────────────────────────────────────
function useCategoryData() {
  const [catData, setCatData] = useState(null) // full L3 data from category_l3
  const [categories, setCategories] = useState({}) // from categories table

  const loadAll = useCallback(async () => {
    try {
      const [{ data: catsRaw, error: catsErr }, { data: l3Raw, error: l3Err }] = await Promise.all([
        db.inventory().from('categories').select('*').order('category'),
        db.inventory().from('category_l3').select('*').order('category'),
      ])
      if (catsErr) { console.error('Failed to load categories:', catsErr.message); return }
      if (l3Err) { console.error('Failed to load category_l3:', l3Err.message); return }
      // Transform categories array into grouped object: { category: [subcategory rows] }
      const grouped = {}
      ;(catsRaw || []).forEach(row => {
        if (!grouped[row.category]) grouped[row.category] = []
        grouped[row.category].push(row)
      })
      setCategories(grouped)
      setCatData(l3Raw || [])
    } catch (err) {
      console.error('Failed to load categories:', err.message)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])
  return { catData, categories, reload: loadAll }
}

function useBrands() {
  const [brands, setBrands] = useState([])
  const load = useCallback(async () => {
    try {
      const { data, error } = await db.inventory().from('brands').select('id, name').order('name')
      if (error) { console.error('Failed to load brands:', error.message); return }
      setBrands(data || [])
    } catch (err) {
      console.error('Failed to load brands:', err.message)
    }
  }, [])
  useEffect(() => { load() }, [load])
  return [brands, load]
}

function useColors() {
  const [colors, setColors] = useState([])
  const load = useCallback(async () => {
    try {
      const { data, error } = await db.inventory().from('colors').select('id, name, hex').order('name')
      if (error) { console.error('Failed to load colors:', error.message); return }
      setColors(data || [])
    } catch (err) {
      console.error('Failed to load colors:', err.message)
    }
  }, [])
  useEffect(() => { load() }, [load])
  return [colors, load]
}

function useFits() {
  const [fits, setFits] = useState([])
  const load = useCallback(async () => {
    try {
      const { data, error } = await db.inventory().from('fits').select('id, name').order('name')
      if (error) { console.error('Failed to load fits:', error.message); return }
      setFits(data || [])
    } catch (err) {
      console.error('Failed to load fits:', err.message)
    }
  }, [])
  useEffect(() => { load() }, [load])
  return [fits, load]
}

function useMaterialTypes() {
  const [materialTypes, setMaterialTypes] = useState([])
  const load = useCallback(async () => {
    try {
      const { data, error } = await db.inventory().from('material_types').select('*').order('name')
      if (error) { console.error('Failed to load material_types:', error.message); return }
      setMaterialTypes(data || [])
    } catch (err) {
      console.error('Failed to load material_types:', err.message)
    }
  }, [])
  useEffect(() => { load() }, [load])
  return [materialTypes, load]
}

function useBodyTypes() {
  const [bodyTypes, setBodyTypes] = useState([])
  const load = useCallback(async () => {
    try {
      const { data, error } = await db.inventory().from('body_types').select('*').order('name')
      if (error) { console.error('Failed to load body_types:', error.message); return }
      setBodyTypes(data || [])
    } catch (err) {
      console.error('Failed to load body_types:', err.message)
    }
  }, [])
  useEffect(() => { load() }, [load])
  return [bodyTypes, load]
}

function useGstConfig() {
  const [gstConfig, setGstConfig] = useState([])
  const load = useCallback(async () => {
    try {
      const { data, error } = await db.pricing().from('gst_config').select('*').order('tax_category')
      if (error) { console.error('Failed to load gst_config:', error.message); return }
      setGstConfig(data || [])
    } catch (err) {
      console.error('Failed to load gst_config:', err.message)
    }
  }, [])
  useEffect(() => { load() }, [load])
  return [gstConfig, load]
}

function useProducts() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await db.inventory().from('products')
        .select('*, mara(matnr, size, quantity, reserved)')
        .order('sku_id', { ascending: false })
      if (error) throw error
      setProducts(data || [])
    } catch (err) { console.error(err.message) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])
  return [products, load, loading]
}

// Loads available sizes from category_l3 for a given category/subcategory/subsubcategory
function SizePicker({ category, subcategory, subsubcategory, value, onChange }) {
  const [sizes, setSizes] = useState([])
  useEffect(() => {
    if (!category || !subcategory || !subsubcategory) { setSizes([]); return }
    db.inventory().from('category_l3').select('sizes')
      .eq('category', category).eq('subcategory', subcategory).eq('subsubcategory', subsubcategory)
      .single()
      .then(({ data }) => {
        setSizes(data?.sizes ? data.sizes.split(',').map(s => s.trim()).filter(Boolean) : [])
      })
      .catch(() => setSizes([]))
  }, [category, subcategory, subsubcategory])

  return (
    <div className="form-group" style={{ margin: 0, minWidth: 120 }}>
      <label style={{ fontSize: 11 }}>Size</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--card)', color: 'var(--ink)', fontSize: 13, width: '100%' }}
      >
        <option value="">{sizes.length === 0 ? 'No sizes configured' : 'Select size…'}</option>
        {sizes.map(s => <option key={s}>{s}</option>)}
      </select>
    </div>
  )
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
// New AddTab — creates a product (SKU), no sizes required
function AddTab({ onAdded }) {
  const showToast = useToast()
  const { catData, categories, reload: reloadCats } = useCategoryData()
  const [brands] = useBrands()
  const [colors] = useColors()
  const [fits] = useFits()
  const [materialTypes] = useMaterialTypes()
  const [gstConfig] = useGstConfig()
  const [bodyTypes] = useBodyTypes()
  const [formKey, setFormKey] = useState(0)
  const [nextSkuCode, setNextSkuCode] = useState('—')

  const loadNextSkuCode = useCallback(async () => {
    try {
      const { data } = await db.inventory().from('products')
        .select('sku_code').order('sku_id', { ascending: false }).limit(1)
      const maxNum = data?.[0]?.sku_code
        ? parseInt(data[0].sku_code.replace('P', ''), 10) || 100000
        : 100000
      setNextSkuCode('P' + String(maxNum + 1).padStart(6, '0'))
    } catch { setNextSkuCode('Auto') }
  }, [])

  useEffect(() => { loadNextSkuCode() }, [loadNextSkuCode])

  const [form, setForm] = useState({
    brand: '', brandfamily: '', gender: '',
    category: '', subcategory: '', subsubcategory: '',
    color: '', fit: '', tax_category: '', body_type: '',
    material_type: '', mrp: '', cost_price: '',
  })

  function set(field) { return e => setForm(f => ({ ...f, [field]: e.target.value })) }

  function setAndCascade(field) {
    return e => {
      const val = e.target.value
      setForm(f => {
        const next = { ...f, [field]: val }
        if (field === 'category') { next.subcategory = ''; next.subsubcategory = '' }
        if (field === 'subcategory') { next.subsubcategory = '' }
        return next
      })
    }
  }

  async function save() {
    if (!form.brand) return showToast('Brand is required', 'error')
    if (!form.category) return showToast('Category is required', 'error')
    try {
      const { data: latest } = await db.inventory().from('products')
        .select('sku_code').order('sku_id', { ascending: false }).limit(1)
      const maxNum = latest?.[0]?.sku_code
        ? parseInt(latest[0].sku_code.replace('P', ''), 10) || 100000
        : 100000
      const sku_code = 'P' + String(maxNum + 1).padStart(6, '0')

      const { error } = await db.inventory().from('products').insert({
        sku_code,
        brand: form.brand,
        brandfamily: form.brandfamily || null,
        gender: form.gender || null,
        category: form.category,
        subcategory: form.subcategory || null,
        subsubcategory: form.subsubcategory || null,
        color: form.color || null,
        fit: form.fit || null,
        tax_category: form.tax_category || null,
        body_type: form.body_type || null,
        material_type: form.material_type || null,
        mrp: parseFloat(form.mrp) || 0,
        cost_price: parseFloat(form.cost_price) || 0,
      })
      if (error) throw new Error(error.message)
      showToast(`✅ Product ${sku_code} created!`)
      setFormKey(k => k + 1)
      loadNextSkuCode()
      onAdded()
    } catch (err) { showToast(`❌ ${err.message}`, 'error') }
  }

  const subcats = form.category ? (categories[form.category] || []) : []
  const l3options = (catData || []).filter(r =>
    r.category === form.category && r.subcategory === form.subcategory
  )

  return (
    <div key={formKey}>
      <h1 className="page-title">Add Product</h1>
      <p className="page-sub">Create a new product (SKU). Add size variants after saving.</p>
      <div className="card">
        {/* SKU Code badge */}
        <div style={{ marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
          <label>AUTO-ASSIGNED SKU CODE</label>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="id-badge">{nextSkuCode}</div>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Assigned automatically on save</span>
          </div>
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label>Brand *</label>
            <select value={form.brand} onChange={set('brand')}>
              <option value="">Select brand…</option>
              {brands.map(b => <option key={b.name}>{b.name}</option>)}
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
              {['Male','Female','Unisex'].map(g => <option key={g}>{g}</option>)}
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
              <option value="">Select…</option>
              {subcats.map(r => <option key={r.subcategory}>{r.subcategory}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Sub-Sub-Category</label>
            <select value={form.subsubcategory} onChange={set('subsubcategory')} disabled={!form.subcategory}>
              <option value="">Select…</option>
              {l3options.map(r => <option key={r.subsubcategory}>{r.subsubcategory}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Color</label>
            <select value={form.color} onChange={set('color')}>
              <option value="">Select…</option>
              {colors.map(c => <option key={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Fit</label>
            <select value={form.fit} onChange={set('fit')}>
              <option value="">Select fit…</option>
              {fits.map(f => <option key={f.name}>{f.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Body Type</label>
            <select value={form.body_type} onChange={set('body_type')}>
              <option value="">Select…</option>
              {bodyTypes.map(b => <option key={b.name}>{b.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Material Type</label>
            <select value={form.material_type} onChange={set('material_type')}>
              <option value="">Select…</option>
              {materialTypes.map(m => <option key={m.name}>{m.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>GST Category</label>
            <select value={form.tax_category} onChange={set('tax_category')}>
              <option value="">Select…</option>
              {gstConfig.map(g => <option key={g.id} value={g.tax_category}>{g.tax_category} ({g.gst_rate}%)</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>MRP (₹)</label>
            <input type="number" value={form.mrp} onChange={set('mrp')} placeholder="0.00" min="0" step="0.01" />
          </div>
          <div className="form-group">
            <label>Cost Price (₹)</label>
            <input type="number" value={form.cost_price} onChange={set('cost_price')} placeholder="0.00" min="0" step="0.01" />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button className="btn btn-primary" onClick={save}>Save Product</button>
          <button className="btn btn-ghost" onClick={() => { setFormKey(k => k + 1); setForm({ brand:'',brandfamily:'',gender:'',category:'',subcategory:'',subsubcategory:'',color:'',fit:'',tax_category:'',body_type:'',material_type:'',mrp:'',cost_price:'' }) }}>Clear</button>
        </div>
      </div>
    </div>
  )
}

// ── Browse Tab (product list with expandable size variants) ──────────────────
function ProductRow({ product, onRefresh, onEdit, onDelete }) {
  const showToast = useToast()
  const [expanded, setExpanded] = useState(false)
  const [addingSizeForm, setAddingSizeForm] = useState(null) // { size, qty }
  const [editingSize, setEditingSize] = useState(null) // { matnr, quantity }

  const variants = product.mara || []
  const totalStock = variants.reduce((s, v) => s + (v.quantity || 0), 0)

  async function saveAddSize() {
    if (!addingSizeForm?.size) return showToast('Select a size', 'error')
    if (variants.find(v => v.size === addingSizeForm.size)) return showToast('This size already exists', 'error')
    try {
      const { data: latest } = await db.inventory().from('mara')
        .select('matnr').order('matnr', { ascending: false }).limit(1)
      const maxNum = latest?.[0]?.matnr ? parseInt(latest[0].matnr, 10) : 99999
      const matnr = String(maxNum + 1).padStart(6, '0')

      const { error } = await db.inventory().from('mara').insert({
        matnr,
        sku_id: product.sku_id,
        size: addingSizeForm.size,
        quantity: parseInt(addingSizeForm.qty) || 0,
      })
      if (error) throw error
      showToast(`✅ Size ${addingSizeForm.size} added (${matnr})`)
      setAddingSizeForm(null)
      onRefresh()
    } catch (err) { showToast(`❌ ${err.message}`, 'error') }
  }

  async function saveEditSize() {
    if (!editingSize) return
    try {
      const { error } = await db.inventory().from('mara')
        .update({ quantity: parseInt(editingSize.quantity) || 0 })
        .eq('matnr', editingSize.matnr)
      if (error) throw error
      showToast('✅ Quantity updated')
      setEditingSize(null)
      onRefresh()
    } catch (err) { showToast(`❌ ${err.message}`, 'error') }
  }

  async function deleteVariant(matnr, size) {
    if (!window.confirm(`Delete size ${size} (${matnr})?`)) return
    try {
      const { error } = await db.inventory().from('mara').delete().eq('matnr', matnr)
      if (error) throw error
      onRefresh()
    } catch (err) { showToast(`❌ ${err.message}`, 'error') }
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, marginBottom: 8, background: 'var(--card)' }}>
      {/* Product header row */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }}
      >
        <span style={{ fontSize: 12, color: 'var(--muted)', transform: expanded ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: '0.2s' }}>▶</span>
        {product.image_data && (
          <img src={product.image_data} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }} />
        )}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 80px 80px 80px 80px', gap: 8, alignItems: 'center', fontSize: 13 }}>
          <div><strong>{product.brand}</strong> <span style={{ color: 'var(--muted)', fontSize: 11 }}>{product.sku_code}</span></div>
          <div style={{ color: 'var(--muted)' }}>{[product.category, product.subcategory, product.subsubcategory].filter(Boolean).join(' · ')}</div>
          <div>{product.color || '—'}</div>
          <div>{product.fit || '—'}</div>
          <div style={{ textAlign: 'right' }}><strong>{totalStock}</strong> <span style={{ fontSize: 11, color: 'var(--muted)' }}>units</span></div>
          <div style={{ textAlign: 'right' }}>{product.mrp ? '₹' + product.mrp : '—'}</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
          <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => onEdit(product)}>Edit</button>
          <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 10px', color: 'var(--danger)' }} onClick={() => onDelete(product.sku_id)}>Delete</button>
        </div>
      </div>

      {/* Expanded: size variants */}
      {expanded && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 12 }}>
            <thead>
              <tr style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase' }}>
                <th style={{ padding: '6px 8px', textAlign: 'left' }}>MATNR</th>
                <th style={{ padding: '6px 8px', textAlign: 'left' }}>Size</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Qty</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Reserved</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Available</th>
                <th style={{ padding: '6px 8px' }}></th>
              </tr>
            </thead>
            <tbody>
              {variants.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '12px 8px', color: 'var(--muted)', fontSize: 12 }}>No size variants yet. Add one below.</td></tr>
              )}
              {variants.map(v => (
                <tr key={v.matnr} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px', fontFamily: 'monospace', fontSize: 12 }}>{v.matnr}</td>
                  <td style={{ padding: '8px' }}>{v.size || '—'}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>
                    {editingSize?.matnr === v.matnr ? (
                      <input
                        type="number" min="0"
                        value={editingSize.quantity}
                        onChange={e => setEditingSize(s => ({ ...s, quantity: e.target.value }))}
                        style={{ width: 60, padding: '2px 6px', borderRadius: 6, border: '1.5px solid var(--accent)', background: 'var(--card)', color: 'var(--ink)', fontSize: 13 }}
                        autoFocus
                      />
                    ) : v.quantity}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right', color: 'var(--muted)' }}>{v.reserved || 0}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{(v.quantity || 0) - (v.reserved || 0)}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      {editingSize?.matnr === v.matnr ? (
                        <>
                          <button className="btn btn-primary" style={{ fontSize: 11, padding: '3px 10px' }} onClick={saveEditSize}>Save</button>
                          <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => setEditingSize(null)}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => setEditingSize({ matnr: v.matnr, quantity: String(v.quantity || 0) })}>Edit Qty</button>
                          <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 10px', color: 'var(--danger)' }} onClick={() => deleteVariant(v.matnr, v.size)}>Delete</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Add size form */}
          {addingSizeForm ? (
            <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'flex-end' }}>
              <SizePicker
                category={product.category}
                subcategory={product.subcategory}
                subsubcategory={product.subsubcategory}
                value={addingSizeForm.size}
                onChange={size => setAddingSizeForm(f => ({ ...f, size }))}
              />
              <div className="form-group" style={{ margin: 0, width: 100 }}>
                <label style={{ fontSize: 11 }}>Opening Qty</label>
                <input type="number" min="0" value={addingSizeForm.qty}
                  onChange={e => setAddingSizeForm(f => ({ ...f, qty: e.target.value }))}
                  style={{ padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--card)', color: 'var(--ink)', fontSize: 13, width: '100%' }}
                />
              </div>
              <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={saveAddSize}>Add</button>
              <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setAddingSizeForm(null)}>Cancel</button>
            </div>
          ) : (
            <button
              className="btn btn-ghost"
              style={{ marginTop: 12, fontSize: 12 }}
              onClick={() => setAddingSizeForm({ size: '', qty: 0 })}
            >+ Add Size</button>
          )}
        </div>
      )}
    </div>
  )
}

function EditProductModal({ product, onClose, onSaved }) {
  const showToast = useToast()
  const { catData, categories } = useCategoryData()
  const [brands] = useBrands()
  const [colors] = useColors()
  const [fits] = useFits()
  const [materialTypes] = useMaterialTypes()
  const [gstConfig] = useGstConfig()
  const [bodyTypes] = useBodyTypes()
  const [form, setForm] = useState({
    brand: product.brand || '',
    brandfamily: product.brandfamily || '',
    gender: product.gender || '',
    category: product.category || '',
    subcategory: product.subcategory || '',
    subsubcategory: product.subsubcategory || '',
    color: product.color || '',
    fit: product.fit || '',
    tax_category: product.tax_category || '',
    body_type: product.body_type || '',
    material_type: product.material_type || '',
    mrp: String(product.mrp || ''),
    cost_price: String(product.cost_price || ''),
  })

  function set(field) { return e => setForm(f => ({ ...f, [field]: e.target.value })) }

  async function save() {
    try {
      const { error } = await db.inventory().from('products').update({
        brand: form.brand,
        brandfamily: form.brandfamily || null,
        gender: form.gender || null,
        category: form.category,
        subcategory: form.subcategory || null,
        subsubcategory: form.subsubcategory || null,
        color: form.color || null,
        fit: form.fit || null,
        tax_category: form.tax_category || null,
        body_type: form.body_type || null,
        material_type: form.material_type || null,
        mrp: parseFloat(form.mrp) || 0,
        cost_price: parseFloat(form.cost_price) || 0,
      }).eq('sku_id', product.sku_id)
      if (error) throw error
      showToast('✅ Product updated')
      onSaved()
      onClose()
    } catch (err) { showToast(`❌ ${err.message}`, 'error') }
  }

  const subcats = form.category ? (categories[form.category] || []) : []

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--card)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 700, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Edit Product — {product.sku_code}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--muted)' }}>×</button>
        </div>
        <div className="form-grid">
          <div className="form-group"><label>Brand *</label>
            <select value={form.brand} onChange={set('brand')}>
              <option value="">Select…</option>
              {brands.map(b => <option key={b.name}>{b.name}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Brand Family</label><input value={form.brandfamily} onChange={set('brandfamily')} /></div>
          <div className="form-group"><label>Gender</label>
            <select value={form.gender} onChange={set('gender')}>
              <option value="">Select…</option>
              {['Male','Female','Unisex'].map(g => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Category *</label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value, subcategory: '', subsubcategory: '' }))}>
              <option value="">Select…</option>
              {Object.keys(categories).map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Sub-Category</label>
            <select value={form.subcategory} onChange={e => setForm(f => ({ ...f, subcategory: e.target.value, subsubcategory: '' }))} disabled={!form.category}>
              <option value="">Select…</option>
              {subcats.map(r => <option key={r.subcategory}>{r.subcategory}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Sub-Sub-Category</label>
            <select value={form.subsubcategory} onChange={set('subsubcategory')} disabled={!form.subcategory}>
              <option value="">Select…</option>
              {(catData || []).filter(r => r.category === form.category && r.subcategory === form.subcategory).map(r => <option key={r.subsubcategory}>{r.subsubcategory}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Color</label>
            <select value={form.color} onChange={set('color')}>
              <option value="">Select…</option>
              {colors.map(c => <option key={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Fit</label>
            <select value={form.fit} onChange={set('fit')}>
              <option value="">Select…</option>
              {fits.map(f => <option key={f.name}>{f.name}</option>)}
            </select>
          </div>
          <div className="form-group"><label>GST Category</label>
            <select value={form.tax_category} onChange={set('tax_category')}>
              <option value="">Select…</option>
              {gstConfig.map(g => <option key={g.id} value={g.tax_category}>{g.tax_category} ({g.gst_rate}%)</option>)}
            </select>
          </div>
          <div className="form-group"><label>Body Type</label>
            <select value={form.body_type} onChange={set('body_type')}>
              <option value="">Select…</option>
              {bodyTypes.map(b => <option key={b.name}>{b.name}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Material Type</label>
            <select value={form.material_type} onChange={set('material_type')}>
              <option value="">Select…</option>
              {materialTypes.map(m => <option key={m.name}>{m.name}</option>)}
            </select>
          </div>
          <div className="form-group"><label>MRP (₹)</label><input type="number" value={form.mrp} onChange={set('mrp')} min="0" step="0.01" /></div>
          <div className="form-group"><label>Cost Price (₹)</label><input type="number" value={form.cost_price} onChange={set('cost_price')} min="0" step="0.01" /></div>
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          <button className="btn btn-primary" onClick={save}>Save Changes</button>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

function BrowseTab({ refreshKey }) {
  const showToast = useToast()
  const navigate = useNavigate()
  const [products, reload, loading] = useProducts()
  const [search, setSearch] = useState('')
  const [editingProduct, setEditingProduct] = useState(null)
  const bp = useBreakpoint()

  // Re-load when parent refreshKey changes (e.g. after AddTab saves)
  useEffect(() => { reload() }, [refreshKey, reload])

  const filtered = products
    .map(p => ({ ...p, total_stock: (p.mara || []).reduce((s, v) => s + (v.quantity || 0), 0) }))
    .filter(p => {
      if (!search) return true
      const q = search.toLowerCase()
      return [p.brand, p.category, p.color, p.fit, p.sku_code, p.subcategory]
        .some(v => (v || '').toLowerCase().includes(q))
    })

  async function deleteProduct(sku_id) {
    if (!window.confirm('Delete this product and all its size variants?')) return
    try {
      const { error } = await db.inventory().from('products').delete().eq('sku_id', sku_id)
      if (error) throw error
      reload()
    } catch (err) { showToast(`❌ ${err.message}`, 'error') }
  }

  const INV_COLUMNS = [
    { key: 'brand', label: 'Brand / SKU', render: r => (
      <div>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{r.brand}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{r.sku_code}</div>
      </div>
    )},
    { key: 'category',    label: 'Category' },
    { key: 'color',       label: 'Color' },
    { key: 'fit',         label: 'Fit' },
    { key: 'total_stock', label: 'Stock', align: 'right', render: r => (
      <span style={{ color: (r.total_stock || 0) === 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>
        {r.total_stock ?? 0}
      </span>
    )},
    { key: 'mrp', label: 'MRP', align: 'right', render: r =>
      r.mrp ? `₹${Number(r.mrp).toLocaleString('en-IN')}` : '—'
    },
    { key: 'actions', label: '', render: r => (
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
        <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 10px' }}
          onClick={() => setEditingProduct(r)}>Edit</button>
        <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 10px', color: 'var(--danger)' }}
          onClick={() => deleteProduct(r.sku_id)}>Delete</button>
      </div>
    )},
  ]

  return (
    <div>
      {/* Search / refresh bar */}
      <div style={{ display: 'flex', gap: 12, padding: '16px 24px 0', alignItems: 'center' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search brand, category, color…"
          style={{ flex: 1, padding: '9px 14px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--card)', color: 'var(--ink)', fontSize: 13 }}
        />
        <button className="btn btn-ghost" onClick={reload}>↺</button>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{filtered.length} products</span>
      </div>

      {bp === 'mobile' ? (
        <CardList
          items={filtered}
          loading={loading}
          emptyText="No products found."
          onCardClick={item => navigate(`/inventory/product/${item.sku_id}`)}
          renderCard={item => (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{item.brand}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  {[item.category, item.color, item.fit].filter(Boolean).join(' · ')}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{item.sku_code}</div>
                {item.mrp && (
                  <div style={{ fontWeight: 600, marginTop: 4, fontSize: 13 }}>
                    ₹{Number(item.mrp).toLocaleString('en-IN')}
                  </div>
                )}
              </div>
              <StatusBadge
                status={(item.total_stock || 0) === 0 ? 'out_of_stock' : 'active'}
                label={(item.total_stock || 0) === 0 ? 'Out of Stock' : `${item.total_stock} pcs`}
              />
            </div>
          )}
        />
      ) : (
        <div style={{ marginTop: 16 }}>
          <DataTable
            columns={INV_COLUMNS}
            rows={filtered}
            gridCols="2fr 1fr 1fr 1fr 80px 90px 110px"
            loading={loading}
            emptyText="No products found."
            renderRow={(p, i) => (
              <div
                key={p.sku_id}
                className={`erp-table-row clickable${i % 2 === 1 ? ' alt' : ''}`}
                style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 80px 90px 110px', cursor: 'pointer' }}
                onClick={() => navigate(`/inventory/product/${p.sku_id}`)}
              >
                {INV_COLUMNS.map(c => (
                  <div key={c.key} className="erp-td" style={{ textAlign: c.align || 'left' }}>
                    {c.render ? c.render(p) : (p[c.key] ?? '—')}
                  </div>
                ))}
              </div>
            )}
          />
        </div>
      )}

      {editingProduct && (
        <EditProductModal product={editingProduct} onClose={() => setEditingProduct(null)} onSaved={reload} />
      )}
    </div>
  )
}


// ── Upload Tab ────────────────────────────────────────────────────────────────
function UploadTab() {
  return (
    <div>
      <h1 className="page-title">Bulk Upload</h1>
      <div className="card" style={{ padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🚧</div>
        <h3 style={{ marginBottom: 8 }}>Upload temporarily unavailable</h3>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>
          Bulk upload is being updated for the new product/SKU model.<br />
          Add products individually via the Add tab, then expand each product to add size variants.
        </p>
      </div>
    </div>
  )
}

const INV_TABS = [
  { id: 'view',   label: 'Products' },
  { id: 'add',    label: 'Add Product' },
  { id: 'upload', label: 'Mass Upload' },
]
const INV_TAB_LABELS = { view: 'Products', add: 'Add Product', upload: 'Mass Upload' }

export default function Inventory() {
  const [tab, setTab] = useState('view')
  const [refreshKey, setRefreshKey] = useState(0)
  const [stats, setStats] = useState({ skus: '—', variants: '—', outOfStock: '—' })

  useEffect(() => {
    async function loadStats() {
      try {
        const [{ count: skuCount }, { data: stockRows }] = await Promise.all([
          db.inventory().from('products').select('*', { count: 'exact', head: true }),
          db.inventory().from('mara').select('quantity'),
        ])
        const total = (stockRows || []).reduce((s, r) => s + (r.quantity || 0), 0)
        const oos   = (stockRows || []).filter(r => (r.quantity || 0) === 0).length
        setStats({ skus: skuCount ?? '—', variants: total, outOfStock: oos })
      } catch { /* non-fatal */ }
    }
    loadStats()
  }, [refreshKey])

  return (
    <ERPLayout>
      <ModuleHeader
        moduleLabel="INVENTORY"
        breadcrumb={INV_TAB_LABELS[tab]}
        action={
          tab === 'view' && (
            <button className="btn btn-primary" style={{ fontSize: 12, padding: '6px 14px' }}
              onClick={() => setTab('add')}>
              + New Product
            </button>
          )
        }
      />
      <ModuleTabs tabs={INV_TABS} activeTab={tab} onChange={t => { setTab(t); if (t === 'view') setRefreshKey(k => k + 1) }} />
      <StatsStrip stats={[
        { value: stats.skus,       label: 'SKUs' },
        { value: stats.variants,   label: 'Variants' },
        { value: stats.outOfStock, label: 'Out of Stock', color: stats.outOfStock > 0 ? 'var(--danger)' : undefined },
      ]} />
      <div className="erp-content">
        {tab === 'add'    && <AddTab onAdded={() => { setRefreshKey(k => k + 1); setTab('view') }} />}
        {tab === 'view'   && <BrowseTab refreshKey={refreshKey} />}

        {tab === 'upload' && <UploadTab />}
      </div>
    </ERPLayout>
  )
}
