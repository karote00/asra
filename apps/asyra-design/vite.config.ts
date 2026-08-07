import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import vercel from 'vite-plugin-vercel'
import tailwindcss from 'tailwindcss'
import { loadEnvironment, resolveEnvironment } from './app-environment.mjs'
import { createDocumentDatabaseMiddleware } from './e2e/document-database-middleware.mjs'
import { createVTracerMiddleware } from './vtracer-tool-server.mjs'
import { createActionBatchMiddleware } from './server/action-batch'

const appEnvironment = resolveEnvironment(loadEnvironment())
const opensBrowser = process.env.E2E_OWN_SERVERS !== '1'
const enablesE2eDocumentDatabase = process.env.E2E_DOCUMENT_DATABASE === '1'
const documentBackendURL =
  process.env.E2E_DOCUMENT_BACKEND_URL?.trim() ||
  process.env.DOCUMENT_PERSISTENCE_BACKEND_URL?.trim()

const createVTracerPlugin = (): Plugin => ({
  name: 'vtracer-tool',
  configureServer(server) {
    server.middlewares.use(createVTracerMiddleware())
  },
  configurePreviewServer(server) {
    server.middlewares.use(createVTracerMiddleware())
  }
})

const createActionBatchPlugin = (): Plugin => ({
  name: 'action-batch-server',
  configureServer(server) {
    server.middlewares.use(createActionBatchMiddleware())
  },
  configurePreviewServer(server) {
    server.middlewares.use(createActionBatchMiddleware())
  }
})

const createDocumentDatabaseTestPlugin = (): Plugin => ({
  name: 'e2e-document-database',
  configureServer(server) {
    server.middlewares.use(createDocumentDatabaseMiddleware())
  }
})

export default defineConfig({
  css: {
    postcss: {
      plugins: [tailwindcss()]
    }
  },
  plugins: [
    ...(enablesE2eDocumentDatabase ? [createDocumentDatabaseTestPlugin()] : []),
    createActionBatchPlugin(),
    createVTracerPlugin(),
    vercel(),
    react()
  ],
  server: {
    host: appEnvironment.viteHost,
    port: appEnvironment.vitePort,
    open: opensBrowser,
    ...(documentBackendURL
      ? {
          proxy: {
            '/api/documents': {
              target: documentBackendURL,
              changeOrigin: true
            }
          }
        }
      : {})
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
