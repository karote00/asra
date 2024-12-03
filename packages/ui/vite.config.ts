import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  esbuild: {
    target: 'esnext'
  },
  publicDir: 'public',
  build: {
    outDir: '../../dist',
    assetsDir: 'assets'
  },
  server: {
    port: 3000
  }
})
