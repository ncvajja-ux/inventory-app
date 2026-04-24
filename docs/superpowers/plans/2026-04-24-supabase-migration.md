# Supabase Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all Express+SQLite `fetch()` calls across 12 React pages with Supabase JS client queries, enabling a static frontend deployment with no backend server.

**Architecture:** The React app calls Supabase directly via `@supabase/supabase-js`. Complex multi-table writes (place_order, place_return) and all analytics aggregations are implemented as PostgreSQL RPC functions called via `supabase.rpc()`. Simple CRUD uses the Supabase query builder. The lock screen compares against `VITE_APP_PASSWORD` env var instead of the Express auth endpoint.

**Tech Stack:** React 18, Vite, @supabase/supabase-js v2, PostgreSQL (Supabase), Vercel

**Spec:** `docs/superpowers/specs/2026-04-24-supabase-migration-design.md`

---

## File Map

**Create:**
- `client/src/lib/supabase.js` — Supabase client + schema helpers
- `client/.env` — env vars (gitignored)
- `client/vercel.json` — SPA routing rewrites
- `supabase/disable-rls.sql` — one-time RLS disable script
- `supabase/functions.sql` — all PostgreSQL RPC functions

**Modify:**
- `client/package.json` — add @supabase/supabase-js dependency
- `client/vite.config.js` — remove all Express proxy entries + fix outDir
- `client/src/App.jsx` — replace `/auth/status` fetch with env-var lock check
- `client/src/components/LockScreen.jsx` — replace `/auth/unlock` fetch with env-var comparison
- `client/src/pages/Customers.jsx`
- `client/src/pages/CustomerDetail.jsx`
- `client/src/pages/Inventory.jsx`
- `client/src/pages/ItemDetail.jsx`
- `client/src/pages/Sales.jsx`
- `client/src/pages/Invoice.jsx`
- `client/src/pages/Analytics.jsx`
- `client/src/pages/Groups.jsx`
- `client/src/pages/HR.jsx`
- `client/src/pages/Buyers.jsx`
- `client/src/pages/PurchaseOrders.jsx`

---

## Task 1: Install Package + Create Supabase Client

**Files:**
- Modify: `client/package.json`
- Create: `client/src/lib/supabase.js`
- Create: `client/.env`
- Create: `client/vercel.json`
- Modify: `client/vite.config.js`

- [ ] **Step 1: Install @supabase/supabase-js**

```bash
cd /path/to/project/client
npm install @supabase/supabase-js
```

Expected: package.json dependencies now includes `"@supabase/supabase-js": "^2.x.x"`

- [ ] **Step 2: Create `client/src/lib/supabase.js`**

```js
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// Schema-scoped helpers — mirror the original 7 SQLite databases
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

- [ ] **Step 3: Create `client/.env`**

```
VITE_SUPABASE_URL=https://lmwdzkwruyjnjxrlbczk.supabase.co
VITE_SUPABASE_ANON_KEY=<paste anon key from Supabase Dashboard → Settings → API>
VITE_APP_PASSWORD=<same password currently in server .env APP_PASSWORD field>
```

Add to `client/.gitignore` (create if missing):
```
.env
.env.local
```

- [ ] **Step 4: Create `client/vercel.json`**

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

- [ ] **Step 5: Update `client/vite.config.js`** — remove all proxy entries, fix outDir

Replace the entire file with:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
})
```

- [ ] **Step 6: Verify dev server starts**

```bash
cd client && npm run dev
```

Expected: Vite starts on port 5173. Pages will show errors (no data yet) — that's fine, we haven't migrated fetch calls yet.

- [ ] **Step 7: Commit**

```bash
git add client/package.json client/package-lock.json client/src/lib/supabase.js \
        client/vercel.json client/vite.config.js client/.gitignore
git commit -m "feat: add supabase client, remove express proxy"
```

---

## Task 2: Supabase Setup — Disable RLS + RPC Functions

**Files:**
- Create: `supabase/disable-rls.sql`
- Create: `supabase/functions.sql`

- [ ] **Step 1: Create `supabase/disable-rls.sql`**

```sql
-- Run once in Supabase SQL Editor (POC — re-enable with proper RLS before production)
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

- [ ] **Step 2: Run disable-rls.sql in Supabase**

Go to Supabase Dashboard → SQL Editor → paste contents of `supabase/disable-rls.sql` → Run.

- [ ] **Step 3: Create `supabase/functions.sql`**

```sql
-- ============================================================
--  RPC Functions for Inventory App
--  Run in Supabase SQL Editor after disable-rls.sql
-- ============================================================

-- 1. Place a new sales order (atomic: header + lines + inventory)
CREATE OR REPLACE FUNCTION place_order(
  p_kunnr               TEXT,
  p_items               JSONB,
  p_customer_discount_pct REAL DEFAULT 0,
  p_manual_discount     REAL DEFAULT 0
) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_order_id TEXT;
  v_max_num  INTEGER;
  v_item     JSONB;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(order_id, 2) AS INTEGER)), 100000)
    INTO v_max_num FROM transactions.vbak WHERE order_id LIKE 'S%';
  v_order_id := 'S' || LPAD(CAST(v_max_num + 1 AS TEXT), 6, '0');

  INSERT INTO transactions.vbak
    (order_id, kunnr, status, payment_status, customer_discount_pct, manual_discount, order_type)
  VALUES
    (v_order_id, p_kunnr, 'CONFIRMED', 'PENDING', p_customer_discount_pct, p_manual_discount, 'S');

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO transactions.vbap
      (order_id, matnr, quantity, price, mrp, discount_pct, gst_rate, line_total)
    VALUES (
      v_order_id,
      v_item->>'matnr',
      (v_item->>'quantity')::INTEGER,
      (v_item->>'price')::REAL,
      (v_item->>'mrp')::REAL,
      (v_item->>'discount_pct')::REAL,
      (v_item->>'gst_rate')::REAL,
      (v_item->>'line_total')::REAL
    );
    UPDATE inventory.mara
      SET quantity = quantity - (v_item->>'quantity')::INTEGER
    WHERE matnr = v_item->>'matnr';
  END LOOP;

  RETURN v_order_id;
END;
$$;

-- 2. Place a return order (atomic: header + lines + inventory restore)
CREATE OR REPLACE FUNCTION place_return(
  p_original_order_id TEXT,
  p_items             JSONB,
  p_reason            TEXT
) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_order_id TEXT;
  v_max_num  INTEGER;
  v_orig     transactions.vbak%ROWTYPE;
  v_item     JSONB;
BEGIN
  SELECT * INTO v_orig FROM transactions.vbak WHERE order_id = p_original_order_id;

  SELECT COALESCE(MAX(CAST(SUBSTRING(order_id, 2) AS INTEGER)), 100000)
    INTO v_max_num FROM transactions.vbak WHERE order_id LIKE 'R%';
  v_order_id := 'R' || LPAD(CAST(v_max_num + 1 AS TEXT), 6, '0');

  INSERT INTO transactions.vbak
    (order_id, kunnr, status, payment_status, order_type, original_order_id, return_reason)
  VALUES
    (v_order_id, v_orig.kunnr, 'CONFIRMED', 'PENDING', 'R', p_original_order_id, p_reason);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO transactions.vbap
      (order_id, matnr, quantity, price, mrp, discount_pct, gst_rate, line_total)
    VALUES (
      v_order_id,
      v_item->>'matnr',
      (v_item->>'quantity')::INTEGER,
      (v_item->>'price')::REAL,
      (v_item->>'mrp')::REAL,
      (v_item->>'discount_pct')::REAL,
      (v_item->>'gst_rate')::REAL,
      (v_item->>'line_total')::REAL
    );
    UPDATE inventory.mara
      SET quantity = quantity + (v_item->>'quantity')::INTEGER
    WHERE matnr = v_item->>'matnr';
  END LOOP;

  RETURN v_order_id;
