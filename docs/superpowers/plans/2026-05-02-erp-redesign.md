# ERP Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply consistent ERP chrome (module header + breadcrumb + tabs + stats strip) to every page, add full mobile responsiveness with bottom nav and card lists.

**Architecture:** New shared components provide the layout shell (`ERPLayout`) and chrome (`ModuleHeader`, `ModuleTabs`, `StatsStrip`). Pages are migrated one-by-one to use these components, replacing the current `<div className="page-layout"><Sidebar .../></div>` wrapper. On mobile (< 768 px) a fixed bottom nav replaces the sidebar, and list views render card-style rows instead of data tables.

**Tech Stack:** React 18, Vite, CSS custom properties (existing), `react-router-dom` `useLocation`/`useSearchParams`, Supabase `@supabase/supabase-js` (schema helpers already in `client/src/lib/supabase.js`).

---

## File Map

**New files:**
- `client/src/hooks/useBreakpoint.js` — returns `'mobile' | 'tablet' | 'desktop'` based on viewport width
- `client/src/styles/erp.css` — all ERP layout classes (shell, chrome, table, card, bottom nav)
- `client/src/components/StatusBadge.jsx` — coloured pill badge for status strings
- `client/src/components/ERPLayout.jsx` — renders sidebar (desktop/tablet) or bottom nav (mobile) + `<main>`
- `client/src/components/BottomNav.jsx` — mobile-only bottom tab bar (5 items + More sheet)
- `client/src/components/ModuleHeader.jsx` — sticky amber module label + breadcrumb + action slot
- `client/src/components/ModuleTabs.jsx` — underline tab bar
- `client/src/components/StatsStrip.jsx` — KPI row with optional right-side slot
- `client/src/components/DataTable.jsx` — comfortable desktop/tablet table (header + alternating rows)
- `client/src/components/CardList.jsx` — mobile card list

**Modified files:**
- `client/src/main.jsx` — import `erp.css`
- `client/src/components/Sidebar.jsx` — remove `SECTION_TABS` and per-page tab rendering; props become optional/unused
- `client/src/pages/Inventory.jsx` — wrap with ERP chrome; replace product list with DataTable + CardList
- `client/src/pages/Sales.jsx` — wrap with ERP chrome; keep existing sub-components
- `client/src/pages/PurchaseOrders.jsx` — wrap with ERP chrome
- `client/src/pages/Customers.jsx` — wrap with ERP chrome
- `client/src/pages/Buyers.jsx` — wrap with ERP chrome
- `client/src/pages/HR.jsx` — wrap with ERP chrome
- `client/src/pages/Analytics.jsx` — replace custom dark topbar with ERP chrome
- `client/src/pages/Groups.jsx` — wrap with ERP chrome

---

## Task 1: Core infrastructure — useBreakpoint, erp.css, StatusBadge

**Files:**
- Create: `client/src/hooks/useBreakpoint.js`
- Create: `client/src/styles/erp.css`
- Create: `client/src/components/StatusBadge.jsx`
- Modify: `client/src/main.jsx`

- [ ] **Step 1: Create `useBreakpoint.js`**

```js
// client/src/hooks/useBreakpoint.js
import { useState, useEffect } from 'react'

function getBreakpoint() {
  if (typeof window === 'undefined') return 'desktop'
  if (window.innerWidth < 768) return 'mobile'
  if (window.innerWidth < 1024) return 'tablet'
  return 'desktop'
}

export function useBreakpoint() {
  const [bp, setBp] = useState(getBreakpoint)
  useEffect(() => {
    const handler = () => setBp(getBreakpoint())
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return bp
}
```

- [ ] **Step 2: Create `erp.css`**

Create `client/src/styles/erp.css` with the full content below. These classes use the existing CSS variables (`--card`, `--border`, `--ink`, `--muted`, `--accent`, `--bg`, `--success`, `--danger`, `--info`, `--accent2`) already defined in `index.css`.

