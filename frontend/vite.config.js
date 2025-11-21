import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // In production, use api.mlr.ramith.io via Cloudflare Tunnel
        // In development, proxy to local backend
        target: process.env.VITE_API_URL || 'http://localhost:8028',
        changeOrigin: true,
      }
    },
    allowedHosts: ['mlr.ramith.io', '.ramith.io'],
  }
})
