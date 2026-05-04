import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from '../components/Toast'
import { supabase, db } from '../lib/supabase'
import ERPLayout from '../components/ERPLayout'
import ModuleHeader from '../components/ModuleHeader'
import ModuleTabs from '../components/ModuleTabs'
import StatsStrip from '../components/StatsStrip'

// ─── Dark theme ───────────────────────────────────────────────────────────────
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n) {
  if (n == null || isNaN(n)) return '—'
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`
  return `₹${Number(n).toFixed(0)}`
}

function monthLabel(ym) {
  if (!ym) return ''
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const m = parseInt(ym.split('-')[1], 10)
  return MONTHS[m - 1] || ym
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
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

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
        color: 'var(--gold)', marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid var(--border)',
      }}>{title}</div>
      {children}
    </div>
  )
}

// ─── Horizontal Bar Chart ─────────────────────────────────────────────────────
function BarChart({ data, valueKey, labelKey, color, valueFmt, labelWidth = 150 }) {
  if (!data || data.length === 0) return <div style={{ color: 'var(--muted)', fontSize: 13 }}>No data</div>
  const vf = valueFmt || fmt
  const max = Math.max(...data.map(d => d[valueKey] || 0), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: labelWidth, fontSize: 12, color: 'var(--muted)', textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
          <div style={{ width: 90, fontSize: 12, fontVariantNumeric: 'tabular-nums', color: 'var(--text)', flexShrink: 0 }}>
            {vf(d[valueKey])}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Column (Vertical Bar) Chart ──────────────────────────────────────────────
const CHART_COLORS = {
  gold: '#c9a84c', green: '#4caf74', blue: '#5b8dee', red: '#c05a5a',
  sage: '#6a9e7f', muted: '#888', border: '#2e2e2e', surface2: '#242424', text: '#e8e8e8',
}

function ColumnChart({ data, valueKey, labelKey, color = 'gold', chartHeight = 200, valueFmt }) {
  if (!data || data.length === 0) return <div style={{ color: 'var(--muted)', fontSize: 13 }}>No data</div>
  const vf = valueFmt || fmt
  const max = Math.max(...data.map(d => d[valueKey] || 0), 1)
  const BAR_W = 34, GAP = 10, LEFT = 8, BOT_PAD = 30, TOP_PAD = 28
  const CHART_H = chartHeight - BOT_PAD - TOP_PAD
  const totalW = data.length * (BAR_W + GAP) + LEFT * 2
  const fillColor = CHART_COLORS[color] || color

  return (
    <svg width="100%" viewBox={`0 0 ${totalW} ${chartHeight}`} style={{ display: 'block', overflow: 'visible' }}>
      {[0.25, 0.5, 0.75, 1].map(pct => {
        const y = TOP_PAD + CHART_H * (1 - pct)
        return <line key={pct} x1={LEFT} y1={y} x2={totalW - LEFT} y2={y} stroke={CHART_COLORS.border} strokeWidth="1" />
      })}
      {data.map((d, i) => {
        const val = d[valueKey] || 0
        const barH = Math.max(val > 0 ? 2 : 0, Math.round((val / max) * CHART_H))
        const x = LEFT + i * (BAR_W + GAP)
        const y = TOP_PAD + CHART_H - barH
        return (
          <g key={i}>
            <rect x={x} y={y} width={BAR_W} height={barH} fill={fillColor} rx={3} opacity={0.9} />
            <text x={x + BAR_W / 2} y={TOP_PAD + CHART_H + 18} textAnchor="middle" fontSize="10" fill={CHART_COLORS.muted}>
              {monthLabel(d[labelKey]) || d[labelKey]}
            </text>
            {val > 0 && (
              <text x={x + BAR_W / 2} y={Math.max(y - 6, TOP_PAD + 10)} textAnchor="middle" fontSize="9" fill={CHART_COLORS.muted}>
                {vf(val)}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ─── PO Breakdown Table ────────────────────────────────────────────────────────
function PoBreakdownTable({ data, rowKey }) {
  const rows = data ? (data[rowKey === 'brand' ? 'brands' : 'categories'] || []) : []
  const months = data ? (data.months || []) : []
  if (rows.length === 0 || months.length === 0) return <div style={{ color: 'var(--muted)', fontSize: 13 }}>No data</div>
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
            <th style={{ padding: '8px 14px', textAlign: 'left', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500 }}>
              {rowKey === 'brand' ? 'Brand' : 'Category'}
            </th>
            {months.map(m => (
              <th key={m} style={{ padding: '8px 10px', textAlign: 'right', fontSize: 10, letterSpacing: 1, color: 'var(--muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                {monthLabel(m)}
              </th>
            ))}
            <th style={{ padding: '8px 14px', textAlign: 'right', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500 }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid rgba(46,46,46,0.5)' }}>
              <td style={{ padding: '9px 14px', color: 'var(--text)', fontWeight: 500, whiteSpace: 'nowrap' }}>{row[rowKey]}</td>
              {row.months.map((mv, j) => (
                <td key={j} style={{ padding: '9px 10px', textAlign: 'right', color: mv.value > 0 ? 'var(--text)' : 'var(--muted)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  {mv.value > 0 ? fmt(mv.value) : '—'}
                </td>
              ))}
              <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--gold)', fontVariantNumeric: 'tabular-nums' }}>{fmt(row.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Top Profit Products Table ────────────────────────────────────────────────
function ProfitTable({ data }) {
  if (!data || data.length === 0) return <div style={{ color: 'var(--muted)', fontSize: 13 }}>No data</div>
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
            {['#', 'MATNR', 'Brand', 'Category', 'Qty Sold', 'Revenue', 'Cost', 'Profit', 'Margin'].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: ['Qty Sold', 'Revenue', 'Cost', 'Profit', 'Margin'].includes(h) ? 'right' : 'left', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((p, i) => (
            <tr key={i} style={{ borderBottom: '1px solid rgba(46,46,46,0.5)' }}>
              <td style={{ padding: '9px 12px', color: 'var(--muted)', fontSize: 11 }}>{i + 1}</td>
              <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 11, color: 'var(--muted)' }}>{p.matnr}</td>
              <td style={{ padding: '9px 12px', color: 'var(--text)', fontWeight: 500 }}>{p.brand}</td>
              <td style={{ padding: '9px 12px', color: 'var(--muted)' }}>{p.category}</td>
              <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--text)' }}>{p.qty}</td>
              <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{fmt(p.revenue)}</td>
              <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{fmt(p.cost)}</td>
              <td style={{ padding: '9px 12px', textAlign: 'right', color: p.profit >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(p.profit)}</td>
              <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                <span style={{
                  background: p.margin >= 40 ? '#1a3a2a' : p.margin >= 20 ? '#2a2a1a' : '#2a1a1a',
                  color: p.margin >= 40 ? 'var(--green)' : p.margin >= 20 ? 'var(--yellow)' : 'var(--red)',
                  padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                }}>{p.margin}%</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Top Return Customers Table ───────────────────────────────────────────────
function ReturnCustomersTable({ data }) {
  if (!data || data.length === 0) return <div style={{ color: 'var(--muted)', fontSize: 13 }}>No data</div>
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
            {['#', 'KUNNR', 'Customer', 'Returns', 'Refund Value'].map(h => (
              <th key={h} style={{ padding: '8px 14px', textAlign: ['Returns', 'Refund Value'].includes(h) ? 'right' : 'left', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((c, i) => (
            <tr key={i} style={{ borderBottom: '1px solid rgba(46,46,46,0.5)' }}>
              <td style={{ padding: '9px 14px', color: 'var(--muted)', fontSize: 11 }}>{i + 1}</td>
              <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: 11, color: 'var(--muted)' }}>{c.kunnr}</td>
              <td style={{ padding: '9px 14px', color: 'var(--text)', fontWeight: 500 }}>{c.customer_name}</td>
              <td style={{ padding: '9px 14px', textAlign: 'right', color: 'var(--text)' }}>{c.return_count}</td>
              <td style={{ padding: '9px 14px', textAlign: 'right', color: 'var(--red)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(c.refund_value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main Analytics Component ─────────────────────────────────────────────────
// ─── Product Match Tab ────────────────────────────────────────────────────────
function ProductMatchTab() {
  const showToast = useToast()
  const [query, setQuery]               = useState('')
  const [products, setProducts]         = useState([])
  const [selected, setSelected]         = useState(null)   // chosen product
  const [matchData, setMatchData]       = useState(null)   // { product, results }
  const [loading, setLoading]           = useState(false)
  const [searching, setSearching]       = useState(false)
  const [bodyTypes, setBodyTypes]       = useState([])
  const [bodyTypeFilter, setBodyTypeFilter] = useState(null)

  // Load available body types once
  useEffect(() => {
    db.inventory().from('body_types').select('name').order('name')
      .then(({ data }) => { if (data) setBodyTypes(data.map(r => r.name)) })
      .catch(() => {})
  }, [])

  // Re-run search when body type filter changes
  useEffect(() => {
    doSearch(query, bodyTypeFilter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyTypeFilter])

  async function doSearch(q, btFilter) {
    if (!q.trim() && !btFilter) { setProducts([]); return }
    setSearching(true)
    try {
      let qb = db.inventory().from('mara').select('matnr, brand, category, body_type, size')
      if (q.trim()) qb = qb.or(`matnr.ilike.%${q}%,brand.ilike.%${q}%,body_type.ilike.%${q}%`)
      if (btFilter) qb = qb.eq('body_type', btFilter)
      const { data: prods } = await qb.limit(20)
      setProducts(prods || [])
    } catch { /* ignore */ } finally { setSearching(false) }
  }

  // Search inventory as user types
  async function searchProducts(q) {
    setQuery(q)
    doSearch(q, bodyTypeFilter)
  }

  function toggleBodyType(bt) {
    const next = bodyTypeFilter === bt ? null : bt
    setBodyTypeFilter(next)
    // Clear selected product when filter changes
    setSelected(null)
    setMatchData(null)
    setQuery('')
  }

  async function runMatch(product) {
    setSelected(product)
    setProducts([])
    setQuery(`${product.brand} — ${product.matnr}`)
    setMatchData(null)
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('analytics_product_match', { p_matnr: product.matnr })
      if (error) { showToast(error.message, 'error'); return }
      const results = (data || []).filter(r => r.indicator !== null).sort((a, b) => a.rank - b.rank)
      setMatchData({ product, results })
    } catch { /* ignore */ } finally { setLoading(false) }
  }

  const INDICATOR = {
    green: { bg: '#14532d', border: '#22c55e', text: '#4ade80', dot: '#22c55e', label: 'Brand + Style + Body Type' },
    blue:  { bg: '#1e3a5f', border: '#3b82f6', text: '#60a5fa', dot: '#3b82f6', label: 'Body Type only' },
    white: { bg: '#1f1f1f', border: '#555',    text: '#ccc',    dot: '#aaa',    label: 'Brand + Style only' },
  }

  const counts = matchData?.results
    ? { green: matchData.results.filter(r => r.indicator === 'green').length,
        blue:  matchData.results.filter(r => r.indicator === 'blue').length,
        white: matchData.results.filter(r => r.indicator === 'white').length }
    : null

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: 'var(--text)', marginBottom: 4 }}>
          Product Match
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          Choose a product to find customers whose preferences and body type align with it.
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        {Object.entries(INDICATOR).map(([key, ind]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--muted)' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: ind.dot, flexShrink: 0, boxShadow: `0 0 6px ${ind.dot}` }} />
            {ind.label}
          </div>
        ))}
      </div>

      {/* Body type filter chips */}
      {bodyTypes.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', flexShrink: 0 }}>Body type</span>
          {bodyTypes.map(bt => {
            const active = bodyTypeFilter === bt
            return (
              <button key={bt} onClick={() => toggleBodyType(bt)} style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: active ? 700 : 400, cursor: 'pointer',
                background: active ? 'var(--blue)' : 'transparent',
                color: active ? '#fff' : 'var(--muted)',
                border: active ? '1px solid var(--blue)' : '1px solid var(--border)',
                transition: 'all 0.15s',
              }}>
                {bt}
              </button>
            )
          })}
          {bodyTypeFilter && (
            <button onClick={() => toggleBodyType(bodyTypeFilter)} style={{
              padding: '4px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
              background: 'none', color: 'var(--muted)', border: '1px solid transparent',
            }}>✕ Clear</button>
          )}
        </div>
      )}

      {/* Product search */}
      <div style={{ position: 'relative', marginBottom: 24 }}>
        <input
          value={query}
          onChange={e => searchProducts(e.target.value)}
          placeholder={bodyTypeFilter ? `Search ${bodyTypeFilter} products by MATNR or brand…` : 'Search product by MATNR, brand, or body type…'}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'var(--surface)', border: '1px solid var(--border)',
            color: 'var(--text)', padding: '12px 16px', fontSize: 14,
            fontFamily: "'DM Sans', sans-serif", outline: 'none',
            borderRadius: selected ? '8px 8px 0 0' : 8,
          }}
          onFocus={() => { if (!selected && (query || bodyTypeFilter)) doSearch(query, bodyTypeFilter) }}
        />
        {products.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
            background: 'var(--surface)', border: '1px solid var(--border)', borderTop: 'none',
            borderRadius: '0 0 8px 8px', maxHeight: 280, overflowY: 'auto',
          }}>
            {products.map(p => (
              <div key={p.matnr} onClick={() => runMatch(p)} style={{
                padding: '10px 16px', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'center',
                borderBottom: '1px solid var(--border)',
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--gold)', background: 'rgba(201,168,76,0.12)', padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}>{p.matnr}</span>
                <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{p.brand}</span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{[p.category, p.subcategory, p.size, p.color].filter(Boolean).join(' · ')}</span>
                {p.body_type && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>{p.body_type}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected product chip */}
      {selected && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          background: 'var(--surface)', border: '1px solid var(--gold)',
          borderRadius: 10, padding: '12px 16px', marginBottom: 24,
        }}>
          <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--gold)', background: 'rgba(201,168,76,0.12)', padding: '3px 8px', borderRadius: 4 }}>{selected.matnr}</span>
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{selected.brand}</span>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>{[selected.category, selected.subcategory, selected.size, selected.color].filter(Boolean).join(' · ')}</span>
          {selected.body_type && (
            <span style={{ fontSize: 12, color: 'var(--blue)', background: 'rgba(91,141,238,0.12)', border: '1px solid rgba(91,141,238,0.3)', borderRadius: 6, padding: '2px 8px' }}>
              Body: {selected.body_type}
            </span>
          )}
          <button onClick={() => { setSelected(null); setMatchData(null); setQuery('') }}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)', fontSize: 14 }}>
          Matching customers…
        </div>
      )}

      {/* Results */}
      {matchData && !loading && (
        <>
          {/* Summary chips */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            {Object.entries(INDICATOR).map(([key, ind]) => counts[key] > 0 && (
              <div key={key} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: ind.bg, border: `1px solid ${ind.border}`,
                borderRadius: 20, padding: '6px 14px', fontSize: 13, color: ind.text, fontWeight: 600,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: ind.dot }} />
                {counts[key]} {key === 'green' ? 'Perfect match' : key === 'blue' ? 'Body type match' : 'Style match'}
              </div>
            ))}
            {matchData.results.length === 0 && (
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>No matching customers found.</div>
            )}
          </div>

          {/* Customer list */}
          {matchData.results.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {matchData.results.map(c => {
                const ind = INDICATOR[c.indicator]
                return (
                  <div key={c.kunnr} style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    background: ind.bg, border: `1px solid ${ind.border}`,
                    borderRadius: 10, padding: '12px 16px',
                  }}>
                    {/* Indicator dot */}
                    <span style={{
                      width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
                      background: ind.dot, boxShadow: `0 0 8px ${ind.dot}`,
                    }} />
                    {/* Avatar */}
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                      background: ind.border + '33', border: `1px solid ${ind.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 700, color: ind.text,
                    }}>
                      {c.name?.[0]?.toUpperCase() || '?'}
                    </div>
                    {/* Name + KUNNR */}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: ind.text }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: ind.border, marginTop: 2, fontFamily: 'monospace' }}>{c.kunnr}</div>
                    </div>
                    {/* Body type */}
                    {c.body_type && (
                      <span style={{ fontSize: 11, color: ind.text, opacity: 0.7, flexShrink: 0 }}>{c.body_type}</span>
                    )}
                    {/* Phone */}
                    {c.number && (
                      <span style={{ fontSize: 12, color: ind.text, opacity: 0.7, flexShrink: 0 }}>{c.number}</span>
                    )}
                    {/* Match badge */}
                    <span style={{
                      fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                      color: ind.dot, background: 'rgba(0,0,0,0.25)', borderRadius: 6, padding: '3px 8px', flexShrink: 0,
                    }}>
                      {c.indicator === 'green' ? '● Perfect' : c.indicator === 'blue' ? '● Body' : '● Style'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function Analytics() {
  const showToast = useToast()
  const containerRef = useRef(null)

  const [tab, setTab] = useState('overview')
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [loading, setLoading] = useState(false)

  // Overview data
  const [overview, setOverview] = useState(null)
  const [monthlySales, setMonthlySales] = useState([])
  const [topProfitProds, setTopProfitProds] = useState([])
  const [ytdBrand, setYtdBrand] = useState([])

  // Sales tab data
  const [ytdCategory, setYtdCategory] = useState([])
  const [retByMonth, setRetByMonth] = useState([])
  const [retByBrand, setRetByBrand] = useState([])
  const [retByReason, setRetByReason] = useState([])
  const [topReturnCusts, setTopReturnCusts] = useState([])

  // Purchasing tab data
  const [poBrand, setPoBrand] = useState(null)
  const [poCategory, setPoCategory] = useState(null)

  useEffect(() => { applyDark(containerRef.current) }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const selectedYear = parseInt(year, 10)
      const [
        { data: overview },
        { data: monthlySales },
        { data: byCategory },
        { data: byBrand },
        { data: poByBrand },
        { data: poByCategory },
        { data: returnsByMonth },
        { data: returnsByBrand },
        { data: returnsByReason },
        { data: topReturnCusts },
        { data: topProfitProds },
      ] = await Promise.all([
        supabase.rpc('analytics_overview'),
        supabase.rpc('analytics_monthly_sales', { p_year: selectedYear }),
        supabase.rpc('analytics_ytd_by_category', { p_year: selectedYear }),
        supabase.rpc('analytics_ytd_by_brand', { p_year: selectedYear }),
        supabase.rpc('analytics_po_by_brand', { p_year: selectedYear }),
        supabase.rpc('analytics_po_by_category', { p_year: selectedYear }),
        supabase.rpc('analytics_returns_by_month', { p_year: selectedYear }),
        supabase.rpc('analytics_returns_by_brand', { p_year: selectedYear }),
        supabase.rpc('analytics_returns_by_reason', { p_year: selectedYear }),
        supabase.rpc('analytics_top_return_customers', { p_year: selectedYear }),
        supabase.rpc('analytics_top_profit_products', { p_year: selectedYear }),
      ])
      setOverview(overview)
      setMonthlySales(Array.isArray(monthlySales) ? monthlySales : [])
      setYtdCategory(Array.isArray(byCategory) ? byCategory : [])
      setYtdBrand(Array.isArray(byBrand) ? byBrand : [])
      setPoBrand(poByBrand && typeof poByBrand === 'object' ? poByBrand : null)
      setPoCategory(poByCategory && typeof poByCategory === 'object' ? poByCategory : null)
      setRetByMonth(Array.isArray(returnsByMonth) ? returnsByMonth : [])
      setRetByBrand(Array.isArray(returnsByBrand) ? returnsByBrand : [])
      setRetByReason(Array.isArray(returnsByReason) ? returnsByReason : [])
      setTopReturnCusts(Array.isArray(topReturnCusts) ? topReturnCusts : [])
      setTopProfitProds(Array.isArray(topProfitProds) ? topProfitProds : [])
    } catch {
      showToast('Could not load analytics data', 'error')
    } finally {
      setLoading(false)
    }
  }, [year, showToast])

  useEffect(() => { loadAll() }, [loadAll])

  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: 5 }, (_, i) => String(currentYear - i))

  // Derived
  const top5Brands = ytdBrand.slice(0, 5)

  // Total returns KPIs
  const totalReturnCount = retByMonth.reduce((s, r) => s + (r.return_count || 0), 0)
  const totalRefundValue = retByMonth.reduce((s, r) => s + (r.refund_value || 0), 0)

  const ANA_TABS = [
    { id: 'overview',   label: 'Overview' },
    { id: 'sales',      label: 'Sales' },
    { id: 'purchasing', label: 'Purchasing' },
    { id: 'match',      label: '🎯 Product Match' },
  ]
  const ANA_TAB_LABELS = {
    overview: 'Overview', sales: 'Sales', purchasing: 'Purchasing', match: 'Product Match',
  }

  return (
    <ERPLayout>
      <ModuleHeader moduleLabel="ANALYTICS" breadcrumb={ANA_TAB_LABELS[tab]} />
      <ModuleTabs tabs={ANA_TABS} activeTab={tab} onChange={setTab} />
      <StatsStrip stats={[]}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <select
              value={year}
              onChange={e => setYear(e.target.value)}
              style={{
                background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--ink)',
                padding: '6px 10px', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer',
                borderRadius: 6,
              }}
            >
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={loadAll} className="btn btn-ghost" style={{ fontSize: 11, padding: '6px 14px' }}>
              ↺ Refresh
            </button>
          </div>
        </StatsStrip>
        <div className="erp-content" ref={containerRef}>
          {loading && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>
          )}
          {!loading && (
            <>
              {/* ══ OVERVIEW TAB ══════════════════════════════════════════════════ */}
              {tab === 'overview' && (
                <>
                  {/* KPI Row */}
                  <Section title="This Month">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
                      <KpiCard
                        label="Total Sales"
                        value={overview ? fmt(overview.sales?.total) : '—'}
                        sub={overview ? `${overview.sales?.count ?? 0} orders` : undefined}
                        color="var(--gold)"
                      />
                      <KpiCard
                        label="Purchase Orders"
                        value={overview ? `${overview.po?.count ?? 0} POs` : '—'}
                        sub={overview ? `Pending: ${fmt(overview.po?.pending)}` : undefined}
                        color="var(--blue)"
                      />
                      <KpiCard
                        label="Salary Paid"
                        value={overview ? fmt(overview.salary?.paid) : '—'}
                        color="var(--green)"
                      />
                    </div>
                  </Section>

                  {/* Monthly Sales + Profit side by side */}
                  <Section title={`Monthly Revenue & Profit — ${year}`}>
                    {monthlySales.length > 0 ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, letterSpacing: 1, textTransform: 'uppercase' }}>Revenue</div>
                          <ColumnChart data={monthlySales} valueKey="revenue" labelKey="month" color="gold" chartHeight={200} />
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, letterSpacing: 1, textTransform: 'uppercase' }}>Gross Profit</div>
                          <ColumnChart data={monthlySales} valueKey="profit" labelKey="month" color="green" chartHeight={200} />
                        </div>
                      </div>
                    ) : (
                      <div style={{ color: 'var(--muted)', fontSize: 13 }}>No sales data for {year}</div>
                    )}
                  </Section>

                  {/* Top 5 Brands by Sales */}
                  <Section title={`Top 5 Brands by Sales — ${year}`}>
                    {top5Brands.length > 0 ? (
                      <BarChart data={top5Brands} valueKey="revenue" labelKey="brand" color="var(--gold)" />
                    ) : (
                      <div style={{ color: 'var(--muted)', fontSize: 13 }}>No brand data for {year}</div>
                    )}
                  </Section>

                  {/* Top 10 Products by Profit */}
                  <Section title={`Top 10 Products by Profit — ${year}`}>
                    <ProfitTable data={topProfitProds} />
                  </Section>
                </>
              )}

              {/* ══ SALES TAB ════════════════════════════════════════════════════ */}
              {tab === 'sales' && (
                <>
                  {/* ── Sales breakdown ── */}
                  <Section title={`YTD Sales by Brand — ${year}`}>
                    {ytdBrand.length > 0 ? (
                      <BarChart data={ytdBrand} valueKey="revenue" labelKey="brand" color="var(--gold)" />
                    ) : (
                      <div style={{ color: 'var(--muted)', fontSize: 13 }}>No brand data for {year}</div>
                    )}
                  </Section>

                  <Section title={`YTD Sales by Category — ${year}`}>
                    {ytdCategory.length > 0 ? (
                      <BarChart data={ytdCategory} valueKey="revenue" labelKey="category" color="var(--blue)" />
                    ) : (
                      <div style={{ color: 'var(--muted)', fontSize: 13 }}>No category data for {year}</div>
                    )}
                  </Section>

                  {/* ── Returns ── */}
                  <div style={{ marginTop: 8, marginBottom: 24, paddingTop: 16, borderTop: '2px solid var(--border)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--red)', marginBottom: 16 }}>
                      ↩ Returns — {year}
                    </div>
                    {/* Returns KPI mini row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
                      <KpiCard label="Total Returns" value={totalReturnCount} sub={`${year} YTD`} color="var(--red)" />
                      <KpiCard label="Total Refund Value" value={fmt(totalRefundValue)} sub={`${year} YTD`} color="var(--rust)" />
                    </div>
                  </div>

                  <Section title={`Returns by Month — ${year}`}>
                    {retByMonth.length > 0 ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, letterSpacing: 1, textTransform: 'uppercase' }}>No. of Returns</div>
                          <ColumnChart
                            data={retByMonth} valueKey="return_count" labelKey="month"
                            color="red" chartHeight={180}
                            valueFmt={n => (n == null ? '—' : String(n))}
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, letterSpacing: 1, textTransform: 'uppercase' }}>Refund Value</div>
                          <ColumnChart data={retByMonth} valueKey="refund_value" labelKey="month" color="rust" chartHeight={180} />
                        </div>
                      </div>
                    ) : (
                      <div style={{ color: 'var(--muted)', fontSize: 13 }}>No returns data for {year}</div>
                    )}
                  </Section>

                  <Section title={`Returns by Brand — ${year}`}>
                    {retByBrand.length > 0 ? (
                      <BarChart data={retByBrand} valueKey="refund_value" labelKey="brand" color="var(--red)" />
                    ) : (
                      <div style={{ color: 'var(--muted)', fontSize: 13 }}>No brand returns data for {year}</div>
                    )}
                  </Section>

                  <Section title={`Returns by Reason — ${year}`}>
                    {retByReason.length > 0 ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10, letterSpacing: 1, textTransform: 'uppercase' }}>By Refund Value</div>
                          <BarChart data={retByReason} valueKey="refund_value" labelKey="reason" color="var(--rust)" labelWidth={180} />
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10, letterSpacing: 1, textTransform: 'uppercase' }}>By No. of Orders</div>
                          <BarChart
                            data={retByReason} valueKey="return_count" labelKey="reason"
                            color="var(--red)" labelWidth={180}
                            valueFmt={n => (n == null ? '—' : `${n} orders`)}
                          />
                        </div>
                      </div>
                    ) : (
                      <div style={{ color: 'var(--muted)', fontSize: 13 }}>No reason data for {year}</div>
                    )}
                  </Section>

                  <Section title={`Top 5 Customers by Returns — ${year}`}>
                    <ReturnCustomersTable data={topReturnCusts} />
                  </Section>
                </>
              )}

              {/* ══ PURCHASING TAB ═══════════════════════════════════════════════ */}
              {tab === 'purchasing' && (
                <>
                  <Section title={`Purchase Orders by Brand — ${year}`}>
                    <PoBreakdownTable data={poBrand} rowKey="brand" />
                  </Section>

                  <Section title={`Purchase Orders by Category — ${year}`}>
                    <PoBreakdownTable data={poCategory} rowKey="category" />
                  </Section>
                </>
              )}

              {tab === 'match' && <ProductMatchTab />}
            </>
          )}
        </div>
      </ERPLayout>
  )
}