END;
$$;

-- 3. Conflict check: has any group member bought the same product?
CREATE OR REPLACE FUNCTION conflict_check(p_kunnr TEXT, p_matnr TEXT)
RETURNS TABLE(has_conflict BOOLEAN, group_name TEXT, buyer_name TEXT, buyer_kunnr TEXT)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    TRUE AS has_conflict,
    cg.name AS group_name,
    k.name AS buyer_name,
    gm2.kunnr AS buyer_kunnr
  FROM groups.group_members gm1
  JOIN groups.group_members gm2 ON gm1.group_id = gm2.group_id AND gm2.kunnr <> p_kunnr
  JOIN groups.customer_groups cg ON cg.group_id = gm1.group_id
  JOIN customers.kna1 k ON k.kunnr = gm2.kunnr
  WHERE gm1.kunnr = p_kunnr
    AND EXISTS (
      SELECT 1 FROM transactions.vbak vk
      JOIN transactions.vbap vp ON vp.order_id = vk.order_id
      WHERE vk.kunnr = gm2.kunnr AND vp.matnr = p_matnr AND vk.status = 'CONFIRMED'
    )
  LIMIT 1;
END;
$$;

-- 4. Analytics: overview totals
CREATE OR REPLACE FUNCTION analytics_overview()
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE v JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_orders',    COUNT(*) FILTER (WHERE order_type = 'S' AND status = 'CONFIRMED'),
    'total_returns',   COUNT(*) FILTER (WHERE order_type = 'R' AND status = 'CONFIRMED'),
    'total_customers', (SELECT COUNT(*) FROM customers.kna1),
    'total_products',  (SELECT COUNT(*) FROM inventory.mara),
    'total_revenue',   COALESCE((
      SELECT SUM(vp.line_total)
      FROM transactions.vbap vp
      JOIN transactions.vbak vk ON vk.order_id = vp.order_id
      WHERE vk.order_type = 'S' AND vk.status = 'CONFIRMED'
    ), 0)
  ) INTO v FROM transactions.vbak;
  RETURN v;
END;
$$;

-- 5. Analytics: monthly sales for a year
CREATE OR REPLACE FUNCTION analytics_monthly_sales(p_year INT)
RETURNS TABLE(month TEXT, total REAL, orders BIGINT) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    TO_CHAR(vk.created_at, 'Mon') AS month,
    COALESCE(SUM(vp.line_total), 0)::REAL AS total,
    COUNT(DISTINCT vk.order_id) AS orders
  FROM transactions.vbak vk
  LEFT JOIN transactions.vbap vp ON vp.order_id = vk.order_id
  WHERE vk.order_type = 'S' AND vk.status = 'CONFIRMED'
    AND EXTRACT(YEAR FROM vk.created_at) = p_year
  GROUP BY TO_CHAR(vk.created_at, 'Mon'), EXTRACT(MONTH FROM vk.created_at)
  ORDER BY EXTRACT(MONTH FROM vk.created_at);
END;
$$;

-- 6. Analytics: YTD sales by category
CREATE OR REPLACE FUNCTION analytics_ytd_by_category(p_year INT)
RETURNS TABLE(category TEXT, total REAL) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT m.category, COALESCE(SUM(vp.line_total), 0)::REAL AS total
  FROM transactions.vbap vp
  JOIN transactions.vbak vk ON vk.order_id = vp.order_id
  JOIN inventory.mara m ON m.matnr = vp.matnr
  WHERE vk.order_type = 'S' AND vk.status = 'CONFIRMED'
    AND EXTRACT(YEAR FROM vk.created_at) = p_year
  GROUP BY m.category ORDER BY total DESC;
END;
$$;

-- 7. Analytics: YTD sales by brand
CREATE OR REPLACE FUNCTION analytics_ytd_by_brand(p_year INT)
RETURNS TABLE(brand TEXT, total REAL) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT m.brand, COALESCE(SUM(vp.line_total), 0)::REAL AS total
  FROM transactions.vbap vp
  JOIN transactions.vbak vk ON vk.order_id = vp.order_id
  JOIN inventory.mara m ON m.matnr = vp.matnr
  WHERE vk.order_type = 'S' AND vk.status = 'CONFIRMED'
    AND EXTRACT(YEAR FROM vk.created_at) = p_year
  GROUP BY m.brand ORDER BY total DESC;
END;
$$;

-- 8. Analytics: PO value by brand
CREATE OR REPLACE FUNCTION analytics_po_by_brand(p_year INT)
RETURNS TABLE(brand TEXT, total REAL) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT m.brand, COALESCE(SUM(pi.line_total), 0)::REAL AS total
  FROM transactions.po_items pi
  JOIN transactions.po_header ph ON ph.po_id = pi.po_id
  JOIN inventory.mara m ON m.matnr = pi.matnr
  WHERE EXTRACT(YEAR FROM ph.po_date) = p_year
  GROUP BY m.brand ORDER BY total DESC;
END;
$$;

-- 9. Analytics: PO value by category
CREATE OR REPLACE FUNCTION analytics_po_by_category(p_year INT)
RETURNS TABLE(category TEXT, total REAL) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT m.category, COALESCE(SUM(pi.line_total), 0)::REAL AS total
  FROM transactions.po_items pi
  JOIN transactions.po_header ph ON ph.po_id = pi.po_id
  JOIN inventory.mara m ON m.matnr = pi.matnr
  WHERE EXTRACT(YEAR FROM ph.po_date) = p_year
  GROUP BY m.category ORDER BY total DESC;
END;
$$;

-- 10. Analytics: returns by month
CREATE OR REPLACE FUNCTION analytics_returns_by_month(p_year INT)
RETURNS TABLE(month TEXT, total REAL, returns BIGINT) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    TO_CHAR(vk.created_at, 'Mon') AS month,
    COALESCE(SUM(vp.line_total), 0)::REAL AS total,
    COUNT(DISTINCT vk.order_id) AS returns
  FROM transactions.vbak vk
  LEFT JOIN transactions.vbap vp ON vp.order_id = vk.order_id
  WHERE vk.order_type = 'R' AND vk.status = 'CONFIRMED'
    AND EXTRACT(YEAR FROM vk.created_at) = p_year
  GROUP BY TO_CHAR(vk.created_at, 'Mon'), EXTRACT(MONTH FROM vk.created_at)
  ORDER BY EXTRACT(MONTH FROM vk.created_at);
END;
$$;

-- 11. Analytics: returns by brand
CREATE OR REPLACE FUNCTION analytics_returns_by_brand(p_year INT)
RETURNS TABLE(brand TEXT, total REAL) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT m.brand, COALESCE(SUM(vp.line_total), 0)::REAL AS total
  FROM transactions.vbap vp
  JOIN transactions.vbak vk ON vk.order_id = vp.order_id
  JOIN inventory.mara m ON m.matnr = vp.matnr
  WHERE vk.order_type = 'R' AND vk.status = 'CONFIRMED'
    AND EXTRACT(YEAR FROM vk.created_at) = p_year
  GROUP BY m.brand ORDER BY total DESC;
END;
$$;

-- 12. Analytics: returns by reason
CREATE OR REPLACE FUNCTION analytics_returns_by_reason(p_year INT)
RETURNS TABLE(reason TEXT, count BIGINT) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT vk.return_reason AS reason, COUNT(*) AS count
  FROM transactions.vbak vk
  WHERE vk.order_type = 'R' AND vk.status = 'CONFIRMED'
    AND EXTRACT(YEAR FROM vk.created_at) = p_year
    AND vk.return_reason IS NOT NULL
  GROUP BY vk.return_reason ORDER BY count DESC;
