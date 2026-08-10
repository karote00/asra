import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { definePublicExample } from './example-contract.mjs'

export const EXAMPLE_SOURCES = Object.freeze({
  'core-information-model': 'docs/examples/core-information-model.mjs',
  'preset-2d-minimal': 'docs/examples/preset-2d-minimal.mjs',
  'preset-selective-defaults': 'docs/examples/preset-selective-defaults.mjs',
  'custom-component-schema': 'docs/examples/custom-component-schema.mjs',
  'feature-session-undo': 'docs/examples/feature-session-undo.mjs',
  'app-versioned-load-migration':
    'docs/examples/app-owned-versioned-load-migration.mjs',
  'custom-render-boundary': 'docs/examples/custom-render-boundary.mjs',
  'collaboration-two-memory-actors':
    'docs/examples/network-collaboration-transport.mjs',
  'ai-registered-action': 'docs/examples/ai-agent-runtime.mjs',
  'app-retrieval-action': 'docs/examples/app-retrieval-action.mjs',
  'generated-design-app-extension':
    'apps/asyra-design/examples/review-queue-extension.mjs'
})

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
)

export const loadExample = async (id) => {
  const source = EXAMPLE_SOURCES[id]
  if (!source) {
    throw new Error(`Unknown public example id: ${id}`)
  }
  const module = await import(path.join(repositoryRoot, source))
  const definition = definePublicExample(module.exampleDefinition)
  if (definition.id !== id) {
    throw new Error(`Example ${source} declares unexpected id ${definition.id}`)
  }
  if (typeof module.runExample !== 'function') {
    throw new Error(`Example ${id} does not export runExample()`)
  }
  return Object.freeze({ definition, run: module.runExample, source })
}

export const runExampleById = async (id) => {
  const example = await loadExample(id)
  const result = await example.run()
  if (result === undefined) {
    throw new Error(`Example ${id} returned no result contract`)
  }
  return Object.freeze({
    id,
    result,
    source: example.source,
    status: 'passed'
  })
}

const isDirectInvocation =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectInvocation) {
  const [id, ...unexpected] = process.argv.slice(2)
  if (!id || unexpected.length > 0) {
    throw new Error('Usage: node docs/examples/run-example.mjs <example-id>')
  }
  const evidence = await runExampleById(id)
  process.stdout.write(`${JSON.stringify(evidence)}\n`)
}
