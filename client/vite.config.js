import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/users': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
      '/monitoring': {
        target: 'http://localhost:8002',
        changeOrigin: true,
        secure: false,
      },
      '/devices': {
        target: 'http://localhost:8001',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
