// client/src/lib/imagekit.js — powered by Cloudinary (unsigned upload)
const CLOUD_NAME    = 'dpu06rcam'
const UPLOAD_PRESET = 'FATCLOSET'
const UPLOAD_URL    = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`

/**
 * Returns a display-ready src for an image.
 * - base64 data URL → return as-is (un-migrated fallback)
 * - Cloudinary URL → inject transforms after /upload/
 * - other URL → return as-is
 */
export function ikUrl(value, transforms = 'w_500,q_auto') {
  if (!value) return null
  if (value.startsWith('data:')) return value                          // base64 passthrough
  if (value.includes('res.cloudinary.com')) {
    return value.replace('/upload/', `/upload/${transforms}/`)         // e.g. w_500,q_auto
  }
  return value
}

/**
 * Upload a base64 data URL to Cloudinary using an unsigned upload preset.
 * Returns the secure_url string on success. Throws on failure.
 */
export async function uploadToImageKit(fileOrBase64, fileName, folder = 'products') {
  const publicId = fileName.replace(/\.[^.]+$/, '')                   // strip extension → sku_42
  const body = new FormData()
  body.append('file', fileOrBase64)
  body.append('upload_preset', UPLOAD_PRESET)
  body.append('folder', folder)
  body.append('public_id', publicId)

  const res = await fetch(UPLOAD_URL, { method: 'POST', body })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Upload failed (HTTP ${res.status})`)
  }
  const data = await res.json()
  return data.secure_url   // e.g. https://res.cloudinary.com/dpu06rcam/image/upload/products/sku_42.jpg
}
