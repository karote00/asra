import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import eslint from 'vite-plugin-eslint'
import svgr from 'vite-plugin-svgr'
import tailwindcss from 'tailwindcss'
import peerDependencies from './package.json'

export default defineConfig({
  css: {
    postcss: {
      plugins: [tailwindcss()]
    }
  },
  plugins: [
    react(),
    eslint(),
    svgr({
      svgrOptions: {
        icon: true
      }
    })
  ],
  build: {
    lib: {
      entry: './src/index.tsx',
      name: 'DesignSystem',
      fileName: (format) => `design-system.${format}.js`,
      formats: ['es', 'umd']
    },
    rollupOptions: {
      external: [...Object.keys(peerDependencies), /\.css$/],
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'index.css'
          }
          return assetInfo.name || 'assets/[name]-[hash][extname]'
        }
      }
    },
    emptyOutDir: false
  }
})
