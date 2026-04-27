import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useToast } from '../components/Toast'
import { db, supabase } from '../lib/supabase'

const fmt  = n  => '₹' + parseFloat(n || 0).toFixed(2)
const fmtD = s  => s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const dash = v  => v || '—'

function payBadge(ps) {
  const map = { PAID: 'paid', PENDING: 'pending', CANCELLED: 'cancelled', PARTIALLY_PAID: 'partial' }
  const lbl = ps === 'PARTIALLY_PAID' ? 'Partial' : (ps || '—')
  return <span className={`badge badge-${map[ps] || ''}`}>{lbl}</span>
}

// ── Photo card — mirrors ItemDetail ImageCard style ───────────────────────────
function PhotoCard({ kunnr }) {
  const showToast = useToast()
  const fileRef = useRef(null)
  const [photoData, setPhotoData] = useState(null)
  const [pending, setPending] = useState(null)
  const [saving, setSaving] = useState(false)

  // Load existing photo on mount
  useEffect(() => {
    db.customers().from('customer_measurements')
      .select('photo_data')
      .eq('kunnr', kunnr)
      .maybeSingle()
      .then(({ data }) => { if (data?.photo_data) setPhotoData(data.photo_data) })
      .catch(() => {})
  }, [kunnr])

  function onFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return showToast('Please select an image file', 'error')
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

  async function savePhoto() {
    if (!pending) return
    setSaving(true)
    try {
      const { error } = await db.customers().from('customer_measurements')
        .upsert({ kunnr, photo_data: pending, updated_at: new Date().toISOString() }, { onConflict: 'kunnr' })
      if (error) throw new Error(error.message)
      setPhotoData(pending)
      setPending(null)
      showToast('✅ Photo saved')
    } catch (err) { showToast('❌ ' + err.message, 'error') }
    finally { setSaving(false) }
  }

  async function removePhoto() {
    if (!confirm('Remove this photo?')) return
    try {
      const { error } = await db.customers().from('customer_measurements')
        .upsert({ kunnr, photo_data: null, updated_at: new Date().toISOString() }, { onConflict: 'kunnr' })
      if (error) throw new Error(error.message)
      setPhotoData(null)
      setPending(null)
      showToast('Photo removed')
    } catch (err) { showToast('Could not remove photo', 'error') }
  }

  const displaySrc = pending || photoData

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
        color: 'var(--muted)', padding: '16px 20px 12px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: displaySrc ? '1px solid var(--border)' : 'none',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span>📷</span> Customer Photo</span>
        {photoData && !pending && (
          <button onClick={removePhoto} style={{ fontSize: 11, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            Remove
          </button>
        )}
      </div>

      {/* Image area */}
      {displaySrc ? (
        <div style={{ position: 'relative' }}>
          <img
            src={displaySrc}
            alt="Customer"
            style={{ width: '100%', aspectRatio: '4/3', objectFit: 'contain', background: '#f8f8f6', display: 'block' }}
          />
          {pending && (
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.85)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
            }}>
              <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>Preview — unsaved</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={savePhoto} disabled={saving} className="btn btn-primary" style={{ fontSize: 13, padding: '8px 20px' }}>
                  {saving ? 'Saving…' : '✓ Save Photo'}
                </button>
                <button onClick={() => setPending(null)} className="btn btn-ghost" style={{ fontSize: 13 }}>Discard</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div
          onClick={() => fileRef.current?.click()}
          style={{
            aspectRatio: '4/3', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12,
            cursor: 'pointer', background: '#fafaf8',
            border: '2px dashed var(--border)', margin: 12, borderRadius: 10,
            transition: 'border-color 0.2s, background 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent2)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = '#fafaf8' }}
        >
          <div style={{ fontSize: 36, opacity: 0.3 }}>👤</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>Upload Customer Photo</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', opacity: 0.7 }}>JPG, PNG, WEBP · max 20 MB</div>
        </div>
      )}

      {/* Footer */}
      <div style={{ padding: '12px 20px', display: 'flex', gap: 10, borderTop: displaySrc ? '1px solid var(--border)' : 'none' }}>
        <button onClick={() => fileRef.current?.click()} className="btn btn-ghost" style={{ fontSize: 12, flex: 1 }}>
          {displaySrc ? '↑ Replace Photo' : '↑ Choose File'}
        </button>
      </div>

      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFileChange} />
    </div>
  )
}

// ── Measurements form ─────────────────────────────────────────────────────────
const MEASURE_FIELDS = [
  { key: 'shoulders',     label: 'Shoulders',      icon: '↔️' },
  { key: 'top_inseam',    label: 'Top Inseam',     icon: '📏' },
  { key: 'tummy',         label: 'Tummy',           icon: '⭕' },
  { key: 'waist',         label: 'Waist',           icon: '➰' },
  { key: 'thighs',        label: 'Thighs',          icon: '🦵' },
  { key: 'bottom_inseam', label: 'Bottom Inseam',  icon: '📐' },
]

function MeasurementsCard({ kunnr, initialData }) {
  const showToast = useToast()
  const [form, setForm] = useState({
    shoulders: '', top_inseam: '', tummy: '', waist: '', thighs: '', bottom_inseam: '',
    ...Object.fromEntries(
      Object.entries(initialData || {}).filter(([k]) => MEASURE_FIELDS.some(f => f.key === k)).map(([k, v]) => [k, v ?? ''])
    )
  })
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  function set(field) {
    return e => { setForm(f => ({ ...f, [field]: e.target.value })); setDirty(true) }
  }

  async function save() {
    setSaving(true)
    try {
      const { error } = await db.customers().from('customer_measurements')
        .upsert({ kunnr, ...form, updated_at: new Date().toISOString() }, { onConflict: 'kunnr' })
      if (error) { showToast('❌ ' + error.message, 'error'); return }
      showToast('✅ Measurements saved')
      setDirty(false)
    } catch (err) { showToast('❌ ' + err.message, 'error') }
    finally { setSaving(false) }
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        {MEASURE_FIELDS.map(({ key, label, icon }) => (
          <div key={key} className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: 11 }}>{icon} {label} <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(cm)</span></label>
            <input
              type="number" min="0" step="0.5"
              value={form[key]}
              onChange={set(key)}
              placeholder="—"
              style={{ fontSize: 14 }}
            />
          </div>
        ))}
      </div>
      {dirty && (
        <button className="btn btn-primary" style={{ fontSize: 12, padding: '7px 16px' }} onClick={save} disabled={saving}>
          {saving ? 'Saving…' : '💾 Save Measurements'}
        </button>
      )}
    </div>
  )
}

