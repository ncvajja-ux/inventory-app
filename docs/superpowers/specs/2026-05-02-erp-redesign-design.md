# ERP Redesign Design Spec

## Goal

Give the entire app a consistent, professional ERP look-and-feel: structured page chrome (module header + breadcrumb + sub-tabs + stats strip), comfortable density, and full responsiveness down to mobile phones.

## Design Decisions (confirmed during brainstorm)

| Dimension | Choice | Rationale |
|-----------|--------|-----------|
| Layout pattern | **A+C** — Module Bar + Breadcrumb + Tabs + Stats Strip | Consistent chrome across every page; SAP/Salesforce feel |
| Density | **Comfortable** (Salesforce/Notion) | Readable without feeling crowded; 2-line cells where needed |
| Responsive | **Fully Responsive** — phone + tablet + desktop | Staff need phone access for floor lookups |

---

## Design System

### Colour Palette (existing tokens, unchanged)

```
--bg         #0f172a   page background
--surface    #1e293b   card / header surfaces
--border     #334155   dividers
--muted      #64748b   secondary text, labels
--text        #e2e8f0  primary text
--accent     #f59e0b   brand amber — active states, CTAs, module label
--success    #34d399   positive stock / paid badges
--danger     #f87171   zero stock / overdue
--info       #60a5fa   neutral / info badges
```

Font stack: `system-ui, -apple-system, sans-serif` (body); `ui-monospace, monospace` (codes/IDs).

### Spacing Scale

```
2px  4px  6px  8px  12px  16px  20px  24px  32px
```

Comfortable table rows: `padding: 10px 16px`.
Stats strip KPI: `padding: 8px 16px`.
Module header: `padding: 12px 16px`.

---

## Layout Shell (all pages)

### Desktop ≥ 1024 px

```
┌──────────┬──────────────────────────────────────────┐
│  Sidebar │  MODULE HEADER (sticky)                  │
│  56px    │  MODULE HEADER › Page (breadcrumb)        │
│  icon +  ├──────────────────────────────────────────┤
│  label   │  Tab bar  [Tab A] [Tab B] [Tab C]         │
│  column  ├──────────────────────────────────────────┤
│          │  Stats strip  48 SKUS  ₹4.8L  3 PENDING  │
│          ├──────────────────────────────────────────┤
│          │  Content area (scrollable)               │
└──────────┴──────────────────────────────────────────┘
```

- Sidebar: 56 px wide, icons + truncated labels, collapsible to 44 px icon-only.
- Module header: sticky top, amber module name + muted breadcrumb, optional `+ NEW` CTA aligned right.
- Tab bar: underline-style active tab in amber; inactive tabs muted.
- Stats strip: horizontal flex of KPI chips; search box right-aligned on same row if ≤ 3 KPIs.
- Content area: fills remaining viewport height, scrolls independently.

### Tablet 768–1023 px

Same structure. Sidebar stays visible (icon-only, 44 px). Stats strip KPIs wrap if needed. Table rows remain; no card transformation.

### Mobile < 768 px

```
┌─────────────────────────────┐
│  [Logo]  SALES › Orders  [+]│   ← compact top bar
├─────────────────────────────┤
│  [Orders] [Returns] [Pricing]│  ← tab bar (horizontal scroll)
├─────────────────────────────┤
│  142 ORDERS  ₹4.8L  8 PEND  │  ← stats (horizontal scroll)
├─────────────────────────────┤
│  Card list (full-width)     │
│  ┌─────────────────────────┐│
│  │ SO-001234               ││
│  │ Rajesh Kumar · Today    ││
│  │ ₹4,200  [PAID]          ││
│  └─────────────────────────┘│
└─────────────────────────────┘
│  [📦Stock][🧾Sales][📦POs][👤CRM][⋯More]│  ← bottom nav
```

