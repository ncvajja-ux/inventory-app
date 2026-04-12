import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useToast } from '../components/Toast'

const fmt  = n  => '₹' + parseFloat(n || 0).toFixed(2)
const fmtD = s  => s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const dash = v  => v || '—'

function payBadge(ps) {
  const map = { PAID: 'paid', PENDING: 'pending', CANCELLED: 'cancelled', PARTIALLY_PAID: 'partial' }
  const lbl = ps === 'PARTIALLY_PAID' ? 'Partial' : (ps || '—')
  return <span className={`badge badge-${map[ps] || ''}`}>{lbl}</span>
}

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

  // Discount modal state
  const [showDiscModal, setShowDiscModal] = useState(false)
  const [discForm, setDiscForm] = useState({ discount_pct: '', valid_from: '', valid_to: '' })
  const [savingDisc, setSavingDisc] = useState(false)

  useEffect(() => {
    if (!kunnr) { setError('No KUNNR provided'); setLoading(false); return }

    async function loadAll() {
      try {
        const [custRes, ordersRes, discRes, statsRes] = await Promise.all([
          fetch(`/customers/${kunnr}`),
          fetch(`/customers/${kunnr}/orders`),
          fetch(`/customers/${kunnr}/discounts`),
          fetch(`/customers/${kunnr}/stats`),
        ])

        if (custRes.status === 404) throw new Error('Customer not found')

        const [custData, ordersData, discData, statsData] = await Promise.all([
          custRes.json(),
          ordersRes.json(),
          discRes.json(),
          statsRes.json(),
        ])

        setCust(custData)
        setOrders(Array.isArray(ordersData) ? ordersData : [])
        setDiscounts(Array.isArray(discData) ? discData : [])
        setStats(statsData || {})
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadAll()
  }, [kunnr])

  async function loadDiscounts() {
    try { const r = await fetch(`/customers/${kunnr}/discounts`); setDiscounts(await r.json()) } catch {}
  }

  async function saveDiscount() {
    if (!discForm.discount_pct) return showToast('Discount % is required', 'error')
    setSavingDisc(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      const res = await fetch('/pricing/customer-discount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kunnr,
          discount_pct: parseFloat(discForm.discount_pct),
          valid_from: discForm.valid_from || today,
          valid_to: discForm.valid_to || '12319999',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
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

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: 'var(--bg)', minHeight: '100vh' }}>
      {/* Topbar */}
      <div style={{
        background: 'white',
        borderBottom: '1px solid var(--border)',
        padding: '0 40px',
        height: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link to="/customers" style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 14px', border: '1.5px solid var(--border)', borderRadius: 8,
            fontSize: 13, fontWeight: 600, color: 'var(--muted)', textDecoration: 'none',
            background: 'white',
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
        <Link to={`/sales`} style={{
          background: 'var(--accent)', color: 'white',
          padding: '9px 20px', borderRadius: 8,
          fontSize: 13, fontWeight: 600, textDecoration: 'none',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>🧾 New Order</Link>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 40px' }}>

        {/* Customer header + stat pills */}
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
                <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7 }}>
                  {pill.label}
                </label>
                <span style={{ fontSize: 20, fontWeight: 700 }}>{pill.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Profile + Discounts */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

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
              <div style={{ color: 'var(--muted)', fontSize: 13, padding: '8px 0' }}>
                No discounts defined for this customer.
              </div>
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

        {/* Add Discount Modal */}
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

        {/* Order History */}
        <div className="card">
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🧾</span> Order History
            {orders.length > 0 && <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--muted)', marginLeft: 8 }}>{orders.length} records</span>}
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
                    No orders found for this customer.
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
    </div>
  )
}