```css
/* ─── ERP Shell ──────────────────────────────────────────────────────────── */
.erp-shell {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.erp-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

/* ─── Module Header ──────────────────────────────────────────────────────── */
.erp-module-header {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--card);
  border-bottom: 1px solid var(--border);
  padding: 0 24px;
  height: 45px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.erp-module-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--accent);
}
.erp-module-chevron { color: var(--muted); font-size: 11px; }
.erp-module-breadcrumb { font-size: 12px; color: var(--muted); }
.erp-module-action { margin-left: auto; }

/* Mobile top bar (replaces module header on small screens) */
.erp-mobile-topbar {
  display: none;
  background: var(--card);
  border-bottom: 1px solid var(--border);
  padding: 0 16px;
  height: 48px;
  align-items: center;
  gap: 8px;
  position: sticky;
  top: 0;
  z-index: 10;
  flex-shrink: 0;
}
.erp-mobile-module {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
}
.erp-mobile-breadcrumb {
  font-size: 12px;
  color: var(--muted);
  flex: 1;
}
.erp-mobile-action { margin-left: auto; }

/* ─── Tabs ───────────────────────────────────────────────────────────────── */
.erp-tabs {
  position: sticky;
  top: 45px;
  z-index: 9;
  background: var(--card);
  border-bottom: 1px solid var(--border);
  display: flex;
  padding: 0 24px;
  flex-shrink: 0;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.erp-tabs::-webkit-scrollbar { display: none; }
.erp-tab {
  padding: 10px 16px;
  border: none;
  background: none;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  color: var(--muted);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: color 0.15s, border-color 0.15s;
  outline: none;
  white-space: nowrap;
  flex-shrink: 0;
}
.erp-tab:hover { color: var(--ink); }
.erp-tab.active { color: var(--accent); border-bottom-color: var(--accent); }

/* ─── Stats Strip ────────────────────────────────────────────────────────── */
.erp-stats-strip {
  position: sticky;
  top: 87px; /* 45px header + 42px tabs */
  z-index: 8;
  background: var(--card);
  border-bottom: 1px solid var(--border);
  padding: 8px 24px;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  gap: 0;
}
.erp-stats-strip::-webkit-scrollbar { display: none; }
.erp-stats-kpis {
  display: flex;
  gap: 28px;
  flex: 1;
}
.erp-kpi {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex-shrink: 0;
}
.erp-kpi-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--accent);
  line-height: 1;
}
.erp-kpi-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
}
.erp-stats-right {
  margin-left: auto;
  flex-shrink: 0;
  padding-left: 16px;
}

/* ─── Content area ───────────────────────────────────────────────────────── */
.erp-content {
  flex: 1;
  padding: 24px;
  min-width: 0;
}

/* ─── DataTable ──────────────────────────────────────────────────────────── */
.erp-table-wrap { font-size: 13px; }
.erp-table-header {
  display: grid;
  padding: 6px 16px;
  background: var(--card);
  border-bottom: 1px solid var(--border);
}
.erp-th {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
  padding-right: 8px;
}
.erp-table-row {
  display: grid;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
  align-items: center;
  transition: background 0.1s;
}
.erp-table-row.alt { background: var(--bg); }
.erp-table-row.clickable:hover { background: var(--accent2); cursor: pointer; }
.erp-td { color: var(--ink); padding-right: 8px; }
.erp-table-empty {
  padding: 40px;
  text-align: center;
  color: var(--muted);
  font-size: 13px;
}

/* ─── CardList (mobile) ──────────────────────────────────────────────────── */
.erp-card-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
}
.erp-card-item {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 16px;
}
.erp-card-list-empty {
  padding: 40px;
  text-align: center;
  color: var(--muted);
  font-size: 13px;
}

/* ─── Bottom Nav ─────────────────────────────────────────────────────────── */
.erp-bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: var(--card);
  border-top: 1px solid var(--border);
  display: none;
  justify-content: space-around;
  padding: 4px 0;
  padding-bottom: calc(4px + env(safe-area-inset-bottom, 0px));
}
.erp-bottom-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 10px;
  background: none;
  border: none;
  cursor: pointer;
  text-decoration: none;
  color: var(--muted);
  font-family: inherit;
  min-width: 52px;
  transition: color 0.15s;
}
.erp-bottom-item.active { color: var(--accent); }
.erp-bottom-icon { font-size: 20px; line-height: 1; }
.erp-bottom-label { font-size: 9px; font-weight: 600; letter-spacing: 0.04em; color: inherit; }

.erp-more-backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.4);
}
.erp-more-sheet {
  position: absolute;
  bottom: 56px;
  left: 0;
  right: 0;
  background: var(--card);
  border-top: 1px solid var(--border);
  border-radius: 12px 12px 0 0;
  padding: 8px 0 16px;
}
.erp-more-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 24px;
  color: var(--ink);
  text-decoration: none;
  font-size: 15px;
  font-weight: 500;
}
.erp-more-item:hover { background: var(--bg); }

/* ─── Mobile overrides ───────────────────────────────────────────────────── */
@media (max-width: 767px) {
  .erp-bottom-nav    { display: flex; }
  .erp-main          { padding-bottom: 60px; }
  .erp-content       { padding: 0; }
  .erp-tabs          { padding: 0 12px; }
  .erp-module-header { display: none; }
  .erp-mobile-topbar { display: flex; }
  .erp-stats-strip   { top: 48px; padding: 6px 12px; } /* mobile topbar is 48px */
  .erp-tabs          { top: calc(48px + 42px); }       /* mobile topbar + stats */
  /* On mobile: stats above tabs so strip stacks: topbar → stats → tabs */
}

/* Dark theme adjustments for ERP components */
[data-theme="dark"] .erp-module-header,
[data-theme="dark"] .erp-mobile-topbar,
[data-theme="dark"] .erp-tabs,
[data-theme="dark"] .erp-stats-strip,
[data-theme="dark"] .erp-table-header,
[data-theme="dark"] .erp-card-item,
[data-theme="dark"] .erp-bottom-nav,
[data-theme="dark"] .erp-more-sheet {
  background: var(--card);
  border-color: var(--border);
}
```

- [ ] **Step 3: Create `StatusBadge.jsx`**

```jsx
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
```

- [ ] **Step 4: Import `erp.css` in `main.jsx`**

Open `client/src/main.jsx`. After the existing imports, add:
```js
import './styles/erp.css'
```

The full modified top of `main.jsx` (keep everything else unchanged):
```js
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './styles/erp.css'
import App from './App.jsx'
```

- [ ] **Step 5: Start dev server and verify no errors**

```bash
cd client && npm run dev
```

Expected: Server starts on http://localhost:5173 with no compile errors. No visual changes yet — components are unused.

- [ ] **Step 6: Commit**

```bash
git add client/src/hooks/useBreakpoint.js client/src/styles/erp.css client/src/components/StatusBadge.jsx client/src/main.jsx
git commit -m "feat: add ERP core infrastructure — useBreakpoint, erp.css, StatusBadge"
```

---

## Task 2: ERPLayout + BottomNav

**Files:**
- Create: `client/src/components/BottomNav.jsx`
- Create: `client/src/components/ERPLayout.jsx`

- [ ] **Step 1: Create `BottomNav.jsx`**

```jsx
// client/src/components/BottomNav.jsx
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useRole } from './RoleContext'

const ADMIN_ITEMS = [
  { icon: '🏷️', label: 'Stock',  href: '/inventory' },
  { icon: '🧾', label: 'Sales',  href: '/sales' },
  { icon: '📦', label: 'POs',    href: '/purchase-orders' },
  { icon: '👤', label: 'CRM',    href: '/customers' },
  { icon: '⋯',  label: 'More',   href: null },
]
const SALES_ITEMS = [
  { icon: '🏷️', label: 'Stock',     href: '/inventory' },
  { icon: '🧾', label: 'Sales',     href: '/sales' },
  { icon: '👤', label: 'CRM',       href: '/customers' },
  { icon: '👥', label: 'Groups',    href: '/groups' },
  { icon: '📊', label: 'Analytics', href: '/analytics' },
]
const MORE_ITEMS = [
  { icon: '📊', label: 'Analytics', href: '/analytics' },
  { icon: '🏢', label: 'Buyers',    href: '/buyers' },
  { icon: '👥', label: 'Groups',    href: '/groups' },
  { icon: '👷', label: 'HR',        href: '/hr' },
]

export default function BottomNav() {
  const location = useLocation()
  const role = useRole()
  const [moreOpen, setMoreOpen] = useState(false)
  const items = role === 'admin' ? ADMIN_ITEMS : SALES_ITEMS

  function isActive(href) {
    if (!href) return false
    return href === '/' ? location.pathname === '/' : location.pathname.startsWith(href)
  }

  return (
    <>
      {moreOpen && (
        <div className="erp-more-backdrop" onClick={() => setMoreOpen(false)}>
          <div className="erp-more-sheet" onClick={e => e.stopPropagation()}>
            {MORE_ITEMS.map(item => (
              <Link
                key={item.href}
                to={item.href}
                className="erp-more-item"
                onClick={() => setMoreOpen(false)}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
      <nav className="erp-bottom-nav">
        {items.map(item =>
          item.href ? (
            <Link
              key={item.href}
              to={item.href}
              className={`erp-bottom-item${isActive(item.href) ? ' active' : ''}`}
            >
              <span className="erp-bottom-icon">{item.icon}</span>
              <span className="erp-bottom-label">{item.label}</span>
            </Link>
          ) : (
            <button
              key="more"
              className={`erp-bottom-item${moreOpen ? ' active' : ''}`}
              onClick={() => setMoreOpen(o => !o)}
            >
              <span className="erp-bottom-icon">{item.icon}</span>
              <span className="erp-bottom-label">{item.label}</span>
            </button>
          )
        )}
      </nav>
    </>
  )
}
```

