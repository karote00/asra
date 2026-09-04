import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolveAppEnvironment } from './app-environment.mjs'

const environment = resolveAppEnvironment()

export default defineConfig({
  plugins: [react()],
  base: './',
  server: { host: environment.host, port: environment.port, strictPort: true },
  preview: { host: environment.host, port: environment.port, strictPort: true },
  build: { target: 'es2022' },
  worker: { format: 'es' }
})