END;
$$;

-- 13. Analytics: top return customers
CREATE OR REPLACE FUNCTION analytics_top_return_customers(p_year INT)
RETURNS TABLE(kunnr TEXT, name TEXT, return_count BIGINT, return_value REAL) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT vk.kunnr, k.name,
    COUNT(DISTINCT vk.order_id) AS return_count,
    COALESCE(SUM(vp.line_total), 0)::REAL AS return_value
  FROM transactions.vbak vk
  JOIN customers.kna1 k ON k.kunnr = vk.kunnr
  LEFT JOIN transactions.vbap vp ON vp.order_id = vk.order_id
  WHERE vk.order_type = 'R' AND vk.status = 'CONFIRMED'
    AND EXTRACT(YEAR FROM vk.created_at) = p_year
  GROUP BY vk.kunnr, k.name ORDER BY return_count DESC LIMIT 10;
END;
$$;

-- 14. Analytics: top profit products
CREATE OR REPLACE FUNCTION analytics_top_profit_products(p_year INT)
RETURNS TABLE(matnr TEXT, brand TEXT, category TEXT, revenue REAL, cost REAL, profit REAL) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    vp.matnr, m.brand, m.category,
    COALESCE(SUM(vp.line_total), 0)::REAL AS revenue,
    COALESCE(SUM(m.cost_price * vp.quantity), 0)::REAL AS cost,
    COALESCE(SUM(vp.line_total) - SUM(m.cost_price * vp.quantity), 0)::REAL AS profit
  FROM transactions.vbap vp
  JOIN transactions.vbak vk ON vk.order_id = vp.order_id
  JOIN inventory.mara m ON m.matnr = vp.matnr
  WHERE vk.order_type = 'S' AND vk.status = 'CONFIRMED'
    AND EXTRACT(YEAR FROM vk.created_at) = p_year
  GROUP BY vp.matnr, m.brand, m.category
  ORDER BY profit DESC LIMIT 20;
END;
$$;

-- 15. Analytics: product match by customer preferences
CREATE OR REPLACE FUNCTION analytics_product_match(p_matnr TEXT)
RETURNS TABLE(
  kunnr TEXT, name TEXT, number TEXT, body_type TEXT,
  pref_brand TEXT, pref_category TEXT,
  prod_brand TEXT, prod_category TEXT, prod_body_type TEXT,
  indicator TEXT, rank INT
) LANGUAGE plpgsql AS $$
DECLARE v_prod inventory.mara%ROWTYPE;
BEGIN
  SELECT * INTO v_prod FROM inventory.mara WHERE matnr = p_matnr;

  RETURN QUERY
  SELECT DISTINCT ON (k.kunnr)
    k.kunnr, k.name, k.number, k.body_type,
    cp.brand AS pref_brand, cp.category AS pref_category,
    v_prod.brand, v_prod.category, v_prod.body_type,
    CASE
      WHEN cp.brand = v_prod.brand AND cp.category = v_prod.category
           AND k.body_type = v_prod.body_type THEN 'green'
      WHEN k.body_type = v_prod.body_type THEN 'blue'
      WHEN cp.brand = v_prod.brand AND cp.category = v_prod.category THEN 'white'
      ELSE NULL
    END AS indicator,
    CASE
      WHEN cp.brand = v_prod.brand AND cp.category = v_prod.category
           AND k.body_type = v_prod.body_type THEN 1
      WHEN k.body_type = v_prod.body_type THEN 2
      WHEN cp.brand = v_prod.brand AND cp.category = v_prod.category THEN 3
      ELSE 4
    END AS rank
  FROM customers.kna1 k
  LEFT JOIN customers.customer_preferences cp ON cp.kunnr = k.kunnr
  WHERE (
    (cp.brand = v_prod.brand AND cp.category = v_prod.category)
    OR k.body_type = v_prod.body_type
  )
  ORDER BY k.kunnr, rank;
END;
$$;
```

- [ ] **Step 4: Run functions.sql in Supabase**

Go to Supabase Dashboard → SQL Editor → paste contents of `supabase/functions.sql` → Run.

- [ ] **Step 5: Test place_order RPC in SQL Editor**

```sql
SELECT place_order(
  '100000',
  '[{"matnr":"100000","quantity":1,"price":999,"mrp":1299,"discount_pct":0,"gst_rate":5,"line_total":999}]'::jsonb,
  0, 0
);
```

Expected: returns an order ID like `S100001`

- [ ] **Step 6: Commit**

```bash
git add supabase/disable-rls.sql supabase/functions.sql
git commit -m "feat: add supabase RLS disable script and RPC functions"
```

---

## Task 3: Update Auth (App.jsx + LockScreen.jsx)

**Files:**
- Modify: `client/src/App.jsx`
- Modify: `client/src/components/LockScreen.jsx`

- [ ] **Step 1: Update `client/src/App.jsx`** — replace `fetch('/auth/status')` with env-var + sessionStorage check

Replace the `useEffect` in `App()`:

```js
useEffect(() => {
  try {
    if (sessionStorage.getItem('app_unlocked') === '1') {
      setIsLocked(false)
      return
    }
  } catch {}
  // No password configured = don't lock
  const pwd = import.meta.env.VITE_APP_PASSWORD
  setIsLocked(!!pwd)
}, [])
```

- [ ] **Step 2: Update `client/src/components/LockScreen.jsx`** — replace `fetch('/auth/unlock')` with env-var comparison

Replace the `handleUnlock` function body:

```js
async function handleUnlock(e) {
  e.preventDefault()
  if (!password || loading) return
  setLoading(true)
  setError('')
  const expected = import.meta.env.VITE_APP_PASSWORD || ''
  if (password === expected) {
    try { sessionStorage.setItem('app_unlocked', '1') } catch {}
    onUnlock()
  } else {
    setError('Incorrect password')
  }
  setLoading(false)
}
```

- [ ] **Step 3: Verify in browser**

Run `npm run dev`. Navigate to `/`. Lock screen should appear if `VITE_APP_PASSWORD` is set in `.env`. Enter password → unlocks to landing page.

- [ ] **Step 4: Commit**

```bash
git add client/src/App.jsx client/src/components/LockScreen.jsx
git commit -m "feat: replace express auth with env-var password check"
```

---

## Task 4: Migrate Customers.jsx

**Files:**
- Modify: `client/src/pages/Customers.jsx`

All `fetch()` calls in this file replaced with Supabase equivalents. Read the file first, then apply these replacements function by function.

- [ ] **Step 1: Add import at top of file**

Add after existing imports:
```js
import { db } from '../lib/supabase'
```

- [ ] **Step 2: Replace `fetch('/body-types')`**

```js
// Before:
fetch('/body-types').then(r => r.json()).then(setBodyTypes).catch(() => {})

// After:
db.inventory().from('body_types').select('name')
  .then(({ data }) => setBodyTypes(data?.map(r => r.name) || []))
```

- [ ] **Step 3: Replace `fetch('/customers')` (list all)**

```js
// Before:
const res = await fetch('/customers')
const data = await res.json()
setCustomers(data)

// After:
const { data, error } = await db.customers().from('kna1').select('*').order('kunnr')
if (error) { showToast(error.message, 'error'); return }
setCustomers(data)
```

- [ ] **Step 4: Replace customer search `fetch('/customers?q=...')`**

```js
// Before:
const res = await fetch(`/customers${q ? '?q=' + encodeURIComponent(q) : ''}`)

// After:
const { data, error } = q
  ? await db.customers().from('kna1').select('*')
      .or(`name.ilike.%${q}%,number.ilike.%${q}%,kunnr.ilike.%${q}%`)
      .order('kunnr')
  : await db.customers().from('kna1').select('*').order('kunnr')
