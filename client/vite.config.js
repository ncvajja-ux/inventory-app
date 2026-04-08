import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/hr': 'http://localhost:3000',
      '/customers': 'http://localhost:3000',
      '/addcustomer': 'http://localhost:3000',
      '/next-kunnr': 'http://localhost:3000',
      '/inventory': 'http://localhost:3000',
      '/addinventory': 'http://localhost:3000',
      '/next-matnr': 'http://localhost:3000',
      '/next-buyer-id': 'http://localhost:3000',
      '/next-po-id': 'http://localhost:3000',
      '/order': 'http://localhost:3000',
      '/orders': 'http://localhost:3000',
      '/categories': 'http://localhost:3000',
      '/category-l3': 'http://localhost:3000',
      '/brands': 'http://localhost:3000',
      '/colors': 'http://localhost:3000',
      '/fits': 'http://localhost:3000',
      '/gst-config': 'http://localhost:3000',
      '/return-reasons': 'http://localhost:3000',
      '/buyers': 'http://localhost:3000',
      '/purchase-orders': 'http://localhost:3000',
      '/pricing': 'http://localhost:3000',
      '/analytics': 'http://localhost:3000',
    }
  },
  build: {
    outDir: '../public/dist',
    emptyOutDir: true,
  }
})
