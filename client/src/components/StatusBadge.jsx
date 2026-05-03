// client/src/components/StatusBadge.jsx
const STATUS_MAP = {
  paid:         { color: 'var(--success)', bg: 'rgba(22,163,74,0.12)',  label: 'PAID' },
  confirmed:    { color: 'var(--success)', bg: 'rgba(22,163,74,0.12)',  label: 'CONFIRMED' },
  active:       { color: 'var(--success)', bg: 'rgba(22,163,74,0.12)',  label: 'ACTIVE' },
  pending:      { color: 'var(--info)',    bg: 'rgba(3,105,161,0.12)',   label: 'PENDING' },
  draft:        { color: 'var(--info)',    bg: 'rgba(3,105,161,0.12)',   label: 'DRAFT' },
  processing:   { color: 'var(--info)',    bg: 'rgba(3,105,161,0.12)',   label: 'PROCESSING' },
  overdue:      { color: 'var(--danger)',  bg: 'rgba(220,38,38,0.12)',   label: 'OVERDUE' },
  out_of_stock: { color: 'var(--danger)',  bg: 'rgba(220,38,38,0.12)',   label: 'OUT OF STOCK' },
  cancelled:    { color: 'var(--danger)',  bg: 'rgba(220,38,38,0.12)',   label: 'CANCELLED' },
  returned:     { color: 'var(--danger)',  bg: 'rgba(220,38,38,0.12)',   label: 'RETURNED' },
}

export default function StatusBadge({ status, label }) {
  const key = status?.toLowerCase().replace(/\s+/g, '_')
  const s = STATUS_MAP[key] || { color: 'var(--muted)', bg: 'var(--border)', label: status }
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 4,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: s.color,
      background: s.bg,
      whiteSpace: 'nowrap',
    }}>
      {label ?? s.label}
    </span>
  )
}
