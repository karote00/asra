import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: 'src/public-imports.ts',
      formats: ['es'],
      fileName: 'framework-release-consumer'
    }
  }
})
