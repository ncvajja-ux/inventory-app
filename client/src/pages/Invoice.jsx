import { useSearchParams, Link } from 'react-router-dom'

export default function Invoice() {
  const [params] = useSearchParams()
  const orderId = params.get('order_id')

  return (
    <div style={{
      fontFamily: "'DM Sans', sans-serif",
      background: 'var(--bg)',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
    }}>
      <div style={{ textAlign: 'center', maxWidth: 500 }}>
        <div style={{ fontSize: 72, marginBottom: 24 }}>🧾</div>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 36, marginBottom: 8 }}>
          Order Confirmed!
        </h1>
        {orderId && (
          <div style={{
            display: 'inline-block',
            background: 'var(--accent2)',
            color: '#92650a',
            border: '1.5px solid #e8d0a0',
            borderRadius: 8,
            padding: '8px 20px',
            fontFamily: 'Courier New, monospace',
            fontSize: 18,
            fontWeight: 700,
            margin: '12px 0 24px',
          }}>
            Order #{orderId}
          </div>
        )}
        <div style={{
          display: 'inline-block',
          background: '#dcfce7',
          color: 'var(--success)',
          borderRadius: 20,
          padding: '6px 18px',
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 32,
        }}>
          ✅ Order Placed Successfully
        </div>
        <p style={{ fontSize: 15, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 28 }}>
          Your sales order has been saved to the database.<br />
          The full invoice layout is currently being designed — it will show itemised details, customer info, tax breakdown, and totals.
        </p>
        <Link to="/sales" style={{
          display: 'inline-block',
          padding: '11px 24px',
          borderRadius: 8,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 14,
          fontWeight: 600,
          background: 'var(--accent)',
          color: 'white',
          textDecoration: 'none',
          transition: 'all 0.2s',
        }}>
          ← New Order
        </Link>
      </div>
    </div>
  )
}
