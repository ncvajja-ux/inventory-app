import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useToast } from '../components/Toast'

const fmt  = n  => '₹' + parseFloat(n || 0).toFixed(2)
const fmtD = s  => s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export default function Invoice() {
  const [searchParams] = useSearchParams()
  const orderId = searchParams.get('order_id')
  const showToast = useToast()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [order, setOrder] = useState(null)
  const [paidAmountInput, setPaidAmountInput] = useState('')

  async function loadOrder() {
    if (!orderId) { setError('No order ID provided'); setLoading(false); return }
    try {
      const res = await fetch(`/orders/${orderId}`)
      if (!res.ok) throw new Error('Order not found')
      const data = await res.json()
      setOrder(data)
      setPaidAmountInput(data.paid_amount > 0 ? String(data.paid_amount) : '')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadOrder() }, [orderId])

  async function updatePayment(status, autoAmount) {
    // If marking PAID with no amount entered, default to the order grand total
    const paid = autoAmount != null ? autoAmount : (parseFloat(paidAmountInput) || 0)
    try {
      const res = await fetch(`/orders/${orderId}/payment`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_status: status, paid_amount: paid }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Update failed')
      showToast('✅ Payment status updated')
      loadOrder()
    } catch (err) {
      showToast('❌ ' + err.message, 'error')
    }
  }

  if (loading) {
    return (
      <div style={{ fontFamily: "'DM Sans', sans-serif", background: 'var(--bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--muted)' }}>
          <span className="spinner" style={{ width: 24, height: 24, borderWidth: 3 }} />
          <p style={{ marginTop: 16 }}>Loading order…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ fontFamily: "'DM Sans', sans-serif", background: 'var(--bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--muted)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>😕</div>
          <p style={{ marginBottom: 12 }}>{error}</p>
          <Link to="/sales" style={{ color: 'var(--accent)', fontWeight: 600 }}>← Back to Sales</Link>
        </div>
      </div>
    )
  }

  const o = order
  const isReturn = o.order_type === 'R'
  const ps = o.payment_status || 'PENDING'

  // Compute totals from line items
  let subtotalPreDisc = 0, prodDiscTotal = 0, subtotal = 0, totalGst = 0
  const items = o.items || []
  items.forEach(item => {
    const mrp      = parseFloat(item.mrp || item.price || 0)
    const discPct  = parseFloat(item.discount_pct || 0)
    const gstRate  = parseFloat(item.gst_rate || 0)
    const netPrice = mrp * (1 - discPct / 100)
    const gstAmt   = netPrice * (gstRate / 100)
    subtotalPreDisc += mrp * item.quantity
    prodDiscTotal   += (mrp - netPrice) * item.quantity
    subtotal  += netPrice * item.quantity
    totalGst  += gstAmt * item.quantity
  })
  const custDiscPct  = o.customer_discount_pct || 0
  const custDisc     = (subtotal + totalGst) * (custDiscPct / 100)
  const manualDisc   = parseFloat(o.manual_discount || 0)
  const grand        = subtotal + totalGst - custDisc - manualDisc
  const paid     = parseFloat(o.paid_amount || 0)
  const balance  = grand - paid

  const statusClsMap = { PENDING: 'pending', PAID: 'paid', PARTIALLY_PAID: 'partial', CANCELLED: 'cancelled' }
  const statusCls = statusClsMap[ps] || 'pending'

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: 'var(--bg)', minHeight: '100vh' }}>
      {/* Topbar — hidden on print */}
      <div className="topbar no-print">
        <div className="topbar-left">
          <Link to="/sales" style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 14px', border: '1.5px solid var(--border)', borderRadius: 8,
            fontSize: 13, fontWeight: 600, color: 'var(--muted)', textDecoration: 'none', background: 'white',
          }}>← All Orders</Link>
          <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20 }}>Order Detail</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-print" onClick={() => window.print()}>🖨️ Print / Save PDF</button>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '36px 40px' }}>

        {/* Print header — only shown when printing */}
        <div className="print-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28 }}>Fat Closet</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Store Manager</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>TAX INVOICE</div>
              <div style={{ fontFamily: 'Courier New, monospace', fontSize: 13, marginTop: 4 }}>Order #{o.order_id}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Date: {fmtD(o.created_at)}</div>
            </div>
          </div>
        </div>

        {/* Return banner */}
        {isReturn && (
          <div className="no-print" style={{
            display: 'flex', alignItems: 'center', gap: 16,
            padding: '14px 20px', background: '#fee2e2', border: '1px solid #fecaca',
            borderRadius: 12, marginBottom: 16, flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: 20 }}>↩️</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--danger)' }}>RETURN ORDER</div>
              <div style={{ fontSize: 13, color: 'var(--danger)', marginTop: 2 }}>
                {o.original_order_id ? `Return against ${o.original_order_id}` : 'Unlinked Return'}
              </div>
            </div>
            {o.return_reason && (
              <div style={{ background: 'white', border: '1px solid #fecaca', borderRadius: 8, padding: '6px 14px', fontSize: 13 }}>
                {o.return_reason}
              </div>
            )}
          </div>
        )}

        {/* Status bar */}
        <div className={`status-bar ${statusCls}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderRadius: 12, marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="status-label">{ps.replace('_', ' ')}</div>
            <div style={{ fontSize: 13, marginTop: 2 }}>
              {ps === 'PAID' ? `Paid in full on ${fmtD(o.created_at)}` :
               ps === 'PARTIALLY_PAID' ? `${fmt(paid)} received — balance due` :
               ps === 'CANCELLED' ? 'Order cancelled — stock reservation released' :
               'Awaiting payment'}
            </div>
          </div>
          {ps !== 'CANCELLED' && (
            <div className="payment-controls no-print" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="number"
                    value={paidAmountInput}
                    onChange={e => setPaidAmountInput(e.target.value)}
                    placeholder={isReturn ? 'Refund amount (₹)' : 'Amount received (₹)'}
                    min="0" step="0.01"
                    style={{ padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, width: 160, fontFamily: "'DM Sans', sans-serif", outline: 'none' }}
                  />
                  {!isReturn && ps !== 'PAID' && (
                    <button
                      onClick={() => setPaidAmountInput(grand.toFixed(2))}
                      style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1.5px solid var(--border)', background: 'var(--accent2)', color: '#92650a', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontWeight: 600, whiteSpace: 'nowrap' }}
                    >Full ₹{grand.toFixed(0)}</button>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {ps !== 'PAID' && (
                  <button className="btn btn-success" onClick={() => {
                    // If amount is blank and marking as PAID, auto-use the grand total
                    const amt = parseFloat(paidAmountInput)
                    updatePayment('PAID', isNaN(amt) || amt === 0 ? (isReturn ? undefined : grand) : undefined)
                  }}>
                    ✅ {isReturn ? 'Mark Refund Issued' : 'Mark as Paid'}
                  </button>
                )}
                {ps === 'PENDING' && !isReturn && (
                  <button
                    className="btn btn-primary"
                    onClick={() => updatePayment('PARTIALLY_PAID')}
                    disabled={o.customer_status === 'Credit Hold'}
                    title={o.customer_status === 'Credit Hold' ? 'Partial payment disabled — customer is on Credit Hold' : undefined}
                    style={o.customer_status === 'Credit Hold' ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
                  >
                    💰 Partial Payment
                  </button>
                )}
                {ps !== 'CANCELLED' && ps !== 'PAID' && !isReturn && (
                  <button className="btn btn-danger" onClick={() => updatePayment('CANCELLED')}>
                    ✕ Cancel
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Customer info — full width */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title">Customer</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            {[
              ['Name',    <strong>{o.name || '—'}</strong>],
              ['KUNNR',   <span className="mono">{o.kunnr}</span>],
              ['Order ID',  <span className="mono">{o.order_id}</span>],
              ['Order Date', fmtD(o.created_at)],
              ...(o.number  ? [['Phone',   o.number]]  : []),
              ...(o.email   ? [['Email',   o.email]]   : []),
              ...(o.gstin   ? [['GSTIN',   o.gstin]]   : []),
              ...(o.address ? [['Address', o.address]] : []),
            ].map(([label, value]) => (
              <div key={label} className="info-field">
                <label>{label}</label>
                <span>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Line items */}
        <div className="card">
          <div className="card-title">Line Items</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Product</th><th>Details</th>
                  <th className="right">MRP</th><th className="right">Disc %</th>
                  <th className="right">Price</th><th className="right">GST</th>
                  <th className="right">Qty</th><th className="right">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr className="state-row"><td colSpan={9}>No line items.</td></tr>
                ) : items.map((item, idx) => {
                  const mrp      = parseFloat(item.mrp || item.price || 0)
                  const discPct  = parseFloat(item.discount_pct || 0)
                  const gstRate  = parseFloat(item.gst_rate || 0)
                  const gstAmt   = mrp * (gstRate / 100)
                  const netPrice = mrp * (1 - discPct / 100)
                  const lineTotal = (netPrice + gstAmt) * item.quantity
                  return (
                    <tr key={idx}>
                      <td style={{ color: 'var(--muted)', fontSize: 12 }}>{idx + 1}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{item.brand || '—'}</div>
                        <span className="mono" style={{ fontSize: 11 }}>{item.matnr}</span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--muted)' }}>
                        {[item.category, item.subcategory, item.subsubcategory, item.size, item.color, item.fit].filter(Boolean).join(' · ')}
                      </td>
                      <td className="right">{fmt(mrp)}</td>
                      <td className="right">{discPct > 0 ? <span style={{ color: 'var(--danger)' }}>{discPct}%</span> : '—'}</td>
                      <td className="right">{fmt(netPrice)}</td>
                      <td className="right"><span className="gst-pill">{gstRate}%</span></td>
                      <td className="right">{item.quantity}</td>
                      <td className="right"><strong>{fmt(lineTotal)}</strong></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
            <div style={{ minWidth: 300 }}>
              {prodDiscTotal > 0 && (
                <div className="totals-row muted"><span>Gross Amount</span><span>{isReturn ? '-' : ''}{fmt(subtotalPreDisc)}</span></div>
              )}
              {prodDiscTotal > 0 && (
                <div className="totals-row disc"><span>Product Discount</span><span>−{fmt(prodDiscTotal)}</span></div>
              )}
              <div className="totals-row muted"><span>Subtotal (ex-GST)</span><span>{isReturn ? '-' : ''}{fmt(subtotal)}</span></div>
              <div className="totals-row muted"><span>GST</span><span>{isReturn ? '-' : ''}{fmt(totalGst)}</span></div>
              {custDisc > 0 && (
                <div className="totals-row disc"><span>Customer Discount ({custDiscPct}%)</span><span>−{fmt(custDisc)}</span></div>
              )}
              {manualDisc > 0 && (
                <div className="totals-row disc"><span>Manual Discount</span><span>−{fmt(manualDisc)}</span></div>
              )}
              <div className="totals-row grand" style={{ color: isReturn ? 'var(--danger)' : undefined }}>
                <span>Grand Total</span><span>{isReturn ? '-' : ''}{fmt(grand)}</span>
              </div>
              {paid > 0 && ps !== 'PAID' && (
                <>
                  <div className="totals-row muted"><span>Amount Paid</span><span>{fmt(paid)}</span></div>
                  <div className="totals-row"><span style={{ fontWeight: 600 }}>Balance Due</span><span style={{ fontWeight: 600, color: 'var(--danger)' }}>{fmt(balance)}</span></div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body { background: white; }
          .topbar, .status-bar, .no-print { display: none !important; }
          .content { max-width: 100%; padding: 0; margin: 0; }
          .card { box-shadow: none; border: 1px solid #ddd; page-break-inside: avoid; }
          .print-header { display: block !important; }
          table { min-width: auto; }
          .btn-print { display: none; }
        }
        .print-header { display: none; border-bottom: 2px solid var(--ink); padding-bottom: 16px; margin-bottom: 24px; }
        .topbar.no-print { background: white; border-bottom: 1px solid var(--border); padding: 0 40px; height: 64px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 50; }
        .topbar-left { display: flex; align-items: center; gap: 16px; }
        .btn-print { background: white; border: 1.5px solid var(--border); color: var(--ink); padding: 9px 20px; border-radius: 8px; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .btn-print:hover { border-color: var(--accent); color: var(--accent); }
        .btn-success { background: var(--success); color: white; padding: 9px 20px; border-radius: 8px; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; border: none; cursor: pointer; }
        .btn-danger { background: #fee2e2; color: var(--danger); padding: 9px 20px; border-radius: 8px; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; border: none; cursor: pointer; }
        .btn-primary { background: var(--accent); color: white; padding: 9px 20px; border-radius: 8px; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; border: none; cursor: pointer; }
        .status-bar.pending { background: #fef9c3; border: 1px solid #fde68a; }
        .status-bar.paid { background: #dcfce7; border: 1px solid #bbf7d0; }
        .status-bar.partial { background: #dbeafe; border: 1px solid #bfdbfe; }
        .status-bar.cancelled { background: #fee2e2; border: 1px solid #fecaca; }
        .status-label { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
        .status-bar.pending .status-label { color: #854d0e; }
        .status-bar.paid .status-label { color: #15803d; }
        .status-bar.partial .status-label { color: #1d4ed8; }
        .status-bar.cancelled .status-label { color: var(--danger); }
        .card { background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 24px 28px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
        .card-title { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); margin-bottom: 16px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .info-field label { font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); display: block; margin-bottom: 3px; }
        .info-field span { font-size: 14px; }
        .table-wrap { overflow-x: auto; }
        .gst-pill { display: inline-block; background: #dcfce7; color: #15803d; border-radius: 10px; padding: 1px 7px; font-size: 11px; font-weight: 600; }
        .totals-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; border-bottom: 1px solid var(--border); }
        .totals-row:last-child { border-bottom: none; }
        .totals-row.grand { font-size: 18px; font-weight: 700; padding-top: 12px; }
        .totals-row.muted { color: var(--muted); font-size: 13px; }
        .totals-row.disc { color: var(--danger); font-size: 13px; }
      `}</style>
    </div>
  )
}
