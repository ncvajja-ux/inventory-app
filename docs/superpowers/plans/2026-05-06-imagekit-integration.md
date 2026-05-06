# ImageKit Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace base64 image storage in `inventory.products` with ImageKit-hosted URLs, migrate existing photos, and add a one-click migration tool in Config.

**Architecture:** Browser uploads directly to ImageKit unsigned upload API, receives a CDN URL, saves it to `products.image_url`. `ImageCard` in `ItemDetail.jsx` gains a dual-source display (URL preferred, base64 fallback for un-migrated records). Config page gains a migration section that batch-uploads all remaining base64 photos.

**Tech Stack:** React 18, Vite, Supabase JS SDK, ImageKit Upload REST API (no SDK needed)

---

## File Map

| File | Action |
|------|--------|
| `client/src/lib/imagekit.js` | **Create** — upload utility + URL helper |
| `client/src/pages/ItemDetail.jsx` | **Modify** — refactor `ImageCard` (lines 21–97 + line 413) |
| `client/src/pages/Config.jsx` | **Modify** — add migration section (before closing `</ERPLayout>`) |
| `client/.env.example` | **Modify** — document new env vars |
| Supabase SQL | **Run once** — add `image_url` column |

---

## Task 1: Add `image_url` column to Supabase

**Files:**
- Run in Supabase SQL editor (Dashboard → SQL Editor)

- [ ] **Step 1: Run migration SQL**

Open your Supabase project → SQL Editor → New query, paste and run:

```sql
ALTER TABLE inventory.products
  ADD COLUMN IF NOT EXISTS image_url text;
```

Expected: "Success. No rows returned."

- [ ] **Step 2: Verify column exists**

Run:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'inventory'
  AND table_name = 'products'
  AND column_name = 'image_url';
```

Expected: one row — `image_url | text`

---

## Task 2: Environment variables

**Files:**
- Modify: `client/.env.example`
- Create/modify: `client/.env` (gitignored — manual step for user)

- [ ] **Step 1: Update `.env.example`**

Replace the contents of `client/.env.example` with:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key-from-supabase-dashboard>
VITE_IMAGEKIT_PUBLIC_KEY=public_xxxxxxxxxxxx
VITE_IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/urbantribe
```

- [ ] **Step 2: Add real values to `client/.env`**

