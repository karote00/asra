import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  logLevel: 'info',
  build: {
    outDir: '../../dist',
    assetsDir: 'assets'
  },
  server: {
    port: 3000,
    historyApiFallback: true
  }
})