// ── Preferred brands card ─────────────────────────────────────────────────────
function PreferencesCard({ kunnr, initialPrefs }) {
  const showToast = useToast()
  const [prefs, setPrefs] = useState(initialPrefs || [])
  const [brands, setBrands] = useState([])
  const [categories, setCategories] = useState([])
  const [fits, setFits] = useState([])
  const [form, setForm] = useState({ brand: '', category: '', size: '', fit: '' })
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    db.inventory().from('brands').select('name').order('name')
      .then(({ data }) => setBrands((data || []).map(b => b.name)))
      .catch(() => {})
    db.inventory().from('categories').select('category').order('category')
      .then(({ data }) => {
        const unique = [...new Set((data || []).map(c => c.category))]
        setCategories(unique)
      })
      .catch(() => {})
    db.inventory().from('fits').select('id, name').order('name')
      .then(({ data }) => setFits(data || []))
      .catch(() => {})
  }, [])

  async function add() {
    if (!form.brand) return showToast('Select a brand', 'error')
    setAdding(true)
    try {
      const { data, error } = await db.customers().from('customer_preferences')
        .insert({ kunnr, brand: form.brand, category: form.category, size: form.size, fit: form.fit })
        .select()
        .single()
      if (error) throw new Error(error.message || 'Failed')
      setPrefs(p => [...p, { ...form, id: data.id }])
      setForm({ brand: '', category: '', size: '', fit: '' })
      showToast('✅ Preference added')
    } catch (err) { showToast('❌ ' + err.message, 'error') }
    finally { setAdding(false) }
  }

  async function remove(id) {
    try {
      const { error } = await db.customers().from('customer_preferences').delete().eq('id', id)
      if (error) throw new Error(error.message)
      setPrefs(p => p.filter(x => x.id !== id))
    } catch (err) {
      showToast(err.message || 'Failed to remove preference', 'error')
    }
  }

  return (
    <div>
      {/* Existing preferences */}
      {prefs.length === 0 ? (
        <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>No preferences set yet.</div>
      ) : (
        <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {prefs.map(p => (
            <div key={p.id} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'var(--accent2)', border: '1px solid #e8d0a0',
              borderRadius: 20, padding: '5px 12px', fontSize: 13,
            }}>
              <strong>{p.brand}</strong>
              {p.category && <span style={{ color: 'var(--muted)', fontSize: 12 }}>· {p.category}</span>}
              {p.fit && (
                <span style={{
                  background: '#ede9fe', border: '1px solid #c4b5fd',
                  color: '#6d28d9', borderRadius: 4, padding: '1px 6px', fontSize: 11, fontWeight: 700,
                }}>{p.fit}</span>
              )}
              {p.size && (
                <span style={{
                  background: 'var(--card)', border: '1px solid var(--border)',
                  borderRadius: 4, padding: '1px 6px', fontSize: 11, fontWeight: 700,
                }}>{p.size}</span>
              )}
              <button onClick={() => remove(p.id)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--muted)', fontSize: 16, padding: '0 2px', lineHeight: 1,
              }}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Add new preference */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 10, alignItems: 'flex-end' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: 11 }}>Brand *</label>
          <select value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}>
            <option value="">Select brand…</option>
            {brands.map(b => <option key={b}>{b}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: 11 }}>Category</label>
          <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            <option value="">Any category</option>
            {categories.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: 11 }}>Fit</label>
          <select value={form.fit} onChange={e => setForm(f => ({ ...f, fit: e.target.value }))}>
            <option value="">Any fit</option>
            {fits.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: 11 }}>Size</label>
          <input
            value={form.size}
            onChange={e => setForm(f => ({ ...f, size: e.target.value }))}
            placeholder="e.g. M, 32"
          />
        </div>
        <button
          className="btn btn-primary"
          style={{ fontSize: 13, padding: '8px 16px', alignSelf: 'flex-end', whiteSpace: 'nowrap' }}
          onClick={add}
          disabled={adding}
        >
          {adding ? '…' : '+ Add'}
        </button>
      </div>
    </div>
  )
}

