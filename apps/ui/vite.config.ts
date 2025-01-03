import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import vercel from 'vite-plugin-vercel'
import eslint from 'vite-plugin-eslint'
import tailwindcss from 'tailwindcss'

export default defineConfig({
  css: {
    postcss: {
      plugins: [tailwindcss()]
    }
  },
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
  }
})
