# Product / SKU Redesign — Design Spec

**Date:** 2026-04-27  
**Status:** Approved

---

## Goal

Separate the concept of a "product" (SKU) from its size variants in both the database and the frontend. Currently every brand+category+color+fit+size combination is a flat `mara` row. After this change, a product (SKU) is a single entity; each size of that product is a separate `mara` row linked by `sku_id`.

---

## Definitions

| Term | Meaning |
|------|---------|
| **SKU** | A unique product style: brand + category + subcategory + subsubcategory + color + fit |
| **Variant / matnr** | One size of a SKU. `matnr` = unique 6-digit code, unchanged format |
| **Product** | Synonym for SKU in the UI |

---

## Database Schema

### New table: `inventory.products`

```sql
CREATE TABLE inventory.products (
  sku_id        SERIAL PRIMARY KEY,
  sku_code      TEXT UNIQUE NOT NULL,     -- e.g. "P100001"
  brand         TEXT,
  brandfamily   TEXT,
  gender        TEXT,
  category      TEXT,
  subcategory   TEXT,
  subsubcategory TEXT,
  color         TEXT,
  fit           TEXT,
  tax_category  TEXT,
  body_type     TEXT,
  material_type TEXT,
  mrp           REAL DEFAULT 0,
  cost_price    REAL DEFAULT 0,
  image_data    TEXT,
  param1        TEXT,
  param2        TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### Modified table: `inventory.mara`

Drop all product-attribute columns. Keep only variant-specific fields:

```sql
CREATE TABLE inventory.mara (
  matnr    TEXT PRIMARY KEY CHECK (length(matnr) = 6),
  sku_id   INTEGER NOT NULL REFERENCES inventory.products(sku_id),
  size     TEXT,
  quantity INTEGER DEFAULT 0,
  reserved INTEGER DEFAULT 0
);
```

### Unchanged tables

All transaction tables (`vbak`, `vbap`, `po_header`, `po_items`), pricing tables (`sales_price`, `gst_config`, `customer_discount`), and analytics functions reference `matnr` only — **no changes required**.

---

## Frontend Changes

### Inventory Page

**Product list view:**
- One row per SKU (not per matnr)
- Columns: Brand, Category, Subcategory, Color, Fit, Total Stock (sum of all size qtys)
- Expand row → size breakdown table: Size | Qty | Reserved | Available | Edit Qty button

**Add Product:**
- Single form: brand, brandfamily, gender, category, subcategory, subsubcategory, color, fit, mrp, cost_price, tax_category, body_type, material_type, image
- No sizes required at creation — product is created as a SKU with no variants
- After saving, sizes can be added from the product's expanded view

**Add Size (per product):**
- From expanded row: "+ Add Size" button
- Dropdown of available sizes from `category_l3` config
- Enter opening quantity
- Generates a new `matnr` (next sequential 6-digit) and inserts into `mara`

**Edit Product:**
- Edit any SKU attribute (brand, category, color, mrp, image, etc.)
- Manage sizes: add new size variant, update qty, delete size variant

### ItemDetail Page

Shows product (SKU) attributes at top + size variant table below.  
Image upload/delete applies to the product (stored in `inventory.products.image_data`).

### Sales Page — Add to Cart

1. Search products by brand / category / color (queries `inventory.products`)
2. Click product → size picker dropdown (only sizes where `mara.quantity > 0`)
3. Selecting size resolves to `matnr` → price fetched from `pricing.sales_price` by `matnr`
4. Line item added to cart with `matnr`, price, qty

### Purchase Orders Page

Same product search → size picker → `matnr` logic as Sales. No separate matnr search.

### Invoice Page

Line items enriched by joining `mara → products`:  
Shows brand · category · color · fit · **size** per line.

### Analytics Page

No UI changes. Backend joins `mara → products` for brand/category grouping. Existing RPC functions updated to join through `mara` to `products` for `brand` and `category` columns.

---

## Data Migration

Fresh start — existing `mara` data is dropped. No migration required.  
All SQL files will be re-run from scratch in Supabase after schema changes.

---

## Supabase SQL Delivery

Changes delivered as new/updated SQL files:
- `supabase/schema-v2.sql` — full schema including `products` table and slimmed `mara`
- `supabase/functions-1-core.sql` — updated (no changes to place_order / place_return logic since they use matnr)
- `supabase/functions-2-analytics.sql` — updated joins from `mara` → `products` for brand/category

---

## Pages Affected

| Page | Change level |
|------|-------------|
| Inventory.jsx | Major rewrite |
| ItemDetail.jsx | Moderate — show variants table |
| Sales.jsx | Moderate — product search + size picker |
| PurchaseOrders.jsx | Moderate — product search + size picker |
| Invoice.jsx | Minor — join path changes |
| Analytics.jsx | Minor — RPC function join updates |
| Customers.jsx | None |
| HR.jsx | None |
| Buyers.jsx | None |
| Groups.jsx | None |