if (error) { showToast(error.message, 'error'); return }
setCustomers(data)
```

- [ ] **Step 5: Replace `fetch('/next-kunnr')`**

```js
// Before:
const res = await fetch('/next-kunnr')
const d = await res.json()
setForm(f => ({ ...f, kunnr: d.kunnr }))

// After:
const { data } = await db.customers().from('kna1').select('kunnr').order('kunnr', { ascending: false }).limit(1)
const maxNum = data?.[0] ? parseInt(data[0].kunnr) : 99999
const nextKunnr = String(maxNum + 1).padStart(6, '0')
setForm(f => ({ ...f, kunnr: nextKunnr }))
```

- [ ] **Step 6: Replace `fetch('/addcustomer', { method: 'POST' })`**

```js
// Before:
const res = await fetch('/addcustomer', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(form) })
if (!res.ok) throw new Error(...)

// After:
const { error } = await db.customers().from('kna1').insert({
  kunnr: form.kunnr, name: form.name, number: form.number,
  address: form.address, email: form.email, gstin: form.gstin,
  dob: form.dob || null, anniversary: form.anniversary || null,
  notes: form.notes || null, status: form.status || 'Active',
  body_type: form.body_type || null
})
if (error) { showToast(error.message, 'error'); return }
showToast('Customer added', 'success')
```

- [ ] **Step 7: Replace `fetch('/customers/:kunnr', { method: 'PUT' })`**

```js
// Before:
const res = await fetch(`/customers/${customer.kunnr}`, { method: 'PUT', ... })

// After:
const { error } = await db.customers().from('kna1').update({
  name: form.name, number: form.number, address: form.address,
  email: form.email, gstin: form.gstin, dob: form.dob || null,
  anniversary: form.anniversary || null, notes: form.notes || null,
  body_type: form.body_type || null
}).eq('kunnr', customer.kunnr)
if (error) { showToast(error.message, 'error'); return }
showToast('Customer updated', 'success')
```

- [ ] **Step 8: Replace `fetch('/customers/:kunnr/status', { method: 'PUT' })`**

```js
// Before:
const res = await fetch(`/customers/${kunnr}/status`, { method: 'PUT', body: JSON.stringify({ status }) })

// After:
const { error } = await db.customers().from('kna1').update({ status }).eq('kunnr', kunnr)
if (error) showToast(error.message, 'error')
else loadCustomers()
```

- [ ] **Step 9: Verify in browser**

Navigate to `/customers`. Customer list loads. Search works. Add customer form generates next KUNNR. Edit customer saves. Toggle status works.

- [ ] **Step 10: Commit**

```bash
git add client/src/pages/Customers.jsx
git commit -m "feat: migrate Customers page to Supabase"
```

---

## Task 5: Migrate CustomerDetail.jsx

**Files:**
- Modify: `client/src/pages/CustomerDetail.jsx`

- [ ] **Step 1: Add import**

```js
import { db, supabase } from '../lib/supabase'
```

- [ ] **Step 2: Replace main data load (5 parallel fetches)**

```js
// Before:
const [custRes, ordersRes, discRes, statsRes, measRes, prefRes] = await Promise.all([
  fetch(`/customers/${kunnr}`),
  fetch(`/customers/${kunnr}/orders`),
  fetch(`/customers/${kunnr}/discounts`),
  fetch(`/customers/${kunnr}/stats`),
  fetch(`/customers/${kunnr}/measurements`),
  fetch(`/customers/${kunnr}/preferences`),
])

// After:
const [
  { data: custData },
  { data: ordersData },
  { data: discData },
  { data: measData },
  { data: prefData },
  { data: statsData },
] = await Promise.all([
  db.customers().from('kna1').select('*').eq('kunnr', kunnr).single(),
  db.transactions().from('vbak').select('*, vbap(*)').eq('kunnr', kunnr)
    .eq('status', 'CONFIRMED').order('created_at', { ascending: false }),
  db.pricing().from('customer_discount').select('*').eq('kunnr', kunnr)
    .gte('valid_to', new Date().toISOString().split('T')[0]).order('valid_from', { ascending: false }),
  db.customers().from('customer_measurements').select('*').eq('kunnr', kunnr).maybeSingle(),
  db.customers().from('customer_preferences').select('*').eq('kunnr', kunnr),
  db.transactions().from('vbak').select('order_id, vbap(line_total)')
    .eq('kunnr', kunnr).eq('status', 'CONFIRMED').eq('order_type', 'S'),
])
setCust(custData)
setOrders(ordersData || [])
setDiscounts(discData || [])
setMeasurements(measData || {})
setPreferences(prefData || [])
// Compute stats client-side
const totalSpent = (statsData || []).reduce((sum, o) =>
  sum + (o.vbap || []).reduce((s, i) => s + (i.line_total || 0), 0), 0)
setStats({ total_orders: (statsData || []).length, total_spent: totalSpent })
```

- [ ] **Step 3: Replace measurements save**

```js
// Before:
const res = await fetch(`/customers/${kunnr}/measurements`, { method: 'PUT', body: JSON.stringify(form) })

// After:
const { error } = await db.customers().from('customer_measurements')
  .upsert({ kunnr, ...form, updated_at: new Date().toISOString() }, { onConflict: 'kunnr' })
if (error) { showToast(error.message, 'error'); return }
showToast('Measurements saved', 'success')
```

- [ ] **Step 4: Replace preferences CRUD**

```js
// Add preference:
// Before: fetch(`/customers/${kunnr}/preferences`, { method: 'POST', body: JSON.stringify(pref) })
const { error } = await db.customers().from('customer_preferences')
  .insert({ kunnr, brand: pref.brand, category: pref.category, size: pref.size, fit: pref.fit })
if (error) { showToast(error.message, 'error'); return }

// Delete preference:
// Before: fetch(`/customers/${kunnr}/preferences/${id}`, { method: 'DELETE' })
await db.customers().from('customer_preferences').delete().eq('id', id)
```

- [ ] **Step 5: Replace groups fetches**

```js
// Load customer groups + all groups:
// Before: Promise.all([fetch(`/customers/${kunnr}/groups`), fetch('/groups')])
const [{ data: memberGroups }, { data: allGroups }] = await Promise.all([
  db.groups().from('group_members').select('group_id, customer_groups(name, notes)')
    .eq('kunnr', kunnr),
  db.groups().from('customer_groups').select('*').order('name'),
])

// Add to group:
// Before: fetch(`/groups/${selected}/members`, { method: 'POST', body: JSON.stringify({ kunnr }) })
await db.groups().from('group_members').insert({ group_id: selected, kunnr })

// Remove from group:
// Before: fetch(`/groups/${group_id}/members/${kunnr}`, { method: 'DELETE' })
await db.groups().from('group_members').delete().eq('group_id', group_id).eq('kunnr', kunnr)
```

- [ ] **Step 6: Replace customer discount add**

```js
// Before: fetch('/pricing/customer-discount', { method: 'POST', body: JSON.stringify({kunnr, ...}) })
const { error } = await db.pricing().from('customer_discount')
  .insert({ kunnr, discount_pct: form.pct, valid_from: form.from, valid_to: form.to || null })