// ── GroupsCard ────────────────────────────────────────────────────────────────
function GroupsCard({ kunnr }) {
  const [groups,    setGroups]    = useState([])
  const [allGroups, setAllGroups] = useState([])
  const [selected,  setSelected]  = useState('')
  const [saving,    setSaving]    = useState(false)
  const showToast = useToast()

  const load = async () => {
    try {
      const [{ data: memberGroups }, { data: allGroupsData }] = await Promise.all([
        db.groups().from('group_members')
          .select('group_id, customer_groups(name, notes)')
          .eq('kunnr', kunnr),
        db.groups().from('customer_groups').select('*').order('name'),
      ])
      // Flatten: attach name from nested customer_groups relation
      const mine = (memberGroups || []).map(m => ({
        group_id: m.group_id,
        name: m.customer_groups?.name || m.group_id,
        notes: m.customer_groups?.notes,
      }))
      setGroups(mine)
      setAllGroups(allGroupsData || [])
    } catch (err) {
      console.error('Failed to load groups:', err.message)
    }
  }

  useEffect(() => { load() }, [kunnr])

  async function addToGroup() {
    if (!selected) return
    setSaving(true)
    try {
      const { error } = await db.groups().from('group_members').insert({ group_id: selected, kunnr })
      if (error) { showToast('❌ ' + error.message, 'error'); return }
      setSelected('')
      await load()
      showToast('Added to group', 'success')
    } finally { setSaving(false) }
  }

  async function leaveGroup(group_id, name) {
    try {
      const { error } = await db.groups().from('group_members')
        .delete().eq('group_id', group_id).eq('kunnr', kunnr)
      if (error) { showToast(error.message, 'error'); return }
      await load()
      showToast(`Removed from ${name}`, 'success')
    } catch (err) {
      showToast(err.message || 'Failed to remove from group', 'error')
    }
  }

  const available = allGroups.filter(g => !groups.find(m => m.group_id === g.group_id))

  return (
    <div>
      {/* Chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: groups.length ? 14 : 0 }}>
        {groups.map(g => (
          <div key={g.group_id} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'var(--bg)', border: '1px solid var(--border)',
            borderRadius: 20, padding: '5px 12px', fontSize: 13,
          }}>
            <span>👥</span>
            <span style={{ fontWeight: 600 }}>{g.name}</span>
            <button
              onClick={() => leaveGroup(g.group_id, g.name)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 15, padding: 0, lineHeight: 1 }}
              title="Leave group"
            >✕</button>
          </div>
        ))}
        {groups.length === 0 && (
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>Not in any group yet.</p>
        )}
      </div>

      {/* Add to group */}
      {available.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <select value={selected} onChange={e => setSelected(e.target.value)} style={{ flex: 1 }}>
            <option value="">Add to a group…</option>
            {available.map(g => <option key={g.group_id} value={g.group_id}>{g.name}</option>)}
          </select>
          <button className="btn btn-primary" style={{ padding: '10px 18px', fontSize: 13 }}
            onClick={addToGroup} disabled={saving || !selected}>
            {saving ? '…' : 'Add'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CustomerDetail() {
  const { kunnr } = useParams()
  const navigate = useNavigate()
  const showToast = useToast()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [cust, setCust] = useState(null)
  const [stats, setStats] = useState({})
  const [discounts, setDiscounts] = useState([])
  const [orders, setOrders] = useState([])
  const [measurements, setMeasurements] = useState({})
  const [preferences, setPreferences] = useState([])

  // Discount modal state
  const [showDiscModal, setShowDiscModal] = useState(false)
  const [discForm, setDiscForm] = useState({ discount_pct: '', valid_from: '', valid_to: '' })
  const [savingDisc, setSavingDisc] = useState(false)

  useEffect(() => {
    if (!kunnr) { setError('No KUNNR provided'); setLoading(false); return }

    async function loadAll() {
      try {
        const today = new Date().toISOString().split('T')[0]
        const [
          { data: custData, error: custErr },
          { data: ordersData },
          { data: discData },
          { data: measData },
          { data: prefData },
        ] = await Promise.all([
          db.customers().from('kna1').select('*').eq('kunnr', kunnr).single(),
          db.transactions().from('vbak').select('*, vbap(line_total)')
            .eq('kunnr', kunnr).order('created_at', { ascending: false }),
          db.pricing().from('customer_discount').select('*')
            .eq('kunnr', kunnr).order('valid_from', { ascending: false }),
          db.customers().from('customer_measurements').select('*').eq('kunnr', kunnr).maybeSingle(),
          db.customers().from('customer_preferences').select('*').eq('kunnr', kunnr),
        ])

        if (custErr) throw new Error(custErr.code === 'PGRST116' ? 'Customer not found' : custErr.message)

        setCust(custData)

        // Compute line_count and order_total from vbap, and compute stats
        const enrichedOrders = (ordersData || []).map(o => {
          const lines = o.vbap || []
          const order_total = lines.reduce((s, l) => s + (l.line_total || 0), 0)
          return { ...o, line_count: lines.length, order_total }
        })
        setOrders(enrichedOrders)

        setDiscounts(Array.isArray(discData) ? discData : [])
        setMeasurements(measData || {})
        setPreferences(Array.isArray(prefData) ? prefData : [])

        // Compute stats client-side
        const sales = enrichedOrders.filter(o => o.order_type === 'S' && o.status === 'CONFIRMED')
        const returns = enrichedOrders.filter(o => o.order_type === 'R')
        const pending = enrichedOrders.filter(o => o.payment_status === 'PENDING' || o.payment_status === 'PARTIALLY_PAID')
        const total_revenue = enrichedOrders
          .filter(o => o.status === 'CONFIRMED')
          .reduce((s, o) => o.order_type === 'R' ? s - (o.order_total || 0) : s + (o.order_total || 0), 0)
        setStats({
          total_orders: enrichedOrders.length,
          total_revenue,
          pending_orders: pending.length,
          total_returns: returns.length,
        })
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadAll()
  }, [kunnr])

  async function loadDiscounts() {
    try {
      const { data } = await db.pricing().from('customer_discount').select('*')
        .eq('kunnr', kunnr).order('valid_from', { ascending: false })
      setDiscounts(data || [])
    } catch (err) {
      console.error('Failed to reload discounts:', err.message)
    }
  }

  async function saveDiscount() {
    if (!discForm.discount_pct) return showToast('Discount % is required', 'error')
    setSavingDisc(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      const { error } = await db.pricing().from('customer_discount').insert({
        kunnr,
        discount_pct: parseFloat(discForm.discount_pct),
        valid_from: discForm.valid_from || today,
        valid_to: discForm.valid_to || null,
      })
      if (error) throw new Error(error.message || 'Failed to save')
      showToast('✅ Discount saved')
      setShowDiscModal(false)
      setDiscForm({ discount_pct: '', valid_from: '', valid_to: '' })
      loadDiscounts()
    } catch (err) {
      showToast('❌ ' + err.message, 'error')
    } finally {
      setSavingDisc(false)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--muted)' }}>
          <span className="spinner" />
          <p style={{ marginTop: 12 }}>Loading customer…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--muted)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>😕</div>
          <p style={{ marginBottom: 16 }}>{error}</p>
          <Link to="/customers" style={{ color: 'var(--accent)', fontWeight: 600 }}>← Back to Customers</Link>
        </div>
      </div>
    )
  }

  const today = new Date().toISOString().split('T')[0]
  const activeDisc = discounts.find(d =>
    d.valid_from <= today && (!d.valid_to || d.valid_to >= today || d.valid_to === '12319999')
  )
  const hasMeasurements = MEASURE_FIELDS.some(f => measurements[f.key])

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: 'var(--bg)', minHeight: '100vh' }}>
      {/* Topbar */}
      <div style={{
        background: 'var(--card)', borderBottom: '1px solid var(--border)',
        padding: '0 40px', height: 64, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link to="/customers" style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 14px', border: '1.5px solid var(--border)', borderRadius: 8,
            fontSize: 13, fontWeight: 600, color: 'var(--muted)', textDecoration: 'none', background: 'var(--card)',
          }}>← Customers</Link>
          <span style={{
            fontFamily: 'Courier New, monospace', fontSize: 13,
            background: 'var(--accent2)', color: '#92650a',
            border: '1px solid #e8d0a0', borderRadius: 6,
            padding: '4px 10px', fontWeight: 700,
          }}>{kunnr}</span>
          <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18 }}>
            {cust?.name || 'Customer Detail'}
          </span>
        </div>
        <Link to={`/sales?tab=new&step=1&kunnr=${kunnr}`} style={{
          background: 'var(--accent)', color: 'white',
          padding: '9px 20px', borderRadius: 8,
          fontSize: 13, fontWeight: 600, textDecoration: 'none',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>🧾 New Order</Link>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 40px' }}>

        {/* Stat pills */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 32, marginBottom: 4 }}>
            {cust?.name || '—'}
          </div>
          <div style={{ fontSize: 15, color: 'var(--muted)', marginBottom: 16 }}>
            {[cust?.number, cust?.email].filter(Boolean).join(' · ') || '—'}
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'Total Orders', value: stats.total_orders || 0, cls: { background: '#dbeafe', color: '#1d4ed8' } },
              { label: 'Revenue', value: fmt(stats.total_revenue || 0), cls: { background: '#dcfce7', color: '#15803d' } },
              { label: 'Pending', value: stats.pending_orders || 0, cls: { background: '#fef9c3', color: '#854d0e' } },
              { label: 'Returns', value: stats.total_returns || 0, cls: { background: '#fee2e2', color: '#dc2626' } },
              { label: 'Active Discount', value: activeDisc ? `${activeDisc.discount_pct}%` : '—', cls: { background: 'var(--accent2)', color: '#92650a' } },
            ].map(pill => (
              <div key={pill.label} style={{
                padding: '12px 18px', borderRadius: 12,
                display: 'flex', flexDirection: 'column', gap: 3, minWidth: 110,
                ...pill.cls,
              }}>
                <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7 }}>{pill.label}</label>
                <span style={{ fontSize: 20, fontWeight: 700 }}>{pill.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Row 1: Photo | Profile | Discounts */}
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 1fr', gap: 20, marginBottom: 20 }}>

          {/* Photo card */}
          <PhotoCard kunnr={kunnr} />

          {/* Profile card */}
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>👤</span> Customer Profile
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: 'KUNNR', value: <span className="mono">{cust?.kunnr}</span> },
                { label: 'Name', value: dash(cust?.name) },
                { label: 'Phone', value: dash(cust?.number) },
                { label: 'Email', value: dash(cust?.email) },
                { label: 'GSTIN', value: dash(cust?.gstin) },
                { label: 'Body Type', value: dash(cust?.body_type) },
              ].map(f => (
                <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)' }}>{f.label}</label>
                  <span style={{ fontSize: 14 }}>{f.value}</span>
                </div>
              ))}
              <div style={{ gridColumn: '1/-1', display: 'flex', flexDirection: 'column', gap: 3 }}>
                <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)' }}>Address</label>
                <span style={{ fontSize: 14 }}>{dash(cust?.address)}</span>
              </div>
            </div>
          </div>

          {/* Discounts card */}
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🏷️</span> Discount Records
            </div>
            {discounts.length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: 13, padding: '8px 0' }}>No discounts defined.</div>
            ) : discounts.map((d, i) => {
              const isActive = d.valid_from <= today && (!d.valid_to || d.valid_to >= today || d.valid_to === '12319999')
              return (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 0', borderBottom: i < discounts.length - 1 ? '1px solid var(--border)' : 'none',
                  ...(isActive ? { background: 'var(--accent2)', borderRadius: 8, padding: '10px 12px', margin: '0 -12px' } : {}),
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 16 }}>
                      {parseFloat(d.discount_pct).toFixed(1)}% off
                      {isActive && <span className="badge badge-active" style={{ fontSize: 10, marginLeft: 8 }}>ACTIVE</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      {d.valid_from} → {d.valid_to === '12319999' ? 'Open' : (d.valid_to || 'Open')}
                    </div>
                  </div>
                </div>
              )
            })}
            <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
              <button
                className="btn btn-primary"
                style={{ fontSize: 12, padding: '7px 14px' }}
                onClick={() => { setDiscForm({ discount_pct: '', valid_from: '', valid_to: '' }); setShowDiscModal(true) }}
              >+ Add Discount</button>
              <Link
                to="/sales?tab=pricing"
                style={{ fontSize: 12, padding: '7px 14px', borderRadius: 8, border: '1.5px solid var(--border)', color: 'var(--muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', fontWeight: 600 }}
              >View All Pricing →</Link>
            </div>
          </div>
        </div>

        {/* Row 2: Body Measurements */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>📐</span> Body Measurements
            {hasMeasurements && (
              <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--muted)', marginLeft: 4 }}>
                · Updated {measurements.updated_at ? new Date(measurements.updated_at).toLocaleDateString('en-IN') : ''}
              </span>
            )}
          </div>
          <MeasurementsCard kunnr={kunnr} initialData={measurements} />
        </div>

        {/* Row 3: Preferred Brands & Sizes */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>⭐</span> Preferred Brands & Sizes
            <span style={{ fontWeight: 400, fontSize: 11 }}>— used for personalised recommendations</span>
          </div>
          <PreferencesCard kunnr={kunnr} initialPrefs={preferences} />
        </div>

        {/* Groups */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>👥</span> Groups
            <span style={{ fontWeight: 400, fontSize: 11 }}>— friend circles for conflict detection</span>
          </div>
          <GroupsCard kunnr={kunnr} />
        </div>

        {/* Order History */}
        <div className="card">
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🧾</span> Order History
            {orders.length > 0 && <span style={{ fontWeight: 400, fontSize: 11, marginLeft: 8 }}>{orders.length} records</span>}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Order ID', 'Type', 'Date', 'Lines', 'Order Total', 'Payment', ''].map((h, i) => (
                    <th key={i} style={{
                      padding: '10px 12px', textAlign: i >= 3 && i <= 4 ? 'right' : 'left',
                      fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase',
                      color: 'var(--muted)', borderBottom: '1px solid var(--border)', background: 'var(--bg)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--muted)', fontSize: 13 }}>
                    No orders found.
                  </td></tr>
                ) : orders.map(r => {
                  const isReturn = r.order_type === 'R'
                  return (
                    <tr key={r.order_id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 12px' }}>
                        <Link to={`/invoice?order_id=${r.order_id}`} style={{
                          fontFamily: 'monospace', fontSize: 12,
                          color: 'var(--accent)', fontWeight: 700, textDecoration: 'none',
                        }}>{r.order_id}</Link>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span className={`badge badge-${isReturn ? 'return' : 'sale'}`}>
                          {isReturn ? 'Return' : 'Sale'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--muted)' }}>{fmtD(r.created_at)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>{r.line_count || 0}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}><strong>{fmt(r.order_total)}</strong></td>
                      <td style={{ padding: '10px 12px' }}>{payBadge(r.payment_status)}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <Link to={`/invoice?order_id=${r.order_id}`} style={{ fontSize: 12, color: '#0369a1', fontWeight: 600, textDecoration: 'none' }}>
                          View →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Discount Modal */}
      {showDiscModal && (
        <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setShowDiscModal(false)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-title">Add Customer Discount</div>
            <div className="modal-sub">For customer <strong>{cust?.name}</strong> ({kunnr})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Discount % *</label>
                <input
                  type="number" min="0" max="100" step="0.1"
                  value={discForm.discount_pct}
                  onChange={e => setDiscForm(f => ({ ...f, discount_pct: e.target.value }))}
                  placeholder="e.g. 10"
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Valid From</label>
                  <input type="date" value={discForm.valid_from} onChange={e => setDiscForm(f => ({ ...f, valid_from: e.target.value }))} style={{ width: '100%' }} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Valid To <span style={{ fontSize: 10, color: 'var(--muted)' }}>(blank = open)</span></label>
                  <input type="date" value={discForm.valid_to} onChange={e => setDiscForm(f => ({ ...f, valid_to: e.target.value }))} style={{ width: '100%' }} />
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowDiscModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveDiscount} disabled={savingDisc}>
                {savingDisc ? 'Saving…' : '💾 Save Discount'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