Create `client/.env` (if it doesn't exist) or add these two lines to the existing file:

```
VITE_IMAGEKIT_PUBLIC_KEY=<your-real-public-key-from-imagekit-dashboard>
VITE_IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/urbantribe
```

The public key is found in your ImageKit dashboard → *Settings → Developer options → Public key*.

- [ ] **Step 3: Enable unsigned uploads in ImageKit dashboard**

Go to ImageKit dashboard → *Settings → Upload restrictions* → enable **"Allow unsigned uploads"**. Without this, all uploads will return a 401 error.

- [ ] **Step 4: Commit `.env.example`**

```bash
git add client/.env.example
git commit -m "chore: add ImageKit env vars to .env.example"
```

---

## Task 3: Create `imagekit.js` upload utility

**Files:**
- Create: `client/src/lib/imagekit.js`

- [ ] **Step 1: Create the file**

```js
// client/src/lib/imagekit.js
const UPLOAD_URL    = 'https://upload.imagekit.io/api/v1/files/upload'
const PUBLIC_KEY    = import.meta.env.VITE_IMAGEKIT_PUBLIC_KEY
const URL_ENDPOINT  = import.meta.env.VITE_IMAGEKIT_URL_ENDPOINT  // https://ik.imagekit.io/urbantribe

/**
 * Returns a display-ready src for an image.
 * - If value is already a base64 data URL → return as-is (un-migrated fallback)
 * - If value is an http URL → append ImageKit transform params
 * - If null/undefined → return null
 */
export function ikUrl(value, transforms = 'w-500,q-auto') {
  if (!value) return null
  if (value.startsWith('data:')) return value          // base64 passthrough
  return `${value}?tr=${transforms}`
}

/**
 * Upload a base64 data URL or File blob to ImageKit unsigned upload.
 * Returns the CDN URL string on success.
 * Throws on failure.
 */
export async function uploadToImageKit(fileOrBase64, fileName, folder = '/products') {
  const body = new FormData()
  body.append('file', fileOrBase64)
  body.append('fileName', fileName)
  body.append('folder', folder)
  body.append('publicKey', PUBLIC_KEY)

  const res = await fetch(UPLOAD_URL, { method: 'POST', body })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `ImageKit upload failed (HTTP ${res.status})`)
  }
  const data = await res.json()
  return data.url  // e.g. https://ik.imagekit.io/urbantribe/products/sku_42.jpg
}
```

- [ ] **Step 2: Verify Vite can see the file**

```bash
cd /Users/naveenvajja/inventory-app/client && node -e "console.log('ok')"
```

Expected: `ok` (just confirms node/npm is working; real verification happens in Task 4 when the build runs)

- [ ] **Step 3: Commit**

```bash
git add client/src/lib/imagekit.js
git commit -m "feat: add ImageKit upload utility"
```

---

## Task 4: Refactor `ImageCard` in `ItemDetail.jsx`

**Files:**
- Modify: `client/src/pages/ItemDetail.jsx` lines 1–97 and line 413

**Context:** `ImageCard` currently stores a canvas-resized JPEG as base64 in `products.image_data`. After this task it uploads to ImageKit and stores the URL in `products.image_url`, with `image_data` falling back for un-migrated records.

- [ ] **Step 1: Add the imagekit import at the top of `ItemDetail.jsx`**

Add to the imports block (after line 4 `import { db } from '../lib/supabase'`):

```js
import { ikUrl, uploadToImageKit } from '../lib/imagekit'
```

- [ ] **Step 2: Replace the entire `ImageCard` function (lines 21–97)**

Replace from `// ─── Image card (unchanged) ───` through the closing `}` of `ImageCard` with:

```js
// ─── Image card ───────────────────────────────────────────────────────────────
function ImageCard({ skuId, initialImageUrl, initialImageData }) {
  const showToast = useToast()
  const fileRef   = useRef(null)
  const [imageUrl,  setImageUrl]  = useState(initialImageUrl  || null)  // ImageKit URL
  const [imageData, setImageData] = useState(initialImageData || null)  // base64 fallback
  const [pending,   setPending]   = useState(null)   // base64 preview before upload
  const [saving,    setSaving]    = useState(false)

  function onFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return showToast('Select an image file', 'error')
    if (file.size > 20 * 1024 * 1024) return showToast('Image must be under 20 MB', 'error')
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const MAX = 900
      let { width, height } = img
      if (width > MAX)  { height = Math.round(height * MAX / width);  width  = MAX }
      if (height > MAX) { width  = Math.round(width  * MAX / height); height = MAX }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      setPending(canvas.toDataURL('image/jpeg', 0.82))
    }
    img.src = objectUrl
    e.target.value = ''
  }

  async function saveImage() {
    if (!pending) return
    setSaving(true)
    try {
      const url = await uploadToImageKit(pending, `sku_${skuId}.jpg`, '/products')
      const { error } = await db.inventory().from('products')
        .update({ image_url: url, image_data: null })
        .eq('sku_id', skuId)
      if (error) throw error
      setImageUrl(url); setImageData(null); setPending(null)
      showToast('✅ Photo saved')
    } catch (err) { showToast(`❌ ${err.message}`, 'error') }
    finally { setSaving(false) }
  }

  async function removeImage() {
    if (!window.confirm('Remove this photo?')) return
    try {
      const { error } = await db.inventory().from('products')
        .update({ image_url: null, image_data: null })
        .eq('sku_id', skuId)
      if (error) throw error
      setImageUrl(null); setImageData(null); setPending(null)
    } catch (err) { showToast(`❌ ${err.message}`, 'error') }
  }

  // Priority: preview > ImageKit URL > base64 fallback
  const display = pending ? pending : ikUrl(imageUrl || imageData)

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 12 }}>Product Photo</div>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFileChange} />
      {display ? (
        <div>
          <img src={display} alt="Product" style={{ maxWidth: 260, borderRadius: 10, display: 'block', marginBottom: 12 }} />
          {pending && <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>Preview — unsaved</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            {pending  && <button className="btn btn-primary" onClick={saveImage} disabled={saving} style={{ fontSize: 13 }}>{saving ? 'Uploading…' : 'Save Photo'}</button>}
            {pending  && <button className="btn btn-ghost"   onClick={() => setPending(null)} style={{ fontSize: 13 }}>Discard</button>}
            {!pending && <button className="btn btn-ghost"   onClick={() => fileRef.current?.click()} style={{ fontSize: 13 }}>Change Photo</button>}
            {!pending && <button onClick={removeImage} style={{ fontSize: 11, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>}
          </div>
        </div>
      ) : (
        <div>
          <div style={{ width: 200, height: 200, background: 'var(--bg)', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ fontSize: 36, opacity: 0.3 }}>👕</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>No photo</div>
          </div>
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()} style={{ fontSize: 12 }}>Upload Photo</button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Update the `ImageCard` usage (line ~413)**

Find this line:
```js
<ImageCard skuId={parseInt(skuId)} initialImage={product.image_data} />
```

Replace with:
```js
<ImageCard skuId={parseInt(skuId)} initialImageUrl={product.image_url} initialImageData={product.image_data} />
```

- [ ] **Step 4: Update the Supabase products query to select `image_url`**

Find the query that fetches product data (search for `.from('products')` with a `select` that includes `image_data`). It will look something like:

```js
.select('*, mara(*)')
```

or an explicit column list. If it uses `select('*')`, `image_url` is already included. If it has an explicit column list that includes `image_data`, add `image_url` to it.

Search for `image_data` in the select statements:
```bash
grep -n "image_data" /Users/naveenvajja/inventory-app/client/src/pages/ItemDetail.jsx
```

If the select uses `'*'` then nothing to change. If it's explicit, add `image_url` alongside `image_data`.

- [ ] **Step 5: Build and verify**

```bash
cd /Users/naveenvajja/inventory-app/client && npm run build 2>&1 | tail -15
```

Expected: `✓ built in ...ms` with no errors. Fix any TypeScript/import errors before continuing.

- [ ] **Step 6: Manual smoke test**

```bash
cd /Users/naveenvajja/inventory-app/client && npm run dev
```

Open a product detail page. Verify:
- Existing photos still display (base64 fallback via `ikUrl()`)
- "Upload Photo" button works — pick a file, see preview, click "Save Photo", check it uploads (watch browser Network tab for a POST to `upload.imagekit.io`)
- After save, the photo still displays (now from ImageKit URL)

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/ItemDetail.jsx client/src/lib/imagekit.js
git commit -m "feat: ImageCard uploads to ImageKit, falls back to base64"
```

---

## Task 5: Add migration section to `Config.jsx`

**Files:**
- Modify: `client/src/pages/Config.jsx`

**Context:** Config.jsx is ~761 lines. The migration UI is a new self-contained section added just before the closing `</ERPLayout>` tag (line ~759). It needs 5 new state variables and 2 new functions added to the `Config` component's state block.

- [ ] **Step 1: Add the imagekit import to `Config.jsx`**

After the existing imports at the top of `Config.jsx` (after the `import { db }` line), add:

```js
import { uploadToImageKit } from '../lib/imagekit'
```

- [ ] **Step 2: Add migration state to the `Config` component**

Find the block of `useState` declarations near the top of the `Config` component (around line 207+). Add these 5 lines after the existing state:

```js
const [unmigratedCount,  setUnmigratedCount]  = useState(null)   // null = not loaded yet
const [migrating,        setMigrating]        = useState(false)
const [migrateProgress,  setMigrateProgress]  = useState(0)
const [migrateTotal,     setMigrateTotal]     = useState(0)
const [migrateError,     setMigrateError]     = useState(null)
```

- [ ] **Step 3: Add `loadUnmigratedCount` and `runMigration` functions**

Add these two functions inside the `Config` component, after the existing `addBrand`/`removeBrand` functions:

```js
async function loadUnmigratedCount() {
  try {
    const { count, error } = await db.inventory().from('products')
      .select('sku_id', { count: 'exact', head: true })
      .not('image_data', 'is', null)
      .is('image_url', null)
    if (error) throw error
    setUnmigratedCount(count || 0)
  } catch (e) { showToast('❌ ' + e.message, 'error') }
}

async function runMigration() {
  setMigrating(true); setMigrateError(null); setMigrateProgress(0)
  try {
    const { data, error } = await db.inventory().from('products')
      .select('sku_id, image_data')
      .not('image_data', 'is', null)
      .is('image_url', null)
    if (error) throw error

    const items = data || []
    setMigrateTotal(items.length)

    for (let i = 0; i < items.length; i++) {
      const { sku_id, image_data } = items[i]
      try {
        const url = await uploadToImageKit(image_data, `sku_${sku_id}.jpg`, '/products')
        const { error: upErr } = await db.inventory().from('products')
          .update({ image_url: url, image_data: null })
          .eq('sku_id', sku_id)
        if (upErr) throw upErr
      } catch (itemErr) {
        setMigrateError(`Failed on SKU ${sku_id}: ${itemErr.message}`)
        setMigrating(false)
        return
      }
      setMigrateProgress(i + 1)
    }

    setUnmigratedCount(0)
    showToast(`✅ ${items.length} photo${items.length !== 1 ? 's' : ''} migrated to ImageKit`)
  } catch (e) { setMigrateError(e.message) }
  finally { setMigrating(false) }
}
```

- [ ] **Step 4: Add a `useEffect` to auto-load the unmigrated count**

Find the block of `useEffect` calls in the `Config` component (there will be one for brands, etc.) and add:

```js
useEffect(() => { loadUnmigratedCount() }, [])
```

- [ ] **Step 5: Add the migration UI section**

Find the line near the end of `Config.jsx`:
```js
    </ERPLayout>
```

Insert the migration section just before it (before the final `</ERPLayout>`):

```jsx
      {/* ── ImageKit Photo Migration ──────────────────────────────────── */}
      <div className="card" style={{ marginTop: 32 }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>
          Product Photos
        </div>
        <div className="config-sub" style={{ marginBottom: 16 }}>
          Migrate product photos from database storage to ImageKit CDN for faster loading.
        </div>

        {unmigratedCount === null ? (
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>Checking…</div>
        ) : unmigratedCount === 0 && !migrating ? (
          <div style={{ fontSize: 13, color: 'var(--success)' }}>✅ All photos are on ImageKit</div>
        ) : (
          <div>
            {!migrating && (
              <div style={{ fontSize: 13, marginBottom: 12 }}>
                <strong>{unmigratedCount}</strong> photo{unmigratedCount !== 1 ? 's' : ''} still stored in database
              </div>
            )}
            {migrating && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, marginBottom: 6 }}>
                  Migrating {migrateProgress} / {migrateTotal}…
                </div>
                <div style={{ height: 6, background: 'var(--bg)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 3,
                    background: 'var(--accent)',
                    width: migrateTotal > 0 ? `${Math.round(migrateProgress / migrateTotal * 100)}%` : '0%',
                    transition: 'width 0.3s',
                  }} />
                </div>
              </div>
            )}
            {migrateError && (
              <div style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>
                ❌ {migrateError}
              </div>
            )}
            <button
              className="btn btn-primary"
              onClick={runMigration}
              disabled={migrating || unmigratedCount === 0}
              style={{ fontSize: 13 }}
            >
              {migrating ? `Migrating ${migrateProgress}/${migrateTotal}…` : `Migrate ${unmigratedCount} Photo${unmigratedCount !== 1 ? 's' : ''} →`}
            </button>
          </div>
        )}
      </div>
```

- [ ] **Step 6: Build and verify**

```bash
cd /Users/naveenvajja/inventory-app/client && npm run build 2>&1 | tail -15
```

Expected: `✓ built in ...ms` with no errors.

- [ ] **Step 7: Manual smoke test**

```bash
npm run dev
```

Navigate to Config page. Verify:
- "Product Photos" section appears at the bottom
- Shows count of un-migrated photos (or "All photos are on ImageKit" if none)
- Click "Migrate N Photos →" — progress bar advances, counter increments
- On completion: "✅ N photos migrated to ImageKit" toast + section shows "All photos are on ImageKit"

- [ ] **Step 8: Commit**

```bash
git add client/src/pages/Config.jsx
git commit -m "feat: add ImageKit photo migration tool to Config page"
```

---

## Task 6: Build, sync and deploy

**Files:**
- `docs/index.html` + `docs/assets/` (GitHub Pages output)

- [ ] **Step 1: Production build**

```bash
cd /Users/naveenvajja/inventory-app/client && npm run build 2>&1 | tail -10
```

Expected: `✓ built in ...ms`

- [ ] **Step 2: Sync to docs/**

```bash
cd /Users/naveenvajja/inventory-app && cp -r client/dist/assets docs/ && cp client/dist/index.html docs/index.html
```

- [ ] **Step 3: Commit and push**

```bash
git add docs/index.html docs/assets/
git commit -m "deploy: ImageKit integration"
git push origin main
```

Expected: push succeeds. GitHub Pages will rebuild within ~60 seconds.
