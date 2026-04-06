import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from '../components/Toast'

const DARK = {
  '--bg': '#0f0f0f',
  '--surface': '#1a1a1a',
  '--surface2': '#242424',
  '--border': '#2e2e2e',
  '--text': '#e8e8e8',
  '--muted': '#888',
  '--gold': '#c9a84c',
  '--green': '#4caf74',
  '--red': '#c05a5a',
  '--rust': '#c05a35',
  '--sage': '#6a9e7f',
  '--blue': '#5b8dee',
  '--yellow': '#e0a820',
}

function applyDark(el) {
  if (!el) return
  Object.entries(DARK).forEach(([k, v]) => el.style.setProperty(k, v))
}

function KpiCard({ label, value, sub, color }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--muted)', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: color || 'var(--gold)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{sub}</div>}
    </div>
  )
}

function BarChart({ data, valueKey, labelKey, color, maxWidth = 320 }) {
  if (!data || data.length === 0) return <div style={{ color: 'var(--muted)', fontSize: 13 }}>No data</div>
  const max = Math.max(...data.map(d => d[valueKey] || 0), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 130, fontSize: 12, color: 'var(--muted)', textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {d[labelKey]}
          </div>
          <div style={{ flex: 1, height: 20, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${Math.round((d[valueKey] / max) * 100)}%`,
              background: color || 'var(--gold)',
              borderRadius: 4,
              minWidth: d[valueKey] > 0 ? 4 : 0,
              transition: 'width 0.4s ease',
            }} />
          </div>
          <div style={{ width: 70, fontSize: 12, fontVariantNumeric: 'tabular-nums', color: 'var(--text)', flexShrink: 0 }}>
            {typeof d[valueKey] === 'number' && d[valueKey] > 999
              ? d[valueKey] >= 100000
                ? `₹${(d[valueKey] / 100000).toFixed(1)}L`
                : `₹${(d[valueKey] / 1000).toFixed(1)}K`
              : d[valueKey]}
          </div>
        </div>
      ))}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--gold)',
        marginBottom: 16,
        paddingBottom: 8,
        borderBottom: '1px solid var(--border)',
      }}>{title}</div>
      {children}
    </div>
  )
}

function fmt(n) {
  if (n == null || isNaN(n)) return '—'
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`
  return `₹${Number(n).toFixed(0)}`
}

function computeAnalytics(orders, inventory, customers, purchaseOrders, from, to) {
  const inRange = (dateStr) => {
    if (!dateStr) return false
    const d = new Date(dateStr)
    return (!from || d >= from) && (!to || d <= to)
  }

  const salesOrders = orders.filter(o => o.order_type !== 'R' && inRange(o.order_date))
  const returnOrders = orders.filter(o => o.order_type === 'R' && inRange(o.order_date))
  const allSales = orders.filter(o => o.order_type !== 'R')
  const allReturns = orders.filter(o => o.order_type === 'R')

  // Revenue
  const revenue = salesOrders.reduce((s, o) => s + (o.grand_total || 0), 0)
  const returnValue = returnOrders.reduce((s, o) => s + Math.abs(o.grand_total || 0), 0)
  const netRevenue = revenue - returnValue
  const avgOrderValue = salesOrders.length ? revenue / salesOrders.length : 0
  const paidOrders = salesOrders.filter(o => o.payment_status === 'PAID')
  const pendingRevenue = salesOrders.filter(o => o.payment_status === 'PENDING' || o.payment_status === 'PARTIALLY_PAID')
    .reduce((s, o) => s + ((o.grand_total || 0) - (o.amount_paid || 0)), 0)

  // Monthly trend (last 6 months or in range)
  const monthMap = {}
  salesOrders.forEach(o => {
    const d = new Date(o.order_date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!monthMap[key]) monthMap[key] = { revenue: 0, orders: 0 }
    monthMap[key].revenue += o.grand_total || 0
    monthMap[key].orders += 1
  })
  const monthTrend = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([k, v]) => ({ month: k, ...v }))

  // Inventory
  const totalSKUs = inventory.length
  const inStock = inventory.filter(i => (i.qty_on_hand || 0) > 0).length
  const outOfStock = inventory.filter(i => (i.qty_on_hand || 0) <= 0).length
  const totalStock = inventory.reduce((s, i) => s + (i.qty_on_hand || 0), 0)
  const inventoryValue = inventory.reduce((s, i) => s + ((i.cost_price || 0) * (i.qty_on_hand || 0)), 0)

  // Top sellers by qty sold (from order lines - we estimate from orders)
  // Category distribution from inventory
  const catMap = {}
  inventory.forEach(i => {
    const cat = i.category || 'Unknown'
    if (!catMap[cat]) catMap[cat] = { category: cat, count: 0, stock: 0 }
    catMap[cat].count++
    catMap[cat].stock += i.qty_on_hand || 0
  })
  const categoryStock = Object.values(catMap).sort((a, b) => b.stock - a.stock).slice(0, 8)

  // Customers
  const uniqueCustomers = new Set(salesOrders.map(o => o.kunnr)).size
  const newCustomerOrders = salesOrders.filter(o => {
    const prevOrders = allSales.filter(ao => ao.kunnr === o.kunnr && new Date(ao.order_date) < new Date(o.order_date))
    return prevOrders.length === 0
  })
  const repeatCustomers = new Set(
    salesOrders.filter(o => {
      const prev = allSales.filter(ao => ao.kunnr === o.kunnr && ao.order_id !== o.order_id)
      return prev.length > 0
    }).map(o => o.kunnr)
  ).size

  const customerRevMap = {}
  salesOrders.forEach(o => {
    if (!customerRevMap[o.kunnr]) customerRevMap[o.kunnr] = { kunnr: o.kunnr, name: o.customer_name || o.kunnr, revenue: 0, orders: 0 }
    customerRevMap[o.kunnr].revenue += o.grand_total || 0
    customerRevMap[o.kunnr].orders++
  })
  const topCustomers = Object.values(customerRevMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10)

  // Top products (from order lines if available)
  const productMap = {}
  salesOrders.forEach(o => {
    if (!o.items) return
    o.items.forEach(item => {
      const k = item.matnr
      if (!productMap[k]) productMap[k] = { matnr: k, brand: item.brand || '—', units: 0, revenue: 0 }
      productMap[k].units += item.quantity || 0
      productMap[k].revenue += (parseFloat(item.mrp || 0)) * (item.quantity || 0)
    })
  })
  const topProducts = Object.values(productMap).sort((a, b) => b.units - a.units).slice(0, 10)

  // Low stock from inventory
  const lowStock = inventory.filter(i => {
    const avail = (i.quantity || 0) - (i.reserved || 0)
    return avail >= 0 && avail <= 3
  }).slice(0, 20)

  // Returns
  const returnRate = allSales.length ? (allReturns.length / allSales.length) * 100 : 0
  const returnReasonMap = {}
  returnOrders.forEach(o => {
    const reason = o.return_reason || 'Unspecified'
    returnReasonMap[reason] = (returnReasonMap[reason] || 0) + 1
  })
  const returnReasons = Object.entries(returnReasonMap)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)

  // Purchase Orders
  const posInRange = purchaseOrders.filter(p => inRange(p.created_at || p.po_date))
  const totalPOValue = posInRange.reduce((s, p) => s + (p.total_value || 0), 0)
  const pendingPOs = posInRange.filter(p => p.status === 'Created' || p.status === 'Accepted').length
  const completedPOs = posInRange.filter(p => p.status === 'Goods Receipt').length

  return {
    revenue: { total: revenue, net: netRevenue, avg: avgOrderValue, pending: pendingRevenue, paid: paidOrders.length, count: salesOrders.length, monthTrend },
    inventory: { totalSKUs, inStock, outOfStock, totalStock, value: inventoryValue, categoryStock, lowStock },
    customers: { unique: uniqueCustomers, repeat: repeatCustomers, newCount: newCustomerOrders.length, topCustomers },
    returns: { count: returnOrders.length, value: returnValue, rate: returnRate, reasons: returnReasons },
    pos: { count: posInRange.length, value: totalPOValue, pending: pendingPOs, completed: completedPOs },
    topProducts,
  }
}

function getPeriodDates(period) {
  const to = new Date()
  to.setHours(23, 59, 59, 999)
  const from = new Date()
  if (period === '7d') { from.setDate(from.getDate() - 7) }
  else if (period === '30d') { from.setDate(from.getDate() - 30) }
  else if (period === '90d') { from.setDate(from.getDate() - 90) }
  else if (period === '1y') { from.setFullYear(from.getFullYear() - 1) }
  else { return { from: null, to: null } }
  from.setHours(0, 0, 0, 0)
  return { from, to }
}

export default function Analytics() {
  const showToast = useToast()
  const [period, setPeriod] = useState('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const containerRef = (el) => applyDark(el)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [ordersRes, inventoryRes, customersRes, posRes] = await Promise.all([
        fetch('/orders'),
        fetch('/inventory'),
        fetch('/customers'),
        fetch('/purchase-orders'),
      ])
      const [orders, inventory, customers, purchaseOrders] = await Promise.all([
        ordersRes.json(),
        inventoryRes.json(),
        customersRes.json(),
        posRes.json(),
      ])

      let from, to
      if (period === 'custom') {
        from = customFrom ? new Date(customFrom) : null
        to = customTo ? new Date(customTo + 'T23:59:59') : null
      } else {
        const dates = getPeriodDates(period)
        from = dates.from
        to = dates.to
      }

      setData(computeAnalytics(
        Array.isArray(orders) ? orders : [],
        Array.isArray(inventory) ? inventory : [],
        Array.isArray(customers) ? customers : [],
        Array.isArray(purchaseOrders) ? purchaseOrders : [],
        from, to
      ))
    } catch (err) {
      showToast('Could not load analytics data', 'error')
    } finally {
      setLoading(false)
    }
  }, [period, customFrom, customTo, showToast])

  useEffect(() => { loadData() }, [loadData])

  const PERIODS = [
    { key: '7d', label: '7 Days' },
    { key: '30d', label: '30 Days' },
    { key: '90d', label: '90 Days' },
    { key: '1y', label: '1 Year' },
    { key: 'all', label: 'All Time' },
    { key: 'custom', label: 'Custom' },
  ]

  return (
    <div ref={containerRef} style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Dark Topbar */}
      <div style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '0 32px',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <Link to="/" style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: 12, letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 6 }}>← Home</Link>
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, color: 'var(--text)' }}>
            Fat Closet <span style={{ color: 'var(--gold)' }}>/</span> Analytics
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={loadData}
            style={{
              background: 'none', border: '1px solid var(--border)', color: 'var(--muted)',
              padding: '6px 14px', fontFamily: "'DM Sans', sans-serif", fontSize: 11,
              letterSpacing: 2, textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s',
            }}
          >↻ Refresh</button>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 32px 64px' }}>

        {/* Period Filter */}
        <div style={{ marginBottom: 36, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', marginRight: 4 }}>Period</span>
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              style={{
                border: `1px solid ${period === p.key ? 'var(--gold)' : 'var(--border)'}`,
                background: period === p.key ? 'var(--gold)' : 'none',
                color: period === p.key ? '#0f0f0f' : 'var(--muted)',
                padding: '7px 16px', fontFamily: "'DM Sans', sans-serif", fontSize: 12,
                cursor: 'pointer', fontWeight: period === p.key ? 600 : 400, transition: 'all 0.2s',
              }}
            >{p.label}</button>
          ))}
          <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 8px' }} />
          <input
            type="date"
            value={customFrom}
            onChange={e => { setCustomFrom(e.target.value); setPeriod('custom') }}
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', padding: '7px 12px', fontFamily: "'DM Sans', sans-serif", fontSize: 12, colorScheme: 'dark' }}
          />
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>→</span>
          <input
            type="date"
            value={customTo}
            onChange={e => { setCustomTo(e.target.value); setPeriod('custom') }}
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', padding: '7px 12px', fontFamily: "'DM Sans', sans-serif", fontSize: 12, colorScheme: 'dark' }}
          />
        </div>

        {loading ? (
          <div style={{ color: 'var(--muted)', fontSize: 14, textAlign: 'center', paddingTop: 60 }}>
            Loading analytics…
          </div>
        ) : !data ? null : (
          <>
            {/* Revenue & Sales */}
            <Section title="Revenue & Sales">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
                <KpiCard label="Total Revenue" value={fmt(data.revenue.total)} color="var(--gold)" />
                <KpiCard label="Net Revenue" value={fmt(data.revenue.net)} sub="After returns" color="var(--green)" />
                <KpiCard label="Orders" value={data.revenue.count} color="var(--blue)" />
                <KpiCard label="Avg Order Value" value={fmt(data.revenue.avg)} color="var(--text)" />
                <KpiCard label="Pending Collection" value={fmt(data.revenue.pending)} color="var(--yellow)" />
              </div>
              {data.revenue.monthTrend.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>Monthly Revenue Trend</div>
                  <BarChart
                    data={data.revenue.monthTrend}
                    labelKey="month"
                    valueKey="revenue"
                    color="var(--gold)"
                  />
                </div>
              )}
            </Section>

            {/* Top Products */}
            {data.topProducts && data.topProducts.length > 0 && (
              <Section title="Top Products">
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 12 }}>
                  <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Top Products by Units Sold</span>
                    <span style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--surface2)', padding: '3px 10px', borderRadius: 20 }}>Top 10 · in period</span>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '10px 22px', textAlign: 'left', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500 }}>#</th>
                        <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500 }}>MATNR</th>
                        <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500 }}>Brand</th>
                        <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500 }}>Units</th>
                        <th style={{ padding: '10px 22px', textAlign: 'right', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500 }}>Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topProducts.map((p, i) => {
                        const maxUnits = data.topProducts[0]?.units || 1
                        return (
                          <tr key={p.matnr} style={{ borderBottom: i < data.topProducts.length - 1 ? '1px solid rgba(46,46,46,0.5)' : 'none' }}>
                            <td style={{ padding: '11px 22px', fontFamily: "'DM Serif Display', serif", fontSize: 18, color: 'var(--muted)', minWidth: 40 }}>{i + 1}</td>
                            <td style={{ padding: '11px 16px', fontFamily: 'monospace', fontSize: 12, color: 'var(--gold)', background: 'rgba(201,168,76,0.1)', paddingLeft: 8, paddingRight: 8, borderRadius: 3 }}>{p.matnr}</td>
                            <td style={{ padding: '11px 16px', color: 'var(--text)' }}>{p.brand}</td>
                            <td style={{ padding: '11px 16px', textAlign: 'right' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
                                <div style={{ width: 80, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${Math.round((p.units / maxUnits) * 100)}%`, background: 'var(--gold)', borderRadius: 2 }} />
                                </div>
                                <span style={{ minWidth: 30, textAlign: 'right', color: 'var(--text)' }}>{p.units}</span>
                              </div>
                            </td>
                            <td style={{ padding: '11px 22px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text)' }}>{fmt(p.revenue)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}

            {/* Inventory */}
            <Section title="Inventory">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
                <KpiCard label="Total SKUs" value={data.inventory.totalSKUs} color="var(--text)" />
                <KpiCard label="In Stock" value={data.inventory.inStock} sub={`${data.inventory.totalStock} units`} color="var(--green)" />
                <KpiCard label="Out of Stock" value={data.inventory.outOfStock} color="var(--red)" />
                <KpiCard label="Inventory Value" value={fmt(data.inventory.value)} sub="At cost price" color="var(--gold)" />
              </div>
              {data.inventory.categoryStock.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>Stock by Category</div>
                  <BarChart
                    data={data.inventory.categoryStock}
                    labelKey="category"
                    valueKey="stock"
                    color="var(--blue)"
                  />
                </div>
              )}
              {data.inventory.lowStock && data.inventory.lowStock.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>Low Stock Alerts (Available ≤ 3)</div>
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                          {['MATNR', 'Brand', 'Category', 'In Stock', 'Reserved', 'Available'].map((h, i) => (
                            <th key={h} style={{ padding: '8px 14px', textAlign: i >= 3 ? 'right' : 'left', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.inventory.lowStock.map((item, i) => {
                          const avail = Math.max(0, (item.quantity || 0) - (item.reserved || 0))
                          return (
                            <tr key={item.matnr} style={{ borderBottom: i < data.inventory.lowStock.length - 1 ? '1px solid rgba(46,46,46,0.5)' : 'none' }}>
                              <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: 'var(--gold)' }}>{item.matnr}</td>
                              <td style={{ padding: '9px 14px' }}>{item.brand || '—'}</td>
                              <td style={{ padding: '9px 14px', color: 'var(--muted)' }}>{item.category || '—'}</td>
                              <td style={{ padding: '9px 14px', textAlign: 'right' }}>{item.quantity || 0}</td>
                              <td style={{ padding: '9px 14px', textAlign: 'right', color: 'var(--muted)' }}>{item.reserved || 0}</td>
                              <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 700, color: avail === 0 ? 'var(--red)' : 'var(--rust)' }}>{avail}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </Section>

            {/* Customers */}
            <Section title="Customers">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
                <KpiCard label="Active Customers" value={data.customers.unique} color="var(--blue)" />
                <KpiCard label="Repeat Customers" value={data.customers.repeat} color="var(--green)" />
                <KpiCard label="New Customers" value={data.customers.newCount} color="var(--gold)" />
              </div>
              {data.customers.topCustomers.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>Top Customers by Revenue</div>
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                          <th style={{ padding: '10px 22px', textAlign: 'left', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500 }}>#</th>
                          <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500 }}>KUNNR</th>
                          <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500 }}>Name</th>
                          <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500 }}>Orders</th>
                          <th style={{ padding: '10px 22px', textAlign: 'right', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500 }}>Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.customers.topCustomers.map((c, i) => {
                          const maxRev = data.customers.topCustomers[0]?.revenue || 1
                          return (
                            <tr key={c.kunnr} style={{ borderBottom: i < data.customers.topCustomers.length - 1 ? '1px solid rgba(46,46,46,0.5)' : 'none' }}>
                              <td style={{ padding: '11px 22px', fontFamily: "'DM Serif Display', serif", fontSize: 18, color: 'var(--muted)' }}>{i + 1}</td>
                              <td style={{ padding: '11px 16px', fontFamily: 'monospace', color: 'var(--gold)' }}>{c.kunnr}</td>
                              <td style={{ padding: '11px 16px', color: 'var(--text)' }}>{c.name}</td>
                              <td style={{ padding: '11px 16px', textAlign: 'right', color: 'var(--muted)' }}>{c.orders}</td>
                              <td style={{ padding: '11px 22px', textAlign: 'right' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
                                  <div style={{ width: 60, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${Math.round((c.revenue / maxRev) * 100)}%`, background: 'var(--sage)', borderRadius: 2 }} />
                                  </div>
                                  <span style={{ minWidth: 60, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(c.revenue)}</span>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </Section>

            {/* Returns */}
            <Section title="Returns">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
                <KpiCard label="Return Orders" value={data.returns.count} color="var(--red)" />
                <KpiCard label="Return Value" value={fmt(data.returns.value)} color="var(--red)" />
                <KpiCard label="Return Rate" value={`${data.returns.rate.toFixed(1)}%`} sub="vs. total orders" color={data.returns.rate > 10 ? 'var(--red)' : 'var(--yellow)'} />
              </div>
              {data.returns.reasons.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>Return Reasons</div>
                  <BarChart
                    data={data.returns.reasons}
                    labelKey="reason"
                    valueKey="count"
                    color="var(--red)"
                  />
                </div>
              )}
            </Section>

            {/* Purchase Orders */}
            <Section title="Purchase Orders">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                <KpiCard label="Total POs" value={data.pos.count} color="var(--text)" />
                <KpiCard label="PO Value" value={fmt(data.pos.value)} color="var(--gold)" />
                <KpiCard label="Pending POs" value={data.pos.pending} sub="Created / Accepted" color="var(--yellow)" />
                <KpiCard label="Completed POs" value={data.pos.completed} sub="Goods Receipt" color="var(--green)" />
              </div>
            </Section>
          </>
        )}
      </div>
    </div>
  )
}
