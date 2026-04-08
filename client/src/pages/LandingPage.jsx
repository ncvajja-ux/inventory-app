import { Link } from 'react-router-dom'
import { useEffect, useRef } from 'react'

const DARK = {
  '--lp-bg':       '#0f0f0f',
  '--lp-surface':  '#1a1a1a',
  '--lp-border':   '#2e2e2e',
  '--lp-gold':     '#c9a84c',
  '--lp-gold-lt':  '#e8c97a',
  '--lp-gold-dim': '#7a6230',
  '--lp-text':     '#e8e8e8',
  '--lp-muted':    '#888',
}

const cards = [
  { to: '/customers',       icon: '👤', label: 'Customers',      desc: 'CRM & profiles',    num: '01' },
  { to: '/inventory',       icon: '🏷️', label: 'Inventory',       desc: 'Stock & materials', num: '02' },
  { to: '/sales',           icon: '🧾', label: 'Sales',           desc: 'Orders & invoices', num: '03' },
  { to: '/buyers',          icon: '🏢', label: 'Buyers',          desc: 'Vendors & supply',  num: '04' },
  { to: '/purchase-orders', icon: '📦', label: 'Purchase',        desc: 'Restock & receive', num: '05' },
  { to: '/hr',              icon: '👷', label: 'HR',              desc: 'Staff & payroll',   num: '06' },
]

function NavCard({ to, icon, label, desc, num, delay }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.opacity = '0'
    el.style.transform = 'translateY(18px)'
    const t = setTimeout(() => {
      el.style.transition = 'opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1)'
      el.style.opacity = '1'
      el.style.transform = 'translateY(0)'
    }, delay)
    return () => clearTimeout(t)
  }, [delay])

  return (
    <Link
      ref={ref}
      to={to}
      style={{
        position: 'relative',
        background: 'var(--lp-surface)',
        border: '1px solid var(--lp-border)',
        borderRadius: 2,
        padding: '22px 12px 18px',
        textDecoration: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        overflow: 'hidden',
        transition: 'border-color 0.35s, transform 0.35s cubic-bezier(0.16,1,0.3,1), box-shadow 0.35s',
        cursor: 'pointer',
      }}
      onMouseEnter={e => {
        const c = e.currentTarget
        c.style.borderColor = 'var(--lp-gold-dim)'
        c.style.transform = 'translateY(-5px)'
        c.style.boxShadow = '0 20px 56px rgba(0,0,0,0.6), 0 0 0 1px rgba(201,168,76,0.1)'
        c.querySelector('.lp-glow').style.opacity = '1'
        c.querySelector('.lp-topline').style.transform = 'translateX(-50%) scaleX(1)'
        c.querySelector('.lp-icon').style.filter = 'drop-shadow(0 0 8px rgba(201,168,76,0.45))'
        c.querySelector('.lp-label').style.color = 'var(--lp-text)'
        c.querySelector('.lp-desc').style.color = 'var(--lp-muted)'
        c.querySelector('.lp-num').style.color = 'var(--lp-gold-dim)'
      }}
      onMouseLeave={e => {
        const c = e.currentTarget
        c.style.borderColor = 'var(--lp-border)'
        c.style.transform = ''
        c.style.boxShadow = ''
        c.querySelector('.lp-glow').style.opacity = '0'
        c.querySelector('.lp-topline').style.transform = 'translateX(-50%) scaleX(0)'
        c.querySelector('.lp-icon').style.filter = ''
        c.querySelector('.lp-label').style.color = 'rgba(232,232,232,0.75)'
        c.querySelector('.lp-desc').style.color = 'rgba(136,136,136,0.6)'
        c.querySelector('.lp-num').style.color = 'var(--lp-border)'
      }}
    >
      {/* Gold top shimmer line */}
      <div className="lp-topline" style={{
        position: 'absolute', top: 0, left: '50%',
        transform: 'translateX(-50%) scaleX(0)',
        width: '100%', height: 1,
        background: 'linear-gradient(90deg, transparent, var(--lp-gold), transparent)',
        transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1)',
      }} />
      {/* Gold glow overlay */}
      <div className="lp-glow" style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(201,168,76,0.07) 0%, transparent 70%)',
        opacity: 0, transition: 'opacity 0.4s', pointerEvents: 'none',
      }} />
      {/* Card number */}
      <span className="lp-num" style={{
        position: 'absolute', top: 8, right: 10,
        fontFamily: "'Jost', 'DM Sans', sans-serif",
        fontSize: 8, fontWeight: 300, letterSpacing: '0.1em',
        color: 'var(--lp-border)', transition: 'color 0.3s', zIndex: 1,
      }}>{num}</span>
      {/* Icon */}
      <span className="lp-icon" style={{
        position: 'relative', zIndex: 1, fontSize: 20, marginBottom: 14,
        transition: 'filter 0.3s',
      }}>{icon}</span>
      {/* Label */}
      <span className="lp-label" style={{
        position: 'relative', zIndex: 1,
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 10, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase',
        color: 'rgba(232,232,232,0.75)', marginBottom: 6, transition: 'color 0.3s',
      }}>{label}</span>
      {/* Desc */}
      <span className="lp-desc" style={{
        position: 'relative', zIndex: 1,
        fontFamily: "'DM Serif Display', Georgia, serif",
        fontSize: 11, fontStyle: 'italic', fontWeight: 300,
        color: 'rgba(136,136,136,0.6)', transition: 'color 0.3s', lineHeight: 1.4,
      }}>{desc}</span>
    </Link>
  )
}

