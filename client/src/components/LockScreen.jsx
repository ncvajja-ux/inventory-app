import { useRef, useState } from 'react'

export default function LockScreen({ onUnlock }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)
  const inputRef = useRef(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!password || loading) return
    setLoading(true)
    setError('')
    try {
      const r = await fetch('/auth/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await r.json()
      if (data.ok) {
        try { sessionStorage.setItem('app_unlocked', '1') } catch {}
        onUnlock()
      } else {
        setError('Incorrect password')
        setShake(true)
        setPassword('')
        setTimeout(() => { setShake(false); inputRef.current?.focus() }, 600)
      }
    } catch {
      setError('Connection error — is the server running?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f0f0f',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Ambient gold glow */}
      <div style={{
        position: 'fixed', top: -180, left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 360,
        background: 'radial-gradient(ellipse, rgba(201,168,76,0.07) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />
      <div style={{
        position: 'fixed', bottom: -80, left: -80,
        width: 420, height: 340,
        background: 'radial-gradient(ellipse, rgba(45,35,100,0.1) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* Content */}
      <div style={{
        position: 'relative', zIndex: 1,
        textAlign: 'center',
        padding: '50px 40px 60px',
        width: '100%',
        maxWidth: 420,
        animation: 'lp-fadeup 0.8s 0.1s cubic-bezier(0.16,1,0.3,1) both',
      }}>
        {/* Eyebrow */}
        <p style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 9, fontWeight: 300, letterSpacing: '0.35em', textTransform: 'uppercase',
          color: '#c9a84c', marginBottom: 18,
        }}>
          Fat Closet &nbsp;·&nbsp; Store Manager
        </p>

        {/* Title */}
        <h1 style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: 'clamp(32px, 5vw, 52px)',
          fontWeight: 500, color: '#e8e8e8', lineHeight: 1.05,
          letterSpacing: '-0.02em', marginBottom: 10,
        }}>
          The <em style={{ fontStyle: 'italic', color: '#e8c97a', fontWeight: 400 }}>Closet</em><br />
          Command Centre
        </h1>

        {/* Ornamental rule */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          margin: '20px 0 28px',
        }}>
          <div style={{ width: 50, height: 1, background: 'linear-gradient(90deg, transparent, #7a6230)' }} />
          <div style={{ width: 3, height: 3, background: '#7a6230', transform: 'rotate(45deg)' }} />
          <div style={{ width: 5, height: 5, background: '#c9a84c', transform: 'rotate(45deg)' }} />
          <div style={{ width: 3, height: 3, background: '#7a6230', transform: 'rotate(45deg)' }} />
          <div style={{ width: 50, height: 1, background: 'linear-gradient(90deg, #7a6230, transparent)' }} />
        </div>

        {/* Lock form */}
        <form onSubmit={handleSubmit}>
          {/* Password input */}
          <div style={{
            animation: shake ? 'lock-shake 0.5s cubic-bezier(0.36,0.07,0.19,0.97)' : 'none',
            marginBottom: 12,
          }}>
            <div style={{
              background: '#1a1a1a',
              border: `1px solid ${error ? '#f87171' : '#2e2e2e'}`,
              borderRadius: 10,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              transition: 'border-color 0.2s',
            }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>🔒</span>
              <input
                ref={inputRef}
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                placeholder="Enter password"
                autoFocus
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#e8e8e8',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 15,
                  width: '100%',
                  letterSpacing: password ? '0.15em' : 'normal',
                }}
              />
            </div>
          </div>

          {/* Error message */}
          {error && (
            <p style={{
              color: '#f87171',
              fontSize: 12,
              marginBottom: 14,
              fontFamily: "'DM Sans', sans-serif",
            }}>{error}</p>
          )}

          {/* Unlock button */}
          <button
            type="submit"
            disabled={loading || !password}
            style={{
              width: '100%',
              padding: '13px 24px',
              background: loading || !password ? '#3a3020' : '#c9a84c',
              color: loading || !password ? '#7a6230' : '#0f0f0f',
              border: 'none',
              borderRadius: 8,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              cursor: loading || !password ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {loading ? 'Checking…' : 'Unlock'}
          </button>
        </form>
      </div>

      <style>{`
        @keyframes lp-fadeup {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes lock-shake {
          10%, 90% { transform: translateX(-2px); }
          20%, 80% { transform: translateX(4px); }
          30%, 50%, 70% { transform: translateX(-6px); }
          40%, 60% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  )
}
