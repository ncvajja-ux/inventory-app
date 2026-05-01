import { useState, useEffect, useCallback } from 'react'
import Sidebar from '../components/Sidebar'
import { useToast } from '../components/Toast'
import { db } from '../lib/supabase'


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
      const { data, error } = await db.inventory().from('brands').select('name').order('name')
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
      const { data, error } = await db.inventory().from('colors').select('name,hex').order('name')
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
      const { data, error } = await db.inventory().from('fits').select('name').order('name')
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
  const [products, reload, loading] = useProducts()
  const [search, setSearch] = useState('')
  const [editingProduct, setEditingProduct] = useState(null)

  // Re-load when parent refreshKey changes (e.g. after AddTab saves)
  useEffect(() => { reload() }, [refreshKey, reload])

  const filtered = products.filter(p => {
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

  return (
    <div>
      <h1 className="page-title">Products</h1>
      <p className="page-sub">All SKUs — click a row to manage size variants.</p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search brand, category, color…"
          style={{ flex: 1, padding: '9px 14px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--card)', color: 'var(--ink)', fontSize: 13 }}
        />
        <button className="btn btn-ghost" onClick={reload}>↺ Refresh</button>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>{filtered.length} products</span>
      </div>

      {/* Column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '24px auto 1fr 80px 80px 80px 80px', gap: 8, padding: '6px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.06em' }}>
        <span></span><span>Brand / SKU</span><span>Category</span><span>Color</span><span>Fit</span><span>Stock</span><span>MRP</span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>No products found.</div>
      ) : filtered.map(p => (
        <ProductRow
          key={p.sku_id}
          product={p}
          onRefresh={reload}
          onEdit={() => setEditingProduct(p)}
          onDelete={() => deleteProduct(p.sku_id)}
        />
      ))}

      {editingProduct && (
        <EditProductModal product={editingProduct} onClose={() => setEditingProduct(null)} onSaved={reload} />
      )}
    </div>
  )
}

// ── Config Tab ────────────────────────────────────────────────────────────────
function ConfigTab() {
  const showToast = useToast()
  const [brands, reloadBrands] = useBrands()
  const [colors, reloadColors] = useColors()
  const [fits, reloadFits] = useFits()
  const [materialTypes, reloadMaterialTypes] = useMaterialTypes()
  const [gstConfig, reloadGst] = useGstConfig()
  const [bodyTypes, reloadBodyTypes] = useBodyTypes()
  const { catData, categories, reload: reloadCats } = useCategoryData()
  const [returnReasons, setReturnReasons] = useState([])
  const [l3Data, setL3Data] = useState([])

  const [newBrand, setNewBrand] = useState('')
  const [newMaterialType, setNewMaterialType] = useState('')
  const [newBodyType, setNewBodyType] = useState('')
  const [newColorName, setNewColorName] = useState('')
  const [newColorHex, setNewColorHex] = useState('#808000')
  const [newFit, setNewFit] = useState('')
  const [newReturnReason, setNewReturnReason] = useState('')
  const [newGst, setNewGst] = useState({ tax_category: '', gst_rate: '', valid_from: '', valid_to: '' })
  const [editingGst, setEditingGst] = useState(null) // { id, tax_category, gst_rate }
  const [newCatName, setNewCatName] = useState('')
  const [newCatFirstSub, setNewCatFirstSub] = useState('')
  const [newSubCat, setNewSubCat] = useState('')
  const [newSubCatParent, setNewSubCatParent] = useState('')
  const [newL3, setNewL3] = useState({ category: '', subcategory: '', name: '', sizes: '' })

  const loadReturnReasons = useCallback(async () => {
    try {
      const { data, error } = await db.transactions().from('return_reasons').select('*').eq('active', 1).order('reason')
      if (error) { console.error('Failed to load return_reasons:', error.message); return }
      setReturnReasons(data || [])
    } catch (err) {
      console.error('Failed to load return_reasons:', err.message)
    }
  }, [])

  const loadL3 = useCallback(async () => {
    try {
      const { data, error } = await db.inventory().from('category_l3').select('*').order('category')
      if (error) { console.error('Failed to load category_l3:', error.message); return }
      setL3Data(data || [])
    } catch (err) {
      console.error('Failed to load category_l3:', err.message)
    }
  }, [])

  useEffect(() => { loadReturnReasons(); loadL3() }, [loadReturnReasons, loadL3])

  async function addBrand() {
    if (!newBrand.trim()) return
    try {
      const { error } = await db.inventory().from('brands').insert({ name: newBrand.trim() })
      if (error) throw error
      setNewBrand('')
      reloadBrands()
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }
  async function removeBrand(id) {
    try {
      const { error } = await db.inventory().from('brands').delete().eq('id', id)
      if (error) throw error
      reloadBrands()
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }

  async function addColor() {
    if (!newColorName.trim()) return
    try {
      const { error } = await db.inventory().from('colors').insert({ name: newColorName.trim(), hex: newColorHex })
      if (error) throw error
      setNewColorName('')
      reloadColors()
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }
  async function removeColor(id) {
    try {
      const { error } = await db.inventory().from('colors').delete().eq('id', id)
      if (error) throw error
      reloadColors()
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }

  async function addFit() {
    if (!newFit.trim()) return
    try {
      const { error } = await db.inventory().from('fits').insert({ name: newFit.trim() })
      if (error) throw error
      setNewFit('')
      reloadFits()
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }
  async function removeFit(id) {
    try {
      const { error } = await db.inventory().from('fits').delete().eq('id', id)
      if (error) throw error
      reloadFits()
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }

  async function addMaterialType() {
    if (!newMaterialType.trim()) return
    try {
      const { error } = await db.inventory().from('material_types').insert({ name: newMaterialType.trim() })
      if (error) throw error
      setNewMaterialType('')
      reloadMaterialTypes()
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }
  async function removeMaterialType(id) {
    try {
      const { error } = await db.inventory().from('material_types').delete().eq('id', id)
      if (error) throw error
      reloadMaterialTypes()
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }

  async function addBodyType() {
    if (!newBodyType.trim()) return
    try {
      const { error } = await db.inventory().from('body_types').insert({ name: newBodyType.trim() })
      if (error) throw error
      setNewBodyType('')
      reloadBodyTypes()
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }
  async function removeBodyType(id) {
    try {
      const { error } = await db.inventory().from('body_types').delete().eq('id', id)
      if (error) throw error
      reloadBodyTypes()
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }

  async function addReturnReason() {
    if (!newReturnReason.trim()) return
    try {
      const { error } = await db.transactions().from('return_reasons').insert({ reason: newReturnReason.trim() })
      if (error) throw error
      setNewReturnReason('')
      loadReturnReasons()
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }
  async function removeReturnReason(id) {
    try {
      const { error } = await db.transactions().from('return_reasons').delete().eq('id', id)
      if (error) throw error
      loadReturnReasons()
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }

  async function updateGst() {
    if (!editingGst?.gst_rate) return showToast('Rate is required', 'error')
    try {
      const { error } = await db.pricing().from('gst_config')
        .update({ gst_rate: parseFloat(editingGst.gst_rate) })
        .eq('id', editingGst.id)
      if (error) throw error
      setEditingGst(null)
      reloadGst()
      showToast('✅ GST rate updated')
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }

  async function deleteGst(id) {
    if (!window.confirm('Delete this GST category?')) return
    try {
      const { error } = await db.pricing().from('gst_config').delete().eq('id', id)
      if (error) throw error
      reloadGst()
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }

  async function addGst() {
    if (!newGst.tax_category || !newGst.gst_rate) return showToast('Category name and rate required', 'error')
    try {
      const { error } = await db.pricing().from('gst_config').insert({
        tax_category: newGst.tax_category,
        gst_rate: parseFloat(newGst.gst_rate),
        valid_from: newGst.valid_from || new Date().toISOString().split('T')[0],
        valid_to: newGst.valid_to || '12319999',
      })
      if (error) throw error
      setNewGst({ tax_category: '', gst_rate: '', valid_from: '', valid_to: '' })
      reloadGst()
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }

  async function addCategory() {
    if (!newCatName.trim()) return showToast('Category name is required', 'error')
    if (!newCatFirstSub.trim()) return showToast('First sub-category name is required', 'error')
    try {
      const { error } = await db.inventory().from('categories').insert({ category: newCatName.trim(), subcategory: newCatFirstSub.trim() })
      if (error) throw error
      setNewCatName('')
      setNewCatFirstSub('')
      reloadCats()
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }

  async function addSubCategory() {
    if (!newSubCat.trim() || !newSubCatParent) return showToast('Select parent category', 'error')
    try {
      const { error } = await db.inventory().from('categories').insert({ category: newSubCatParent, subcategory: newSubCat.trim() })
      if (error) throw error
      setNewSubCat('')
      reloadCats()
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }

  async function addL3() {
    if (!newL3.category || !newL3.subcategory || !newL3.name) return showToast('Category, Sub-Category and name required', 'error')
    try {
      const { error } = await db.inventory().from('category_l3').insert({
        category: newL3.category,
        subcategory: newL3.subcategory,
        subsubcategory: newL3.name,
        sizes: newL3.sizes,
      })
      if (error) throw error
      setNewL3({ category: '', subcategory: '', name: '', sizes: '' })
      loadL3()
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }

  async function updateL3Sizes(id, sizes) {
    try {
      const { error } = await db.inventory().from('category_l3').update({ sizes }).eq('id', id)
      if (error) throw error
      loadL3()
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }

  async function removeL3(id) {
    if (!confirm('Remove this sub-sub-category?')) return
    try {
      const { error } = await db.inventory().from('category_l3').delete().eq('id', id)
      if (error) throw error
      loadL3()
    } catch (e) { showToast('❌ ' + e.message, 'error') }
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

        {/* Material Types */}
        <div className="config-card">
          <div className="config-title">🧵 Material Types</div>
          <div className="config-sub">Fabric and material types available when adding products.</div>
          <div className="tag-list">
            {materialTypes.map(m => <Tag key={m.id} label={m.name} onRemove={() => removeMaterialType(m.id)} />)}
          </div>
          <div className="add-row">
            <input value={newMaterialType} onChange={e => setNewMaterialType(e.target.value)} placeholder="e.g. Cotton, Polyester, Wool" onKeyDown={e => e.key === 'Enter' && addMaterialType()} />
            <button className="btn btn-primary" onClick={addMaterialType}>Add</button>
          </div>
        </div>

        {/* Body Types */}
        <div className="config-card">
          <div className="config-title">🧍 Body Types</div>
          <div className="config-sub">Body type classifications for products and customers.</div>
          <div className="tag-list">
            {bodyTypes.map(b => <Tag key={b.id} label={b.name} onRemove={() => removeBodyType(b.id)} />)}
          </div>
          <div className="add-row">
            <input value={newBodyType} onChange={e => setNewBodyType(e.target.value)} placeholder="e.g. Tall & Thin" onKeyDown={e => e.key === 'Enter' && addBodyType()} />
            <button className="btn btn-primary" onClick={addBodyType}>Add</button>
          </div>
        </div>

        {/* GST Config */}
        <div className="config-card">
          <div className="config-title">🧾 GST Tax Categories</div>
          <div className="config-sub">Tax category with GST rate. Leave Valid To blank for open-ended.</div>
          <div style={{ marginBottom: 16 }}>
            {gstConfig.map(g => (
              <div key={g.id || g.tax_category} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13, gap: 8 }}>
                {editingGst?.id === g.id ? (
                  <>
                    <span style={{ flex: 1 }}><strong>{g.tax_category}</strong></span>
                    <input
                      type="number" min="0" max="100" step="0.5"
                      value={editingGst.gst_rate}
                      onChange={e => setEditingGst(x => ({ ...x, gst_rate: e.target.value }))}
                      style={{ width: 70, padding: '3px 8px', borderRadius: 6, border: '1.5px solid var(--accent)', fontSize: 13, background: 'var(--card)', color: 'var(--ink)' }}
                      autoFocus
                    />
                    <span style={{ fontSize: 13 }}>%</span>
                    <button className="btn btn-primary" style={{ fontSize: 12, padding: '4px 12px' }} onClick={updateGst}>Save</button>
                    <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setEditingGst(null)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <span style={{ flex: 1 }}><strong>{g.tax_category}</strong> — {g.gst_rate}%</span>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>{g.valid_from} → {g.valid_to === '12319999' ? 'Open' : g.valid_to}</span>
                    <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => setEditingGst({ id: g.id, tax_category: g.tax_category, gst_rate: String(g.gst_rate) })}>Edit</button>
                    <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 10px', color: 'var(--danger)' }} onClick={() => deleteGst(g.id)}>Delete</button>
                  </>
                )}
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
        // Compute next matnr for this row
        const { data: matnrData, error: matnrErr } = await db.inventory().from('mara').select('matnr').order('matnr', { ascending: false }).limit(1)
        if (matnrErr) throw matnrErr
        const maxNum = matnrData?.[0] ? parseInt(matnrData[0].matnr) : 99999
        const newMatnr = String(maxNum + 1).padStart(6, '0')

        const { error } = await db.inventory().from('mara').insert({
          matnr: newMatnr,
          brand: obj.brand,
          brandfamily: obj.brandfamily || null,
          gender: obj.gender || null,
          category: obj.category,
          subcategory: obj.subcategory || null,
          subsubcategory: obj.subsubcategory || null,
          size: obj.size || null,
          fit: obj.fit || null,
          color: obj.color || null,
          tax_category: obj.tax_category || null,
          quantity: 0,
          price: 0,
          cost_price: 0,
          mrp: 0,
        })
        if (error) throw error
        addLog(`Row ${i + 2}: ✅ ${obj.brand} (${newMatnr})`, 'success')
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
  const [tab, setTab] = useState('view')
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="page-layout">
      <Sidebar section="Inventory" activeTab={tab} onTabChange={t => { setTab(t); if (t === 'view') setRefreshKey(k => k + 1) }} />
      <div className="main">
        {tab === 'add' && <AddTab onAdded={() => { setRefreshKey(k => k + 1) }} />}
        {tab === 'view' && <BrowseTab refreshKey={refreshKey} />}
        {tab === 'cats' && <ConfigTab />}
        {tab === 'upload' && <UploadTab />}
      </div>
    </div>
  )
}
