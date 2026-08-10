import { describe, expect, it } from 'vitest'

import {
  exampleDefinition as coreDefinition,
  runCoreInformationModelExample
} from '../../../../docs/examples/core-information-model.mjs'
import {
  exampleDefinition as componentDefinition,
  runCustomComponentSchemaExample
} from '../../../../docs/examples/custom-component-schema.mjs'
import {
  exampleDefinition as featureDefinition,
  runFeatureSessionUndoExample
} from '../../../../docs/examples/feature-session-undo.mjs'
import {
  exampleDefinition as retrievalDefinition,
  runAppRetrievalActionExample
} from '../../../../docs/examples/app-retrieval-action.mjs'

describe('public Core composition examples', () => {
  it('models information while optional systems remain uncomposed', () => {
    expect(coreDefinition.id).toBe('core-information-model')
    expect(runCoreInformationModelExample()).toMatchObject({
      model: { revision: 1, status: 'verified' },
      optionalSystems: {
        ai: 'not-composed',
        collaboration: 'not-composed',
        renderEngine: false
      }
    })
  })

  it('registers an app-owned component, property runtime, and schema', () => {
    expect(componentDefinition.id).toBe('custom-component-schema')
    expect(runCustomComponentSchemaExample()).toMatchObject({
      componentType: 'example:work-item',
      relations: [{ name: 'review' }],
      schema: { type: 'example:review-state' },
      value: { score: 92, status: 'approved' }
    })
  })

  it('commits one Feature session, replays Undo/Redo, and rolls failure back', async () => {
    expect(featureDefinition.id).toBe('feature-session-undo')
    await expect(runFeatureSessionUndoExample()).resolves.toEqual({
      committedDepth: 1,
      rollbackDepth: 1,
      rollbackError: 'app mutation rejected',
      rolledBackValue: 5,
      undone: 0,
      redone: 5
    })
  })

  it('keeps app retrieval read-only and mutates through the registered API', () => {
    expect(retrievalDefinition.id).toBe('app-retrieval-action')
    expect(runAppRetrievalActionExample()).toMatchObject({
      matches: [{ id: 'record-b', label: 'Safety review', status: 'open' }],
      afterAction: {
        'record-b': { label: 'Safety review', status: 'approved' }
      }
    })
  })
})
