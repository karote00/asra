import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()] as any,
  esbuild: {
    target: 'esnext'
  },
  publicDir: 'public',
  build: {
    outDir: '../../dist',
    assetsDir: 'assets'
  },
  server: {
    port: 3000,
    open: true
  }
})