- No sidebar. Module nav moves to bottom tab bar (5 items max; "More ⋯" for overflow).
- Top bar: logo left, `MODULE › Page` centre, primary action button right.
- Tables become card lists. Each card shows the 3–4 most important fields.
- Tabs and stats strip scroll horizontally (no wrapping).

---

## Component Inventory

### `ERPLayout` (wrapper)

Renders the full shell: sidebar (desktop/tablet) or bottom-nav (mobile), and a `<main>` slot.

Props: `module` (string shown in sidebar as active), `children`.

### `ModuleHeader`

Sticky header bar with:
- `moduleLabel` — CAPS amber text (e.g. `INVENTORY`)
- `breadcrumb` — muted secondary label (e.g. `Products`)  
- `action` — optional React node rendered right-aligned (e.g. `<button>+ New</button>`)

On mobile: renders as compact top bar; module label + breadcrumb combined, action button right.

### `ModuleTabs`

Horizontal tab bar below the module header.

Props: `tabs` (array of `{ id, label }`), `activeTab`, `onChange`.

Renders as underline tabs (amber bottom border on active). On mobile, scrolls horizontally with `-webkit-overflow-scrolling: touch`.

### `StatsStrip`

KPI row below the tabs.

Props: `stats` (array of `{ value, label, color? }`), `children` (optional right-side slot, e.g. search box).

Each KPI: large value in accent/success/danger, small muted uppercase label below. On mobile: horizontal scroll.

### `DataTable`

Comfortable table for desktop/tablet.

Props: `columns` (array of `{ key, label, align?, render? }`), `rows`, `onRowClick?`.

- Column headers: uppercase, muted, 10px, 0.08em letter-spacing.
- Rows: alternating `--surface` / transparent background, 10px 16px padding.
- Supports 2-line cells via `render` prop returning JSX.
- On mobile (< 768 px): hidden; callers render `CardList` instead.

### `CardList`

Mobile list of record cards.

Props: `items`, `renderCard` (function → JSX), `onCardClick?`.

### `StatusBadge`

Pill badge.

Props: `status` (string key), `label` (display text).

Colour map: `paid/confirmed/active → success`, `pending/draft → info`, `overdue/out_of_stock/cancelled → danger`.

### `Sidebar` (updated)

Existing `Sidebar.jsx` refactored:
- Remove per-section `SECTION_TABS` (tabs move to page-level `ModuleTabs`).
- Keep module navigation links (icon + label).
- Collapsible to icon-only at 44 px.
- Hide entirely below 768 px (bottom nav takes over).

### `BottomNav` (new)

Mobile-only bottom tab bar.

Props: `items` (array of `{ label, icon, href, badge? }`), `active` (current path).

Fixed bottom, 5 items max, overflow goes in a "More ⋯" sheet.

**Default bottom nav items (admin role):**

| Icon | Label | href |
|------|-------|------|
| 🏷️ | Stock | /inventory |
| 🧾 | Sales | /sales |
| 📦 | POs | /purchase-orders |
| 👤 | CRM | /customers |
| ⋯ | More | (opens sheet with HR, Buyers, Analytics, Groups) |

**Sales role** (no Buyers/POs/HR): show Stock, Sales, CRM, Groups, Analytics directly.

---

## Module Definitions

Each module lists its tabs and stats strip KPIs.

### Inventory

| Tab | Content |
|-----|---------|
| Products | SKU list with variant counts |
| Config | Brands, Categories, Colors, Fits, Body Types |
| Add Product | New SKU form |
| Mass Upload | CSV import |

Stats: `{n} SKUs` · `{n} Variants` · `{n} Out of Stock`

### Sales

| Tab | Content |
|-----|---------|
| Orders | Sales order list |
| Returns | Return/credit memo list |
| Pricing | Sales price table + customer discounts |
| New Order | Order creation wizard |

Stats: `{n} Orders` · `₹{x} Revenue` · `{n} Pending` · `{n} This Month`

### Purchase Orders

