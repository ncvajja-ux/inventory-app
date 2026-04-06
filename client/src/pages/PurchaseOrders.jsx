import { useState, useEffect, useCallback, useRef } from 'react'
import Sidebar from '../components/Sidebar'
import { useToast } from '../components/Toast'
import { INDIAN_STATES, INDIAN_CITIES, COUNTRIES } from '../data/referenceData'

const fmt  = n  => '₹' + parseFloat(n || 0).toFixed(2)
const fmtD = s  => s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

function SearchDropdown({ placeholder, onSearch, onSelect, renderItem, width = 340 }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [selectedLabel, setSelectedLabel] = useState('')
  const debounceRef = useRef(null)
  const wrapRef = useRef(null)

  useEffect(() => {
    function h(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  function handleInput(e) {
    const val = e.target.value
    setQuery(val); setSelectedLabel('')
    clearTimeout(debounceRef.current)
    if (!val.trim()) { setResults([]); setOpen(false); return }
    debounceRef.current = setTimeout(async () => {
      const items = await onSearch(val)
      setResults(items || [])
      setOpen(true)
    }, 250)
  }

  function select(item) {
    setSelectedLabel('')
    setQuery('')
    setResults([])
    setOpen(false)
    onSelect(item)
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', width }}>
      <input value={selectedLabel || query} onChange={handleInput} onFocus={() => { if (results.length) setOpen(true) }}
        placeholder={placeholder} autoComplete="off" style={{ width: '100%' }} />
      {open && results.length > 0 && (
        <div className="search-results">
          {results.map((item, i) => (
            <div key={i} className="search-result-item" onMouseDown={() => select(item)}>
              {renderItem ? renderItem(item) : String(item)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StepBar({ step, labels }) {
  return (
    <div className="steps">
      {labels.map((label, i) => {
        const n = i + 1
        const cls = n < step ? 'step done' : n === step ? 'step active' : 'step'
        return (
          <span key={n} style={{ display: 'contents' }}>
            <div className={cls}><div className="step-num">{n < step ? '✓' : n}</div><span>{label}</span></div>
            {n < labels.length && <div className={`step-line${n < step ? ' done' : ''}`} />}
          </span>
        )
      })}
    </div>
  )
}

function NewPOTab({ onCreated }) {
  const showToast = useToast()
  const [step, setStep] = useState(1)
  const [buyer, setBuyer] = useState(null)
  const [lines, setLines] = useState([])
  const [nextPOId, setNextPOId] = useState('—')
  const [reviewForm, setReviewForm] = useState({
    rv_name: '', rv_phone: '', rv_addr1: '', rv_addr2: '',
    rv_city: '', rv_state: '', rv_country: 'India', rv_zip: '', rv_ship_city: '',
    po_date: new Date().toISOString().split('T')[0],
    expected_delivery: '', notes: '',
  })

  useEffect(() => {
    fetch('/next-po-id').then(r => r.json()).then(d => setNextPOId(d.po_id || '—')).catch(() => {})
  }, [])

  async function searchBuyer(q) {
    try { const r = await fetch(`/buyers/search?q=${encodeURIComponent(q)}`); return await r.json() } catch { return [] }
  }
  async function searchProduct(q) {
    try { const r = await fetch(`/inventory/search?q=${encodeURIComponent(q)}`); return await r.json() } catch { return [] }
  }

  function selectBuyer(b) {
    setBuyer(b)
    setReviewForm(f => ({
      ...f,
      rv_addr1: b.addr1 || '', rv_addr2: b.addr2 || '',
      rv_city: b.city || '', rv_state: b.state || '', rv_country: b.country || 'India',
      rv_zip: b.zip || '', rv_ship_city: b.ship_city || '',
    }))
    setStep(2)
  }

  function addProduct(p) {
    setLines(prev => {
      if (prev.find(l => l.matnr === p.matnr)) return prev
      return [...prev, { ...p, qty: 1, unit_price: parseFloat(p.cost_price || 0) }]
    })
  }

  function updateLine(matnr, field, value) {
    setLines(prev => prev.map(l => l.matnr === matnr ? { ...l, [field]: parseFloat(value) || 0 } : l))
  }

  function removeLine(matnr) {
    setLines(prev => prev.filter(l => l.matnr !== matnr))
  }

  const poTotal = lines.reduce((s, l) => s + l.qty * l.unit_price, 0)

  function set(field) { return e => setReviewForm(f => ({ ...f, [field]: e.target.value })) }

  async function confirmPO() {
    if (!lines.length) return showToast('Add at least one product', 'error')
    const body = {
      buyer_id: buyer.buyer_id,
      po_date: reviewForm.po_date,
      expected_delivery: reviewForm.expected_delivery,
      notes: reviewForm.notes,
      shipping: {
        name: reviewForm.rv_name, phone: reviewForm.rv_phone,
        addr1: reviewForm.rv_addr1, addr2: reviewForm.rv_addr2,
        city: reviewForm.rv_city, state: reviewForm.rv_state,
        country: reviewForm.rv_country, zip: reviewForm.rv_zip,
        ship_city: reviewForm.rv_ship_city,
      },
      items: lines.map(l => ({ matnr: l.matnr, quantity: l.qty, unit_price: l.unit_price })),
    }
    try {
      const res = await fetch('/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      showToast(`✅ PO ${data.po_id} created!`)
      setStep(1); setBuyer(null); setLines([])
      onCreated()
    } catch (err) { showToast(`❌ ${err.message}`, 'error') }
  }

  return (
    <>
      <StepBar step={step} labels={['Buyer', 'Line Items', 'Review & Confirm']} />

      {step === 1 && (
        <div className="card">
          <div className="card-title">Select Buyer</div>
          <div className="card-sub">Search by name, phone or Buyer ID.</div>
          <div className="form-group" style={{ maxWidth: 400 }}>
            <label>Search Buyer</label>
            <SearchDropdown
              placeholder="Name, phone, or Buyer ID…"
              onSearch={searchBuyer}
              onSelect={selectBuyer}
              renderItem={b => <div><strong>{b.company_name}</strong> <span className="sri-kunnr">{b.buyer_id}</span></div>}
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div className="card-title" style={{ flex: 1 }}>Add Products</div>
            <div style={{ background: 'var(--accent2)', border: '1.5px solid #e8d0a0', borderRadius: 20, padding: '6px 14px', fontSize: 13, fontWeight: 600, color: '#92650a' }}>
              🏢 {buyer?.company_name} <span style={{ fontFamily: 'monospace', fontSize: 11, marginLeft: 4 }}>{buyer?.buyer_id}</span>
            </div>
          </div>
          <div className="card-sub">Search for products and add quantities and purchase prices.</div>

          <div className="form-group" style={{ maxWidth: 400, marginBottom: 20 }}>
            <label>Search Product</label>
            <SearchDropdown
              placeholder="MATNR, brand, category…"
              onSearch={searchProduct}
              onSelect={addProduct}
              renderItem={p => <div><span className="sri-kunnr">{p.matnr}</span> {p.brand} — {p.category}</div>}
            />
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
                  {['Line', 'MATNR', 'Product', 'Qty', 'Unit Price (₹)', 'Line Total', ''].map((h, i) => (
                    <th key={i} style={{ padding: '10px 12px', textAlign: i >= 3 ? 'right' : 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>No products added yet. Search above to add.</td></tr>
                ) : lines.map((l, i) => (
                  <tr key={l.matnr} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px', color: 'var(--muted)' }}>{i + 1}</td>
                    <td style={{ padding: '10px 12px' }}><span className="mono">{l.matnr}</span></td>
                    <td style={{ padding: '10px 12px' }}>{l.brand} — {[l.category, l.size, l.color].filter(Boolean).join(' · ')}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <input type="number" min="1" value={l.qty} onChange={e => updateLine(l.matnr, 'qty', e.target.value)}
                        style={{ width: 70, textAlign: 'center', padding: '4px 8px', fontSize: 13 }} />
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <input type="number" min="0" step="0.01" value={l.unit_price} onChange={e => updateLine(l.matnr, 'unit_price', e.target.value)}
                        style={{ width: 90, textAlign: 'right', padding: '4px 8px', fontSize: 13 }} />
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}><strong>{fmt(l.qty * l.unit_price)}</strong></td>
                    <td style={{ padding: '10px 12px' }}>
                      <button className="action-btn btn-delete" onClick={() => removeLine(l.matnr)}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ textAlign: 'right', padding: '12px 0', fontWeight: 700, fontSize: 15 }}>
            PO Total: <span style={{ color: 'var(--accent)' }}>{fmt(poTotal)}</span>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
            <button className="btn btn-primary" onClick={() => setStep(3)} disabled={!lines.length}>Continue → Review</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title">Delivery & Order Details</div>
            <div className="card-sub">Shipping address defaults from buyer — edit if delivery is different.</div>
            <div className="form-grid">
              <div className="form-group">
                <label>Receiver Name</label>
                <input value={reviewForm.rv_name} onChange={set('rv_name')} placeholder="Who receives the goods" />
              </div>
              <div className="form-group">
                <label>Receiver Phone</label>
                <input value={reviewForm.rv_phone} onChange={set('rv_phone')} placeholder="+91…" />
              </div>
              <div className="form-group full">
                <label>Address Line 1</label>
                <input value={reviewForm.rv_addr1} onChange={set('rv_addr1')} />
              </div>
              <div className="form-group full">
                <label>Address Line 2</label>
                <input value={reviewForm.rv_addr2} onChange={set('rv_addr2')} />
              </div>
              <div className="form-group">
                <label>City</label>
                <select value={reviewForm.rv_city} onChange={set('rv_city')}>
                  <option value="">Select…</option>
                  {INDIAN_CITIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>State</label>
                <select value={reviewForm.rv_state} onChange={set('rv_state')}>
                  <option value="">Select…</option>
                  {INDIAN_STATES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Country</label>
                <select value={reviewForm.rv_country} onChange={set('rv_country')}>
                  <option value="">Select…</option>
                  {COUNTRIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>ZIP</label>
                <input value={reviewForm.rv_zip} onChange={set('rv_zip')} />
              </div>
              <div className="form-group">
                <label>Shipping City</label>
                <select value={reviewForm.rv_ship_city} onChange={set('rv_ship_city')}>
                  <option value="">Select…</option>
                  {INDIAN_CITIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>PO Date</label>
                <input type="date" value={reviewForm.po_date} onChange={set('po_date')} />
              </div>
              <div className="form-group">
                <label>Expected Delivery</label>
                <input type="date" value={reviewForm.expected_delivery} onChange={set('expected_delivery')} />
              </div>
              <div className="form-group full">
                <label>Notes</label>
                <input value={reviewForm.notes} onChange={set('notes')} placeholder="Internal notes…" />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Summary</div>
            <div style={{ marginBottom: 12 }}>
              <strong>{buyer?.company_name}</strong> <span className="mono">{buyer?.buyer_id}</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['MATNR', 'Product', 'Qty', 'Unit Price', 'Line Total'].map((h, i) => (
                      <th key={i} style={{ padding: '8px 12px', textAlign: i >= 2 ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lines.map(l => (
                    <tr key={l.matnr} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 12px' }}><span className="mono">{l.matnr}</span></td>
                      <td style={{ padding: '8px 12px' }}>{l.brand}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>{l.qty}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmt(l.unit_price)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}><strong>{fmt(l.qty * l.unit_price)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ textAlign: 'right', padding: '12px 0', fontWeight: 700, fontSize: 16 }}>
              Total: <span style={{ color: 'var(--accent)' }}>{fmt(poTotal)}</span>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button className="btn btn-ghost" onClick={() => setStep(2)}>← Back</button>
              <button className="btn btn-primary" onClick={confirmPO}>✅ Confirm Purchase Order</button>
            </div>
          </div>
        </>
      )}
    </>
  )
}

function AllPOsTab() {
  const showToast = useToast()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [viewOrder, setViewOrder] = useState(null)

  const loadOrders = useCallback(async () => {
    setLoading(true)
    try {
      let url = '/purchase-orders'
      const params = new URLSearchParams()
      if (dateFrom) params.set('from', dateFrom)
      if (dateTo) params.set('to', dateTo)
      if (params.toString()) url += '?' + params.toString()
      const res = await fetch(url)
      setOrders(await res.json())
    } catch { showToast('Could not load POs', 'error') } finally { setLoading(false) }
  }, [dateFrom, dateTo, showToast])

  useEffect(() => { loadOrders() }, [loadOrders])

  const filtered = query
    ? orders.filter(o => Object.values(o).some(v => String(v ?? '').toLowerCase().includes(query.toLowerCase())))
    : orders

  function payBadge(ps) {
    const map = { PAID: 'paid', PENDING: 'pending', CANCELLED: 'cancelled', PARTIALLY_PAID: 'partial' }
    const lbl = ps === 'PARTIALLY_PAID' ? 'Partial' : (ps || '—')
    return <span className={`badge badge-${map[ps] || ''}`}>{lbl}</span>
  }

  async function updateLineStatus(poId, lineNo, status) {
    try {
      const res = await fetch(`/purchase-orders/${poId}/items/${lineNo}/gr`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Update failed')
      }
      showToast(status === 'Goods Receipt' ? '✅ Goods Receipt confirmed — stock updated' : `✅ Line ${lineNo} → ${status}`)
      // Refresh modal
      if (viewOrder) {
        const r = await fetch(`/purchase-orders/${poId}`)
        const d = await r.json()
        setViewOrder(d)
      }
      loadOrders()
    } catch (e) { showToast(`❌ ${e.message}`, 'error') }
  }

  async function updatePOPayment(poId, status) {
    try {
      await fetch(`/purchase-orders/${poId}/payment`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_status: status }),
      })
      loadOrders()
      if (viewOrder && viewOrder.po_id === poId) {
        setViewOrder(prev => ({ ...prev, payment_status: status }))
      }
    } catch (e) { showToast('Update failed', 'error') }
  }

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28 }}>All Purchase Orders</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>View and manage purchase orders.</p>
      </div>

      <div className="toolbar">
        <div className="form-group" style={{ flex: 1 }}>
          <label>Search</label>
          <div className="search-wrap">
            <span className="search-icon">🔍</span>
            <input placeholder="PO ID, buyer name…" value={query} onChange={e => setQuery(e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label>From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ fontSize: 13 }} />
        </div>
        <div className="form-group">
          <label>To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ fontSize: 13 }} />
        </div>
        <button className="btn btn-ghost" style={{ alignSelf: 'flex-end' }} onClick={loadOrders}>↺ Refresh</button>
      </div>

      <div className="stats">
        <div className="stat-pill">Total POs <strong>{filtered.length}</strong></div>
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>PO ID</th><th>Buyer</th><th>Date</th><th>Lines</th>
              <th className="right">Total</th><th>Payment</th><th className="right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="state-row"><td colSpan={7}><span className="spinner" /> Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr className="state-row"><td colSpan={7}>No purchase orders found.</td></tr>
            ) : filtered.map(o => (
              <tr key={o.po_id}>
                <td><span className="mono">{o.po_id}</span></td>
                <td><strong>{o.buyer_name || o.buyer_id}</strong></td>
                <td style={{ fontSize: 12, color: 'var(--muted)' }}>{fmtD(o.po_date)}</td>
                <td>{o.line_count || '—'}</td>
                <td className="right"><strong>{fmt(o.po_total)}</strong></td>
                <td>{payBadge(o.payment_status)}</td>
                <td className="right">
                  <div className="actions">
                    <button className="action-btn btn-view-sm" onClick={async () => {
                      const res = await fetch(`/purchase-orders/${o.po_id}`)
                      const data = await res.json()
                      setViewOrder(data)
                    }}>View</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* PO Detail Modal */}
      {viewOrder && (
        <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setViewOrder(null)}>
          <div className="modal" style={{ maxWidth: 720, width: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-title">PO Details — {viewOrder.po_id}</div>
            <div className="modal-sub">{viewOrder.buyer_name || viewOrder.buyer_id} · {fmtD(viewOrder.po_date)}</div>

            <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>Payment:</span>
              <span className={`badge badge-${({ PAID: 'paid', PENDING: 'pending', PARTIALLY_PAID: 'partial', CANCELLED: 'cancelled' }[viewOrder.payment_status] || 'pending')}`}>
                {viewOrder.payment_status?.replace('_', ' ')}
              </span>
              {viewOrder.payment_status !== 'PAID' && (
                <button className="btn btn-success" style={{ padding: '5px 14px', fontSize: 12 }} onClick={() => updatePOPayment(viewOrder.po_id, 'PAID')}>Mark Paid</button>
              )}
              {viewOrder.payment_status === 'PENDING' && (
                <button className="btn btn-danger" style={{ padding: '5px 14px', fontSize: 12 }} onClick={() => updatePOPayment(viewOrder.po_id, 'CANCELLED')}>Cancel</button>
              )}
            </div>

            <div style={{ overflowX: 'auto', marginBottom: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
                    {['Line', 'MATNR', 'Product', 'Qty', 'Unit Price', 'Line Total', 'Status', ''].map((h, i) => (
                      <th key={i} style={{ padding: '10px 12px', textAlign: i >= 3 && i <= 5 ? 'right' : 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(viewOrder.items || viewOrder.lines || []).map((l, i) => {
                    const lineNo = l.line_no || (i + 1)
                    const status = l.status || 'Created'
                    const isGR = status === 'Goods Receipt'
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 12px', color: 'var(--muted)', fontSize: 12 }}>{lineNo}</td>
                        <td style={{ padding: '10px 12px' }}><span className="mono">{l.matnr}</span></td>
                        <td style={{ padding: '10px 12px' }}>
                          <strong>{l.brand || l.matnr}</strong>
                          {[l.category, l.subcategory, l.size].filter(Boolean).length > 0 && (
                            <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 6 }}>{[l.category, l.subcategory, l.size].filter(Boolean).join(' · ')}</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>{l.quantity}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>{fmt(l.unit_price)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}><strong>{fmt(l.line_total || l.quantity * l.unit_price)}</strong></td>
                        <td style={{ padding: '10px 12px' }}>
                          <span className={`badge badge-${isGR ? 'gr' : status === 'Accepted' ? 'accepted' : 'created'}`}>
                            {isGR ? 'GR Done' : status}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {!isGR && (
                            <select value={status} onChange={e => updateLineStatus(viewOrder.po_id, lineNo, e.target.value)}
                              style={{ fontSize: 11, padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 6 }}>
                              <option value="Created">Created</option>
                              <option value="Accepted">Accepted</option>
                              <option value="Goods Receipt">Mark GR</option>
                            </select>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setViewOrder(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default function PurchaseOrders() {
  const [tab, setTab] = useState('new')
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="page-layout">
      <Sidebar section="PurchaseOrders" activeTab={tab} onTabChange={t => { setTab(t); if (t === 'all') setRefreshKey(k => k + 1) }} />
      <div className="main">
        {tab === 'new' && <NewPOTab onCreated={() => { setTab('all'); setRefreshKey(k => k + 1) }} />}
        {tab === 'all' && <AllPOsTab key={refreshKey} />}
      </div>
    </div>
  )
}
