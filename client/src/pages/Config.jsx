import { useState, useEffect, useCallback } from 'react'
import { useToast } from '../components/Toast'
import { db } from '../lib/supabase'
import { uploadToImageKit } from '../lib/imagekit'
import ERPLayout from '../components/ERPLayout'
import ModuleHeader from '../components/ModuleHeader'
import ModuleTabs from '../components/ModuleTabs'

// ─── Shared hooks ─────────────────────────────────────────────────────────────
function useBrands() {
  const [brands, setBrands] = useState([])
  const load = useCallback(async () => {
    try {
      const { data, error } = await db.inventory().from('brands').select('id, name').order('name')
      if (error) { console.error(error.message); return }
      setBrands(data || [])
    } catch (err) { console.error(err.message) }
  }, [])
  useEffect(() => { load() }, [load])
  return [brands, load]
}

function useColors() {
  const [colors, setColors] = useState([])
  const load = useCallback(async () => {
    try {
      const { data, error } = await db.inventory().from('colors').select('id, name, hex').order('name')
      if (error) { console.error(error.message); return }
      setColors(data || [])
    } catch (err) { console.error(err.message) }
  }, [])
  useEffect(() => { load() }, [load])
  return [colors, load]
}

function useFits() {
  const [fits, setFits] = useState([])
  const load = useCallback(async () => {
    try {
      const { data, error } = await db.inventory().from('fits').select('id, name').order('name')
      if (error) { console.error(error.message); return }
      setFits(data || [])
    } catch (err) { console.error(err.message) }
  }, [])
  useEffect(() => { load() }, [load])
  return [fits, load]
}

function useMaterialTypes() {
  const [materialTypes, setMaterialTypes] = useState([])
  const load = useCallback(async () => {
    try {
      const { data, error } = await db.inventory().from('material_types').select('*').order('name')
      if (error) { console.error(error.message); return }
      setMaterialTypes(data || [])
    } catch (err) { console.error(err.message) }
  }, [])
  useEffect(() => { load() }, [load])
  return [materialTypes, load]
}

function useBodyTypes() {
  const [bodyTypes, setBodyTypes] = useState([])
  const load = useCallback(async () => {
    try {
      const { data, error } = await db.inventory().from('body_types').select('*').order('name')
      if (error) { console.error(error.message); return }
      setBodyTypes(data || [])
    } catch (err) { console.error(err.message) }
  }, [])
  useEffect(() => { load() }, [load])
  return [bodyTypes, load]
}

function useGstConfig() {
  const [gstConfig, setGstConfig] = useState([])
  const load = useCallback(async () => {
    try {
      const { data, error } = await db.pricing().from('gst_config').select('*').order('tax_category')
      if (error) { console.error(error.message); return }
      setGstConfig(data || [])
    } catch (err) { console.error(err.message) }
  }, [])
  useEffect(() => { load() }, [load])
  return [gstConfig, load]
}

function useCategoryData() {
  const [catData, setCatData] = useState(null)
  const [categories, setCategories] = useState({})
  const loadAll = useCallback(async () => {
    try {
      const [{ data: catsRaw, error: catsErr }, { data: l3Raw, error: l3Err }] = await Promise.all([
        db.inventory().from('categories').select('*').order('category'),
        db.inventory().from('category_l3').select('*').order('category'),
      ])
      if (catsErr) { console.error(catsErr.message); return }
      if (l3Err)   { console.error(l3Err.message); return }
      const grouped = {}
      ;(catsRaw || []).forEach(row => {
        if (!grouped[row.category]) grouped[row.category] = []
        grouped[row.category].push(row)
      })
      setCategories(grouped)
      setCatData(l3Raw || [])
    } catch (err) { console.error(err.message) }
  }, [])
  useEffect(() => { loadAll() }, [loadAll])
  return { catData, categories, reload: loadAll }
}

// ─── Shared UI ────────────────────────────────────────────────────────────────
function Tag({ label, color, onRemove }) {
  return (
    <div className="tag">
      {color && <div className="tag-dot" style={{ background: color }} />}
      {label}
      <button className="tag-remove" onClick={onRemove}>×</button>
    </div>
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
            <button className="btn btn-ghost"   style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => setEditing(false)}>✕</button>
          </div>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--muted)', cursor: 'pointer' }} onClick={() => setEditing(true)} title="Click to edit">{sizes || '—'}</span>
        )}
      </td>
      <td style={{ padding: '8px 10px' }}>
        <div className="actions">
          <button className="action-btn btn-edit"   onClick={() => setEditing(true)}>Edit Sizes</button>
          <button className="action-btn btn-delete" onClick={() => onRemove(row.id)}>Delete</button>
        </div>
      </td>
    </tr>
  )
}

