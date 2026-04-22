import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Routes that are both React pages AND Express API prefixes.
// When a browser navigates to these paths, serve the SPA instead of proxying.
function bypass(req) {
  if (req.headers.accept?.includes('text/html')) return '/index.html'
}

const api = target => ({ target, bypass })
const T = 'http://localhost:3000'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/hr':              api(T),
      '/customers':       api(T),
      '/addcustomer':     api(T),
      '/next-kunnr':      api(T),
      '/inventory':       api(T),
      '/addinventory':    api(T),
      '/next-matnr':      api(T),
      '/next-buyer-id':   api(T),
      '/next-po-id':      api(T),
      '/order':           api(T),
      '/orders':          api(T),
      '/categories':      api(T),
      '/category-l3':     api(T),
      '/brands':          api(T),
      '/colors':          api(T),
      '/fits':            api(T),
      '/gst-config':      api(T),
      '/return-reasons':  api(T),
      '/buyers':          api(T),
      '/purchase-orders': api(T),
      '/pricing':         api(T),
      '/analytics':       api(T),
      '/material-types':  api(T),
      '/body-types':      api(T),
      '/sales-price':     api(T),
      '/auth':            api(T),
      '/groups':          api(T),
    }
  },
  build: {
    outDir: '../public/dist',
    emptyOutDir: true,
  }
})
