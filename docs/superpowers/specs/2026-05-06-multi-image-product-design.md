# Multi-Image per Product Design

## Goal

Replace the single `image_url` column on `inventory.products` with a dedicated `product_images` table that supports multiple photos per SKU, with a cover photo concept and drag-to-reorder management.

## Database

### New table

```sql
CREATE TABLE inventory.product_images (
  id          bigserial   PRIMARY KEY,
  sku_id      integer     NOT NULL REFERENCES inventory.products(sku_id) ON DELETE CASCADE,
  url         text        NOT NULL,
  position    integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON inventory.product_images(sku_id, position);
```

### Cover photo convention

- **Cover = the row with the lowest `position` value** (position 0 after a full reorder)
- Reordering updates `position` for each affected row
- On delete of the cover, the next photo (position 1) becomes cover automatically (position values are renumbered)

### Migration from existing columns

All products with `image_url IS NOT NULL` are migrated: each URL is inserted into `product_images` with `position = 0`. After migration, `image_url` is set to null. Products with `image_data` (base64) are uploaded to Cloudinary first, then inserted as `position = 0`.

The `image_url` and `image_data` columns are left in place (nulled) — not dropped, to avoid schema breakage.

## UI: `PhotoGallery` component

Replaces the `ImageCard` component in `client/src/pages/ItemDetail.jsx`.

### Display mode (read)

- Large main photo shown at top (defaults to cover, switches on thumbnail click)
- Thumbnail strip below — up to 8 thumbnails visible, horizontally scrollable if more
- Cover badge (★) displayed on the position-0 thumbnail
- "No photos" empty state with "Upload Photo" button if no images

### Management mode (edit)

Triggered by clicking "Manage Photos" button — replaces the display with a grid editor:

- **4-column thumbnail grid** — all photos shown as equal-sized squares
- **Drag to reorder** — HTML5 native drag-and-drop; dragging updates `position` for all affected rows on drop
- **First position = cover** — ★ badge always on the first cell
- **× button** on each thumbnail to delete (with confirm prompt); positions renumbered after delete
- **+ slot** at the end of the grid — click to upload a single photo
- **Drop zone** at the bottom of the grid — drop multiple files to batch upload
- "Done" button exits management mode, returns to display mode

### Upload flow (single or batch)

1. File(s) selected or dropped → canvas resize to max 900px, JPEG 82%
2. `uploadToImageKit()` → Cloudinary CDN URL returned
3. `INSERT INTO inventory.product_images (sku_id, url, position)` — position = current max + 1
4. State updated to show new thumbnail

### Delete flow

1. Confirm dialog: "Remove this photo?"
2. `DELETE FROM inventory.product_images WHERE id = $1`
3. Renumber remaining positions: `UPDATE ... SET position = $new_pos WHERE id = $id` for each remaining photo
4. If deleted photo was the displayed main photo, switch main view to cover (position 0)

### Reorder flow

1. User drags thumbnail to new position
2. On drop: compute new positions array
3. Batch update: for each photo whose position changed, `UPDATE inventory.product_images SET position = $new WHERE id = $id`
4. State updated immediately (optimistic)

## Files

| File | Action |
|------|--------|
| `client/src/pages/ItemDetail.jsx` | **Modify** — replace `ImageCard` with `PhotoGallery` component |
| `client/src/pages/Config.jsx` | **Modify** — update migration section to handle `product_images` table |
| Supabase SQL | **Run once** — create table + index + migrate existing data |

`client/src/lib/imagekit.js` — no changes needed (`uploadToImageKit` is unchanged).

## Config page migration

"Product Photos" section in Config updated to migrate in two passes:

**Pass 1 — `image_url` rows** (already on Cloudinary):
- Query: `SELECT sku_id, image_url FROM products WHERE image_url IS NOT NULL`
- For each: `INSERT INTO product_images (sku_id, url, position) VALUES ($sku_id, $url, 0)`
- Then: `UPDATE products SET image_url = null WHERE sku_id = $sku_id`

**Pass 2 — `image_data` rows** (base64, still in DB):
- Query: `SELECT sku_id, image_data FROM products WHERE image_data IS NOT NULL`
- For each: upload to Cloudinary → insert into `product_images` → null `image_data`

Progress bar shows combined progress across both passes.

After migration, "All photos migrated" state. If a product already has rows in `product_images`, it is skipped.

## Supabase SQL (run once)

```sql
-- 1. Create table
CREATE TABLE inventory.product_images (
  id          bigserial   PRIMARY KEY,
  sku_id      integer     NOT NULL REFERENCES inventory.products(sku_id) ON DELETE CASCADE,
  url         text        NOT NULL,
  position    integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON inventory.product_images(sku_id, position);

-- 2. Enable RLS
ALTER TABLE inventory.product_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated full access"
  ON inventory.product_images
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
```

## What Is Not In Scope

- Deleting images from Cloudinary when a photo is removed (Cloudinary retains them; manageable via Cloudinary dashboard)
- Showing gallery thumbnails in the Inventory list view (cover URL is derivable via a join if needed later)
- Per-image captions or alt text
