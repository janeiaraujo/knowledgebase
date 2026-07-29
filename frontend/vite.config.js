import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Libera qualquer subdominio de tunel ngrok (o host muda a cada restart no plano free)
    allowedHosts: ['.ngrok-free.dev', '.ngrok-free.app', '.ngrok.io'],
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true
      }
    }
  }
})
