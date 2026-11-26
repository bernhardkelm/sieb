import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

/**
 * Returns the API server the dev server proxies /api and /metrics to.
 * @returns {string} - Base URL from SIEB_API_URL, the local API server on SIEB_PORT or 3100 by default
 */
const apiTarget = (): string =>
  process.env.SIEB_API_URL || `http://127.0.0.1:${process.env.SIEB_PORT || 3100}`

export default defineConfig(() => ({
  plugins: [vue(), vueDevTools()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src/client', import.meta.url)),
    },
  },
  server: {
    // keep the browser Host, the API compares Origin with Host on writes
    proxy: {
      '/api': { target: apiTarget(), changeOrigin: false },
      '/metrics': { target: apiTarget(), changeOrigin: false },
    },
  },
}))
