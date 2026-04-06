import { Link } from 'react-router-dom'

const GRAIN_SVG = "data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E"

const cards = [
  { to: '/customers', icon: '👤', label: 'Customers', desc: 'Add & manage CRM' },
  { to: '/inventory', icon: '🏷️', label: 'Inventory',  desc: 'Stock & materials' },
  { to: '/sales',     icon: '🧾', label: 'Sales',      desc: 'Create sales orders' },
]

export default function LandingPage() {
  return (
    <div style={{
      fontFamily: "'DM Sans', sans-serif",
      background: 'var(--bg)',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Grain texture */}
      <div style={{
        position: 'fixed', inset: 0,
        backgroundImage: `url("${GRAIN_SVG}")`,
        pointerEvents: 'none', zIndex: 0,
      }} />

      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '60px 40px' }}>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 16 }}>
          Clothing Store
        </p>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 'clamp(42px, 6vw, 72px)', color: 'var(--ink)', lineHeight: 1.1, marginBottom: 12 }}>
          Store Manager
        </h1>
        <p style={{ fontSize: 16, color: 'var(--muted)', marginBottom: 56, fontWeight: 300 }}>
          CRM &amp; Inventory in one place
        </p>
        <div style={{ width: 40, height: 2, background: 'var(--accent)', margin: '0 auto 48px', borderRadius: 2 }} />

        <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap' }}>
          {cards.map(({ to, icon, label, desc }) => (
            <Link key={to} to={to} style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              padding: '36px 32px',
              width: 200,
              cursor: 'pointer',
              textDecoration: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 14,
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              transition: 'all 0.25s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-4px)'
              e.currentTarget.style.boxShadow = '0 16px 40px rgba(0,0,0,0.10)'
              e.currentTarget.style.borderColor = 'var(--accent)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = ''
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'
              e.currentTarget.style.borderColor = 'var(--border)'
            }}>
              <span style={{ fontSize: 32 }}>{icon}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', letterSpacing: '0.02em' }}>{label}</span>
              <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 300 }}>{desc}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
