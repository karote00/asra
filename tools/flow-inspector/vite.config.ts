import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify('production')
  },
  plugins: [react()],
  build: {
    emptyOutDir: true,
    lib: {
      entry: resolve(import.meta.dirname, 'src/main.tsx'),
      formats: ['iife'],
      name: 'FlowInspectorWorkspace',
      fileName: () => 'flow-inspector-workspace.js',
      cssFileName: 'flow-inspector-workspace'
    },
    outDir: resolve(import.meta.dirname, 'workspace/generated')
  }
})
