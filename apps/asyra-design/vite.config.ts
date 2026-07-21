import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import vercel from 'vite-plugin-vercel'
import tailwindcss from 'tailwindcss'
import {
  loadAsyraDesignEnvironment,
  resolveAsyraDesignEnvironment
} from './app-environment.mjs'

const appEnvironment = resolveAsyraDesignEnvironment(
  loadAsyraDesignEnvironment()
)

export default defineConfig({
  css: {
    postcss: {
      plugins: [tailwindcss()]
    }
  },
  plugins: [vercel(), react()],
  server: {
    host: appEnvironment.viteHost,
    port: appEnvironment.vitePort,
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