export default function LandingPage() {
  const wrapRef = useRef(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    Object.entries(DARK).forEach(([k, v]) => el.style.setProperty(k, v))
  }, [])

  return (
    <div ref={wrapRef} style={{
      minHeight: '100vh',
      background: 'var(--lp-bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Ambient glows */}
      <div style={{
        position: 'fixed', top: -180, left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 360,
        background: 'radial-gradient(ellipse, rgba(201,168,76,0.055) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />
      <div style={{
        position: 'fixed', bottom: -80, left: -80,
        width: 420, height: 340,
        background: 'radial-gradient(ellipse, rgba(45,35,100,0.1) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '50px 40px 60px', maxWidth: 1100, width: '100%' }}>

        {/* Eyebrow */}
        <p style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 9, fontWeight: 300, letterSpacing: '0.35em', textTransform: 'uppercase',
          color: 'var(--lp-gold)', marginBottom: 18,
          animation: 'lp-fadeup 0.8s 0.15s cubic-bezier(0.16,1,0.3,1) both',
        }}>
          Fat Closet &nbsp;·&nbsp; Store Manager
        </p>

        {/* Title */}
        <h1 style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: 'clamp(42px, 5.5vw, 72px)',
          fontWeight: 500, color: 'var(--lp-text)', lineHeight: 1.0,
          letterSpacing: '-0.02em', marginBottom: 10,
          animation: 'lp-fadeup 0.9s 0.25s cubic-bezier(0.16,1,0.3,1) both',
        }}>
          The <em style={{ fontStyle: 'italic', color: 'var(--lp-gold-lt)', fontWeight: 400 }}>Closet</em><br />Command Centre
        </h1>

        {/* Subtitle */}
        <p style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: 16, fontStyle: 'italic', fontWeight: 300,
          color: 'var(--lp-muted)', letterSpacing: '0.04em', marginBottom: 36,
          animation: 'lp-fadeup 0.9s 0.35s cubic-bezier(0.16,1,0.3,1) both',
        }}>
          Inventory, orders &amp; relationships — unified.
        </p>

        {/* Ornamental rule */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          marginBottom: 40,
          animation: 'lp-fadeup 0.9s 0.42s cubic-bezier(0.16,1,0.3,1) both',
        }}>
          <div style={{ width: 50, height: 1, background: 'linear-gradient(90deg, transparent, var(--lp-gold-dim))' }} />
          <div style={{ width: 3, height: 3, background: 'var(--lp-gold-dim)', transform: 'rotate(45deg)' }} />
          <div style={{ width: 5, height: 5, background: 'var(--lp-gold)', transform: 'rotate(45deg)' }} />
          <div style={{ width: 3, height: 3, background: 'var(--lp-gold-dim)', transform: 'rotate(45deg)' }} />
          <div style={{ width: 50, height: 1, background: 'linear-gradient(90deg, var(--lp-gold-dim), transparent)' }} />
        </div>

        {/* Cards — 6 in one row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
          {cards.map((c, i) => (
            <NavCard key={c.to} {...c} delay={520 + i * 90} />
          ))}
        </div>

        {/* Footer */}
        <p style={{
          marginTop: 36,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 9, fontWeight: 200, letterSpacing: '0.2em', textTransform: 'uppercase',
          color: 'rgba(136,136,136,0.25)',
          animation: 'lp-fadeup 1s 1.05s cubic-bezier(0.16,1,0.3,1) both',
        }}>
          v1.0 &nbsp;·&nbsp; 2026 &nbsp;·&nbsp; Hyderabad
        </p>
      </div>

      <style>{`
        @keyframes lp-fadeup {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
