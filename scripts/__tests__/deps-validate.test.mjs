import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  extractInternalImports,
  resolveWorkspaceImport,
  validateDependencies,
  validateSourceImports
} from '../deps-validate.js'

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
)

const workspaceNames = new Set([
  '@asyra/render-engine',
  '@asyra/reactive-events',
  '@asyra/ui-context'
])

test('resolves a public package subpath to its owning workspace', () => {
  assert.equal(
    resolveWorkspaceImport('@asyra/render-engine/testing', workspaceNames),
    '@asyra/render-engine'
  )
})

test('extracts source imports without treating comments as dependencies', () => {
  const source = `
    /** import { idCounter } from '@asyra/sid' */
    // require('@asyra/naming')
    import type { RenderEngine } from '@asyra/render-engine'
    export { EventTypes } from '@asyra/reactive-events'
    const testing = import('@asyra/render-engine/testing')
    type UIContext = import('@asyra/ui-context').UIContext
    const preset = import('@asyra/preset', { with: { type: 'json' } })
    vi.mock('@asyra/core', () => ({}))
    /** @type {import('@asyra/render').Render} */
    const render = null
  `

  assert.deepEqual(
    new Set(extractInternalImports(source, 'example.ts')),
    new Set([
      '@asyra/render-engine',
      '@asyra/reactive-events',
      '@asyra/render-engine/testing',
      '@asyra/ui-context',
      '@asyra/preset',
      '@asyra/core',
      '@asyra/render'
    ])
  )
})

test('discovers every workspace family declared by the root manifest', async () => {
  const result = await validateDependencies({ rootDir: repositoryRoot })
  const discoveredWorkspaceNames = new Set(
    result.workspaces.map((workspace) => workspace.name)
  )

  assert.equal(result.setupError, undefined)
  assert.ok(discoveredWorkspaceNames.has('@asyra/asyra'))
  assert.ok(discoveredWorkspaceNames.has('@asyra/asyra-design'))
  assert.ok(discoveredWorkspaceNames.has('@asyra/render-engine'))
  assert.ok(discoveredWorkspaceNames.has('create-asyra-design-app'))
})

test('requires production imports in dependencies', () => {
  assert.deepEqual(
    validateSourceImports({
      workspaceName: '@asyra/preset',
      relativeFile: 'src/ui/register-properties.ts',
      source: "import type { UIContext } from '@asyra/ui-context'",
      dependencies: [],
      devDependencies: ['@asyra/ui-context'],
      workspaceNames
    }),
    ['@asyra/ui-context']
  )
})

test('allows test imports declared in devDependencies', () => {
  assert.deepEqual(
    validateSourceImports({
      workspaceName: '@asyra/preset',
      relativeFile: 'src/__tests__/selection-subscriptions.test.ts',
      source: "import { EventTypes } from '@asyra/reactive-events'",
      dependencies: [],
      devDependencies: ['@asyra/reactive-events'],
      workspaceNames
    }),
    []
  )
})

test('allows a workspace to import one of its own public subpaths', () => {
  assert.deepEqual(
    validateSourceImports({
      workspaceName: '@asyra/render-engine',
      relativeFile: 'src/__tests__/contract.test.ts',
      source:
        "import { runRenderEngineContract } from '@asyra/render-engine/testing'",
      dependencies: [],
      devDependencies: [],
      workspaceNames
    }),
    []
  )
})
