# ImageKit Integration Design

## Goal

Replace base64 image storage in the `products` table with ImageKit-hosted URLs. New uploads go directly from the browser to ImageKit. Existing base64 images are migrated via a one-click admin tool in the Config page.

## Architecture

Direct browser-to-ImageKit upload using ImageKit's unsigned upload API — no server or signed token required. The browser uploads a file, receives a CDN URL, and saves that URL to Supabase. The existing `ImageCard` component in `ItemDetail.jsx` is refactored to use this flow.

**ImageKit account:** `https://ik.imagekit.io/urbantribe`  
**Folder structure:** `/products/sku_{sku_id}` — one folder per product SKU

**Prerequisite:** Unsigned uploads must be enabled in the ImageKit dashboard under *Settings → Upload restrictions → Allow unsigned uploads*.

## Files

| File | Action | Purpose |
|------|--------|---------|
| `client/src/lib/imagekit.js` | Create | Upload utility — wraps the ImageKit upload API |
| `client/src/pages/ItemDetail.jsx` | Modify | Refactor `ImageCard` to upload to ImageKit and save URL |
| `client/src/pages/Config.jsx` | Modify | Add "Migrate Photos to ImageKit" admin section |
| `client/.env` | Modify | Add `VITE_IMAGEKIT_PUBLIC_KEY` and `VITE_IMAGEKIT_URL_ENDPOINT` |
| DB migration SQL | New file | `ALTER TABLE inventory.products ADD COLUMN IF NOT EXISTS image_url text` |

## Database

### Schema change
```sql
ALTER TABLE inventory.products ADD COLUMN IF NOT EXISTS image_url text;
```

- `image_data text` — existing base64 column, kept during migration, nulled after each photo migrates
- `image_url text` — new column, stores the ImageKit CDN URL

After all images are migrated, `image_data` can be dropped in a future cleanup. No code breaks if it's left as null.

### Display logic (priority order)
1. If `image_url` is set → use ImageKit URL with transforms
2. If `image_data` is set (un-migrated) → use base64 as fallback
3. Neither → show empty state placeholder

## imagekit.js Utility

```js
// client/src/lib/imagekit.js
const UPLOAD_URL = 'https://upload.imagekit.io/api/v1/files/upload'
const PUBLIC_KEY = import.meta.env.VITE_IMAGEKIT_PUBLIC_KEY
const URL_ENDPOINT = import.meta.env.VITE_IMAGEKIT_URL_ENDPOINT  // https://ik.imagekit.io/urbantribe

export function ikUrl(path, transforms = 'w-500,q-auto') {
  if (!path) return null
  if (path.startsWith('data:')) return path          // base64 fallback
  if (path.startsWith('http')) return `${path}?tr=${transforms}`
  return `${URL_ENDPOINT}/${path}?tr=${transforms}`
}

export async function uploadToImageKit(base64DataUrl, fileName, folder = '/products') {
  const body = new FormData()
  body.append('file', base64DataUrl)
  body.append('fileName', fileName)
  body.append('folder', folder)
  body.append('publicKey', PUBLIC_KEY)

  const res = await fetch(UPLOAD_URL, { method: 'POST', body })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `ImageKit upload failed (${res.status})`)
  }
  const data = await res.json()
  return data.url   // e.g. https://ik.imagekit.io/urbantribe/products/sku_42.jpg
}
```

## ImageCard Refactor (ItemDetail.jsx)

### Props
`ImageCard({ skuId, initialImage, initialImageUrl })`
- `initialImage` — existing base64 (may be null after migration)
- `initialImageUrl` — new ImageKit URL (may be null for old records)

### State
- `imageUrl` — saved ImageKit URL (from `image_url` column)
- `imageData` — saved base64 fallback (from `image_data` column, for un-migrated records)
- `pending` — preview base64 before upload

### Upload flow
1. User selects file → canvas resizes to max 900px, JPEG 82% (unchanged)
2. `setPending(base64)` → shows preview with "Save Photo" / "Discard" buttons
3. On "Save Photo":
   a. Call `uploadToImageKit(pending, 'sku_${skuId}.jpg', '/products')`
   b. On success: `products.update({ image_url: url, image_data: null })`
   c. Set `imageUrl = url`, clear `imageData` and `pending`

### Remove flow
- `products.update({ image_url: null, image_data: null })`
- Clear both `imageUrl` and `imageData` state

### Display
```js
const display = pending || imageUrl || imageData
// <img src={pending ? pending : ikUrl(imageUrl || imageData)} />
```

## Migration (Config.jsx)

Admin-only section: **"Product Photos — Migrate to ImageKit"**

### UI states
- **Idle:** Shows count of un-migrated photos (`image_data IS NOT NULL AND image_url IS NULL`). Button: "Migrate N Photos →"
- **Running:** Progress bar + counter "Migrating 12 / 47…". Button disabled.
- **Done:** "✅ 47 photos migrated to ImageKit"
- **Error:** "❌ Failed on SKU 42: [message]" — stops migration, shows which SKU failed

### Migration algorithm
```
1. Query all products WHERE image_data IS NOT NULL AND image_url IS NULL
2. For each product (sequentially, not parallel — avoid rate limits):
   a. uploadToImageKit(product.image_data, `sku_${product.sku_id}.jpg`, '/products')
   b. products.update({ image_url: returnedUrl, image_data: null })
   c. Increment progress counter
3. On complete: refresh count → should be 0
```

Sequential uploads (one at a time) to stay well within ImageKit's free tier rate limits.

## Environment Variables

```
# client/.env
VITE_IMAGEKIT_PUBLIC_KEY=public_xxxxxxxxxxxx
VITE_IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/urbantribe
```

The public key is safe to expose in the frontend — it only allows uploads, not deletions or account changes.

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| Upload fails (network/rate limit) | Toast error, pending stays — user can retry |
| Migration item fails | Stop migration, show which SKU failed, already-migrated items keep their URLs |
| ImageKit URL broken | Falls back to `image_data` if still set, else shows placeholder |

## What Is Not In Scope

- Deleting old images from ImageKit when a product is deleted (no SDK needed, can be a future cleanup)
- Signed/authenticated uploads (unsigned is sufficient for this use case)
- Multiple images per SKU (single product photo only)
