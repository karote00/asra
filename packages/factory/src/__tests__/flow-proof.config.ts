import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

const sourceRoot =
  process.env.FLOW_PROOF_SOURCE ?? resolve(import.meta.dirname, '../../../..')
const scenario = process.env.FLOW_PROOF_SCENARIO ?? 'baseline'
if (!['baseline', 'inverse-regression'].includes(scenario))
  throw new Error('Unknown proof scenario')

export default defineConfig({
  plugins: [
    {
      name: 'proof-inverse-regression',
      enforce: 'pre',
      resolveId(id) {
        // Declared aliases run before this hook. Never fall through to a
        // workspace package's mutable dist output for an unknown dependency.
        if (id.startsWith('@asyra/'))
          throw new Error('Uncaptured source dependency: ' + id)
      },
      transform(code, id) {
        if (
          scenario !== 'inverse-regression' ||
          !id.endsWith('/packages/factory/src/data-transact.ts')
        )
          return
        const original =
          'inversePayload.after = (payload as { before?: unknown }).before'
        if (code.split(original).length !== 2)
          throw new Error('Negative proof mutation site changed')
        return {
          code: code.replace(
            original,
            'inversePayload.after = (payload as { after?: unknown }).after'
          ),
          map: null
        }
      }
    }
  ],
  resolve: {
    alias: [
      {
        find: /^@asyra\/persistence$/,
        replacement: resolve(sourceRoot, 'packages/persistence/src/index.ts')
      },
      {
        find: /^@asyra\/utils$/,
        replacement: resolve(sourceRoot, 'packages/utils/src/index.ts')
      },
      {
        find: /^@asyra\/reactive-events$/,
        replacement: resolve(
          sourceRoot,
          'packages/reactive-events/src/index.ts'
        )
      },
      {
        find: /^@asyra\/factory$/,
        replacement: resolve(sourceRoot, 'packages/factory/src/index.ts')
      }
    ]
  },
  test: {
    environment: 'node',
    include: [
      resolve(sourceRoot, 'packages/factory/src/__tests__/flow-proof.test.ts')
    ],
    maxWorkers: 1,
    fileParallelism: false,
    testTimeout: 10000,
    hookTimeout: 10000
  }
})
