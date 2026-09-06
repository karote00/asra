import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolveAppEnvironment } from './app-environment.mjs'

export default defineConfig(({ command }) => {
  // Static builds have no server origin; dev and preview still require one.
  const environment = command === 'serve' ? resolveAppEnvironment() : undefined
  const server = environment
    ? { host: environment.host, port: environment.port, strictPort: true }
    : undefined

  return {
    plugins: [tailwindcss(), react()],
    base: './',
    server,
    preview: server,
    build: { target: 'es2022' },
    worker: { format: 'es' }
  }
})
