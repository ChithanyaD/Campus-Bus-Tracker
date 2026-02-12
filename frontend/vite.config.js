import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3000,
    // Allow all hosts in development so ngrok tunnels can connect
    // Vite expects a boolean or string[], so use true here.
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'http://localhost:3004',
        changeOrigin: true
      },
      // Proxy backend Socket.IO through the same origin (for ngrok / mobile)
      '/socket.io': {
        target: process.env.VITE_BACKEND_URL || 'http://localhost:3004',
        ws: true,
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})
