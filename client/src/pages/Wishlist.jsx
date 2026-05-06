import { useState, useEffect, useCallback, useRef } from 'react'
import { useToast } from '../components/Toast'
import { db } from '../lib/supabase'
import ERPLayout from '../components/ERPLayout'
import ModuleHeader from '../components/ModuleHeader'
import ModuleTabs from '../components/ModuleTabs'
import StatsStrip from '../components/StatsStrip'

const STATUS_OPTS = ['open', 'pending', 'fulfilled']

const STATUS_STYLE = {
  open:      { color: '#5b8dee', bg: 'rgba(91,141,238,0.12)',  border: 'rgba(91,141,238,0.3)'  },
  pending:   { color: '#e0a820', bg: 'rgba(224,168,32,0.12)',  border: 'rgba(224,168,32,0.3)'  },
  fulfilled: { color: '#4caf74', bg: 'rgba(76,175,116,0.12)', border: 'rgba(76,175,116,0.3)'  },
}

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.open
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 11,
      fontWeight: 700, textTransform: 'capitalize', letterSpacing: '0.04em',
      color: s.color, background: s.bg, border: `1px solid ${s.border}`,
    }}>{status}</span>
  )
}

// ─── Add Wishlist Modal ───────────────────────────────────────────────────────
function AddWishlistModal({ onClose, onSaved }) {
  const showToast  = useToast()
  const wrapRef    = useRef(null)
  const debSkuRef  = useRef(null)
  const debCustRef = useRef(null)

  const [skuQuery,    setSkuQuery]    = useState('')
  const [skuResults,  setSkuResults]  = useState([])
  const [skuOpen,     setSkuOpen]     = useState(false)
  const [sku,         setSku]         = useState(null)

  const [custQuery,   setCustQuery]   = useState('')
  const [custResults, setCustResults] = useState([])
  const [custOpen,    setCustOpen]    = useState(false)
  const [cust,        setCust]        = useState(null)   // matched kna1 row or null
  const [custIsNew,   setCustIsNew]   = useState(false)  // will be created on save

  const [form, setForm] = useState({
    size: '', number: '', notes: '',
    date: new Date().toISOString().split('T')[0],
    status: 'open',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    function h(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setSkuOpen(false); setCustOpen(false)
      }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // Search inventory: sku_code, brand, OR category
  async function searchSku(q) {
    if (!q.trim()) { setSkuResults([]); setSkuOpen(false); return }
    const { data } = await db.inventory().from('products')
      .select('sku_id, sku_code, brand, category, color, mara(size)')
      .or(`sku_code.ilike.%${q}%,brand.ilike.%${q}%,category.ilike.%${q}%`)
      .limit(8)
    const results = data || []
    setSkuResults(results); setSkuOpen(results.length > 0)
  }

  // Search customers; on no results, the typed text will auto-create a new customer on save
  async function searchCust(q) {
    if (!q.trim()) { setCustResults([]); setCustOpen(false); setCustIsNew(false); return }
    const { data } = await db.customers().from('kna1')
      .select('kunnr, name, number')
      .or(`name.ilike.%${q}%,kunnr.ilike.%${q}%,number.ilike.%${q}%`)
      .limit(8)
    const results = data || []
    setCustResults(results)
    setCustOpen(results.length > 0)
    // If nothing found, flag that we'll create a new customer on save
    setCustIsNew(results.length === 0 && q.trim().length > 0)
  }

  const sizes = sku?.mara?.map(v => v.size).filter(Boolean) || []
  const productName = sku ? `${sku.brand} — ${sku.sku_code}` : skuQuery.trim()

  async function save() {
    if (!productName) return showToast('Enter a product name or select from search', 'error')
    if (!form.size.trim()) return showToast('Enter a size', 'error')
    setSaving(true)
    try {
      // Auto-create customer if no match was selected and name was typed
      let resolvedKunnr = cust?.kunnr || null
      let resolvedName  = cust ? (cust.name || cust.kunnr) : null
      if (!cust && custQuery.trim()) {
        const { data: lastCust } = await db.customers().from('kna1')
          .select('kunnr').order('kunnr', { ascending: false }).limit(1)
        const maxNum = lastCust?.[0] ? parseInt(lastCust[0].kunnr) : 99999
        resolvedKunnr = String(maxNum + 1).padStart(6, '0')
        resolvedName  = custQuery.trim()
        await db.customers().from('kna1').insert({
          kunnr: resolvedKunnr, name: resolvedName,
          number: form.number.trim() || null, status: 'Active',
        })
        showToast(`✅ New customer "${resolvedName}" created (${resolvedKunnr})`)
      }

      const { error } = await db.customers().from('wishlist').insert({
        sku_id:        sku?.sku_id   || null,
        sku_code:      sku?.sku_code || null,
        product_name:  productName,
        size:          form.size.trim(),
        kunnr:         resolvedKunnr,
        customer_name: resolvedName,
        number:        form.number.trim() || cust?.number || null,
        date:          form.date,
        status:        form.status,
        notes:         form.notes.trim() || null,
      })
      if (error) throw error
      showToast('✅ Wishlist record added')
      onSaved()
    } catch (e) { showToast('❌ ' + e.message, 'error') }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520, width: '95vw', position: 'relative' }} ref={wrapRef}>
        {/* Close button — top right */}
        <button onClick={onClose} style={{
          position: 'absolute', top: 16, right: 16,
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 22, lineHeight: 1, color: 'var(--muted)', zIndex: 1,
        }}>×</button>

        <div className="modal-title">Add Wishlist Item</div>

        {/* Product — search existing or type free text */}
        <div style={{ marginBottom: 14, position: 'relative' }}>
          <label style={labelStyle}>Product *</label>
          <input
            value={sku ? `${sku.brand} — ${sku.sku_code}` : skuQuery}
            onChange={e => {
              setSkuQuery(e.target.value); setSku(null); setForm(f => ({ ...f, size: '' }))
              clearTimeout(debSkuRef.current)
              debSkuRef.current = setTimeout(() => searchSku(e.target.value), 250)
            }}
            onFocus={() => { if (skuResults.length && !sku) setSkuOpen(true) }}
            placeholder="Search by brand, SKU or category — or type any name…"
            autoComplete="off"
            style={{ width: '100%', boxSizing: 'border-box', paddingRight: sku ? 32 : undefined }}
          />
          {sku && <ClearBtn onClick={() => { setSku(null); setSkuQuery(''); setForm(f => ({ ...f, size: '' })) }} />}
          {sku && <div style={{ marginTop: 4, fontSize: 11, color: 'var(--success)' }}>✓ Matched to inventory — {sku.sku_code}</div>}
          {skuOpen && skuResults.length > 0 && (
            <Dropdown>
              {skuResults.map(p => (
                <DropItem key={p.sku_id} onMouseDown={e => { e.preventDefault(); setSku(p); setSkuQuery(''); setSkuOpen(false) }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#c9a84c', marginRight: 8 }}>{p.sku_code}</span>
                  <strong>{p.brand}</strong>
                  <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--muted)' }}>{[p.category, p.color].filter(Boolean).join(' · ')}</span>
                </DropItem>
              ))}
            </Dropdown>
          )}
        </div>

        {/* Size */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Size *</label>
          {sizes.length > 0 ? (
            <select value={form.size} onChange={e => setForm(f => ({ ...f, size: e.target.value }))}
              style={{ width: '100%', boxSizing: 'border-box' }}>
              <option value="">Select size…</option>
              {sizes.map(s => <option key={s}>{s}</option>)}
            </select>
          ) : (
            <input value={form.size} onChange={e => setForm(f => ({ ...f, size: e.target.value }))}
              placeholder="e.g. M, 32, XL"
              style={{ width: '100%', boxSizing: 'border-box' }} />
          )}
        </div>

        {/* Customer — search existing or type new name (auto-creates on save) */}
        <div style={{ marginBottom: 14, position: 'relative' }}>
          <label style={labelStyle}>Customer</label>
          <input
            value={cust ? (cust.name || cust.kunnr) : custQuery}
            onChange={e => {
              setCustQuery(e.target.value); setCust(null)
              clearTimeout(debCustRef.current)
              debCustRef.current = setTimeout(() => searchCust(e.target.value), 300)
            }}
            onFocus={() => { if (custResults.length && !cust) setCustOpen(true) }}
            placeholder="Search existing customer or type a new name…"
            autoComplete="off"
            style={{ width: '100%', boxSizing: 'border-box', paddingRight: cust ? 32 : undefined }}
          />
          {cust && <ClearBtn onClick={() => { setCust(null); setCustQuery(''); setCustIsNew(false) }} />}
          {cust   && <div style={{ marginTop: 4, fontSize: 11, color: 'var(--success)' }}>✓ Existing customer — {cust.kunnr}</div>}
          {custIsNew && !cust && custQuery.trim() && (
            <div style={{ marginTop: 4, fontSize: 11, color: '#e0a820' }}>⚡ New customer will be created on save</div>
          )}
          {custOpen && !cust && custResults.length > 0 && (
            <Dropdown>
              {custResults.map(c => (
                <DropItem key={c.kunnr} onMouseDown={e => {
                  e.preventDefault()
                  setCust(c); setCustQuery(''); setCustOpen(false); setCustIsNew(false)
                  setForm(f => ({ ...f, number: f.number || c.number || '' }))
                }}>
                  <strong>{c.name}</strong>
                  <span style={{ marginLeft: 8, fontFamily: 'monospace', fontSize: 11, color: 'var(--muted)' }}>{c.kunnr}</span>
                  {c.number && <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--muted)' }}>{c.number}</span>}
                </DropItem>
              ))}
            </Dropdown>
          )}
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Notes</label>
          <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Any additional details…"
            style={{ width: '100%', boxSizing: 'border-box' }} />
        </div>

        {/* Number + Date + Status */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 22 }}>
          <div>
            <label style={labelStyle}>Phone Number</label>
            <input value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))}
              placeholder="+91…" style={{ width: '100%', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={labelStyle}>Date</label>
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              style={{ width: '100%', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={labelStyle}>Status</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              style={{ width: '100%', boxSizing: 'border-box' }}>
              {STATUS_OPTS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Add to Wishlist'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── tiny shared helpers ──────────────────────────────────────────────────────
const labelStyle = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', display: 'block', marginBottom: 6 }

function ClearBtn({ onClick }) {
  return (
    <button onClick={onClick} style={{
      position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
      background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 16, lineHeight: 1,
    }}>×</button>
  )
}

function Dropdown({ children }) {
  return (
    <div style={{
      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
      background: 'var(--card)', border: '1px solid var(--border)',
      borderTop: 'none', borderRadius: '0 0 8px 8px',
      maxHeight: 200, overflowY: 'auto',
      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    }}>
      {children}
    </div>
  )
}

function DropItem({ children, onMouseDown }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '10px 14px', cursor: 'pointer',
        borderBottom: '1px solid var(--border)', fontSize: 13,
        background: hover ? 'var(--surface2)' : 'var(--card)',
      }}
    >
      {children}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
const STATUS_FILTER_ALL = 'all'
const fmtDate = s => s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export default function Wishlist() {
  const showToast = useToast()
  const [rows,         setRows]         = useState([])
  const [loading,      setLoading]      = useState(true)
  const [showAdd,      setShowAdd]      = useState(false)
  const [filterStatus, setFilterStatus] = useState(STATUS_FILTER_ALL)
  const [search,       setSearch]       = useState('')
  const [updatingId,   setUpdatingId]   = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await db.customers().from('wishlist')
        .select('*')
        .order('date', { ascending: false })
        .order('id', { ascending: false })
      if (error) throw error
      setRows(data || [])
    } catch (e) { showToast('❌ ' + e.message, 'error') }
    finally { setLoading(false) }
  }, [showToast])

  useEffect(() => { load() }, [load])

  async function updateStatus(id, status) {
    setUpdatingId(id)
    try {
      const { error } = await db.customers().from('wishlist').update({ status }).eq('id', id)
      if (error) throw error
      setRows(prev => prev.map(r => r.id === id ? { ...r, status } : r))
    } catch (e) { showToast('❌ ' + e.message, 'error') }
    finally { setUpdatingId(null) }
  }

  async function deleteRow(id) {
    if (!window.confirm('Delete this wishlist item?')) return
    try {
      const { error } = await db.customers().from('wishlist').delete().eq('id', id)
      if (error) throw error
      setRows(prev => prev.filter(r => r.id !== id))
      showToast('✅ Deleted')
    } catch (e) { showToast('❌ ' + e.message, 'error') }
  }

  const filtered = rows
    .filter(r => filterStatus === STATUS_FILTER_ALL || r.status === filterStatus)
    .filter(r => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (
        (r.sku_code || '').toLowerCase().includes(q) ||
        (r.customer_name || '').toLowerCase().includes(q) ||
        (r.kunnr || '').toLowerCase().includes(q) ||
        (r.size || '').toLowerCase().includes(q) ||
        (r.number || '').toLowerCase().includes(q)
      )
    })

  const counts = {
    all:       rows.length,
    open:      rows.filter(r => r.status === 'open').length,
    pending:   rows.filter(r => r.status === 'pending').length,
    fulfilled: rows.filter(r => r.status === 'fulfilled').length,
  }

  return (
    <ERPLayout>
      <ModuleHeader moduleLabel="ANALYTICS" breadcrumb="Wishlist" />
      <ModuleTabs
        tabs={[{ key: 'list', label: 'Wishlist' }]}
        active="list"
        onChange={() => {}}
      />

      <StatsStrip stats={[
        { value: counts.all,       label: 'Total' },
        { value: counts.open,      label: 'Open',      color: counts.open      > 0 ? '#5b8dee' : undefined },
        { value: counts.pending,   label: 'Pending',   color: counts.pending   > 0 ? '#e0a820' : undefined },
        { value: counts.fulfilled, label: 'Fulfilled', color: counts.fulfilled > 0 ? '#4caf74' : undefined },
      ]}>
        {/* Status filter pills live in the sticky stats bar — no overlap */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[STATUS_FILTER_ALL, ...STATUS_OPTS].map(s => {
            const active = filterStatus === s
            return (
              <button key={s} onClick={() => setFilterStatus(s)} style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: active ? 700 : 400,
                cursor: 'pointer', border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
                background: active ? 'var(--accent)' : 'transparent',
                color: active ? '#fff' : 'var(--muted)',
                transition: 'all 0.15s', textTransform: 'capitalize',
              }}>
                {s === STATUS_FILTER_ALL ? 'All' : s}
                {s !== STATUS_FILTER_ALL && <span style={{ marginLeft: 4, opacity: 0.7 }}>({counts[s]})</span>}
              </button>
            )
          })}
        </div>
      </StatsStrip>

      <div className="erp-content">
        {/* Toolbar: search + add only */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search SKU, customer, size, phone…"
            style={{ flex: 1 }}
          />
          <button className="btn btn-primary" style={{ fontSize: 13, padding: '7px 16px', flexShrink: 0 }}
            onClick={() => setShowAdd(true)}>+ Add Item</button>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)', fontSize: 14 }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)', fontSize: 14 }}>
            {rows.length === 0 ? 'No wishlist items yet. Click "+ Add Item" to start.' : 'No items match your filters.'}
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg)' }}>
                    {['Product', 'Size', 'Customer', 'Phone', 'Notes', 'Date', 'Status', ''].map((h, i) => (
                      <th key={i} style={{
                        padding: '10px 14px', textAlign: 'left',
                        fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '0.08em', color: 'var(--muted)',
                        borderBottom: '1px solid var(--border)',
                        whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 14px' }}>
                        {/* Show product_name if set; fall back to sku_code; indicate if matched to inventory */}
                        <div style={{ fontWeight: 600 }}>
                          {r.product_name || r.sku_code || '—'}
                        </div>
                        {r.sku_code && r.product_name && (
                          <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#c9a84c', marginTop: 2 }}>{r.sku_code}</div>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 600 }}>{r.size || '—'}</td>
                      <td style={{ padding: '12px 14px' }}>
                        {r.customer_name ? (
                          <div>
                            <div style={{ fontWeight: 600 }}>{r.customer_name}</div>
                            {r.kunnr && <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace', marginTop: 1 }}>{r.kunnr}</div>}
                          </div>
                        ) : <span style={{ color: 'var(--muted)' }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{r.number || '—'}</td>
                      <td style={{ padding: '12px 14px', color: 'var(--muted)', maxWidth: 180 }}>
                        <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {r.notes || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{fmtDate(r.date)}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <select
                          value={r.status}
                          onChange={e => updateStatus(r.id, e.target.value)}
                          disabled={updatingId === r.id}
                          style={{
                            padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                            cursor: 'pointer', border: `1px solid ${STATUS_STYLE[r.status]?.border || 'var(--border)'}`,
                            background: STATUS_STYLE[r.status]?.bg || 'transparent',
                            color: STATUS_STYLE[r.status]?.color || 'var(--text)',
                            textTransform: 'capitalize',
                          }}
                        >
                          {STATUS_OPTS.map(s => <option key={s}>{s}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <button className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px', color: 'var(--danger)' }}
                          onClick={() => deleteRow(r.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showAdd && (
        <AddWishlistModal
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load() }}
        />
      )}
    </ERPLayout>
  )
}
