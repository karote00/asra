import { defineConfig } from 'vite'
import vercel from 'vite-plugin-vercel'
import react from '@vitejs/plugin-react'
import eslint from 'vite-plugin-eslint'

export default defineConfig({
  plugins: [vercel(), react(), eslint()],
  server: {
    port: (process.env.PORT || 3000) as unknown as number,
    open: true
  },
  define: {
    __APP_ENV__: process.env.VITE_VERCEL_ENV
  },
  esbuild: {
    target: 'esnext'
  },
  publicDir: 'public',
  build: {
    outDir: '../../dist',
    assetsDir: 'assets',
    emptyOutDir: true
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: '@import "@asra/design-system/index.css";'
      }
    }
  }
})
