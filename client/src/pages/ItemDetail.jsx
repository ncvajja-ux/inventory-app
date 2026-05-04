import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useToast } from '../components/Toast'
import { db } from '../lib/supabase'
import ERPLayout from '../components/ERPLayout'
import ModuleHeader from '../components/ModuleHeader'
import ModuleTabs from '../components/ModuleTabs'
import StatsStrip from '../components/StatsStrip'

const fmt     = n => '₹' + parseFloat(n || 0).toFixed(2)
const fmtK    = n => {
  const v = parseFloat(n || 0)
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`
  if (v >= 1000)   return `₹${(v / 1000).toFixed(1)}K`
  return fmt(v)
}
const fmtDate = s => s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const dash    = v => v || '—'

// ─── Image card (unchanged) ───────────────────────────────────────────────────
function ImageCard({ skuId, initialImage }) {
  const showToast = useToast()
  const fileRef = useRef(null)
  const [imageData, setImageData] = useState(initialImage || null)
  const [pending,   setPending]   = useState(null)
  const [saving,    setSaving]    = useState(false)

  function onFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return showToast('Select an image file', 'error')
    if (file.size > 20 * 1024 * 1024) return showToast('Image must be under 20 MB', 'error')
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const MAX = 900
      let { width, height } = img
      if (width > MAX)  { height = Math.round(height * MAX / width);  width  = MAX }
      if (height > MAX) { width  = Math.round(width  * MAX / height); height = MAX }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      setPending(canvas.toDataURL('image/jpeg', 0.82))
    }
    img.src = objectUrl
    e.target.value = ''
  }

  async function saveImage() {
    if (!pending) return
    setSaving(true)
    try {
      const { error } = await db.inventory().from('products').update({ image_data: pending }).eq('sku_id', skuId)
      if (error) throw error
      setImageData(pending); setPending(null); showToast('✅ Image saved')
    } catch (err) { showToast(`❌ ${err.message}`, 'error') }
    finally { setSaving(false) }
  }

  async function removeImage() {
    if (!window.confirm('Remove this photo?')) return
    try {
      const { error } = await db.inventory().from('products').update({ image_data: null }).eq('sku_id', skuId)
      if (error) throw error
      setImageData(null); setPending(null)
    } catch (err) { showToast(`❌ ${err.message}`, 'error') }
  }

  const display = pending || imageData
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 12 }}>Product Photo</div>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFileChange} />
      {display ? (
        <div>
          <img src={display} alt="Product" style={{ maxWidth: 260, borderRadius: 10, display: 'block', marginBottom: 12 }} />
          {pending && <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>Preview — unsaved</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            {pending  && <button className="btn btn-primary" onClick={saveImage} disabled={saving} style={{ fontSize: 13 }}>Save Photo</button>}
            {pending  && <button className="btn btn-ghost"   onClick={() => setPending(null)}           style={{ fontSize: 13 }}>Discard</button>}
            {!pending && <button className="btn btn-ghost"   onClick={() => fileRef.current?.click()}   style={{ fontSize: 13 }}>Change Photo</button>}
            {!pending && <button onClick={removeImage} style={{ fontSize: 11, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>}
          </div>
        </div>
      ) : (
        <div>
          <div style={{ width: 200, height: 200, background: 'var(--bg)', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ fontSize: 36, opacity: 0.3 }}>👕</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>No photo</div>
          </div>
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()} style={{ fontSize: 12 }}>Upload Photo</button>
        </div>
      )}
    </div>
  )
}

// ─── Overview tab ─────────────────────────────────────────────────────────────
function OverviewTab({ product, variants, skuId, onReload }) {
  const showToast = useToast()
  const [validSizes,   setValidSizes]   = useState([])
  const [addForm,      setAddForm]      = useState(null)   // { size, qty } | null
  const [editingMatnr, setEditingMatnr] = useState(null)  // matnr being edited
  const [editQty,      setEditQty]      = useState('')

  // Load valid sizes from category_l3 for this product's category path
  useEffect(() => {
    if (!product.category || !product.subcategory || !product.subsubcategory) {
      setValidSizes([])
      return
    }
    db.inventory().from('category_l3')
      .select('sizes')
      .eq('category',       product.category)
      .eq('subcategory',    product.subcategory)
      .eq('subsubcategory', product.subsubcategory)
      .single()
      .then(({ data }) => {
        if (data?.sizes) {
          setValidSizes(data.sizes.split(',').map(s => s.trim()).filter(Boolean))
        } else {
          setValidSizes([])
        }
      })
      .catch(() => setValidSizes([]))
  }, [product.category, product.subcategory, product.subsubcategory])

  async function addVariant() {
    if (!addForm?.size?.trim()) return showToast('Size is required', 'error')
    if (variants.find(v => v.size === addForm.size.trim())) return showToast('Size already exists', 'error')
    try {
      const { data: latest } = await db.inventory().from('mara')
        .select('matnr').order('matnr', { ascending: false }).limit(1)
      const maxNum = latest?.[0]?.matnr ? parseInt(latest[0].matnr, 10) : 99999
      const matnr = String(maxNum + 1).padStart(6, '0')
      const { error } = await db.inventory().from('mara').insert({
        matnr,
        sku_id: parseInt(skuId, 10),
        size: addForm.size.trim(),
        quantity: parseInt(addForm.qty) || 0,
      })
      if (error) throw error
      showToast(`✅ Size ${addForm.size} added`)
      setAddForm(null)
      onReload()
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }

  async function saveEditQty(matnr) {
    try {
      const { error } = await db.inventory().from('mara')
        .update({ quantity: parseInt(editQty) || 0 })
        .eq('matnr', matnr)
      if (error) throw error
      showToast('✅ Quantity updated')
      setEditingMatnr(null)
      onReload()
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }

  async function deleteVariant(matnr, size) {
    if (!window.confirm(`Delete size "${size || matnr}"?`)) return
    try {
      const { error } = await db.inventory().from('mara').delete().eq('matnr', matnr)
      if (error) throw error
      showToast(`✅ Size ${size} deleted`)
      onReload()
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }

  const fields = [
    ['SKU Code',        product.sku_code],
    ['Brand',           product.brand],
    ['Brand Family',    product.brandfamily],
    ['Gender',          product.gender],
    ['Category',        product.category],
    ['Sub-Category',    product.subcategory],
    ['Sub-Sub-Category',product.subsubcategory],
    ['Color',           product.color],
    ['Fit',             product.fit],
    ['Body Type',       product.body_type],
    ['Material',        product.material_type],
    ['GST Category',    product.tax_category],
    ['MRP',             product.mrp       ? fmt(product.mrp)        : null],
    ['Cost Price',      product.cost_price ? fmt(product.cost_price) : null],
  ].filter(([, v]) => v)

  const availableSizesToAdd = validSizes.filter(s => !variants.find(v => v.size === s))

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, alignItems: 'start' }}>
        <ImageCard skuId={parseInt(skuId)} initialImage={product.image_data} />
        <div className="card">
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 16 }}>Product Attributes</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {fields.map(([label, value]) => (
              <div key={label}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.06em', marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 14 }}>{dash(value)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Size variants — full CRUD */}
      <div className="card" style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>Size Variants</div>
          {!addForm && (
            <button className="btn btn-primary" style={{ fontSize: 12, padding: '5px 14px' }}
              onClick={() => setAddForm({ size: '', qty: '0' })}>+ Add Size</button>
          )}
        </div>

        {/* Add size form */}
        {addForm && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', padding: '12px 14px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
            {validSizes.length > 0 ? (
              <select
                value={addForm.size}
                onChange={e => setAddForm(f => ({ ...f, size: e.target.value }))}
                style={{ padding: '7px 10px', borderRadius: 6, border: '1.5px solid var(--border)', background: 'var(--card)', color: 'var(--ink)', fontSize: 13, minWidth: 100 }}
              >
                <option value="">Select size…</option>
                {availableSizesToAdd.map(s => <option key={s}>{s}</option>)}
              </select>
            ) : (
              <input
                value={addForm.size}
                onChange={e => setAddForm(f => ({ ...f, size: e.target.value }))}
                placeholder="Size (e.g. M, 32)"
                style={{ padding: '7px 10px', borderRadius: 6, border: '1.5px solid var(--border)', background: 'var(--card)', color: 'var(--ink)', fontSize: 13, width: 120 }}
              />
            )}
            <input
              type="number" min="0"
              value={addForm.qty}
              onChange={e => setAddForm(f => ({ ...f, qty: e.target.value }))}
              placeholder="Qty"
              style={{ padding: '7px 10px', borderRadius: 6, border: '1.5px solid var(--border)', background: 'var(--card)', color: 'var(--ink)', fontSize: 13, width: 80 }}
            />
            <button className="btn btn-primary" style={{ fontSize: 12, padding: '7px 14px' }} onClick={addVariant}>Save</button>
            <button className="btn btn-ghost"   style={{ fontSize: 12, padding: '7px 10px' }} onClick={() => setAddForm(null)}>Cancel</button>
          </div>
        )}

        {variants.length === 0 && !addForm ? (
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>No size variants yet. Click "+ Add Size" to add one.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase' }}>
                <th style={{ padding: '6px 8px', textAlign: 'left' }}>MATNR</th>
                <th style={{ padding: '6px 8px', textAlign: 'left' }}>Size</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Stock</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Reserved</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Available</th>
                <th style={{ padding: '6px 8px' }}></th>
              </tr>
            </thead>
            <tbody>
              {variants.map(v => (
                <tr key={v.matnr} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 8px', fontFamily: 'monospace', fontSize: 12 }}>{v.matnr}</td>
                  <td style={{ padding: '10px 8px', fontWeight: 600 }}>{v.size || '—'}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                    {editingMatnr === v.matnr ? (
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                        <input type="number" min="0" value={editQty}
                          onChange={e => setEditQty(e.target.value)}
                          style={{ width: 70, padding: '3px 6px', borderRadius: 5, border: '1.5px solid var(--accent)', textAlign: 'right', fontSize: 13, background: 'var(--card)', color: 'var(--ink)' }}
                          autoFocus onKeyDown={e => { if (e.key === 'Enter') saveEditQty(v.matnr); if (e.key === 'Escape') setEditingMatnr(null) }}
                        />
                        <button className="btn btn-primary" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => saveEditQty(v.matnr)}>✓</button>
                        <button className="btn btn-ghost"   style={{ fontSize: 11, padding: '3px 8px'  }} onClick={() => setEditingMatnr(null)}>✕</button>
                      </div>
                    ) : (
                      <span
                        style={{ cursor: 'pointer', color: (v.quantity || 0) === 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}
                        title="Click to edit quantity"
                        onClick={() => { setEditingMatnr(v.matnr); setEditQty(String(v.quantity || 0)) }}
                      >
                        {v.quantity || 0}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--muted)' }}>{v.reserved || 0}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right' }}>{(v.quantity || 0) - (v.reserved || 0)}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                    <button className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px', color: 'var(--danger)' }}
                      onClick={() => deleteVariant(v.matnr, v.size)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

// ─── Order History tab ────────────────────────────────────────────────────────
function OrderHistoryTab({ variants }) {
  const [orders,  setOrders]  = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const matnrList = variants.map(v => v.matnr)
    if (!matnrList.length) { setLoading(false); return }
    setLoading(true)
    try {
      // Fetch all vbap lines for this product's MATNRs
      const { data: lines, error } = await db.transactions()
        .from('vbap')
        .select('order_id, matnr, quantity, line_total, discount_pct, vbak(order_id, order_type, status, payment_status, created_at, kunnr)')
        .in('matnr', matnrList)
      if (error) throw error

      // Group lines by order_id
      const orderMap = {}
      for (const line of (lines || [])) {
        const hdr  = line.vbak || {}
        const oid  = line.order_id
        if (!orderMap[oid]) {
          orderMap[oid] = {
            order_id:       oid,
            order_type:     hdr.order_type,
            status:         hdr.status,
            payment_status: hdr.payment_status,
            created_at:     hdr.created_at,
            kunnr:          hdr.kunnr,
            customer_name:  null,
            lines:          [],
            total:          0,
          }
        }
        orderMap[oid].lines.push(line)
        orderMap[oid].total += parseFloat(line.line_total || 0)
      }

      // Fetch customer names for unique kunnrs
      const kunnrs = [...new Set(Object.values(orderMap).map(o => o.kunnr).filter(Boolean))]
      if (kunnrs.length) {
        const { data: custs } = await db.customers().from('kna1').select('kunnr, name').in('kunnr', kunnrs)
        const custMap = Object.fromEntries((custs || []).map(c => [c.kunnr, c.name]))
        for (const o of Object.values(orderMap)) {
          o.customer_name = custMap[o.kunnr] || null
        }
      }

      // Sort by date desc
      const sorted = Object.values(orderMap).sort((a, b) =>
        new Date(b.created_at || 0) - new Date(a.created_at || 0)
      )
      setOrders(sorted)
    } catch { /* non-fatal */ }
    finally { setLoading(false) }
  }, [variants])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="erp-table-empty">Loading orders…</div>
  if (!orders.length) return (
    <div className="erp-table-empty" style={{ padding: '48px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>🛒</div>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>No orders yet</div>
      <div style={{ fontSize: 13, color: 'var(--muted)' }}>This product hasn't been ordered yet.</div>
    </div>
  )

  return (
    <div>
      <div className="erp-table-wrap">
        {/* Header */}
        <div className="erp-table-header" style={{ gridTemplateColumns: '1.2fr 1.6fr 0.9fr 2fr 0.7fr 0.9fr 0.9fr' }}>
          {['Order ID', 'Customer', 'Date', 'Sizes', 'Qty', 'Value', 'Status'].map(h => (
            <div key={h} className="erp-th">{h}</div>
          ))}
        </div>

        {/* Rows */}
        {orders.map((o, i) => {
          const isReturn = o.order_type === 'R'
          const sizes = o.lines.map(l => {
            const v = variants.find(v => v.matnr === l.matnr)
            return v?.size ? `${v.size}×${l.quantity}` : `${l.matnr}×${l.quantity}`
          }).join(', ')
          const totalQty = o.lines.reduce((s, l) => s + (l.quantity || 0), 0)

          return (
            <div
              key={o.order_id}
              className={`erp-table-row${i % 2 === 1 ? ' alt' : ''}`}
              style={{ gridTemplateColumns: '1.2fr 1.6fr 0.9fr 2fr 0.7fr 0.9fr 0.9fr' }}
            >
              {/* Order ID */}
              <div className="erp-td">
                <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--accent)' }}>{o.order_id}</span>
              </div>

              {/* Customer */}
              <div className="erp-td">
                <div style={{ fontWeight: 600, fontSize: 13 }}>{o.customer_name || o.kunnr || '—'}</div>
                {o.customer_name && <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>{o.kunnr}</div>}
              </div>

              {/* Date */}
              <div className="erp-td" style={{ fontSize: 12, color: 'var(--muted)' }}>
                {fmtDate(o.created_at)}
              </div>

              {/* Sizes */}
              <div className="erp-td" style={{ fontSize: 12, color: 'var(--muted)' }}>
                {sizes || '—'}
              </div>

              {/* Qty */}
              <div className="erp-td" style={{ fontWeight: 600 }}>
                {totalQty}
              </div>

              {/* Value */}
              <div className="erp-td" style={{ fontWeight: 600, color: isReturn ? 'var(--danger)' : 'var(--success)' }}>
                {isReturn ? '−' : ''}{fmt(o.total)}
              </div>

              {/* Status */}
              <div className="erp-td">
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                  background: isReturn
                    ? 'rgba(239,68,68,0.12)'
                    : o.status === 'CONFIRMED' || o.status === 'confirmed'
                    ? 'rgba(34,197,94,0.12)'
                    : 'rgba(234,179,8,0.12)',
                  color: isReturn
                    ? 'var(--danger)'
                    : o.status === 'CONFIRMED' || o.status === 'confirmed'
                    ? 'var(--success)'
                    : 'var(--warning, #b45309)',
                }}>
                  {isReturn ? 'Return' : (o.status || 'Sale')}
                </span>
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--muted)' }}>
        {orders.length} order{orders.length !== 1 ? 's' : ''} · {orders.filter(o => o.order_type !== 'R').length} sales · {orders.filter(o => o.order_type === 'R').length} returns
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'orders',   label: 'Order History' },
]

export default function ItemDetail() {
  const { skuId } = useParams()
  const navigate  = useNavigate()
  const showToast = useToast()

  const [tab,       setTab]       = useState('overview')
  const [product,   setProduct]   = useState(null)
  const [variants,  setVariants]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [stats,     setStats]     = useState({ orders: '—', revenue: '—', pending: '—', returns: '—', discount: '—' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await db.inventory().from('products')
        .select('*, mara(matnr, size, quantity, reserved)')
        .eq('sku_id', parseInt(skuId, 10))
        .single()
      if (error) throw error
      setProduct(data)
      const mara = data.mara || []
      setVariants(mara)
      loadStats(mara)
    } catch (err) { setLoadError(err.message); showToast(err.message, 'error') }
    finally { setLoading(false) }
  }, [skuId, showToast])

  async function loadStats(mara) {
    const matnrList = (mara || []).map(v => v.matnr)
    if (!matnrList.length) return

    try {
      const today = new Date().toISOString().split('T')[0]
      const [{ data: lines }, { data: pdRows }] = await Promise.all([
        // All order lines for this product's MATNRs
        db.transactions().from('vbap')
          .select('order_id, line_total, vbak(order_type, status)')
          .in('matnr', matnrList),
        // Active product discounts
        db.pricing().from('product_discount')
          .select('discount_pct')
          .in('matnr', matnrList)
          .lte('valid_from', today)
          .or(`valid_to.is.null,valid_to.gte.${today}`),
      ])

      // Derive stats from lines
      const saleOrders    = new Set()
      const returnOrders  = new Set()
      const pendingOrders = new Set()
      let revenue = 0

      for (const line of (lines || [])) {
        const hdr = line.vbak || {}
        if (hdr.order_type === 'R') {
          returnOrders.add(line.order_id)
        } else {
          saleOrders.add(line.order_id)
          revenue += parseFloat(line.line_total || 0)
          const s = (hdr.status || '').toLowerCase()
          if (s === 'pending' || s === 'open') pendingOrders.add(line.order_id)
        }
      }

      // Max active discount across all variants
      const maxDiscount = (pdRows || []).reduce((max, r) => Math.max(max, parseFloat(r.discount_pct || 0)), 0)

      setStats({
        orders:   saleOrders.size,
        revenue:  fmtK(revenue),
        pending:  pendingOrders.size,
        returns:  returnOrders.size,
        discount: maxDiscount > 0 ? `${maxDiscount}%` : '—',
      })
    } catch { /* non-fatal */ }
  }

  useEffect(() => { load() }, [load])

  if (loading) return (
    <ERPLayout>
      <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>
    </ERPLayout>
  )

  if (loadError && !product) return (
    <ERPLayout>
      <div style={{ padding: '32px 24px' }}>
        <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => navigate('/inventory')}>← Back to Inventory</button>
        <p style={{ marginTop: 20, color: 'var(--muted)' }}>
          Failed to load product.{' '}
          <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={load}>Retry</button>
        </p>
      </div>
    </ERPLayout>
  )

  if (!product) return (
    <ERPLayout>
      <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--muted)' }}>Product not found.</div>
    </ERPLayout>
  )

  return (
    <ERPLayout>
      <ModuleHeader
        moduleLabel="INVENTORY"
        breadcrumb={product.brand}
        action={
          <button className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 14px' }}
            onClick={() => navigate('/inventory')}>
            ← Back
          </button>
        }
      />
      <ModuleTabs tabs={TABS} activeTab={tab} onChange={setTab} />
      <StatsStrip stats={[
        { value: stats.orders,   label: 'Total Orders' },
        { value: stats.revenue,  label: 'Revenue',         color: 'var(--success)' },
        { value: stats.pending,  label: 'Pending',         color: stats.pending > 0 ? 'var(--accent)' : undefined },
        { value: stats.returns,  label: 'Returns',         color: stats.returns > 0 ? 'var(--danger)'  : undefined },
        { value: stats.discount, label: 'Active Discount', color: stats.discount !== '—' ? 'var(--accent2, #b45309)' : undefined },
      ]} />
      <div className="erp-content">
        {tab === 'overview' && <OverviewTab product={product} variants={variants} skuId={skuId} onReload={load} />}
        {tab === 'orders'   && <OrderHistoryTab variants={variants} />}
      </div>
    </ERPLayout>
  )
}
