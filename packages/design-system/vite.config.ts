import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from 'tailwindcss'
import peerDependencies from './package.json'

export default defineConfig({
  css: {
    postcss: {
      plugins: [tailwindcss()]
    }
  },
  plugins: [react()],
  build: {
    lib: {
      entry: './src/index.tsx',
      name: 'index',
      fileName: (format) => `design-system.${format}.js`,
      formats: ['es', 'cjs', 'umd']
    },
    rollupOptions: {
      external: Object.keys(peerDependencies)
    },
    outDir: 'dist',
    emptyOutDir: false
  }
})
