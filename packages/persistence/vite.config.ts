import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  build: {
    lib: {
      entry: './src/index.ts',
      name: 'AsyraPersistence',
      formats: ['es']
    },
    rollupOptions: {
      external: ['@asyra/utils']
    }
  },
  plugins: [dts({ rollupTypes: true })]
})
