import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    ssr: 'server/document-backend.ts',
    target: 'node18',
    outDir: 'dist/document-backend',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'document-backend.js'
      }
    }
  },
  ssr: {
    noExternal: true
  }
})
