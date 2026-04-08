import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from '../components/Toast'

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
function BarChart({ data, valueKey, labelKey, color }) {
  if (!data || data.length === 0) return <div style={{ color: 'var(--muted)', fontSize: 13 }}>No data</div>
  const max = Math.max(...data.map(d => d[valueKey] || 0), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 140, fontSize: 12, color: 'var(--muted)', textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
          <div style={{ width: 80, fontSize: 12, fontVariantNumeric: 'tabular-nums', color: 'var(--text)', flexShrink: 0 }}>
            {fmt(d[valueKey])}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Column (Vertical Bar) Chart ──────────────────────────────────────────────
const CHART_COLORS = {
  gold: '#c9a84c',
  green: '#4caf74',
  blue: '#5b8dee',
  red: '#c05a5a',
  sage: '#6a9e7f',
  muted: '#888',
  border: '#2e2e2e',
  surface2: '#242424',
  text: '#e8e8e8',
}

function ColumnChart({ data, valueKey, labelKey, color = 'gold', chartHeight = 200 }) {
  if (!data || data.length === 0) return <div style={{ color: 'var(--muted)', fontSize: 13 }}>No data</div>
  const max = Math.max(...data.map(d => d[valueKey] || 0), 1)
  const BAR_W = 34
  const GAP = 10
  const LEFT = 8
  const BOT_PAD = 30
  const TOP_PAD = 28
  const CHART_H = chartHeight - BOT_PAD - TOP_PAD
  const totalW = data.length * (BAR_W + GAP) + LEFT * 2
  const fillColor = CHART_COLORS[color] || color

  return (
    <svg width="100%" viewBox={`0 0 ${totalW} ${chartHeight}`} style={{ display: 'block', overflow: 'visible' }}>
      {/* Gridlines */}
      {[0.25, 0.5, 0.75, 1].map(pct => {
        const y = TOP_PAD + CHART_H * (1 - pct)
        return (
          <line key={pct} x1={LEFT} y1={y} x2={totalW - LEFT} y2={y}
            stroke={CHART_COLORS.border} strokeWidth="1" />
        )
      })}
      {/* Bars */}
      {data.map((d, i) => {
        const val = d[valueKey] || 0
        const barH = Math.max(val > 0 ? 2 : 0, Math.round((val / max) * CHART_H))
        const x = LEFT + i * (BAR_W + GAP)
        const y = TOP_PAD + CHART_H - barH
        return (
          <g key={i}>
            <rect x={x} y={y} width={BAR_W} height={barH} fill={fillColor} rx={3} opacity={0.9} />
            {/* Month label below */}
            <text x={x + BAR_W / 2} y={TOP_PAD + CHART_H + 18}
              textAnchor="middle" fontSize="10" fill={CHART_COLORS.muted}>
              {monthLabel(d[labelKey])}
            </text>
            {/* Value above bar */}
            {val > 0 && (
              <text x={x + BAR_W / 2} y={Math.max(y - 6, TOP_PAD + 10)}
                textAnchor="middle" fontSize="9" fill={CHART_COLORS.muted}>
                {fmt(val)}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ─── Donut Pie Chart ──────────────────────────────────────────────────────────
const PIE_COLORS = [
  '#c9a84c', '#5b8dee', '#4caf74', '#6a9e7f', '#e0a820',
  '#c05a35', '#c05a5a', '#8888ff', '#ff88aa', '#88ffdd', '#ffaa44', '#44aaff',
]

function PieChart({ data, valueKey, labelKey }) {
  if (!data || data.length === 0) return <div style={{ color: 'var(--muted)', fontSize: 13 }}>No data</div>
  const total = data.reduce((s, d) => s + (d[valueKey] || 0), 0)
  if (total === 0) return <div style={{ color: 'var(--muted)', fontSize: 13 }}>No data</div>

  const CX = 100, CY = 100, R = 82, INNER_R = 52
  let angle = -Math.PI / 2

  const slices = data.map((d, i) => {
    const pct = (d[valueKey] || 0) / total
    const sa = angle
    angle += pct * 2 * Math.PI
    return { d, pct, sa, ea: angle, color: PIE_COLORS[i % PIE_COLORS.length] }
  })

  function arc(sa, ea) {
    const x1 = CX + R * Math.cos(sa), y1 = CY + R * Math.sin(sa)
    const x2 = CX + R * Math.cos(ea), y2 = CY + R * Math.sin(ea)
    const x3 = CX + INNER_R * Math.cos(ea), y3 = CY + INNER_R * Math.sin(ea)
    const x4 = CX + INNER_R * Math.cos(sa), y4 = CY + INNER_R * Math.sin(sa)
    const lg = (ea - sa) > Math.PI ? 1 : 0
    return `M ${x1} ${y1} A ${R} ${R} 0 ${lg} 1 ${x2} ${y2} L ${x3} ${y3} A ${INNER_R} ${INNER_R} 0 ${lg} 0 ${x4} ${y4} Z`
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
      <svg width={200} height={200} style={{ flexShrink: 0 }}>
        {slices.map((s, i) => (
          <path key={i} d={arc(s.sa, s.ea)} fill={s.color} opacity={0.9} />
        ))}
        <text x={CX} y={CY - 8} textAnchor="middle" fontSize="11" fill="#888">YTD Total</text>
        <text x={CX} y={CY + 10} textAnchor="middle" fontSize="13" fontWeight="700" fill="#e8e8e8">{fmt(total)}</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ color: 'var(--muted)', minWidth: 34 }}>{monthLabel(s.d[labelKey])}</span>
            <span style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums', minWidth: 70 }}>{fmt(s.d[valueKey])}</span>
            <span style={{ color: 'var(--muted)', fontSize: 11 }}>({(s.pct * 100).toFixed(1)}%)</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── PO Breakdown Table (brands or categories × months) ───────────────────────
function PoBreakdownTable({ data, rowKey }) {
  const rows = data ? (data[rowKey === 'brand' ? 'brands' : 'categories'] || []) : []
  const months = data ? (data.months || []) : []
  if (rows.length === 0 || months.length === 0) {
    return <div style={{ color: 'var(--muted)', fontSize: 13 }}>No data</div>
  }
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
              <td style={{ padding: '9px 14px', color: 'var(--text)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                {row[rowKey]}
              </td>
              {row.months.map((mv, j) => (
                <td key={j} style={{ padding: '9px 10px', textAlign: 'right', color: mv.value > 0 ? 'var(--text)' : 'var(--muted)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  {mv.value > 0 ? fmt(mv.value) : '—'}
                </td>
              ))}
              <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--gold)', fontVariantNumeric: 'tabular-nums' }}>
                {fmt(row.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main Analytics Component ─────────────────────────────────────────────────
export default function Analytics() {
  const showToast = useToast()
  const containerRef = useRef(null)

  const [tab, setTab] = useState('overview')
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [loading, setLoading] = useState(false)

  const [overview, setOverview] = useState(null)
  const [monthlySales, setMonthlySales] = useState(null)
  const [ytdCategory, setYtdCategory] = useState(null)
  const [ytdBrand, setYtdBrand] = useState(null)
  const [poBrand, setPoBrand] = useState(null)
  const [poCategory, setPoCategory] = useState(null)

  useEffect(() => { applyDark(containerRef.current) }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [ovRes, msRes, ytcRes, ytbRes, pbRes, pcRes] = await Promise.all([
        fetch('/analytics/overview'),
        fetch(`/analytics/monthly-sales?year=${year}`),
        fetch(`/analytics/ytd-by-category?year=${year}`),
        fetch(`/analytics/ytd-by-brand?year=${year}`),
        fetch(`/analytics/po-by-brand?year=${year}`),
        fetch(`/analytics/po-by-category?year=${year}`),
      ])
      const [ov, ms, ytc, ytb, pb, pc] = await Promise.all([
        ovRes.json(), msRes.json(), ytcRes.json(), ytbRes.json(), pbRes.json(), pcRes.json(),
      ])
      setOverview(ov)
      setMonthlySales(Array.isArray(ms) ? ms : [])
      setYtdCategory(Array.isArray(ytc) ? ytc : [])
      setYtdBrand(Array.isArray(ytb) ? ytb : [])
      setPoBrand(pb && typeof pb === 'object' ? pb : null)
      setPoCategory(pc && typeof pc === 'object' ? pc : null)
    } catch (err) {
      showToast('Could not load analytics data', 'error')
    } finally {
      setLoading(false)
    }
  }, [year, showToast])

  useEffect(() => { loadAll() }, [loadAll])

  // Year options: current year down to 4 years ago
  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: 5 }, (_, i) => String(currentYear - i))

  const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'sales', label: 'Sales' },
    { key: 'purchasing', label: 'Purchasing' },
  ]

  const tabBtn = (key, label) => (
    <button
      key={key}
      onClick={() => setTab(key)}
      style={{
        border: `1px solid ${tab === key ? 'var(--gold)' : 'var(--border)'}`,
        background: tab === key ? 'var(--gold)' : 'none',
        color: tab === key ? '#0f0f0f' : 'var(--muted)',
        padding: '6px 18px',
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 12,
        fontWeight: tab === key ? 700 : 400,
        cursor: 'pointer',
        letterSpacing: 1,
        transition: 'all 0.2s',
      }}
    >{label}</button>
  )

  return (
    <div ref={containerRef} style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>

      {/* ── Dark Topbar ── */}
      <div style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '0 28px', height: 56, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <Link to="/" style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: 12, letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            ← Home
          </Link>
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, color: 'var(--text)', flexShrink: 0 }}>
            Fat Closet <span style={{ color: 'var(--gold)' }}>/ Analytics</span>
          </div>
          <div style={{ width: 1, height: 24, background: 'var(--border)' }} />
          {/* Tab switcher */}
          <div style={{ display: 'flex', gap: 4 }}>
            {TABS.map(t => tabBtn(t.key, t.label))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <select
            value={year}
            onChange={e => setYear(e.target.value)}
            style={{
              background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)',
              padding: '6px 10px', fontFamily: "'DM Sans', sans-serif", fontSize: 12,
              cursor: 'pointer', colorScheme: 'dark',
            }}
          >
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            onClick={loadAll}
            style={{
              background: 'none', border: '1px solid var(--border)', color: 'var(--muted)',
              padding: '6px 14px', fontFamily: "'DM Sans', sans-serif", fontSize: 11,
              letterSpacing: 2, textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s',
            }}
          >↻ Refresh</button>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 32px 64px' }}>
        {loading ? (
          <div style={{ color: 'var(--muted)', fontSize: 14, textAlign: 'center', paddingTop: 80 }}>
            Loading analytics…
          </div>
        ) : (
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

                {/* Monthly Sales Histogram */}
                <Section title={`Monthly Sales — ${year}`}>
                  {monthlySales && monthlySales.length > 0 ? (
                    <ColumnChart data={monthlySales} valueKey="revenue" labelKey="month" color="gold" chartHeight={220} />
                  ) : (
                    <div style={{ color: 'var(--muted)', fontSize: 13 }}>No sales data for {year}</div>
                  )}
                </Section>

                {/* Monthly Profit Histogram */}
                <Section title={`Monthly Profit — ${year}`}>
                  {monthlySales && monthlySales.length > 0 ? (
                    <ColumnChart data={monthlySales} valueKey="profit" labelKey="month" color="green" chartHeight={220} />
                  ) : (
                    <div style={{ color: 'var(--muted)', fontSize: 13 }}>No sales data for {year}</div>
                  )}
                </Section>

                {/* YTD Pie */}
                <Section title={`Year to Date — ${year}`}>
                  {monthlySales && monthlySales.length > 0 ? (
                    <PieChart data={monthlySales} valueKey="revenue" labelKey="month" />
                  ) : (
                    <div style={{ color: 'var(--muted)', fontSize: 13 }}>No sales data for {year}</div>
                  )}
                </Section>
              </>
            )}

            {/* ══ SALES TAB ════════════════════════════════════════════════════ */}
            {tab === 'sales' && (
              <>
                <Section title={`YTD Sales by Category — ${year}`}>
                  {ytdCategory && ytdCategory.length > 0 ? (
                    <BarChart
                      data={ytdCategory}
                      valueKey="revenue"
                      labelKey="category"
                      color="var(--blue)"
                    />
                  ) : (
                    <div style={{ color: 'var(--muted)', fontSize: 13 }}>No category data for {year}</div>
                  )}
                </Section>

                <Section title={`YTD Sales by Brand — ${year}`}>
                  {ytdBrand && ytdBrand.length > 0 ? (
                    <BarChart
                      data={ytdBrand}
                      valueKey="revenue"
                      labelKey="brand"
                      color="var(--gold)"
                    />
                  ) : (
                    <div style={{ color: 'var(--muted)', fontSize: 13 }}>No brand data for {year}</div>
                  )}
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
          </>
        )}
      </div>
    </div>
  )
}