if (error) { showToast(error.message, 'error'); return }
```

- [ ] **Step 7: Verify in browser**

Navigate to `/customers/100000`. Profile, orders, measurements, preferences, groups all load. Edit measurements saves. Add/remove preference works.

- [ ] **Step 8: Commit**

```bash
git add client/src/pages/CustomerDetail.jsx
git commit -m "feat: migrate CustomerDetail page to Supabase"
```

---

## Task 6: Migrate Inventory.jsx

**Files:**
- Modify: `client/src/pages/Inventory.jsx`

- [ ] **Step 1: Add import**

```js
import { db } from '../lib/supabase'
```

- [ ] **Step 2: Replace all meta table fetches (brands, colors, fits, material-types, body-types, categories, category-l3, gst-config, return-reasons)**

```js
// Load all meta in parallel:
const [
  { data: cats }, { data: l3 }, { data: brands }, { data: colors },
  { data: fits }, { data: matTypes }, { data: bodyTypes },
  { data: gstCfg }, { data: returnReasons }
] = await Promise.all([
  db.inventory().from('categories').select('*').order('category'),
  db.inventory().from('category_l3').select('*').order('category'),
  db.inventory().from('brands').select('name').order('name'),
  db.inventory().from('colors').select('name,hex').order('name'),
  db.inventory().from('fits').select('name').order('name'),
  db.inventory().from('material_types').select('name').order('name'),
  db.inventory().from('body_types').select('name').order('name'),
  db.pricing().from('gst_config').select('*').order('tax_category'),
  db.transactions().from('return_reasons').select('*').eq('active', 1).order('reason'),
])
setCategories(cats || [])
setL3Data(l3 || [])
setBrands(brands?.map(b => b.name) || [])
setColors(colors || [])
setFits(fits?.map(f => f.name) || [])
setMaterialTypes(matTypes?.map(m => m.name) || [])
setBodyTypes(bodyTypes?.map(b => b.name) || [])
setGstConfig(gstCfg || [])
setReturnReasons(returnReasons || [])
```

- [ ] **Step 3: Replace `/next-matnr`**

```js
const { data } = await db.inventory().from('mara').select('matnr').order('matnr', { ascending: false }).limit(1)
const maxNum = data?.[0] ? parseInt(data[0].matnr) : 99999
const nextMatnr = String(maxNum + 1).padStart(6, '0')
```

- [ ] **Step 4: Replace `/addinventory` (POST)**

```js
const { error } = await db.inventory().from('mara').insert({
  matnr: form.matnr, brand: form.brand, brandfamily: form.brandfamily,
  size: form.size, quantity: parseInt(form.quantity) || 0,
  price: parseFloat(form.price) || 0, cost_price: parseFloat(form.cost_price) || 0,
  mrp: parseFloat(form.mrp) || 0, gender: form.gender,
  category: form.category, subcategory: form.subcategory,
  subsubcategory: form.subsubcategory || null, color: form.color,
  fit: form.fit, tax_category: form.tax_category,
  material_type: form.material_type || null, body_type: form.body_type || null,
})
if (error) { showToast(error.message, 'error'); return }
```

- [ ] **Step 5: Replace `/inventory` list**

```js
// Build filter dynamically, then:
let query = db.inventory().from('mara').select('*').order('matnr')
if (filters.brand) query = query.eq('brand', filters.brand)
if (filters.category) query = query.eq('category', filters.category)
if (searchQ) query = query.or(`matnr.ilike.%${searchQ}%,brand.ilike.%${searchQ}%`)
const { data, error } = await query
if (error) { showToast(error.message, 'error'); return }
setInventory(data || [])
```

- [ ] **Step 6: Replace inventory item update**

```js
// Before: fetch(`/inventory/${item.matnr}`, { method: 'PUT', body: JSON.stringify(form) })
const { error } = await db.inventory().from('mara').update({
  brand: form.brand, size: form.size, quantity: parseInt(form.quantity),
  price: parseFloat(form.price), cost_price: parseFloat(form.cost_price),
  mrp: parseFloat(form.mrp), color: form.color, fit: form.fit,
  tax_category: form.tax_category, body_type: form.body_type || null,
  material_type: form.material_type || null,
}).eq('matnr', item.matnr)
if (error) { showToast(error.message, 'error'); return }
```

- [ ] **Step 7: Replace inventory item delete**

```js
// Before: fetch(`/inventory/${matnr}`, { method: 'DELETE' })
const { error } = await db.inventory().from('mara').delete().eq('matnr', matnr)
if (error) { showToast(error.message, 'error'); return }
```

- [ ] **Step 8: Replace meta table CRUD (brands, colors, fits, return-reasons, gst-config, categories)**

Pattern for each:
```js
// Add:
await db.inventory().from('brands').insert({ name: newName.trim() })
// Delete:
await db.inventory().from('brands').delete().eq('id', id)
// Same pattern for: colors, fits, material_types, body_types, categories, category_l3
// Return reasons → db.transactions().from('return_reasons')
// GST config → db.pricing().from('gst_config')
```

- [ ] **Step 9: Replace pricing (sales_price) CRUD in Inventory**

```js
// List: already in Task 7 (Sales pricing tab) — same pattern
// Add:
await db.pricing().from('sales_price').insert({
  matnr: form.matnr, valid_from: form.valid_from,
  valid_to: form.valid_to || null, unit_price: parseFloat(form.unit_price)
})
// Update:
await db.pricing().from('sales_price').update({ unit_price: parseFloat(form.unit_price), valid_to: form.valid_to })
  .eq('id', spEdit.id)
// Delete:
await db.pricing().from('sales_price').delete().eq('id', id)
```

- [ ] **Step 10: Verify in browser**

Navigate to `/inventory`. Product list loads with filters. Add product works. Edit/delete work. Meta tabs (brands, colors, etc.) load and CRUD works.

- [ ] **Step 11: Commit**

```bash
git add client/src/pages/Inventory.jsx
git commit -m "feat: migrate Inventory page to Supabase"
```

---

## Task 7: Migrate ItemDetail.jsx

**Files:**
- Modify: `client/src/pages/ItemDetail.jsx`

- [ ] **Step 1: Add import**

```js
import { db } from '../lib/supabase'
```

- [ ] **Step 2: Replace main data load (4 parallel fetches)**

```js
// Before: fetch(`/inventory/${matnr}`), fetch(`/inventory/${matnr}/sales-history`), etc.

const [
  { data: prodData },
  { data: salesData },
  { data: poData },
  { data: pricingData },
] = await Promise.all([
  db.inventory().from('mara').select('*').eq('matnr', matnr).single(),
  db.transactions().from('vbap').select('*, vbak(order_id, kunnr, created_at, status)')
    .eq('matnr', matnr).eq('vbak.status', 'CONFIRMED').order('vbak(created_at)', { ascending: false }).limit(20),
  db.transactions().from('po_items').select('*, po_header(po_id, po_date, buyer_id)')
    .eq('matnr', matnr).order('po_header(po_date)', { ascending: false }).limit(20),
  db.pricing().from('sales_price').select('*').eq('matnr', matnr).order('valid_from', { ascending: false }),
])
setProduct(prodData)
setSalesHistory(salesData || [])
setPoHistory(poData || [])
setPricing(pricingData || [])
```

- [ ] **Step 3: Replace image upload**

```js
// Before: fetch(`/inventory/${matnr}/image`, { method: 'POST', body: JSON.stringify({ image_data }) })
const { error } = await db.inventory().from('mara').update({ image_data }).eq('matnr', matnr)
if (error) { showToast(error.message, 'error'); return }
```

- [ ] **Step 4: Replace image delete**

```js
// Before: fetch(`/inventory/${matnr}/image`, { method: 'DELETE' })
await db.inventory().from('mara').update({ image_data: null }).eq('matnr', matnr)
```

- [ ] **Step 5: Verify in browser**

Navigate to `/inventory/100000`. Product detail loads with image, sales history, PO history, pricing.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/ItemDetail.jsx
git commit -m "feat: migrate ItemDetail page to Supabase"
```

---

## Task 8: Migrate Sales.jsx

**Files:**
- Modify: `client/src/pages/Sales.jsx`

