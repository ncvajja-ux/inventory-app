// client/src/components/ModuleHeader.jsx
import { useBreakpoint } from '../hooks/useBreakpoint'

export default function ModuleHeader({ moduleLabel, breadcrumb, action }) {
  const bp = useBreakpoint()

  if (bp === 'mobile') {
    return (
      <div className="erp-mobile-topbar">
        <span className="erp-mobile-module">{moduleLabel}</span>
        {breadcrumb && (
          <span className="erp-mobile-breadcrumb"> › {breadcrumb}</span>
        )}
        {action && <div className="erp-mobile-action">{action}</div>}
      </div>
    )
  }

  return (
    <div className="erp-module-header">
      <span className="erp-module-label">{moduleLabel}</span>
      {breadcrumb && (
        <>
          <span className="erp-module-chevron">›</span>
          <span className="erp-module-breadcrumb">{breadcrumb}</span>
        </>
      )}
      {action && <div className="erp-module-action">{action}</div>}
    </div>
  )
}
