import { describe, expect, it } from 'vitest'

import {
  exampleDefinition,
  runCustomRenderBoundaryExample
} from '../../../../docs/examples/custom-render-boundary.mjs'

describe('public custom render boundary example', () => {
  it('passes the engine-neutral conformance contract through an app adapter', async () => {
    const result = await runCustomRenderBoundaryExample()

    expect(exampleDefinition.id).toBe('custom-render-boundary')
    expect(result.engineName).toBe('example-app-adapter')
    expect(result.interactionCount).toBe(1)
    expect(result.operationTypes).toEqual([
      'initialize',
      'create-resource',
      'create-object',
      'create-object',
      'append-child',
      'append-child',
      'draw',
      'update-object',
      'resize',
      'flush',
      'destroy-resource',
      'destroy'
    ])
  })
})
