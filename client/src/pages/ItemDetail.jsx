import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { useToast } from '../components/Toast'
import { db } from '../lib/supabase'

const fmt  = n => '₹' + parseFloat(n || 0).toFixed(2)
const dash = v => v || '—'

// Image upload — stored on products table
function ImageCard({ skuId, initialImage }) {
  const showToast = useToast()
  const fileRef = useRef(null)
  const [imageData, setImageData] = useState(initialImage || null)
  const [pending, setPending] = useState(null)
  const [saving, setSaving] = useState(false)

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
      if (width > MAX) { height = Math.round(height * MAX / width); width = MAX }
      if (height > MAX) { width = Math.round(width * MAX / height); height = MAX }
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
      setImageData(pending)
      setPending(null)
      showToast('✅ Image saved')
    } catch (err) { showToast(`❌ ${err.message}`, 'error') }
    finally { setSaving(false) }
  }

  async function removeImage() {
    if (!window.confirm('Remove this photo?')) return
    try {
      const { error } = await db.inventory().from('products').update({ image_data: null }).eq('sku_id', skuId)
      if (error) throw error
      setImageData(null)
      setPending(null)
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
            {pending && <button className="btn btn-primary" onClick={saveImage} disabled={saving} style={{ fontSize: 13 }}>Save Photo</button>}
            {pending && <button className="btn btn-ghost" onClick={() => setPending(null)} style={{ fontSize: 13 }}>Discard</button>}
            {!pending && <button className="btn btn-ghost" onClick={() => fileRef.current?.click()} style={{ fontSize: 13 }}>Change Photo</button>}
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

export default function ItemDetail() {
  const { skuId } = useParams()
  const showToast = useToast()
  const [product, setProduct] = useState(null)
  const [variants, setVariants] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const { data, error } = await db.inventory().from('products')
        .select('*, mara(matnr, size, quantity, reserved)')
        .eq('sku_id', skuId)
        .single()
      if (error) throw error
      setProduct(data)
      setVariants(data.mara || [])
    } catch (err) { showToast(err.message, 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [skuId])

  if (loading) return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", minHeight: '100vh', display: 'flex' }}>
      <Sidebar />
      <div style={{ flex: 1, padding: '32px 40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>Loading…</div>
    </div>
  )

  if (!product) return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", minHeight: '100vh', display: 'flex' }}>
      <Sidebar />
      <div style={{ flex: 1, padding: '32px 40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>Product not found.</div>
    </div>
  )

  const fields = [
    ['SKU Code', product.sku_code],
    ['Brand', product.brand],
    ['Brand Family', product.brandfamily],
    ['Gender', product.gender],
    ['Category', product.category],
    ['Sub-Category', product.subcategory],
    ['Sub-Sub-Category', product.subsubcategory],
    ['Color', product.color],
    ['Fit', product.fit],
    ['Body Type', product.body_type],
    ['Material', product.material_type],
    ['GST Category', product.tax_category],
    ['MRP', product.mrp ? fmt(product.mrp) : null],
    ['Cost Price', product.cost_price ? fmt(product.cost_price) : null],
  ].filter(([, v]) => v)

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", minHeight: '100vh', display: 'flex' }}>
      <Sidebar />
      <div style={{ flex: 1, padding: '32px 40px', maxWidth: 960 }}>
        <div style={{ marginBottom: 20 }}>
          <Link to="/inventory" style={{ fontSize: 13, color: 'var(--muted)', textDecoration: 'none' }}>← Back to Inventory</Link>
        </div>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, marginBottom: 4 }}>{product.brand}</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>
          {[product.category, product.subcategory, product.subsubcategory, product.color, product.fit].filter(Boolean).join(' · ')}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
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

        {/* Size variants */}
        <div className="card" style={{ marginTop: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 16 }}>Size Variants</div>
          {variants.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>No size variants. Add sizes from the Inventory page.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase' }}>
                  <th style={{ padding: '6px 8px', textAlign: 'left' }}>MATNR</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left' }}>Size</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Stock</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Reserved</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Available</th>
                </tr>
              </thead>
              <tbody>
                {variants.map(v => (
                  <tr key={v.matnr} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 8px', fontFamily: 'monospace', fontSize: 12 }}>{v.matnr}</td>
                    <td style={{ padding: '10px 8px' }}>{v.size || '—'}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right' }}>{v.quantity || 0}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--muted)' }}>{v.reserved || 0}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right' }}>{(v.quantity || 0) - (v.reserved || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