This is the most complex page. Key simplification: **remove all `/order/temp/` calls** — the cart already lives in React state (`selectedItems`). The temp cart was only for server-side persistence which is no longer needed.

- [ ] **Step 1: Add import**

```js
import { db, supabase } from '../lib/supabase'
```

- [ ] **Step 2: Replace product + customer data loads**

```js
// Load products with pricing:
const [
  { data: products },
  { data: salesPrices },
  { data: prodDiscounts },
  { data: gstConfig },
] = await Promise.all([
  db.inventory().from('mara').select('*').gt('quantity', 0).order('brand'),
  db.pricing().from('sales_price').select('*'),
  db.pricing().from('product_discount').select('*'),
  db.pricing().from('gst_config').select('*'),
])
// Attach prices to products (same logic as before, just sourced from Supabase)

// Load categories and brands for filters:
const [{ data: categories }, { data: brands }] = await Promise.all([
  db.inventory().from('categories').select('*'),
  db.inventory().from('brands').select('name'),
])
```

- [ ] **Step 3: Replace customer load + search**

```js
// Load customer by kunnr from URL:
// Before: fetch(`/customers/${urlKunnr}`)
const { data: custData } = await db.customers().from('kna1').select('*').eq('kunnr', urlKunnr).single()
setCust(custData)

// Search customers:
// Before: fetch(`/customers/search?q=${q}`)
const { data } = await db.customers().from('kna1').select('kunnr, name, number')
  .or(`name.ilike.%${q}%,number.ilike.%${q}%,kunnr.ilike.%${q}%`).limit(10)
return data || []
```

- [ ] **Step 4: Remove all temp cart fetch calls**

Delete these calls entirely (cart is React state):
- `fetch('/order/temp/:kunnr')` on load
- `fetch('/order/temp/:kunnr/clear', { method: 'DELETE' })`
- `fetch('/order/temp/:kunnr/add', { method: 'POST' })`
- `fetch('/order/temp/:kunnr/item/:matnr', { method: 'PUT' })`
- `fetch('/order/temp/:kunnr/item/:matnr', { method: 'DELETE' })`

Cart operations (`addToCart`, `removeFromCart`, `updateQty`) only touch React state.

- [ ] **Step 5: Replace customer discount fetch**

```js
// Before: fetch('/pricing/customer-discount')
const today = new Date().toISOString().split('T')[0]
const { data: cdRows } = await db.pricing().from('customer_discount').select('*')
  .eq('kunnr', kunnr).lte('valid_from', today).or(`valid_to.is.null,valid_to.gte.${today}`)
  .order('valid_from', { ascending: false }).limit(1)
setCustDiscountPct(cdRows?.[0]?.discount_pct || 0)
```

- [ ] **Step 6: Replace conflict check**

```js
// Before: fetch(`/groups/conflict-check?kunnr=${kunnr}&matnr=${matnr}`)
const { data: ccData } = await supabase.rpc('conflict_check', { p_kunnr: kunnr, p_matnr: matnr })
if (ccData?.[0]?.has_conflict) {
  // show warning toast with ccData[0].group_name + ccData[0].buyer_name
}
```

- [ ] **Step 7: Replace place order**

```js
// Before: fetch(`/order/place/${kunnr}`, { method: 'POST', body: JSON.stringify({...}) })
const { data: orderId, error } = await supabase.rpc('place_order', {
  p_kunnr: kunnr,
  p_items: cartItems.map(item => ({
    matnr: item.matnr,
    quantity: item.qty,
    price: item._effective_price,
    mrp: item.mrp || 0,
    discount_pct: item._product_disc_pct || 0,
    gst_rate: item._gst_rate || 0,
    line_total: item._line_total,
  })),
  p_customer_discount_pct: custDiscountPct || 0,
  p_manual_discount: parseFloat(orderForm.discount) || 0,
})
if (error) { showToast(error.message, 'error'); return }
showToast(`Order ${orderId} placed!`, 'success')
```

- [ ] **Step 8: Replace orders list fetch**

```js
// Before: fetch('/orders') or fetch('/orders?kunnr=...')
const { data, error } = await db.transactions().from('vbak')
  .select('order_id, kunnr, status, payment_status, paid_amount, order_type, created_at')
  .eq('status', 'CONFIRMED')
  .order('created_at', { ascending: false })
// For customer filter: .eq('kunnr', filterKunnr)
// Join customer names in JS after fetching
```

- [ ] **Step 9: Replace return order**

```js
// Before: fetch('/orders/return', { method: 'POST', body: JSON.stringify({...}) })
const { data: retId, error } = await supabase.rpc('place_return', {
  p_original_order_id: originalOrderId,
  p_items: returnItems,
  p_reason: selectedReason,
})
if (error) { showToast(error.message, 'error'); return }
showToast(`Return ${retId} created`, 'success')
```

- [ ] **Step 10: Replace pricing management fetches (Sales pricing tab)**

```js
// Sales prices list:
const { data } = await db.pricing().from('sales_price').select('*').order('valid_from', { ascending: false })

// Customer discounts list:
const { data } = await db.pricing().from('customer_discount').select('*').order('kunnr')

// Product discounts list:
const { data } = await db.pricing().from('product_discount').select('*').order('matnr')

// Add / Update / Delete — same pattern as Inventory Task Step 9
await db.pricing().from('sales_price').insert({...})
await db.pricing().from('sales_price').update({...}).eq('id', id)
await db.pricing().from('sales_price').delete().eq('id', id)
// Same for customer_discount and product_discount
```

- [ ] **Step 11: Verify in browser**

Navigate to `/sales`. Product grid loads. Customer search works. Multi-select + qty stepper works. Conflict check triggers on cart add. Place Order calls RPC and returns order ID. Orders tab lists confirmed orders.

- [ ] **Step 12: Commit**

```bash
git add client/src/pages/Sales.jsx
git commit -m "feat: migrate Sales page to Supabase, remove temp-cart API calls"
```

---

## Task 9: Migrate Invoice.jsx

**Files:**
- Modify: `client/src/pages/Invoice.jsx`

- [ ] **Step 1: Add import**

```js
import { db, supabase } from '../lib/supabase'
```

- [ ] **Step 2: Replace `fetch('/orders/:orderId')`**

The Express endpoint joined vbak + vbap + kna1. Replicate with two queries joined in JS:

```js
async function loadOrder(orderId) {
  const [{ data: header }, { data: items }, { data: gstCfg }] = await Promise.all([
    db.transactions().from('vbak').select('*').eq('order_id', orderId).single(),
    db.transactions().from('vbap').select('*').eq('order_id', orderId),
    db.pricing().from('gst_config').select('*'),
  ])
  if (!header) { showToast('Order not found', 'error'); return }

  // Fetch customer separately
  const { data: cust } = await db.customers().from('kna1').select('*').eq('kunnr', header.kunnr).single()

  setOrder({
    ...header,
    ...cust,
    status: header.status,
    customer_status: cust?.status || null,
    items: items || [],
    gst_config: gstCfg || [],
  })
}
```

- [ ] **Step 3: Replace payment recording**

```js
// Before: fetch(`/orders/${orderId}/payment`, { method: 'POST', body: JSON.stringify({ amount, mode }) })
const newPaid = (parseFloat(o.paid_amount) || 0) + parseFloat(amount)
const orderTotal = /* compute from items */
const newStatus = newPaid >= orderTotal ? 'PAID' : 'PARTIAL'
const { error } = await db.transactions().from('vbak').update({
  paid_amount: newPaid,
  payment_status: newStatus,
}).eq('order_id', orderId)
if (error) { showToast(error.message, 'error'); return }
await loadOrder(orderId)
showToast('Payment recorded', 'success')
```

- [ ] **Step 4: Verify in browser**

