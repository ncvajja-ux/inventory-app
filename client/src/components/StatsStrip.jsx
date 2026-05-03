// client/src/components/StatsStrip.jsx
export default function StatsStrip({ stats = [], children }) {
  return (
    <div className="erp-stats-strip">
      <div className="erp-stats-kpis">
        {stats.map((s, i) => (
          <div key={i} className="erp-kpi">
            <span
              className="erp-kpi-value"
              style={s.color ? { color: s.color } : undefined}
            >
              {s.value ?? '—'}
            </span>
            <span className="erp-kpi-label">{s.label}</span>
          </div>
        ))}
      </div>
      {children && <div className="erp-stats-right">{children}</div>}
    </div>
  )
}
