import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    ssr: 'collaboration-server.ts',
    target: 'node18',
    outDir: 'dist/collaboration-server',
    emptyOutDir: true,
    rollupOptions: {
      external: ['ws'],
      output: {
        entryFileNames: 'collaboration-server.js'
      }
    }
  },
  ssr: {
    noExternal: true
  }
})
