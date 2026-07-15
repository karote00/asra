import assert from 'node:assert/strict'
import test from 'node:test'

import {
  extractInternalImports,
  resolveWorkspaceImport,
  validateSourceImports
} from './deps-validate.js'

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
  `

  assert.deepEqual(extractInternalImports(source, 'example.ts'), [
    '@asyra/render-engine',
    '@asyra/reactive-events',
    '@asyra/render-engine/testing'
  ])
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
