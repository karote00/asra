import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import svgr from 'vite-plugin-svgr'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'
import packageJson from './package.json'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
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
      external: [...Object.keys(packageJson.peerDependencies)],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM'
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
