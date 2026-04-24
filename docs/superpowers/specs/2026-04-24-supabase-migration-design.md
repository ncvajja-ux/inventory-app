# Supabase Migration Design

**Date:** 2026-04-24  
**Status:** Approved  
**Scope:** POC — single store, one Supabase project

---

## Goal

Replace the Express + SQLite backend with a direct Supabase connection from the React frontend. Ship the app as a static build (Vercel/Netlify) with no Node.js server.

---

## Architecture

```
Before:
  React → fetch('/api/...') → Express (server.js) → 7 × SQLite .db files

After:
  React → @supabase/supabase-js → Supabase PostgreSQL (7 schemas)
```

**What is removed:** `server.js` is not deployed. It stays in the repo for reference but is excluded from the static build.

**What is unchanged:** All 12 page components, React Router, Vite config, lock screen, dark mode, all visual features. Only the data-fetching layer inside each page changes.

---

## Supabase Project

- **Project ref:** `lmwdzkwruyjnjxrlbczk`
- **URL:** `https://lmwdzkwruyjnjxrlbczk.supabase.co`
- **Auth for POC:** Anon key + RLS disabled on all tables. The existing UI password lock screen remains as the only gate.
- **Schema:** Already defined in `supabase_schema.sql` (7 PostgreSQL schemas mirroring the 7 SQLite databases).

---

## New Files

### `client/src/lib/supabase.js`

Single Supabase client shared across the entire app. Schema-scoped helpers mirror the original SQLite database split:

```js
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export const db = {
  customers:    () => supabase.schema('customers'),
  inventory:    () => supabase.schema('inventory'),
  transactions: () => supabase.schema('transactions'),
  pricing:      () => supabase.schema('pricing'),
  buyers:       () => supabase.schema('buyers'),
  hr:           () => supabase.schema('hr'),
  groups:       () => supabase.schema('groups'),
}
```

### `client/.env`

```
VITE_SUPABASE_URL=https://lmwdzkwruyjnjxrlbczk.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key from Supabase dashboard → Settings → API>
```

`.env` is gitignored. Vercel env vars hold production values.

### `client/vercel.json`

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

Ensures React Router SPA routes work on direct URL access.

---

## Schema Mapping

Each SQLite database becomes a PostgreSQL schema in Supabase:

| SQLite DB | Supabase Schema | Tables |
|---|---|---|
| customers.db | `customers` | kna1, customer_measurements, customer_preferences |
| inventory.db | `inventory` | mara, brands, colors, fits, material_types, body_types, categories, category_l3 |
| transactions.db | `transactions` | vbak, vbap, return_reasons, po_header, po_items |
| pricing.db | `pricing` | gst_config, sales_price, customer_discount, product_discount |
| buyers.db | `buyers` | buyers |
| hr.db | `hr` | departments, designations, employees, salary_headers, salary_lines, attendance |
| groups.db | `groups` | customer_groups, group_members |

---

## Page Migration Map

Each page's `fetch('/api/...')` calls are replaced with Supabase queries:

| Page | Schemas used | Notes |
|---|---|---|
| Customers | `customers` | List, search, create, update |
| CustomerDetail | `customers`, `transactions`, `pricing` | Profile, orders, measurements, preferences |
| Inventory / ItemDetail | `inventory`, `pricing` | Product list, detail, image upload |
| Sales | `inventory`, `customers`, `transactions`, `pricing` | New order flow, cart, order history |
| Invoice | `transactions`, `customers`, `pricing` | Order detail, payment recording |
| Analytics | `transactions`, `inventory`, `customers` | Aggregations via `supabase.rpc()` |
| Groups | `groups`, `customers` | Group CRUD, member management |
| HR | `hr` | Employee, salary, attendance CRUD |
| Buyers / PurchaseOrders | `buyers`, `transactions`, `inventory` | Buyer and PO management |

---

## Error Handling

Supabase queries always return `{ data, error }`. The existing `showToast()` pattern is preserved:

```js
// Pattern used across all pages
const { data, error } = await db.customers().from('kna1').select('*')
if (error) { showToast(error.message, 'error'); return }
setCustomers(data)
```

No try/catch needed. No changes to toast UI or error display components.

---

## Complex Operations → PostgreSQL RPC

Operations that involve multi-table writes or complex aggregations are implemented as PostgreSQL functions called via `supabase.rpc()`:

| Operation | RPC Function | Description |
|---|---|---|
| Place order | `place_order(kunnr, items, customer_discount_pct, manual_discount)` | Writes to vbak + vbap, decrements inventory |
| Return order | `place_return(original_order_id, items, reason)` | Writes return vbak/vbap, restores inventory |
| Analytics: sales by month | `analytics_sales_by_month(year)` | Aggregates vbak + vbap |
| Analytics: top products | `analytics_top_products(limit)` | Aggregates vbap + mara |
| Analytics: returns by month | `analytics_returns_by_month(year)` | Filters order_type = 'R' |
| Analytics: product match | `analytics_product_match(matnr)` | Matches customers by preferences |
| Conflict check | `conflict_check(kunnr, matnr)` | Cross-schema groups + transactions query |
| Record payment | `record_payment(order_id, amount, mode)` | Updates paid_amount + payment_status |

All other operations (list, create, update, delete) use the Supabase JS query builder directly.

---

## Pre-Deploy Supabase Setup

Run once before deploying:

```sql
-- Disable RLS on all tables (POC only)
ALTER TABLE customers.kna1                  DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers.customer_measurements DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers.customer_preferences  DISABLE ROW LEVEL SECURITY;
ALTER TABLE buyers.buyers                   DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory.mara                  DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory.brands                DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory.colors                DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory.fits                  DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory.material_types        DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory.body_types            DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory.categories            DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory.category_l3           DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions.vbak               DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions.vbap               DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions.return_reasons     DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions.po_header          DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions.po_items           DISABLE ROW LEVEL SECURITY;
ALTER TABLE pricing.gst_config              DISABLE ROW LEVEL SECURITY;
ALTER TABLE pricing.sales_price             DISABLE ROW LEVEL SECURITY;
ALTER TABLE pricing.customer_discount       DISABLE ROW LEVEL SECURITY;
ALTER TABLE pricing.product_discount        DISABLE ROW LEVEL SECURITY;
ALTER TABLE hr.departments                  DISABLE ROW LEVEL SECURITY;
ALTER TABLE hr.designations                 DISABLE ROW LEVEL SECURITY;
ALTER TABLE hr.employees                    DISABLE ROW LEVEL SECURITY;
ALTER TABLE hr.salary_headers               DISABLE ROW LEVEL SECURITY;
ALTER TABLE hr.salary_lines                 DISABLE ROW LEVEL SECURITY;
ALTER TABLE hr.attendance                   DISABLE ROW LEVEL SECURITY;
ALTER TABLE groups.customer_groups          DISABLE ROW LEVEL SECURITY;
ALTER TABLE groups.group_members            DISABLE ROW LEVEL SECURITY;
```

---

## Deployment

```bash
cd client
npm run build          # output: dist/
vercel --prod          # deploy dist/ as static site
```

Environment variables set in Vercel dashboard:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

---

## Out of Scope (POC)

- Supabase Auth (email/password login per store)
- Row Level Security policies
- Multi-store / multi-tenant setup
- Real-time subscriptions
- File storage (images currently stored as base64 in DB — unchanged for POC)