// ─── Customers tab: Body Types ────────────────────────────────────────────────
function CustomersConfigTab() {
  const showToast = useToast()
  const [bodyTypes, reloadBodyTypes] = useBodyTypes()
  const [newBodyType, setNewBodyType] = useState('')

  async function addBodyType() {
    if (!newBodyType.trim()) return
    try {
      const { error } = await db.inventory().from('body_types').insert({ name: newBodyType.trim() })
      if (error) throw error
      setNewBodyType(''); reloadBodyTypes()
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }

  async function removeBodyType(id) {
    try {
      const { error } = await db.inventory().from('body_types').delete().eq('id', id)
      if (error) throw error
      reloadBodyTypes()
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }

  return (
    <div className="config-grid">
      <div className="config-card">
        <div className="config-title">🧍 Body Types</div>
        <div className="config-sub">Body type classifications used on customers and products.</div>
        <div className="tag-list">
          {bodyTypes.map(b => <Tag key={b.id} label={b.name} onRemove={() => removeBodyType(b.id)} />)}
        </div>
        <div className="add-row">
          <input value={newBodyType} onChange={e => setNewBodyType(e.target.value)} placeholder="e.g. Tall & Thin"
            onKeyDown={e => e.key === 'Enter' && addBodyType()} />
          <button className="btn btn-primary" onClick={addBodyType}>Add</button>
        </div>
      </div>
    </div>
  )
}

// ─── Buyers tab: placeholder ───────────────────────────────────────────────────
function BuyersConfigTab() {
  return (
    <div className="config-grid">
      <div className="config-card" style={{ gridColumn: '1 / -1' }}>
        <div className="config-title">🏢 Buyer Configuration</div>
        <div className="config-sub">No buyer-specific configuration available yet.</div>
      </div>
    </div>
  )
}

// ─── Products tab: Brands, Colors, Fits, Material Types, GST, Categories ──────
function ProductsConfigTab({ setWishlistAlert }) {
  const showToast = useToast()
  const [brands, reloadBrands]               = useBrands()
  const [colors, reloadColors]               = useColors()
  const [fits, reloadFits]                   = useFits()
  const [materialTypes, reloadMaterialTypes] = useMaterialTypes()
  const [gstConfig, reloadGst]               = useGstConfig()
  const { catData, categories, reload: reloadCats } = useCategoryData()
  const [l3Data, setL3Data] = useState([])

  const [newBrand,        setNewBrand]        = useState('')
  const [newMaterialType, setNewMaterialType] = useState('')
  const [newColorName,    setNewColorName]    = useState('')
  const [newColorHex,     setNewColorHex]     = useState('#808000')
  const [newFit,          setNewFit]          = useState('')
  const [newGst,          setNewGst]          = useState({ tax_category: '', gst_rate: '', valid_from: '', valid_to: '' })
  const [editingGst,      setEditingGst]      = useState(null)
  const [newCatName,      setNewCatName]      = useState('')
  const [newCatFirstSub,  setNewCatFirstSub]  = useState('')
  const [newSubCat,       setNewSubCat]       = useState('')
  const [newSubCatParent, setNewSubCatParent] = useState('')
  const [newL3,           setNewL3]           = useState({ category: '', subcategory: '', name: '', sizes: '' })

  const loadL3 = useCallback(async () => {
    try {
      const { data, error } = await db.inventory().from('category_l3').select('*').order('category')
      if (error) { console.error(error.message); return }
      setL3Data(data || [])
    } catch (err) { console.error(err.message) }
  }, [])

  useEffect(() => { loadL3() }, [loadL3])

  // Brands
  async function addBrand() {
    if (!newBrand.trim()) return
    const brandName = newBrand.trim()
    try {
      const { error } = await db.inventory().from('brands').insert({ name: brandName })
      if (error) throw error
      setNewBrand(''); reloadBrands()
      showToast(`✅ Brand "${brandName}" added`)

      // Check wishlist for unlinked items that mention this brand
      const { data: matches } = await db.customers().from('wishlist')
        .select('id, product_name, size, customer_name, number, status')
        .is('sku_id', null)
        .ilike('product_name', `%${brandName}%`)
        .neq('status', 'fulfilled')
      if (matches && matches.length > 0) {
        setWishlistAlert({ brandName, matches })
      }
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }
  async function removeBrand(id) {
    try {
      const { error } = await db.inventory().from('brands').delete().eq('id', id)
      if (error) throw error
      reloadBrands()
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }

  // Colors
  async function addColor() {
    if (!newColorName.trim()) return
    try {
      const { error } = await db.inventory().from('colors').insert({ name: newColorName.trim(), hex: newColorHex })
      if (error) throw error
      setNewColorName(''); reloadColors()
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }
  async function removeColor(id) {
    try {
      const { error } = await db.inventory().from('colors').delete().eq('id', id)
      if (error) throw error
      reloadColors()
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }

  // Fits
  async function addFit() {
    if (!newFit.trim()) return
    try {
      const { error } = await db.inventory().from('fits').insert({ name: newFit.trim() })
      if (error) throw error
      setNewFit(''); reloadFits()
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }
  async function removeFit(id) {
    try {
      const { error } = await db.inventory().from('fits').delete().eq('id', id)
      if (error) throw error
      reloadFits()
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }

  // Material Types
  async function addMaterialType() {
    if (!newMaterialType.trim()) return
    try {
      const { error } = await db.inventory().from('material_types').insert({ name: newMaterialType.trim() })
      if (error) throw error
      setNewMaterialType(''); reloadMaterialTypes()
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }
  async function removeMaterialType(id) {
    try {
      const { error } = await db.inventory().from('material_types').delete().eq('id', id)
      if (error) throw error
      reloadMaterialTypes()
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }

  // GST
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
      setNewGst({ tax_category: '', gst_rate: '', valid_from: '', valid_to: '' }); reloadGst()
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }
  async function updateGst() {
    if (!editingGst?.gst_rate) return showToast('Rate is required', 'error')
    try {
      const { error } = await db.pricing().from('gst_config').update({ gst_rate: parseFloat(editingGst.gst_rate) }).eq('id', editingGst.id)
      if (error) throw error
      setEditingGst(null); reloadGst(); showToast('✅ GST rate updated')
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

  // Categories
  async function addCategory() {
    if (!newCatName.trim()) return showToast('Category name is required', 'error')
    if (!newCatFirstSub.trim()) return showToast('First sub-category name is required', 'error')
    try {
      const { error } = await db.inventory().from('categories').insert({ category: newCatName.trim(), subcategory: newCatFirstSub.trim() })
      if (error) throw error
      setNewCatName(''); setNewCatFirstSub(''); reloadCats()
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }
  async function addSubCategory() {
    if (!newSubCat.trim() || !newSubCatParent) return showToast('Select parent category', 'error')
    try {
      const { error } = await db.inventory().from('categories').insert({ category: newSubCatParent, subcategory: newSubCat.trim() })
      if (error) throw error
      setNewSubCat(''); reloadCats()
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }
  async function deleteSubCategory(parentCat, subCatName) {
    if (!window.confirm(`Delete sub-category "${subCatName}" from "${parentCat}"?\n\nThis will:\n• Remove all L3 entries for this sub-category\n• Set subcategory to "Generic" on any products using it`)) return
    try {
      const [{ error: e1 }, { error: e2 }, { error: e3 }] = await Promise.all([
        db.inventory().from('categories').delete().eq('category', parentCat).eq('subcategory', subCatName),
        db.inventory().from('category_l3').delete().eq('category', parentCat).eq('subcategory', subCatName),
        db.inventory().from('mara').update({ subcategory: 'Generic' }).eq('category', parentCat).eq('subcategory', subCatName),
      ])
      if (e1) throw e1
      if (e2) throw e2
      if (e3) throw e3
      reloadCats(); loadL3()
      showToast('✅ Sub-category deleted, products updated to "Generic"')
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }
  async function addL3() {
    if (!newL3.category || !newL3.subcategory || !newL3.name) return showToast('Category, Sub-Category and name required', 'error')
    try {
      const { error } = await db.inventory().from('category_l3').insert({
        category: newL3.category, subcategory: newL3.subcategory,
        subsubcategory: newL3.name, sizes: newL3.sizes,
      })
      if (error) throw error
      setNewL3({ category: '', subcategory: '', name: '', sizes: '' }); loadL3()
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
    if (!window.confirm('Remove this sub-sub-category?')) return
    try {
      const { error } = await db.inventory().from('category_l3').delete().eq('id', id)
      if (error) throw error
      loadL3()
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }

  const l3SubsForForm = newL3.category && categories[newL3.category] ? categories[newL3.category] : []

  return (
    <>
      <div className="config-grid">
        {/* Brands */}
        <div className="config-card">
          <div className="config-title">🏷️ Brands</div>
          <div className="config-sub">Add or remove brands used in inventory.</div>
          <div className="tag-list">
            {brands.map(b => <Tag key={b.id} label={b.name} onRemove={() => removeBrand(b.id)} />)}
          </div>
          <div className="add-row">
            <input value={newBrand} onChange={e => setNewBrand(e.target.value)} placeholder="e.g. Calvin Klein"
              onKeyDown={e => e.key === 'Enter' && addBrand()} />
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
              <input value={newColorName} onChange={e => setNewColorName(e.target.value)} placeholder="e.g. Olive Green"
                onKeyDown={e => e.key === 'Enter' && addColor()} />
              <input type="color" value={newColorHex} onChange={e => setNewColorHex(e.target.value)}
                style={{ width: 40, height: 38, padding: 2, borderRadius: 6, cursor: 'pointer', border: '1.5px solid var(--border)' }} />
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
            <input value={newFit} onChange={e => setNewFit(e.target.value)} placeholder="e.g. Athletic Fit"
              onKeyDown={e => e.key === 'Enter' && addFit()} />
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
            <input value={newMaterialType} onChange={e => setNewMaterialType(e.target.value)} placeholder="e.g. Cotton, Polyester, Wool"
              onKeyDown={e => e.key === 'Enter' && addMaterialType()} />
            <button className="btn btn-primary" onClick={addMaterialType}>Add</button>
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
                    <input type="number" min="0" max="100" step="0.5" value={editingGst.gst_rate}
                      onChange={e => setEditingGst(x => ({ ...x, gst_rate: e.target.value }))}
                      style={{ width: 70, padding: '3px 8px', borderRadius: 6, border: '1.5px solid var(--accent)', fontSize: 13, background: 'var(--card)', color: 'var(--ink)' }} autoFocus />
                    <span style={{ fontSize: 13 }}>%</span>
                    <button className="btn btn-primary" style={{ fontSize: 12, padding: '4px 12px' }} onClick={updateGst}>Save</button>
                    <button className="btn btn-ghost"   style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setEditingGst(null)}>Cancel</button>
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

        {/* Category Tree */}
        <div className="config-card">
          <div className="config-title">📁 Category Tree</div>
          <div className="config-sub">Top-level categories and sub-categories.</div>
          <div style={{ maxHeight: 260, overflowY: 'auto', marginBottom: 16 }}>
            {Object.entries(categories).map(([cat, subs]) => (
              <div key={cat} style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{cat}</div>
                <div style={{ paddingLeft: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(subs || []).length === 0 ? (
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>(no sub-categories)</span>
                  ) : (subs || []).map(s => (
                    <span key={s.id} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      background: 'var(--bg)', border: '1px solid var(--border)',
                      borderRadius: 20, padding: '2px 8px 2px 10px', fontSize: 12,
                    }}>
                      {s.subcategory}
                      <button
                        onClick={() => deleteSubCategory(cat, s.subcategory)}
                        title={`Delete "${s.subcategory}"`}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 14, lineHeight: 1, padding: '0 0 0 2px' }}
                      >×</button>
                    </span>
                  ))}
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
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 8 }}>New Top-Level Category</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Category name (e.g. Footwear)" style={{ flex: 1, minWidth: 140 }} />
              <input value={newCatFirstSub} onChange={e => setNewCatFirstSub(e.target.value)} placeholder="First sub-category (required)" style={{ flex: 1, minWidth: 160 }}
                onKeyDown={e => e.key === 'Enter' && addCategory()} />
              <button className="btn btn-ghost" style={{ padding: '8px 12px', fontSize: 13, whiteSpace: 'nowrap' }} onClick={addCategory}>+ Add Category</button>
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

// ─── Return Reasons (shared between Sales and Purchasing) ─────────────────────
function ReturnReasonsSection() {
  const showToast = useToast()
  const [returnReasons, setReturnReasons] = useState([])
  const [newReturnReason, setNewReturnReason] = useState('')

  const load = useCallback(async () => {
    try {
      const { data, error } = await db.transactions().from('return_reasons').select('*').eq('active', 1).order('reason')
      if (error) { console.error(error.message); return }
      setReturnReasons(data || [])
    } catch (err) { console.error(err.message) }
  }, [])

  useEffect(() => { load() }, [load])

  async function add() {
    if (!newReturnReason.trim()) return
    try {
      const { error } = await db.transactions().from('return_reasons').insert({ reason: newReturnReason.trim() })
      if (error) throw error
      setNewReturnReason(''); load()
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }

  async function remove(id) {
    try {
      const { error } = await db.transactions().from('return_reasons').delete().eq('id', id)
      if (error) throw error
      load()
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }

  return (
    <div className="config-grid">
      <div className="config-card">
        <div className="config-title">↩️ Return Reasons</div>
        <div className="config-sub">Reasons available when creating a return order.</div>
        <div className="tag-list">
          {returnReasons.map(r => <Tag key={r.id} label={r.reason} onRemove={() => remove(r.id)} />)}
        </div>
        <div className="add-row">
          <input value={newReturnReason} onChange={e => setNewReturnReason(e.target.value)} placeholder="e.g. Exchange Request"
            onKeyDown={e => e.key === 'Enter' && add()} />
          <button className="btn btn-primary" onClick={add}>Add</button>
        </div>
      </div>
    </div>
  )
}

function SalesConfigTab()      { return <ReturnReasonsSection /> }
function PurchasingConfigTab() { return <ReturnReasonsSection /> }

// ─── Page ─────────────────────────────────────────────────────────────────────
const CONFIG_TABS = [
  { id: 'customers',  label: 'Customers' },
  { id: 'buyers',     label: 'Buyers' },
  { id: 'products',   label: 'Products' },
  { id: 'sales',      label: 'Sales' },
  { id: 'purchasing', label: 'Purchasing' },
]

const TAB_LABELS = {
  customers: 'Customers', buyers: 'Buyers', products: 'Products',
  sales: 'Sales', purchasing: 'Purchasing',
}

export default function Config() {
  const showToast = useToast()
  const [tab, setTab] = useState('products')
  const [wishlistAlert, setWishlistAlert] = useState(null)

  const [unmigratedCount,  setUnmigratedCount]  = useState(null)
  const [migrating,        setMigrating]        = useState(false)
  const [migrateProgress,  setMigrateProgress]  = useState(0)
  const [migrateTotal,     setMigrateTotal]     = useState(0)
  const [migrateError,     setMigrateError]     = useState(null)

  async function loadUnmigratedCount() {
    try {
      // Products with image_url or image_data that haven't been migrated to product_images yet
      const { data: migrated, error: mErr } = await db.inventory()
        .from('product_images').select('sku_id').limit(5000)
      if (mErr) throw mErr
      const migratedIds = new Set((migrated || []).map(r => r.sku_id))

      const { data: prods, error: pErr } = await db.inventory().from('products')
        .select('sku_id, image_url, image_data')
        .or('image_url.neq.null,image_data.neq.null')
      if (pErr) throw pErr

      const count = (prods || []).filter(p => !migratedIds.has(p.sku_id)).length
      setUnmigratedCount(count)
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }

  async function runMigration() {
    setMigrating(true); setMigrateError(null); setMigrateProgress(0)
    try {
      // Find already-migrated sku_ids
      const { data: migrated, error: mErr } = await db.inventory()
        .from('product_images').select('sku_id').limit(5000)
      if (mErr) throw mErr
      const migratedIds = new Set((migrated || []).map(r => r.sku_id))

      // Find products with image_url or image_data not yet migrated
      const { data: prods, error: pErr } = await db.inventory().from('products')
        .select('sku_id, image_url, image_data')
        .or('image_url.neq.null,image_data.neq.null')
      if (pErr) throw pErr

      const items = (prods || []).filter(p => !migratedIds.has(p.sku_id))
      setMigrateTotal(items.length)

      for (let i = 0; i < items.length; i++) {
        const { sku_id, image_url, image_data } = items[i]
        try {
          let url = image_url
          // If only base64, upload to Cloudinary first
          if (!url && image_data) {
            url = await uploadToImageKit(image_data, `sku_${sku_id}.jpg`, 'products')
          }
          // Insert into product_images
          const { error: insErr } = await db.inventory().from('product_images')
            .insert({ sku_id, url, position: 0 })
          if (insErr) throw insErr
          // Null out old columns
          const { error: upErr } = await db.inventory().from('products')
            .update({ image_url: null, image_data: null })
            .eq('sku_id', sku_id)
          if (upErr) throw upErr
        } catch (itemErr) {
          setMigrateError(`Failed on SKU ${sku_id}: ${itemErr.message}`)
          return
        }
        setMigrateProgress(i + 1)
      }

      showToast(`✅ ${items.length} photo${items.length !== 1 ? 's' : ''} migrated`)
    } catch (e) { setMigrateError(e.message); showToast('❌ ' + e.message, 'error') }
    finally { setMigrating(false); loadUnmigratedCount() }
  }

  useEffect(() => { loadUnmigratedCount() }, [])

  return (
    <ERPLayout>
      <ModuleHeader moduleLabel="CONFIG" breadcrumb={TAB_LABELS[tab]} />
      <ModuleTabs tabs={CONFIG_TABS} activeTab={tab} onChange={setTab} />
      <div className="erp-content">
        {tab === 'customers'  && <CustomersConfigTab />}
        {tab === 'buyers'     && <BuyersConfigTab />}
        {tab === 'products'   && <ProductsConfigTab setWishlistAlert={setWishlistAlert} />}
        {tab === 'sales'      && <SalesConfigTab />}
        {tab === 'purchasing' && <PurchasingConfigTab />}
      </div>

      {/* Wishlist match alert */}
      {wishlistAlert && (
        <div className="modal-backdrop" onClick={() => setWishlistAlert(null)}>
          <div className="modal" style={{ maxWidth: 520, width: '95vw' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title">Wishlist Items Found</div>
                <div className="modal-sub" style={{ marginTop: 2 }}>
                  {wishlistAlert.matches.length} open wishlist item{wishlistAlert.matches.length !== 1 ? 's' : ''} mention "{wishlistAlert.brandName}"
                </div>
              </div>
              <button className="modal-close" onClick={() => setWishlistAlert(null)}>×</button>
            </div>

            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
              Now that <strong style={{ color: 'var(--text)' }}>{wishlistAlert.brandName}</strong> is in your inventory,
              consider updating these wishlist entries to link them to the correct SKU.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {wishlistAlert.matches.map(m => (
                <div key={m.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '10px 14px', fontSize: 13,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{m.product_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                      {[m.size, m.customer_name, m.number].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, textTransform: 'capitalize', padding: '2px 8px',
                    borderRadius: 20, background: 'rgba(224,168,32,0.12)', color: '#e0a820',
                    border: '1px solid rgba(224,168,32,0.3)', flexShrink: 0,
                  }}>{m.status}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setWishlistAlert(null)}>Dismiss</button>
              <a href="/wishlist" className="btn btn-primary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                onClick={() => setWishlistAlert(null)}>
                Go to Wishlist →
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── ImageKit Photo Migration ──────────────────────────────────── */}
      <div className="card" style={{ marginTop: 32 }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>
          Product Photos
        </div>
        <div className="config-sub" style={{ marginBottom: 16 }}>
          Migrate product photos from database storage to ImageKit CDN for faster loading.
        </div>

        {unmigratedCount === null ? (
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>Checking…</div>
        ) : unmigratedCount === 0 && !migrating ? (
          <div style={{ fontSize: 13, color: 'var(--success)' }}>✅ All photos are on ImageKit</div>
        ) : (
          <div>
            {!migrating && (
              <div style={{ fontSize: 13, marginBottom: 12 }}>
                <strong>{unmigratedCount}</strong> photo{unmigratedCount !== 1 ? 's' : ''} still stored in database
              </div>
            )}
            {migrating && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, marginBottom: 6 }}>
                  Migrating {migrateProgress} / {migrateTotal}…
                </div>
                <div style={{ height: 6, background: 'var(--bg)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 3,
                    background: 'var(--accent)',
                    width: migrateTotal > 0 ? `${Math.round(migrateProgress / migrateTotal * 100)}%` : '0%',
                    transition: 'width 0.3s',
                  }} />
                </div>
              </div>
            )}
            {migrateError && (
              <div style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>
                ❌ {migrateError}
              </div>
            )}
            <button
              className="btn btn-primary"
              onClick={runMigration}
              disabled={migrating || unmigratedCount === 0}
              style={{ fontSize: 13 }}
            >
              {migrating ? `Migrating ${migrateProgress}/${migrateTotal}…` : `Migrate ${unmigratedCount} Photo${unmigratedCount !== 1 ? 's' : ''} →`}
            </button>
          </div>
        )}
      </div>
    </ERPLayout>
  )
}
