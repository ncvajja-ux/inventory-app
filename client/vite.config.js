import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/customers': 'http://localhost:3000',
      '/addcustomer': 'http://localhost:3000',
      '/inventory': 'http://localhost:3000',
      '/addinventory': 'http://localhost:3000',
      '/next-kunnr': 'http://localhost:3000',
      '/next-matnr': 'http://localhost:3000',
      '/order': 'http://localhost:3000',
      '/categories': 'http://localhost:3000',
    }
  },
  build: {
    outDir: '../public/dist',
    emptyOutDir: true,
  }
})
