import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // Packed ESM exports stay live across Core runtime replacement.
    deps: { interopDefault: false },
    include: ['src/**/__tests__/**/*.test.ts'],
    maxWorkers: 2,
    testTimeout: 10000
  }
})
