import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: parseInt(process.env.VITE_PORT || '5550'),
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.API_PORT || process.env.PORT || '3001'}`,
        changeOrigin: true
      }
    }
  }
})
