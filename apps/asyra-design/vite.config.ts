import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import vercel from 'vite-plugin-vercel'
import tailwindcss from 'tailwindcss'
import { loadEnvironment, resolveEnvironment } from './app-environment.mjs'
import { createVTracerMiddleware } from './vtracer-tool-server.mjs'

const appEnvironment = resolveEnvironment(loadEnvironment())

const createVTracerPlugin = (): Plugin => ({
  name: 'vtracer-tool',
  configureServer(server) {
    server.middlewares.use(createVTracerMiddleware())
  },
  configurePreviewServer(server) {
    server.middlewares.use(createVTracerMiddleware())
  }
})

export default defineConfig({
  css: {
    postcss: {
      plugins: [tailwindcss()]
    }
  },
  plugins: [createVTracerPlugin(), vercel(), react()],
  server: {
    host: appEnvironment.viteHost,
    port: appEnvironment.vitePort,
    open: true
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