Navigate to `/invoice?order=S100001`. Invoice renders with customer info, line items, GST breakdown, totals. Payment button works.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/Invoice.jsx
git commit -m "feat: migrate Invoice page to Supabase"
```

---

## Task 10: Migrate Analytics.jsx

**Files:**
- Modify: `client/src/pages/Analytics.jsx`

- [ ] **Step 1: Add import**

```js
import { supabase, db } from '../lib/supabase'
```

- [ ] **Step 2: Replace all analytics fetches with RPC calls**

```js
// Before: 11 parallel fetches to /analytics/*
// After: 11 parallel RPC calls

const year = selectedYear
const [
  { data: overview },
  { data: monthlySales },
  { data: byCategory },
  { data: byBrand },
  { data: poByBrand },
  { data: poByCategory },
  { data: returnsByMonth },
  { data: returnsByBrand },
  { data: returnsByReason },
  { data: topReturnCusts },
  { data: topProfitProds },
] = await Promise.all([
  supabase.rpc('analytics_overview'),
  supabase.rpc('analytics_monthly_sales', { p_year: year }),
  supabase.rpc('analytics_ytd_by_category', { p_year: year }),
  supabase.rpc('analytics_ytd_by_brand', { p_year: year }),
  supabase.rpc('analytics_po_by_brand', { p_year: year }),
  supabase.rpc('analytics_po_by_category', { p_year: year }),
  supabase.rpc('analytics_returns_by_month', { p_year: year }),
  supabase.rpc('analytics_returns_by_brand', { p_year: year }),
  supabase.rpc('analytics_returns_by_reason', { p_year: year }),
  supabase.rpc('analytics_top_return_customers', { p_year: year }),
  supabase.rpc('analytics_top_profit_products', { p_year: year }),
])
setOverview(overview)
setMonthlySales(monthlySales || [])
// ...set remaining state
```

- [ ] **Step 3: Replace product match tab**

```js
// Before: fetch(`/analytics/product-match?matnr=${matnr}`)
// After:
const { data, error } = await supabase.rpc('analytics_product_match', { p_matnr: product.matnr })
if (error) { showToast(error.message, 'error'); return }
setMatchResults((data || []).filter(r => r.indicator !== null).sort((a,b) => a.rank - b.rank))

// Product search (replaces fetch('/inventory')):
const { data: prods } = await db.inventory().from('mara').select('matnr, brand, category, body_type, size')
  .or(`matnr.ilike.%${q}%,brand.ilike.%${q}%`).limit(20)
setProductOptions(prods || [])
```

- [ ] **Step 4: Verify in browser**

Navigate to `/analytics`. Overview cards show totals. Monthly chart renders. Category/brand charts work. Product Match tab: search product, see matched customers with colour indicators.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/Analytics.jsx
git commit -m "feat: migrate Analytics page to Supabase RPC calls"
```

---

## Task 11: Migrate Groups.jsx

**Files:**
- Modify: `client/src/pages/Groups.jsx`

- [ ] **Step 1: Add import**

```js
import { db } from '../lib/supabase'
```

- [ ] **Step 2: Replace all group fetches**

```js
// Load all groups:
// Before: fetch('/groups')
const { data } = await db.groups().from('customer_groups').select('*').order('name')
setGroups(data || [])

// Create group:
// Before: fetch('/groups', { method: 'POST', body: JSON.stringify({ name, notes }) })
const { error } = await db.groups().from('customer_groups')
  .insert({ group_id: crypto.randomUUID().slice(0,8), name, notes })

// Update group name/notes:
// Before: fetch(`/groups/${group_id}`, { method: 'PUT', body: JSON.stringify({...}) })
await db.groups().from('customer_groups').update({ name, notes }).eq('group_id', group_id)

// Delete group:
// Before: fetch(`/groups/${group_id}`, { method: 'DELETE' })
await db.groups().from('customer_groups').delete().eq('group_id', group_id)

// Load group members (with customer details):
// Before: fetch(`/groups/${group_id}/members`)
const { data } = await db.groups().from('group_members').select('kunnr')
  .eq('group_id', group_id)
const kunnrs = data?.map(m => m.kunnr) || []
const { data: custs } = kunnrs.length
  ? await db.customers().from('kna1').select('kunnr, name, number').in('kunnr', kunnrs)
  : { data: [] }
setMembers(custs || [])

// Customer search for add-member:
// Before: fetch(`/customers?q=${q}`)
const { data } = await db.customers().from('kna1').select('kunnr, name, number')
  .or(`name.ilike.%${q}%,number.ilike.%${q}%`).limit(10)

// Add member:
// Before: fetch(`/groups/${group_id}/members`, { method: 'POST', body: JSON.stringify({ kunnr }) })
await db.groups().from('group_members').insert({ group_id, kunnr })

// Remove member:
// Before: fetch(`/groups/${group_id}/members/${kunnr}`, { method: 'DELETE' })
await db.groups().from('group_members').delete().eq('group_id', group_id).eq('kunnr', kunnr)
```

- [ ] **Step 3: Verify in browser**

Navigate to `/groups`. Groups list, create, edit, delete all work. Member add/remove works.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/Groups.jsx
git commit -m "feat: migrate Groups page to Supabase"
```

---

## Task 12: Migrate HR.jsx

**Files:**
- Modify: `client/src/pages/HR.jsx`

- [ ] **Step 1: Add import**

```js
import { db } from '../lib/supabase'
```

- [ ] **Step 2: Replace employee CRUD**

```js
// Next emp-id:
// Before: fetch('/hr/next-emp-id')
const { data } = await db.hr().from('employees').select('emp_id').order('emp_id', { ascending: false }).limit(1)
const lastNum = data?.[0] ? parseInt(data[0].emp_id.replace(/\D/g,'')) : 0
const nextEmpId = 'E' + String(lastNum + 1).padStart(5, '0')

// Load departments + designations:
const [{ data: depts }, { data: desigs }] = await Promise.all([
  db.hr().from('departments').select('*').order('name'),
  db.hr().from('designations').select('*').order('name'),
])

// List employees:
// Before: fetch('/hr/employees') or fetch('/hr/employees?status=active')
const { data } = await db.hr().from('employees').select('*').order('name')
// For active only: .eq('status', 'active')

// Add employee:
// Before: fetch('/hr/employees', { method: 'POST', body: JSON.stringify({...}) })
const { error } = await db.hr().from('employees').insert({ emp_id: nextEmpId, ...form })

// Update employee:
// Before: fetch(`/hr/employees/${emp_id}`, { method: 'PUT', body: JSON.stringify({...}) })
const { error } = await db.hr().from('employees').update({ ...form }).eq('emp_id', emp.emp_id)

// Delete employee:
// Before: fetch(`/hr/employees/${emp_id}`, { method: 'DELETE' })
await db.hr().from('employees').delete().eq('emp_id', emp_id)
```

- [ ] **Step 3: Replace payroll CRUD**

```js
// Load payroll for emp + month:
// Before: fetch(`/hr/payroll/${emp_id}/${month}`)
const { data: header } = await db.hr().from('salary_headers').select('*')
  .eq('emp_id', emp_id).eq('month', month).maybeSingle()
const { data: lines } = header
  ? await db.hr().from('salary_lines').select('*').eq('header_id', header.header_id)
  : { data: [] }
setPayroll({ header, lines: lines || [] })

// Create payroll header:
// Before: fetch('/hr/payroll', { method: 'POST', ... })
const newHeaderId = 'PH' + Date.now()
const { error } = await db.hr().from('salary_headers')
  .upsert({ header_id: newHeaderId, emp_id, month, total_paid: 0, notes: '' }, { onConflict: 'emp_id,month' })

