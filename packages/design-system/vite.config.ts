import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import eslint from 'vite-plugin-eslint'
import svgr from 'vite-plugin-svgr'
import dts from 'vite-plugin-dts'
import tailwindcss from 'tailwindcss'
import { resolve } from 'path'
import packageJson from './package.json'

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
    }),
    dts()
  ],
  build: {
    lib: {
      entry: resolve(__dirname, './src/index.tsx'),
      name: 'DesignSystem',
      fileName: (format) => `index.${format}.js`
    },
    rollupOptions: {
      external: [...Object.keys(packageJson.peerDependencies), 'tailwindcss'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          tailwindcss: 'tailwindcss'
        }
      }
    },
    sourcemap: true,
    emptyOutDir: false
  },
  server: {
    watch: {
      ignored: ['**/dist/**']
    }
  }
})
