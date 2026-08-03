import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8')
)

export default defineConfig({
  plugins: [react()],
  define: {
    // Expõe a versão do package.json em runtime, evitando string hardcoded
    // que fica desatualizada (ex.: sidebar mostrando "v2.0" com o pacote em 1.0.0).
    __APP_VERSION__: JSON.stringify(pkg.version)
  },
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
