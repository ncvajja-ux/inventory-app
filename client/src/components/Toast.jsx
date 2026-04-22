import { useState, useCallback, createContext, useContext } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toast, setToast] = useState({ msg: '', type: 'success', show: false })

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type, show: true })
    const duration = type === 'warning' ? 6000 : 3000
    setTimeout(() => setToast(t => ({ ...t, show: false })), duration)
  }, [])

  const bg = toast.type === 'error'   ? '#dc2626'
           : toast.type === 'info'    ? '#0369a1'
           : toast.type === 'warning' ? '#b45309'
           : '#16a34a'

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div style={{
        position: 'fixed',
        bottom: 32,
        right: 32,
        padding: '14px 22px',
        borderRadius: 10,
        fontSize: 14,
        fontWeight: 500,
        color: 'white',
        background: bg,
        opacity: toast.show ? 1 : 0,
        transform: toast.show ? 'translateY(0)' : 'translateY(12px)',
        transition: 'all 0.3s ease',
        zIndex: 999,
        pointerEvents: 'none',
        maxWidth: 400,
        whiteSpace: 'pre-line',
      }}>
        {toast.msg}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
