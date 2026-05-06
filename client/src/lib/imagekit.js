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