- [ ] **Step 2: Create `ERPLayout.jsx`**

```jsx
// client/src/components/ERPLayout.jsx
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import { useBreakpoint } from '../hooks/useBreakpoint'

export default function ERPLayout({ children }) {
  const bp = useBreakpoint()
  return (
    <div className="erp-shell">
      {bp !== 'mobile' && <Sidebar />}
      <main className="erp-main">
        {children}
      </main>
      {bp === 'mobile' && <BottomNav />}
    </div>
  )
}
```

- [ ] **Step 3: Verify no compile errors**

```bash
cd client && npm run dev
```

Expected: No errors. Still no visual change — `ERPLayout` is imported by nothing yet.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/BottomNav.jsx client/src/components/ERPLayout.jsx
git commit -m "feat: add ERPLayout shell and BottomNav mobile component"
```

---

## Task 3: ModuleHeader + ModuleTabs + StatsStrip

**Files:**
- Create: `client/src/components/ModuleHeader.jsx`
- Create: `client/src/components/ModuleTabs.jsx`
- Create: `client/src/components/StatsStrip.jsx`

- [ ] **Step 1: Create `ModuleHeader.jsx`**

```jsx
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
```

- [ ] **Step 2: Create `ModuleTabs.jsx`**

```jsx
// client/src/components/ModuleTabs.jsx
export default function ModuleTabs({ tabs, activeTab, onChange }) {
  return (
    <div className="erp-tabs">
      {tabs.map(t => (
        <button
          key={t.id}
          className={`erp-tab${activeTab === t.id ? ' active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Create `StatsStrip.jsx`**

```jsx
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
```

- [ ] **Step 4: Verify no compile errors**

```bash
cd client && npm run dev
```

Expected: Clean build. Components are still unused — no visual change.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/ModuleHeader.jsx client/src/components/ModuleTabs.jsx client/src/components/StatsStrip.jsx
git commit -m "feat: add ModuleHeader, ModuleTabs, StatsStrip chrome components"
```

---

## Task 4: DataTable + CardList

**Files:**
- Create: `client/src/components/DataTable.jsx`
- Create: `client/src/components/CardList.jsx`

- [ ] **Step 1: Create `DataTable.jsx`**

`gridCols` is a CSS `grid-template-columns` string (e.g. `"2fr 1fr 1fr 80px 80px"`). When `renderRow` is provided, it receives `(row, index)` and must use `erp-table-row` class for correct alternating styling. When omitted, DataTable renders cells automatically using `columns[n].render(row)`.

```jsx
// client/src/components/DataTable.jsx
export default function DataTable({
  columns,
  rows,
  gridCols,
  onRowClick,
  loading,
  emptyText = 'No records found.',
  renderRow,
}) {
  const template = gridCols || `repeat(${columns.length}, 1fr)`

  if (loading) return <div className="erp-table-empty">Loading…</div>
  if (!rows || rows.length === 0) {
    return <div className="erp-table-empty">{emptyText}</div>
  }

  return (
    <div className="erp-table-wrap">
      {/* Header */}
      <div className="erp-table-header" style={{ gridTemplateColumns: template }}>
        {columns.map(c => (
          <div key={c.key} className="erp-th" style={{ textAlign: c.align || 'left' }}>
            {c.label}
          </div>
        ))}
      </div>

      {/* Rows */}
      {rows.map((row, i) =>
        renderRow ? (
          renderRow(row, i)
        ) : (
          <div
            key={row.id ?? row.sku_id ?? row.vbeln ?? i}
            className={`erp-table-row${i % 2 === 1 ? ' alt' : ''}${onRowClick ? ' clickable' : ''}`}
            style={{ gridTemplateColumns: template }}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
          >
            {columns.map(c => (
              <div key={c.key} className="erp-td" style={{ textAlign: c.align || 'left' }}>
                {c.render ? c.render(row) : (row[c.key] ?? '—')}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `CardList.jsx`**

```jsx
// client/src/components/CardList.jsx
export default function CardList({
  items,
  renderCard,
  onCardClick,
  loading,
  emptyText = 'No records found.',
}) {
  if (loading) return <div className="erp-card-list-empty">Loading…</div>
  if (!items || items.length === 0) {
    return <div className="erp-card-list-empty">{emptyText}</div>
  }

  return (
    <div className="erp-card-list">
      {items.map((item, i) => (
        <div
          key={item.id ?? item.sku_id ?? item.vbeln ?? i}
          className="erp-card-item"
          onClick={onCardClick ? () => onCardClick(item) : undefined}
          style={onCardClick ? { cursor: 'pointer' } : undefined}
        >
          {renderCard(item)}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Verify no compile errors**

```bash
cd client && npm run dev
```

Expected: Clean build.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/DataTable.jsx client/src/components/CardList.jsx
git commit -m "feat: add DataTable and CardList data display components"
```

---

## Task 5: Sidebar refactor — remove per-page tabs

**Files:**
- Modify: `client/src/components/Sidebar.jsx`

The `SECTION_TABS` block and the section tab rendering loop must be removed. The component still accepts `section`, `activeTab`, `onTabChange` as props (for backward compat with unmigrated pages) but ignores them — active state is determined solely by `useLocation()`. The "Navigate" section label and module links remain unchanged.

- [ ] **Step 1: Read the current file**

Read `client/src/components/Sidebar.jsx` to confirm current structure before editing.

- [ ] **Step 2: Remove SECTION_TABS constant and section tab rendering**

Replace the entire current file content with:

```jsx
// client/src/components/Sidebar.jsx
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTheme } from './ThemeContext'
import { useRole } from './RoleContext'

const ALL_NAV = [
  { href: '/',                icon: '🏠', label: 'Home' },
  { href: '/customers',       icon: '👤', label: 'Customers' },
  { href: '/groups',          icon: '👥', label: 'Customer Groups' },
  { href: '/inventory',       icon: '🏷️', label: 'Inventory' },
  { href: '/sales',           icon: '🧾', label: 'Sales' },
  { href: '/buyers',          icon: '🏢', label: 'Buyers' },
  { href: '/purchase-orders', icon: '📦', label: 'Purchase Orders' },
  { href: '/analytics',       icon: '📊', label: 'Analytics' },
  { href: '/hr',              icon: '👷', label: 'HR' },
]

const ALLOWED = {
  admin: null,
  sales: new Set(['/', '/customers', '/sales', '/invoice', '/inventory', '/analytics', '/groups']),
}

// Props section/activeTab/onTabChange accepted but unused —
// kept for backward compat during page migration.
export default function Sidebar() {
  const location = useLocation()
  const { theme, toggleTheme } = useTheme()
  const role = useRole()

  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebarCollapsed') === 'true' } catch { return false }
  })

  function toggle() {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem('sidebarCollapsed', String(next)) } catch {}
  }

  function canSee(path) {
    if (role === 'admin' || !ALLOWED[role]) return true
    return ALLOWED[role].has(path)
  }

  return (
    <div className={`sidebar${collapsed ? ' sidebar-collapsed' : ''}`}>
      {/* Brand */}
      <div className="sidebar-brand-row">
        <Link className="sidebar-brand" to="/" style={{ textDecoration: 'none' }}>
          {collapsed ? 'FC' : 'Fat Closet'}
        </Link>
        <button
          className="sidebar-toggle"
          onClick={toggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '▶' : '◀'}
        </button>
      </div>

      {/* Navigation */}
      <>
        {!collapsed && <span className="nav-section">Navigate</span>}
        {collapsed && <div className="nav-divider" />}
        {ALL_NAV.filter(link => canSee(link.href)).map(link => {
          const isActive = link.href === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(link.href)
          return (
            <Link
              key={link.href}
              className={`nav-item${isActive ? ' active' : ''}`}
              to={link.href}
              title={collapsed ? link.label : undefined}
            >
              <span className="nav-icon">{link.icon}</span>
              {!collapsed && <span className="nav-label">{link.label}</span>}
            </Link>
          )
        })}
      </>

      {/* Theme toggle */}
      <div className="sidebar-footer">
        <button
          className="nav-item"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          <span className="nav-icon">{theme === 'dark' ? '☀️' : '🌙'}</span>
          {!collapsed && <span className="nav-label">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify in browser**

```bash
cd client && npm run dev
```

Open http://localhost:5173/inventory. Expected: Sidebar no longer shows per-page tabs (Products / Config / etc.). Navigation links still work. The page content is unchanged.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/Sidebar.jsx
git commit -m "refactor: remove per-page SECTION_TABS from Sidebar (tabs move to ModuleTabs in each page)"
```

---

## Task 6: Migrate Inventory page

**Files:**
- Modify: `client/src/pages/Inventory.jsx`

Replace the root `Inventory()` component and the `BrowseTab` table with ERP chrome. `AddTab`, `ConfigTab`, `UploadTab`, `ProductRow`, and all data hooks remain unchanged.

**Stats query** fetches: total SKU count, total variant quantity, out-of-stock variant count.

- [ ] **Step 1: Read the bottom of `Inventory.jsx` (lines 700–755 and 1300–1317)**

Read these ranges to confirm the current `BrowseTab` return JSX and root `Inventory` component before editing.

- [ ] **Step 2: Add new imports at the top of `Inventory.jsx`**

After the existing import block (after `import { db } from '../lib/supabase'`), add:

```jsx
import ERPLayout from '../components/ERPLayout'
import ModuleHeader from '../components/ModuleHeader'
import ModuleTabs from '../components/ModuleTabs'
import StatsStrip from '../components/StatsStrip'
import DataTable from '../components/DataTable'
import CardList from '../components/CardList'
import StatusBadge from '../components/StatusBadge'
import { useBreakpoint } from '../hooks/useBreakpoint'
```

- [ ] **Step 3: Replace the root `Inventory()` function (lines ~1302–1317)**

Find this block:
```jsx
// ── Root Component ────────────────────────────────────────────────────────────
export default function Inventory() {
  const [tab, setTab] = useState('view')
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="page-layout">
      <Sidebar section="Inventory" activeTab={tab} onTabChange={t => { setTab(t) }} />
      <div className="main">
        {tab === 'add' && <AddTab onAdded={() => { setRefreshKey(k => k + 1) }} />}
        {tab === 'view' && <BrowseTab refreshKey={refreshKey} />}
        {tab === 'cats' && <ConfigTab />}
        {tab === 'upload' && <UploadTab />}
      </div>
    </div>
  )
}
```

Replace it with:

```jsx
const INV_TABS = [
  { id: 'view',   label: 'Products' },
  { id: 'cats',   label: 'Config' },
  { id: 'add',    label: 'Add Product' },
  { id: 'upload', label: 'Mass Upload' },
]

// ── Root Component ────────────────────────────────────────────────────────────
export default function Inventory() {
  const [tab, setTab] = useState('view')
  const [refreshKey, setRefreshKey] = useState(0)
  const [stats, setStats] = useState({ skus: '—', variants: '—', outOfStock: '—' })

  useEffect(() => {
    async function loadStats() {
      try {
        const [{ count: skuCount }, { data: stockRows }] = await Promise.all([
          db.inventory().from('products').select('*', { count: 'exact', head: true }),
          db.inventory().from('mara').select('quantity'),
        ])
        const total = (stockRows || []).reduce((s, r) => s + (r.quantity || 0), 0)
        const oos   = (stockRows || []).filter(r => (r.quantity || 0) === 0).length
        setStats({ skus: skuCount ?? '—', variants: total, outOfStock: oos })
      } catch { /* non-fatal */ }
    }
    loadStats()
  }, [refreshKey])

  const TAB_LABELS = { view: 'Products', cats: 'Config', add: 'Add Product', upload: 'Mass Upload' }

  return (
    <ERPLayout>
      <ModuleHeader
        moduleLabel="INVENTORY"
        breadcrumb={TAB_LABELS[tab]}
        action={
          tab === 'view' && (
            <button className="btn btn-primary" style={{ fontSize: 12, padding: '6px 14px' }}
              onClick={() => setTab('add')}>
              + New Product
            </button>
          )
        }
      />
      <ModuleTabs tabs={INV_TABS} activeTab={tab} onChange={t => { setTab(t); if (t === 'view') setRefreshKey(k => k + 1) }} />
      <StatsStrip stats={[
        { value: stats.skus,        label: 'SKUs' },
        { value: stats.variants,    label: 'Variants' },
        { value: stats.outOfStock,  label: 'Out of Stock', color: stats.outOfStock > 0 ? 'var(--danger)' : undefined },
      ]} />
      <div className="erp-content">
        {tab === 'add'    && <AddTab onAdded={() => { setRefreshKey(k => k + 1); setTab('view') }} />}
        {tab === 'view'   && <BrowseTab refreshKey={refreshKey} />}
        {tab === 'cats'   && <ConfigTab />}
        {tab === 'upload' && <UploadTab />}
      </div>
    </ERPLayout>
  )
}
```

- [ ] **Step 4: Replace `BrowseTab` list section with DataTable + CardList**

Find the `BrowseTab` component's `return (` block (around line 716). Replace only the return JSX (keep all state, hooks, and `filtered` logic above it unchanged):

```jsx
  const bp = useBreakpoint()

  const INV_COLUMNS = [
    { key: 'brand', label: 'Brand / SKU', render: r => (
      <div>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{r.brand}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{r.sku_code}</div>
      </div>
    )},
    { key: 'category',   label: 'Category' },
    { key: 'color',      label: 'Color' },
    { key: 'fit',        label: 'Fit' },
    { key: 'total_stock', label: 'Stock', align: 'right', render: r => (
      <span style={{ color: (r.total_stock || 0) === 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>
        {r.total_stock ?? 0}
      </span>
    )},
    { key: 'mrp', label: 'MRP', align: 'right', render: r =>
      r.mrp ? `₹${Number(r.mrp).toLocaleString('en-IN')}` : '—'
    },
  ]

  return (
    <div>
      {/* Search / refresh bar */}
      <div style={{ display: 'flex', gap: 12, padding: '16px 24px 0', alignItems: 'center' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search brand, category, color…"
          style={{ flex: 1, padding: '9px 14px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--card)', color: 'var(--ink)', fontSize: 13 }}
        />
        <button className="btn btn-ghost" onClick={reload}>↺</button>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{filtered.length} products</span>
      </div>

      {bp === 'mobile' ? (
        <CardList
          items={filtered}
          loading={loading}
          emptyText="No products found."
          renderCard={item => (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{item.brand}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  {[item.category, item.color, item.fit].filter(Boolean).join(' · ')}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{item.sku_code}</div>
                {item.mrp && (
                  <div style={{ fontWeight: 600, marginTop: 4, fontSize: 13 }}>
                    ₹{Number(item.mrp).toLocaleString('en-IN')}
                  </div>
                )}
              </div>
              <StatusBadge
                status={(item.total_stock || 0) === 0 ? 'out_of_stock' : 'active'}
                label={(item.total_stock || 0) === 0 ? 'Out of Stock' : `${item.total_stock} pcs`}
              />
            </div>
          )}
        />
      ) : (
        <div style={{ marginTop: 16 }}>
          <DataTable
            columns={INV_COLUMNS}
            rows={filtered}
            gridCols="2fr 1fr 1fr 1fr 80px 90px"
            loading={loading}
            emptyText="No products found."
            renderRow={(p, i) => (
              <div
                key={p.sku_id}
                className={`erp-table-row${i % 2 === 1 ? ' alt' : ''}`}
                style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 80px 90px' }}
              >
                {INV_COLUMNS.map(c => (
                  <div key={c.key} className="erp-td" style={{ textAlign: c.align || 'left' }}>
                    {c.render ? c.render(p) : (p[c.key] ?? '—')}
                  </div>
                ))}
              </div>
            )}
          />
        </div>
      )}

      {editingProduct && (
        <EditProductModal product={editingProduct} onClose={() => setEditingProduct(null)} onSaved={reload} />
      )}
    </div>
  )
```

Note: also add `const bp = useBreakpoint()` and the `INV_COLUMNS` definition right before the `return (` statement in `BrowseTab`. Remove the old `<h1 className="page-title">`, the old column headers div, and the old `filtered.map(p => <ProductRow ...>)` render.

Also remove the `import Sidebar from '../components/Sidebar'` line — `ERPLayout` now handles the sidebar.

- [ ] **Step 5: Verify in browser**

```bash
cd client && npm run dev
```

Open http://localhost:5173/inventory. Expected:
- Amber "INVENTORY" header with "Products" breadcrumb visible at top
- Tabs row: Products · Config · Add Product · Mass Upload
- Stats strip: SKU count · Variant count · Out of Stock count
- Products list renders as cards on narrow window (resize to < 768px), as DataTable headers + rows on wide

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/Inventory.jsx
git commit -m "feat: migrate Inventory page to ERP chrome with DataTable + CardList"
```

---

## Task 7: Migrate Sales page

**Files:**
- Modify: `client/src/pages/Sales.jsx`

Apply ERP chrome. Keep all existing sub-components (`NewOrderTab`, `AllOrdersTab`, `ReturnsTab`, `PricingTab`) unchanged. The existing `sales-tabbar` div is replaced by `ModuleTabs`.

- [ ] **Step 1: Add ERP imports to `Sales.jsx`**

After the existing import block, add:
```jsx
import ERPLayout from '../components/ERPLayout'
import ModuleHeader from '../components/ModuleHeader'
import ModuleTabs from '../components/ModuleTabs'
import StatsStrip from '../components/StatsStrip'
```

Remove: `import Sidebar from '../components/Sidebar'`

- [ ] **Step 2: Add stats state + loader to the root `Sales()` function**

In `Sales()`, after the existing `const [searchParams, setSearchParams] = useSearchParams()` line, add:

```jsx
const [stats, setStats] = useState({ orders: '—', revenue: '—', pending: '—', thisMonth: '—' })

useEffect(() => {
  async function loadStats() {
    try {
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString().split('T')[0]
      const [
        { count: total },
        { data: amounts },
        { count: pending },
        { count: month },
      ] = await Promise.all([
        db.transactions().from('vbak').select('*', { count: 'exact', head: true }),
        db.transactions().from('vbak').select('netwr'),
        db.transactions().from('vbak').select('*', { count: 'exact', head: true })
          .in('status', ['Pending', 'pending', 'PENDING']),
        db.transactions().from('vbak').select('*', { count: 'exact', head: true })
          .gte('erdat', monthStart),
      ])
      const revenue = (amounts || []).reduce((s, r) => s + (r.netwr || 0), 0)
      const fmt = n => n >= 100000
        ? `₹${(n / 100000).toFixed(1)}L`
        : n >= 1000
        ? `₹${(n / 1000).toFixed(1)}K`
        : `₹${n}`
      setStats({ orders: total ?? 0, revenue: fmt(revenue), pending: pending ?? 0, thisMonth: month ?? 0 })
    } catch { /* non-fatal */ }
  }
  loadStats()
}, [])
```

- [ ] **Step 3: Replace the `Sales()` return JSX**

The existing return block is:
```jsx
return (
  <div className="page-layout">
    <Sidebar section="Sales" activeTab={tab} onTabChange={setTab} />
    <div className="main" style={{ display: 'flex', flexDirection: 'column', padding: 0 }}>
      <div className="topbar">...</div>
      <div className="sales-tabbar">...</div>
      <div style={{ flex: 1, padding: '32px 40px', overflowX: 'hidden' }}>
        {tab === 'new' && <NewOrderTab />}
        ...
      </div>
    </div>
  </div>
)
```

Replace the entire return block with:

```jsx
const SALES_TABS = [
  { id: 'orders',  label: 'All Orders' },
  { id: 'returns', label: 'Returns' },
  { id: 'pricing', label: 'Sales Pricing' },
  { id: 'new',     label: 'New Order' },
]
const TAB_LABELS = { orders: 'All Orders', returns: 'Returns', pricing: 'Sales Pricing', new: 'New Order' }

return (
  <ERPLayout>
    <ModuleHeader
      moduleLabel="SALES"
      breadcrumb={TAB_LABELS[tab]}
      action={
        tab !== 'new' && (
          <button className="btn btn-primary" style={{ fontSize: 12, padding: '6px 14px' }}
            onClick={() => setTab('new')}>
            + New Order
          </button>
        )
      }
    />
    <ModuleTabs tabs={SALES_TABS} activeTab={tab} onChange={setTab} />
    <StatsStrip stats={[
      { value: stats.orders,    label: 'Orders' },
      { value: stats.revenue,   label: 'Revenue', color: 'var(--success)' },
      { value: stats.pending,   label: 'Pending', color: stats.pending > 0 ? 'var(--accent)' : undefined },
      { value: stats.thisMonth, label: 'This Month' },
    ]} />
    <div className="erp-content">
      {tab === 'new'     && <NewOrderTab />}
      {tab === 'orders'  && <AllOrdersTab />}
      {tab === 'returns' && <ReturnsTab />}
      {tab === 'pricing' && <PricingTab />}
    </div>
  </ERPLayout>
)
```

Note: `SALES_TABS` and `TAB_LABELS` must be defined outside the component (module scope) or inside before the `return`. Also ensure the `useState` import still exists.

- [ ] **Step 4: Verify in browser**

Open http://localhost:5173/sales. Expected:
- "SALES" header with tab breadcrumb
- Tabs: All Orders · Returns · Sales Pricing · New Order
- Stats strip with order counts and revenue
- All order creation / order list functionality works unchanged

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/Sales.jsx
git commit -m "feat: migrate Sales page to ERP chrome"
```

---

## Task 8: Migrate PurchaseOrders page

**Files:**
- Modify: `client/src/pages/PurchaseOrders.jsx`

- [ ] **Step 1: Add imports, remove Sidebar import**

```jsx
import ERPLayout from '../components/ERPLayout'
import ModuleHeader from '../components/ModuleHeader'
import ModuleTabs from '../components/ModuleTabs'
import StatsStrip from '../components/StatsStrip'
```
Remove: `import Sidebar from '../components/Sidebar'`

- [ ] **Step 2: Read the current root `PurchaseOrders()` function**

Read `client/src/pages/PurchaseOrders.jsx` lines 640–663 to see the current return structure.

- [ ] **Step 3: Replace the root component**

Find the `export default function PurchaseOrders()` block and replace:

```jsx
const PO_TABS = [
  { id: 'all', label: 'All POs' },
  { id: 'new', label: 'New PO' },
]

export default function PurchaseOrders() {
  const [tab, setTab] = useState('all')
  const [refreshKey, setRefreshKey] = useState(0)
  const [stats, setStats] = useState({ total: '—', value: '—', pending: '—' })

  useEffect(() => {
    async function loadStats() {
      try {
        const [{ count: total }, { data: amounts }, { count: pending }] = await Promise.all([
          db.transactions().from('po_header').select('*', { count: 'exact', head: true }),
          db.transactions().from('po_header').select('total_amount'),
          db.transactions().from('po_header').select('*', { count: 'exact', head: true })
            .in('status', ['Pending', 'pending', 'PENDING', 'Open', 'open']),
        ])
        const totalVal = (amounts || []).reduce((s, r) => s + (r.total_amount || 0), 0)
        const fmt = n => n >= 100000
          ? `₹${(n / 100000).toFixed(1)}L`
          : n >= 1000
          ? `₹${(n / 1000).toFixed(1)}K`
          : `₹${n}`
        setStats({ total: total ?? 0, value: fmt(totalVal), pending: pending ?? 0 })
      } catch { /* non-fatal */ }
    }
    loadStats()
  }, [refreshKey])

  return (
    <ERPLayout>
      <ModuleHeader
        moduleLabel="PURCHASE ORDERS"
        breadcrumb={tab === 'all' ? 'All POs' : 'New PO'}
        action={
          tab !== 'new' && (
            <button className="btn btn-primary" style={{ fontSize: 12, padding: '6px 14px' }}
              onClick={() => setTab('new')}>
              + New PO
            </button>
          )
        }
      />
      <ModuleTabs tabs={PO_TABS} activeTab={tab} onChange={t => { setTab(t); if (t === 'all') setRefreshKey(k => k + 1) }} />
      <StatsStrip stats={[
        { value: stats.total,   label: 'POs' },
        { value: stats.value,   label: 'Total Value', color: 'var(--success)' },
        { value: stats.pending, label: 'Pending', color: stats.pending > 0 ? 'var(--accent)' : undefined },
      ]} />
      <div className="erp-content">
        {tab === 'all' && <AllPOsTab key={refreshKey} />}
        {tab === 'new' && <NewPOTab onCreated={() => { setTab('all'); setRefreshKey(k => k + 1) }} />}
      </div>
    </ERPLayout>
  )
}
```

Note: Read the existing code to find what tab IDs and sub-component names are used (`AllPOsTab`, `NewPOTab`) and match them exactly.

- [ ] **Step 4: Verify in browser**

Open http://localhost:5173/purchase-orders. Expected: ERP chrome visible, PO creation still works.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/PurchaseOrders.jsx
git commit -m "feat: migrate PurchaseOrders page to ERP chrome"
```

---

## Task 9: Migrate Customers page

**Files:**
- Modify: `client/src/pages/Customers.jsx`

- [ ] **Step 1: Add imports, remove Sidebar import**

```jsx
import ERPLayout from '../components/ERPLayout'
import ModuleHeader from '../components/ModuleHeader'
import ModuleTabs from '../components/ModuleTabs'
import StatsStrip from '../components/StatsStrip'
```
Remove: `import Sidebar from '../components/Sidebar'`

- [ ] **Step 2: Replace the root `Customers()` component**

Read lines 527–546 to confirm current structure, then replace:

```jsx
const CUST_TABS = [
  { id: 'view',   label: 'Customers' },
  { id: 'add',    label: 'Add Customer' },
  { id: 'upload', label: 'Mass Upload' },
]

export default function Customers() {
  const [tab, setTab] = useState('view')
  const [refreshKey, setRefreshKey] = useState(0)
  const [stats, setStats] = useState({ total: '—', withMeasurements: '—' })

  useEffect(() => {
    async function loadStats() {
      try {
        const [{ count: total }, { count: withM }] = await Promise.all([
          db.customers().from('kna1').select('*', { count: 'exact', head: true }),
          db.customers().from('customer_measurements').select('kunnr', { count: 'exact', head: true }),
        ])
        setStats({ total: total ?? 0, withMeasurements: withM ?? 0 })
      } catch { /* non-fatal */ }
    }
    loadStats()
  }, [refreshKey])

  function goToView() {
    setTab('view')
    setRefreshKey(k => k + 1)
  }

  return (
    <ERPLayout>
      <ModuleHeader
        moduleLabel="CUSTOMERS"
        breadcrumb={tab === 'view' ? 'All Customers' : tab === 'add' ? 'Add Customer' : 'Mass Upload'}
        action={
          tab !== 'add' && (
            <button className="btn btn-primary" style={{ fontSize: 12, padding: '6px 14px' }}
              onClick={() => setTab('add')}>
              + Add Customer
            </button>
          )
        }
      />
      <ModuleTabs tabs={CUST_TABS} activeTab={tab} onChange={t => { setTab(t); if (t === 'view') setRefreshKey(k => k + 1) }} />
      <StatsStrip stats={[
        { value: stats.total,            label: 'Customers' },
        { value: stats.withMeasurements, label: 'With Measurements' },
      ]} />
      <div className="erp-content">
        {tab === 'add'    && <AddTab onAdded={goToView} />}
        {tab === 'view'   && <ViewTab key={refreshKey} />}
        {tab === 'upload' && <UploadTab />}
      </div>
    </ERPLayout>
  )
}
```

- [ ] **Step 3: Verify in browser**

Open http://localhost:5173/customers. Expected: ERP chrome visible, customer list and add form still work.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/Customers.jsx
git commit -m "feat: migrate Customers page to ERP chrome"
```

---

## Task 10: Migrate Buyers page

**Files:**
- Modify: `client/src/pages/Buyers.jsx`

- [ ] **Step 1: Add imports, remove Sidebar import**

```jsx
import ERPLayout from '../components/ERPLayout'
import ModuleHeader from '../components/ModuleHeader'
import ModuleTabs from '../components/ModuleTabs'
import StatsStrip from '../components/StatsStrip'
```
Remove: `import Sidebar from '../components/Sidebar'`

- [ ] **Step 2: Replace root `Buyers()` component (lines 397–410)**

```jsx
const BUYER_TABS = [
  { id: 'view', label: 'Buyers' },
  { id: 'add',  label: 'Add Buyer' },
]

export default function Buyers() {
  const [tab, setTab] = useState('view')
  const [refreshKey, setRefreshKey] = useState(0)
  const [stats, setStats] = useState({ total: '—' })

  useEffect(() => {
    async function loadStats() {
      try {
        const { count } = await db.buyers().from('buyers').select('*', { count: 'exact', head: true })
        setStats({ total: count ?? 0 })
      } catch { /* non-fatal */ }
    }
    loadStats()
  }, [refreshKey])

  return (
    <ERPLayout>
      <ModuleHeader
        moduleLabel="BUYERS"
        breadcrumb={tab === 'view' ? 'All Buyers' : 'Add Buyer'}
        action={
          tab !== 'add' && (
            <button className="btn btn-primary" style={{ fontSize: 12, padding: '6px 14px' }}
              onClick={() => setTab('add')}>
              + Add Buyer
            </button>
          )
        }
      />
      <ModuleTabs tabs={BUYER_TABS} activeTab={tab} onChange={t => { setTab(t); if (t === 'view') setRefreshKey(k => k + 1) }} />
      <StatsStrip stats={[
        { value: stats.total, label: 'Buyers' },
      ]} />
      <div className="erp-content">
        {tab === 'add'  && <AddTab onAdded={() => { setTab('view'); setRefreshKey(k => k + 1) }} />}
        {tab === 'view' && <ViewTab key={refreshKey} />}
      </div>
    </ERPLayout>
  )
}
```

- [ ] **Step 3: Verify + Commit**

```bash
cd client && npm run dev
# Open http://localhost:5173/buyers — verify ERP chrome visible
git add client/src/pages/Buyers.jsx
git commit -m "feat: migrate Buyers page to ERP chrome"
```

---

## Task 11: Migrate HR page

**Files:**
- Modify: `client/src/pages/HR.jsx`

- [ ] **Step 1: Add imports, remove Sidebar import**

```jsx
import ERPLayout from '../components/ERPLayout'
import ModuleHeader from '../components/ModuleHeader'
import ModuleTabs from '../components/ModuleTabs'
import StatsStrip from '../components/StatsStrip'
```
Remove: `import Sidebar from '../components/Sidebar'`

- [ ] **Step 2: Replace root `HR()` component (lines 988–1006)**

```jsx
const HR_TABS = [
  { id: 'view',       label: 'Employees' },
  { id: 'payroll',    label: 'Payroll' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'config',     label: 'Config' },
  { id: 'add',        label: 'Add Employee' },
]
const HR_TAB_LABELS = {
  view: 'Employees', payroll: 'Payroll', attendance: 'Attendance',
  config: 'Config', add: 'Add Employee',
}

export default function HR() {
  const [tab, setTab] = useState('view')
  const [refreshKey, setRefreshKey] = useState(0)
  const [stats, setStats] = useState({ employees: '—', present: '—' })

  useEffect(() => {
    async function loadStats() {
      try {
        const today = new Date().toISOString().split('T')[0]
        const [{ count: empCount }, { count: presentCount }] = await Promise.all([
          db.hr().from('employees').select('*', { count: 'exact', head: true }),
          db.hr().from('attendance').select('*', { count: 'exact', head: true })
            .eq('date', today).eq('status', 'present'),
        ])
        setStats({ employees: empCount ?? 0, present: presentCount ?? 0 })
      } catch { /* non-fatal */ }
    }
    loadStats()
  }, [refreshKey])

  return (
    <ERPLayout>
      <ModuleHeader
        moduleLabel="HR"
        breadcrumb={HR_TAB_LABELS[tab]}
        action={
          tab !== 'add' && (
            <button className="btn btn-primary" style={{ fontSize: 12, padding: '6px 14px' }}
              onClick={() => setTab('add')}>
              + Add Employee
            </button>
          )
        }
      />
      <ModuleTabs tabs={HR_TABS} activeTab={tab} onChange={t => { setTab(t); if (t === 'view') setRefreshKey(k => k + 1) }} />
      <StatsStrip stats={[
        { value: stats.employees, label: 'Employees' },
        { value: stats.present,   label: 'Present Today', color: 'var(--success)' },
      ]} />
      <div className="erp-content">
        {tab === 'add'        && <AddTab onAdded={() => { setTab('view'); setRefreshKey(k => k + 1) }} />}
        {tab === 'view'       && <ViewTab key={refreshKey} />}
        {tab === 'payroll'    && <PayrollTab />}
        {tab === 'attendance' && <AttendanceTab />}
        {tab === 'config'     && <ConfigTab />}
      </div>
    </ERPLayout>
  )
}
```

- [ ] **Step 3: Verify + Commit**

```bash
cd client && npm run dev
# Open http://localhost:5173/hr — verify ERP chrome and attendance stats
git add client/src/pages/HR.jsx
git commit -m "feat: migrate HR page to ERP chrome"
```

---

## Task 12: Migrate Analytics page

**Files:**
- Modify: `client/src/pages/Analytics.jsx`

Analytics has a custom dark topbar with its own tab buttons and year selector. Replace the entire topbar with `ERPLayout` + `ModuleHeader` + `ModuleTabs`. The year selector moves to the `StatsStrip` right slot.

- [ ] **Step 1: Read the Analytics root component area (lines 470–640)**

Read this range to confirm the structure of the `Analytics()` component, the `TABS` array, the `tab` state, year selector, and topbar before editing.

- [ ] **Step 2: Add imports, remove unused imports**

Add after the existing import block:
```jsx
import ERPLayout from '../components/ERPLayout'
import ModuleHeader from '../components/ModuleHeader'
import ModuleTabs from '../components/ModuleTabs'
import StatsStrip from '../components/StatsStrip'
```
Remove the `import { Link } from 'react-router-dom'` line if it was only used for the "← Home" link in the old topbar.

- [ ] **Step 3: Replace the Analytics() return topbar section**

In the `Analytics()` function return, find the entire outer wrapper including the dark topbar and the inner content div. Replace it with:

```jsx
  const ANA_TABS = [
    { id: 'overview',   label: 'Overview' },
    { id: 'sales',      label: 'Sales' },
    { id: 'purchasing', label: 'Purchasing' },
    { id: 'match',      label: '🎯 Product Match' },
  ]
  const ANA_TAB_LABELS = {
    overview: 'Overview', sales: 'Sales', purchasing: 'Purchasing', match: 'Product Match'
  }

  return (
    <div ref={containerRef} style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
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
            <button
              onClick={loadAll}
              className="btn btn-ghost"
              style={{ fontSize: 11, padding: '6px 14px', letterSpacing: 1 }}
            >
              ↺ Refresh
            </button>
          </div>
        </StatsStrip>
        <div className="erp-content">
          {/* Keep all existing tab content blocks unchanged below */}
          {loading && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>
          )}
          {!loading && (
            <>
              {/* paste all existing tab === 'overview' / 'sales' / 'purchasing' / 'match' blocks here */}
            </>
          )}
        </div>
      </ERPLayout>
    </div>
  )
```

Important: the `ref={containerRef}` must stay on an outer wrapper div so that the PDF/print logic (if any) still works. Keep all existing chart rendering blocks (`tab === 'overview'`, `tab === 'sales'`, etc.) inside `erp-content` unchanged.

- [ ] **Step 4: Verify in browser**

Open http://localhost:5173/analytics. Expected:
- ERP chrome at top ("ANALYTICS › Overview")
- Year selector and refresh in stats right slot
- All chart content unchanged below

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/Analytics.jsx
git commit -m "feat: migrate Analytics page to ERP chrome, replace custom topbar"
```

---

## Task 13: Migrate Groups page

**Files:**
- Modify: `client/src/pages/Groups.jsx`

- [ ] **Step 1: Add imports, remove Sidebar import**

```jsx
import ERPLayout from '../components/ERPLayout'
import ModuleHeader from '../components/ModuleHeader'
import ModuleTabs from '../components/ModuleTabs'
import StatsStrip from '../components/StatsStrip'
```
Remove: `import Sidebar from '../components/Sidebar'`

- [ ] **Step 2: Replace root `Groups()` component (lines 292–305)**

```jsx
const GROUP_TABS = [
  { id: 'view', label: 'Groups' },
  { id: 'new',  label: 'New Group' },
]

export default function Groups() {
  const [tab, setTab] = useState('view')
  const showToast = useToast()
  const [stats, setStats] = useState({ groups: '—', members: '—' })

  useEffect(() => {
    async function loadStats() {
      try {
        const [{ count: gCount }, { count: mCount }] = await Promise.all([
          db.groups().from('customer_groups').select('*', { count: 'exact', head: true }),
          db.groups().from('group_members').select('*', { count: 'exact', head: true }),
        ])
        setStats({ groups: gCount ?? 0, members: mCount ?? 0 })
      } catch { /* non-fatal */ }
    }
    loadStats()
  }, [tab]) // reload when returning to view

  return (
    <ERPLayout>
      <ModuleHeader
        moduleLabel="CUSTOMER GROUPS"
        breadcrumb={tab === 'view' ? 'All Groups' : 'New Group'}
        action={
          tab !== 'new' && (
            <button className="btn btn-primary" style={{ fontSize: 12, padding: '6px 14px' }}
              onClick={() => setTab('new')}>
              + New Group
            </button>
          )
        }
      />
      <ModuleTabs tabs={GROUP_TABS} activeTab={tab} onChange={setTab} />
      <StatsStrip stats={[
        { value: stats.groups,  label: 'Groups' },
        { value: stats.members, label: 'Total Members' },
      ]} />
      <div className="erp-content">
        {tab === 'view' && <ViewGroupsTab showToast={showToast} />}
        {tab === 'new'  && <NewGroupTab onCreated={() => setTab('view')} showToast={showToast} />}
      </div>
    </ERPLayout>
  )
}
```

- [ ] **Step 3: Final full-app verify**

```bash
cd client && npm run dev
```

Check every route:
- `/inventory` — INVENTORY chrome + stats + Products/Config/Add/Upload tabs
- `/sales` — SALES chrome + stats + All Orders/Returns/Pricing/New Order tabs
- `/purchase-orders` — PURCHASE ORDERS chrome + stats
- `/customers` — CUSTOMERS chrome + stats
- `/buyers` — BUYERS chrome + stats
- `/analytics` — ANALYTICS chrome + year selector in stats right slot
- `/hr` — HR chrome + employee/attendance stats
- `/groups` — CUSTOMER GROUPS chrome + stats

Resize browser to < 768 px (or use DevTools device emulation). Expected:
- Sidebar disappears
- Bottom tab bar appears (Stock / Sales / POs / CRM / More)
- Module label appears in compact top bar
- Inventory Products tab renders card list instead of data table

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/Groups.jsx
git commit -m "feat: migrate Groups page to ERP chrome — completes full ERP redesign"
```

---

## Self-Review Notes

**Spec coverage check:**
- ✅ A+C layout (ModuleHeader + Tabs + StatsStrip) — Tasks 3, 6–13
- ✅ Comfortable density (10px 16px row padding, 2-line cells) — Task 1 erp.css, Task 4 DataTable
- ✅ Fully Responsive (bottom nav, card list on mobile) — Tasks 1–2
- ✅ All 8 modules migrated — Tasks 6–13
- ✅ Sidebar SECTION_TABS removed — Task 5
- ✅ BottomNav items per role (admin vs sales) — Task 2
- ✅ StatusBadge for status values — Task 1

**Type consistency:**
- `ERPLayout` children prop — used identically in Tasks 6–13
- `ModuleTabs` receives `{ id, label }[]` — consistent across all pages
- `StatsStrip` receives `{ value, label, color? }[]` — consistent
- `DataTable` `gridCols` is a CSS template string — used in Task 6 only (other pages keep existing rendering)
- `useBreakpoint` returns `'mobile' | 'tablet' | 'desktop'` — used in ERPLayout and ModuleHeader

**Known limitation:** The sticky `erp-stats-strip` uses hard-coded `top: 87px` (45px header + 42px tabs). If a page uses a non-standard header height this will drift. Acceptable for now; all pages use the same components.
