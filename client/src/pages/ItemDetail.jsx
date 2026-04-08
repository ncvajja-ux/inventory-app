import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { useToast } from '../components/Toast'

const fmt  = n  => '₹' + parseFloat(n || 0).toFixed(2)
const fmtD = s  => s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const dash = v  => v || '—'

function payBadge(ps) {
  const map = { PAID: 'paid', PENDING: 'pending', CANCELLED: 'cancelled', PARTIALLY_PAID: 'partial' }
  const lbl = ps === 'PARTIALLY_PAID' ? 'Partial' : (ps || '—')
  return <span className={`badge badge-${map[ps] || ''}`}>{lbl}</span>
}

function grBadge(s) {
  const map = { 'Goods Receipt': 'gr', 'Accepted': 'accepted', 'Created': 'created' }
  return <span className={`badge badge-${map[s] || 'created'}`}>{s || '—'}</span>
}

export default function ItemDetail() {
  const { matnr } = useParams()
  const showToast = useToast()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [prod, setProd] = useState(null)
  const [pricing, setPricing] = useState([])
  const [sales, setSales] = useState([])
  const [pos, setPOs] = useState([])

  useEffect(() => {
    if (!matnr) { setError('No MATNR provided'); setLoading(false); return }

    async function loadAll() {
      try {
        const [prodRes, salesRes, poRes, pricingRes] = await Promise.all([
          fetch(`/inventory/${matnr}`),
          fetch(`/inventory/${matnr}/sales-history`),
          fetch(`/inventory/${matnr}/po-history`),
          fetch(`/inventory/${matnr}/pricing`),
        ])

        if (prodRes.status === 404) throw new Error('Product not found')

        const [prodData, salesData, posData, pricingData] = await Promise.all([
          prodRes.json(),
          salesRes.json(),
          poRes.json(),
          pricingRes.json(),
        ])

        setProd(prodData)
        setSales(Array.isArray(salesData) ? salesData : [])
        setPOs(Array.isArray(posData) ? posData : [])
        setPricing(Array.isArray(pricingData) ? pricingData : [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadAll()
  }, [matnr])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--muted)' }}>
          <span className="spinner" />
          <p style={{ marginTop: 12 }}>Loading product…</p>
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
          <Link to="/inventory" style={{ color: 'var(--accent)', fontWeight: 600 }}>← Back to Inventory</Link>
        </div>
      </div>
    )
  }

  const today = new Date().toISOString().split('T')[0]
  const activePrice = pricing.find(r =>
    r.valid_from <= today && (!r.valid_to || r.valid_to >= today || r.valid_to === '12319999')
  )
  const displayMrp = parseFloat(prod?.mrp) || (activePrice ? parseFloat(activePrice.unit_price) : 0)
  const avail = Math.max(0, (prod?.quantity || 0) - (prod?.reserved || 0))
  const subtitle = [prod?.brandfamily, prod?.gender, prod?.category, prod?.subcategory, prod?.subsubcategory, prod?.size, prod?.color, prod?.fit].filter(Boolean).join(' · ')

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: 'var(--bg)', minHeight: '100vh' }}>
      {/* Topbar */}
      <div style={{
        background: 'white', borderBottom: '1px solid var(--border)',
        padding: '0 40px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link to="/inventory" style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 14px', border: '1.5px solid var(--border)', borderRadius: 8,
            fontSize: 13, fontWeight: 600, color: 'var(--muted)', textDecoration: 'none', background: 'white',
          }}>← Inventory</Link>
          <span style={{
            fontFamily: 'Courier New, monospace', fontSize: 13,
            background: 'var(--accent2)', color: '#92650a',
            border: '1px solid #e8d0a0', borderRadius: 6,
            padding: '4px 10px', fontWeight: 700,
          }}>{matnr}</span>
          <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18 }}>
            {prod?.brand || 'Item Detail'}
          </span>
        </div>
        <Link to={`/inventory?edit=${matnr}`} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 14px', border: '1.5px solid var(--border)', borderRadius: 8,
          fontSize: 13, fontWeight: 600, color: 'var(--muted)', textDecoration: 'none', background: 'white',
        }}>✏️ Edit Product</Link>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 40px' }}>

        {/* Product header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 32, marginBottom: 4 }}>{prod?.brand || '—'}</div>
          <div style={{ fontSize: 15, color: 'var(--muted)', marginBottom: 12 }}>{subtitle || '—'}</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { label: 'In Stock', value: prod?.quantity || 0, cls: { background: '#dcfce7', color: '#15803d' } },
              { label: 'Reserved', value: prod?.reserved || 0, cls: { background: '#fef9c3', color: '#854d0e' } },
              { label: 'Available', value: avail, cls: { background: '#dbeafe', color: '#1d4ed8' } },
              { label: 'Cost Price', value: fmt(prod?.cost_price), cls: { background: '#f1f5f9', color: '#475569' } },
              { label: 'Sales Price', value: fmt(displayMrp), cls: { background: 'var(--accent2)', color: '#92650a' } },
            ].map(pill => (
              <div key={pill.label} style={{
                padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 80, textAlign: 'center',
                ...pill.cls,
              }}>
                <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7 }}>{pill.label}</label>
                <span>{pill.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Product Details + Pricing */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

          {/* Product Details */}
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>📋</span> Product Details
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                ['MATNR', <span className="mono">{prod?.matnr}</span>],
                ['Brand', dash(prod?.brand)],
                ['Brand Family', dash(prod?.brandfamily)],
                ['Gender', dash(prod?.gender)],
                ['Category', dash(prod?.category)],
                ['Sub-Category', dash(prod?.subcategory)],
                ['L3', dash(prod?.subsubcategory)],
                ['Size', dash(prod?.size)],
                ['Color', dash(prod?.color)],
                ['Fit', dash(prod?.fit)],
                ['Tax Category', dash(prod?.tax_category)],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)' }}>{label}</label>
                  <span style={{ fontSize: 14 }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing Records */}
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>💰</span> Sales Pricing
            </div>
            {pricing.length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: 13, padding: '8px 0' }}>No sales prices defined yet.</div>
            ) : pricing.map((r, i) => {
              const isActive = r.valid_from <= today && (!r.valid_to || r.valid_to >= today || r.valid_to === '12319999')
              return (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 0', borderBottom: i < pricing.length - 1 ? '1px solid var(--border)' : 'none',
                  ...(isActive ? { background: 'var(--accent2)', borderRadius: 8, padding: '10px 12px', margin: '4px -12px' } : {}),
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {fmt(r.unit_price)}
                      {isActive && <span style={{ background: '#15803d', color: 'white', borderRadius: 10, fontSize: 10, padding: '1px 7px', fontWeight: 700, verticalAlign: 'middle', marginLeft: 8 }}>ACTIVE</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      {r.valid_from} → {r.valid_to === '12319999' ? 'Open' : (r.valid_to || 'Open')}
                    </div>
                  </div>
                </div>
              )
            })}
            <div style={{ marginTop: 12 }}>
              <Link to={`/sales`} style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
                + Add / Update Price →
              </Link>
            </div>
          </div>
        </div>

        {/* Sales History */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🧾</span> Sales History
            {sales.length > 0 && <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--muted)', marginLeft: 8 }}>{sales.length} records</span>}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 500 }}>
              <thead>
                <tr>
                  {['Order ID', 'Type', 'Customer', 'Date', 'Qty', 'MRP', 'GST%', 'Line Total', 'Payment'].map((h, i) => (
                    <th key={i} style={{ padding: '10px 12px', textAlign: i >= 4 && i <= 7 ? 'right' : 'left', fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--muted)', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sales.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--muted)', fontSize: 13 }}>No sales history for this product.</td></tr>
                ) : sales.map((r, i) => {
                  const isReturn = r.order_type === 'R'
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 12px' }}>
                        <Link to={`/invoice?order_id=${r.order_id}`} style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' }}>{r.order_id}</Link>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span className={`badge badge-${isReturn ? 'r' : 's'}`}>{isReturn ? 'RETURN' : 'SALE'}</span>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 13 }}>{r.customer_name || r.kunnr}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--muted)' }}>{fmtD(r.created_at)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>{r.quantity || 0}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>{fmt(r.mrp)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <span style={{ background: '#dcfce7', color: '#15803d', borderRadius: 10, padding: '1px 6px', fontSize: 11, fontWeight: 600 }}>{r.gst_rate || 0}%</span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}><strong>{fmt(r.line_total)}</strong></td>
                      <td style={{ padding: '10px 12px' }}>{payBadge(r.payment_status)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* PO History */}
        <div className="card">
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>📦</span> Purchase History
            {pos.length > 0 && <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--muted)', marginLeft: 8 }}>{pos.length} records</span>}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 500 }}>
              <thead>
                <tr>
                  {['PO ID', 'Buyer', 'Date', 'Qty', 'Unit Price', 'Line Total', 'GR Status', 'Payment'].map((h, i) => (
                    <th key={i} style={{ padding: '10px 12px', textAlign: i >= 3 && i <= 5 ? 'right' : 'left', fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--muted)', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pos.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--muted)', fontSize: 13 }}>No purchase history for this product.</td></tr>
                ) : pos.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#92650a' }}>{r.po_id}</span>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 13 }}>{r.buyer_name || r.buyer_id}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--muted)' }}>{fmtD(r.po_date)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>{r.quantity || 0}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>{fmt(r.unit_price)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}><strong>{fmt(r.line_total)}</strong></td>
                    <td style={{ padding: '10px 12px' }}>{grBadge(r.status)}</td>
                    <td style={{ padding: '10px 12px' }}>{payBadge(r.payment_status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