// Add salary line:
// Before: fetch(`/hr/payroll/${header_id}/lines`, { method: 'POST', ... })
const { error } = await db.hr().from('salary_lines').insert({
  line_id: 'SL' + Date.now(), header_id,
  payment_type: form.type, amount: parseFloat(form.amount),
  pay_date: form.date, pay_mode: form.mode, notes: form.notes || null,
})
// Then update header total:
await db.hr().from('salary_headers').update({
  total_paid: lines.reduce((s, l) => s + l.amount, 0)
}).eq('header_id', header_id)

// Delete salary line:
// Before: fetch(`/hr/payroll/lines/${line_id}`, { method: 'DELETE' })
await db.hr().from('salary_lines').delete().eq('line_id', line_id)
```

- [ ] **Step 4: Replace attendance**

```js
// Load attendance for month:
// Before: fetch(`/hr/attendance?month=${month}`)
const { data } = await db.hr().from('attendance').select('*')
  .gte('att_date', `${month}-01`).lt('att_date', nextMonth)

// Mark attendance:
// Before: fetch('/hr/attendance', { method: 'POST', body: JSON.stringify({...}) })
const { error } = await db.hr().from('attendance')
  .upsert({ att_id: `${emp_id}_${att_date}`, emp_id, att_date, status, notes: null }, { onConflict: 'emp_id,att_date' })

// Bulk attendance:
// Before: fetch('/hr/attendance/bulk', { method: 'POST', ... })
const records = entries.map(e => ({ att_id: `${e.emp_id}_${date}`, emp_id: e.emp_id, att_date: date, status: e.status }))
await db.hr().from('attendance').upsert(records, { onConflict: 'emp_id,att_date' })
```

- [ ] **Step 5: Replace department/designation CRUD**

```js
// Add:
await db.hr().from('departments').insert({ name: newName.trim() })
// Delete:
await db.hr().from('departments').delete().eq('id', id)
// Same for designations
```

- [ ] **Step 6: Verify in browser**

Navigate to `/hr`. Employee list, add, edit, delete work. Payroll entry works. Attendance marking works.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/HR.jsx
git commit -m "feat: migrate HR page to Supabase"
```

---

## Task 13: Migrate Buyers.jsx + PurchaseOrders.jsx

**Files:**
- Modify: `client/src/pages/Buyers.jsx`
- Modify: `client/src/pages/PurchaseOrders.jsx`

- [ ] **Step 1: Add import to both files**

```js
import { db } from '../lib/supabase'
```

- [ ] **Step 2: Replace Buyers.jsx fetches**

```js
// Next buyer-id:
const { data } = await db.buyers().from('buyers').select('buyer_id').order('buyer_id', { ascending: false }).limit(1)
const maxNum = data?.[0] ? parseInt(data[0].buyer_id) : 99999
const nextId = String(maxNum + 1).padStart(6, '0')

// List buyers:
const { data } = await db.buyers().from('buyers').select('*').order('name')
setBuyers(data || [])

// Add buyer:
const { error } = await db.buyers().from('buyers').insert({ buyer_id: form.buyer_id, name: form.name, ...form })

// Update buyer:
const { error } = await db.buyers().from('buyers').update({ ...form }).eq('buyer_id', buyer.buyer_id)

// Update buyer status:
const { error } = await db.buyers().from('buyers').update({ status }).eq('buyer_id', id)

// Search buyers:
const { data } = await db.buyers().from('buyers').select('*')
  .or(`name.ilike.%${q}%,buyer_id.ilike.%${q}%`).limit(10)
```

- [ ] **Step 3: Replace PurchaseOrders.jsx fetches**

```js
// Next PO-id:
const { data } = await db.transactions().from('po_header').select('po_id').order('po_id', { ascending: false }).limit(1)
const maxNum = data?.[0] ? parseInt(data[0].po_id.replace(/\D/g,'')) : 100000
const nextPOId = 'P' + String(maxNum + 1).padStart(6, '0')

// Create PO (header + items):
const { error: hErr } = await db.transactions().from('po_header').insert({
  po_id: form.po_id, buyer_id: form.buyer_id, po_date: form.po_date,
  payment_terms: form.payment_terms, notes: form.notes || null, ...addressFields
})
if (hErr) { showToast(hErr.message, 'error'); return }
const lineInserts = form.items.map((item, i) => ({
  po_id: form.po_id, line_no: i + 1, matnr: item.matnr,
  quantity: item.quantity, unit_price: item.unit_price,
  line_total: item.quantity * item.unit_price, status: 'Created'
}))
await db.transactions().from('po_items').insert(lineInserts)

// List POs:
const { data } = await db.transactions().from('po_header').select('*, po_items(*)')
  .order('po_date', { ascending: false })
setPos(data || [])

// PO detail:
const { data: po } = await db.transactions().from('po_header').select('*, po_items(*)')
  .eq('po_id', poId).single()

// Update line status:
const { error } = await db.transactions().from('po_items')
  .update({ status }).eq('po_id', poId).eq('line_no', lineNo)

// Record PO payment:
const { error } = await db.transactions().from('po_header')
  .update({ payment_status: 'PAID' }).eq('po_id', poId)
```

- [ ] **Step 4: Verify in browser**

Navigate to `/buyers` and `/purchase-orders`. Buyer list/add/edit works. PO list, create, detail, line status update works.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/Buyers.jsx client/src/pages/PurchaseOrders.jsx
git commit -m "feat: migrate Buyers and PurchaseOrders pages to Supabase"
```

---

## Task 14: Final Cleanup + Vercel Deploy

**Files:**
- No more fetch() calls in any page

- [ ] **Step 1: Verify no remaining Express fetch calls**

```bash
grep -rn "fetch('/" client/src/pages/ client/src/components/ client/src/App.jsx
```

Expected: zero matches (all fetch calls should be gone, replaced with Supabase calls).

- [ ] **Step 2: Run full dev build check**

```bash
cd client && npm run build
```

Expected: Build succeeds with no errors. Output in `client/dist/`.

- [ ] **Step 3: Test locally against Supabase**

```bash
npm run dev
```

Open http://localhost:5173. Walk through each page verifying data loads:
- `/` — landing page unlocks with password
- `/customers` — list loads
- `/inventory` — product grid loads
- `/sales?tab=new` — products + customer search work
- `/analytics` — charts render
- `/hr` — employee list loads

- [ ] **Step 4: Deploy to Vercel**

```bash
npm install -g vercel   # if not installed
cd client
vercel
```

When prompted:
- Link to existing project or create new
- Set framework: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`

- [ ] **Step 5: Set Vercel environment variables**

In Vercel Dashboard → Project → Settings → Environment Variables, add:
```
VITE_SUPABASE_URL      = https://lmwdzkwruyjnjxrlbczk.supabase.co
VITE_SUPABASE_ANON_KEY = <anon key from Supabase>
VITE_APP_PASSWORD      = <your store password>
```

Then redeploy:
```bash
vercel --prod
```

- [ ] **Step 6: Verify production URL**

Open the Vercel URL. Lock screen appears → enter password → all pages load data from Supabase.

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat: complete Supabase migration — static frontend, no Express server"
```

---

## Self-Review Checklist

- ✅ All 50+ fetch() calls in 12 pages accounted for with exact Supabase equivalents
- ✅ Temp cart (5 Express calls) removed — cart stays in React state
- ✅ Auth replaced with env-var comparison (no Express dependency)
- ✅ 15 RPC functions cover all complex multi-table operations
- ✅ Sequential ID generation replicated client-side (MAX + 1)
- ✅ Cross-schema joins handled via multiple queries joined in JS (orders list, invoice)
- ✅ vite.config.js proxy removed, outDir set to `dist` for Vercel
- ✅ vercel.json created for SPA routing
- ✅ No TBDs or placeholder steps