| Tab | Content |
|-----|---------|
| All POs | PO list |
| New PO | PO creation form |

Stats: `{n} POs` · `₹{x} Value` · `{n} Pending`

### Customers

| Tab | Content |
|-----|---------|
| Customers | Customer list (search/filter) |
| Add Customer | New customer form |
| Mass Upload | CSV import |

Stats: `{n} Customers` · `{n} Active` · `{n} With Measurements`

### Buyers

| Tab | Content |
|-----|---------|
| Buyers | Buyer list |
| Add Buyer | New buyer form |

Stats: `{n} Buyers`

### HR

| Tab | Content |
|-----|---------|
| Employees | Employee list |
| Payroll | Salary runs |
| Attendance | Daily attendance |
| Config | Departments / Designations |
| Add Employee | New employee form |

Stats: `{n} Employees` · `{n} Present Today` · `{n} On Leave`

### Analytics

No tabs. Stats strip shows summary KPIs. Full-width chart content.

### Customer Groups

| Tab | Content |
|-----|---------|
| Groups | Group list |
| New Group | Group creation form |

Stats: `{n} Groups` · `{n} Total Members`

---

## Responsive Breakpoints

```css
/* Mobile-first */
/* < 768px  → bottom nav, card lists */
/* ≥ 768px  → sidebar icon-only, tables */
/* ≥ 1024px → sidebar with labels, full tables */
```

CSS custom property: none needed. Use a single `useBreakpoint()` hook returning `'mobile' | 'tablet' | 'desktop'` based on `window.innerWidth`.

---

## Migration Strategy

Implement the ERP chrome as new shared components. Migrate pages **one module at a time**, starting with Inventory (most complex). Each page migration:

1. Replace page wrapper with `<ERPLayout module="...">`.
2. Add `<ModuleHeader>` at the top of the page's main content.
3. Move existing tab/section buttons into `<ModuleTabs>`.
4. Add `<StatsStrip>` with live counts (fetch at page load).
5. Replace table with `<DataTable>` (desktop) + `<CardList>` (mobile).
6. Remove corresponding section from `Sidebar.jsx` `SECTION_TABS`.

Migration order: Inventory → Sales → Purchase Orders → Customers → Buyers → HR → Analytics → Groups.

---

## Files to Create / Modify

**New files:**
- `client/src/components/ERPLayout.jsx` — shell with sidebar/bottom-nav logic
- `client/src/components/ModuleHeader.jsx` — sticky module header
- `client/src/components/ModuleTabs.jsx` — tab bar
- `client/src/components/StatsStrip.jsx` — KPI strip
- `client/src/components/DataTable.jsx` — comfortable table
- `client/src/components/CardList.jsx` — mobile card list
- `client/src/components/StatusBadge.jsx` — status pill
- `client/src/components/BottomNav.jsx` — mobile bottom nav
- `client/src/hooks/useBreakpoint.js` — responsive breakpoint hook
- `client/src/styles/erp.css` — ERP-specific CSS (shared layout tokens)

**Modified files:**
- `client/src/components/Sidebar.jsx` — remove SECTION_TABS, add hide-on-mobile
- `client/src/pages/Inventory.jsx` — first migration target
- `client/src/pages/Sales.jsx`
- `client/src/pages/PurchaseOrders.jsx`
- `client/src/pages/Customers.jsx`
- `client/src/pages/CustomerDetail.jsx` (minor — consistent header chrome)
- `client/src/pages/Buyers.jsx`
- `client/src/pages/HR.jsx`
- `client/src/pages/Analytics.jsx`
- `client/src/pages/Groups.jsx`
- `client/src/index.css` — ensure ERP token variables exist

---

## Out of Scope

- Schema changes (no new Supabase tables)
- Authentication / role system changes
- New business features (this is purely UI/UX)
- Dark/light theme toggle (keep existing)
- Analytics page charts (keep existing charts, just wrap with ERP chrome)
