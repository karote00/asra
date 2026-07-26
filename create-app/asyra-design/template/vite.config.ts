import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from 'tailwindcss'
import {
  loadAsyraDesignEnvironment,
  resolveAsyraDesignEnvironment
} from './app-environment.mjs'
import { createAsyraDesignVTracerMiddleware } from './vtracer-tool-server.mjs'

const appEnvironment = resolveAsyraDesignEnvironment(
  loadAsyraDesignEnvironment()
)

const asyraDesignVTracer = (): Plugin => ({
  name: 'asyra-design-vtracer-tool',
  configureServer(server) {
    server.middlewares.use(createAsyraDesignVTracerMiddleware())
  },
  configurePreviewServer(server) {
    server.middlewares.use(createAsyraDesignVTracerMiddleware())
  }
})

export default defineConfig({
  css: {
    postcss: {
      plugins: [tailwindcss()]
    }
  },
  plugins: [asyraDesignVTracer(), react()],
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
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true
  }
})
