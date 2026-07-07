import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  alternateStrokeParameterPayload,
  assertStrokeParameterCoverageForStep,
  expectNoStrokeParameterOutputKeys,
  representativeStrokeParameterPayload,
  strokeParameterPayloadAllowedKeys
} from './stroke-parameter-coverage-test-helper'
import {
  EventTypes,
  changeComputedDataPatch,
  subscribeToEvents,
  updateComputedDataPatch,
  type AllEvent
} from '@asyra/reactive-events'

interface InspectorStep {
  id: string
  refactorStatus: 'locked' | 'active' | 'verified'
}

interface InspectorData {
  steps: InspectorStep[]
  inspectorContractErrors: string[]
}

const repoRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../'
)
const require = createRequire(import.meta.url)
const inspectorPath = resolve(
  repoRoot,
  'docs/ai/apps/asyra-design/plans/stroke-engine-final/stroke-flow-inspector.data.js'
)
const sceneTreeSubscribesSourcePath = resolve(
  repoRoot,
  'packages/scene-tree/src/subscribes.ts'
)
const reactivePublishSourcePath = resolve(
  repoRoot,
  'packages/reactive-events/src/scene-tree/publish.ts'
)

let cachedInspectorData: InspectorData | null = null

const loadInspectorData = (): InspectorData => {
  if (cachedInspectorData) {
    return cachedInspectorData
  }
  const windowRecord: { STROKE_FLOW_INSPECTOR_DATA?: InspectorData } = {}
  ;(globalThis as typeof globalThis & { window?: unknown }).window =
    windowRecord
  Reflect.deleteProperty(require.cache, require.resolve(inspectorPath))
  require(inspectorPath)
  const data = windowRecord.STROKE_FLOW_INSPECTOR_DATA
  expect(data).toBeDefined()
  cachedInspectorData = data as InspectorData
  return cachedInspectorData
}

const captureEvents = () => {
  const events: AllEvent[] = []
  const subscription = subscribeToEvents((event) => {
    events.push(event)
  })
  events.length = 0
  return { events, subscription }
}

describe('stroke flow step 11: computed-patch-event', () => {
  it('keeps computed-patch-event as the current or verified eleventh step', () => {
    const data = loadInspectorData()
    const step = data.steps.find((entry) => entry.id === 'computed-patch-event')
    const activeSteps = data.steps.filter(
      (entry) => entry.refactorStatus === 'active'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(step?.refactorStatus).toMatch(/^(active|verified)$/)
    if (step?.refactorStatus === 'active') {
      expect(activeSteps.map((entry) => entry.id)).toEqual([
        'computed-patch-event'
      ])
    }
  })

  it('publishes committed computed patch requests as reactive change events', () => {
    const { events, subscription } = captureEvents()
    const patch = {
      values: {
        width: 80
      },
      records: {
        points: {
          set: {
            'point:b': {
              id: 'point:b',
              x: 90,
              y: 80
            }
          }
        }
      }
    }

    changeComputedDataPatch(['element:step-11'], patch, { undoable: true })

    expect(events).toEqual([
      expect.objectContaining({
        type: EventTypes.CHANGE_COMPUTED_DATA_PATCH,
        payload: {
          elementIds: ['element:step-11'],
          patch
        },
        options: {
          undoable: true
        }
      })
    ])
    subscription.unsubscribe()
  })

  it('publishes applied computed patch changes for downstream replay', () => {
    const { events, subscription } = captureEvents()
    const patchChange = {
      values: {
        width: {
          before: 60,
          after: 80
        }
      }
    }

    updateComputedDataPatch('element:step-11', patchChange)

    expect(events).toEqual([
      expect.objectContaining({
        type: EventTypes.UPDATE_COMPUTED_DATA_PATCH,
        payload: {
          id: 'element:step-11',
          patch: patchChange
        }
      })
    ])
    subscription.unsubscribe()
  })

  it('preserves stroke parameter payloads in change and update computed patch events', () => {
    const { events, subscription } = captureEvents()
    const patch = {
      values: {
        strokes: [representativeStrokeParameterPayload],
        fills: [representativeStrokeParameterPayload.fill]
      }
    }
    const patchChange = {
      values: {
        strokes: {
          before: [alternateStrokeParameterPayload],
          after: [representativeStrokeParameterPayload]
        },
        fills: {
          before: [alternateStrokeParameterPayload.fill],
          after: [representativeStrokeParameterPayload.fill]
        }
      }
    }

    changeComputedDataPatch(['element:stroke-step-11'], patch, {
      undoable: true
    })
    updateComputedDataPatch('element:stroke-step-11', patchChange)

    expect(events).toEqual([
      expect.objectContaining({
        type: EventTypes.CHANGE_COMPUTED_DATA_PATCH,
        payload: {
          elementIds: ['element:stroke-step-11'],
          patch
        },
        options: {
          undoable: true
        }
      }),
      expect.objectContaining({
        type: EventTypes.UPDATE_COMPUTED_DATA_PATCH,
        payload: {
          id: 'element:stroke-step-11',
          patch: patchChange
        }
      })
    ])
    expectNoStrokeParameterOutputKeys(events, strokeParameterPayloadAllowedKeys)
    subscription.unsubscribe()
  })

  it('keeps scene-tree subscribers on computed patch events and model commits', () => {
    const sceneTreeSubscribesSource = readFileSync(
      sceneTreeSubscribesSourcePath,
      'utf8'
    )
    const reactivePublishSource = readFileSync(
      reactivePublishSourcePath,
      'utf8'
    )

    expect(reactivePublishSource).toContain('changeComputedDataPatch = (')
    expect(reactivePublishSource).toContain(
      'type: EventTypes.CHANGE_COMPUTED_DATA_PATCH'
    )
    expect(reactivePublishSource).toContain('updateComputedDataPatch = (')
    expect(reactivePublishSource).toContain(
      'type: EventTypes.UPDATE_COMPUTED_DATA_PATCH'
    )
    expect(sceneTreeSubscribesSource).toContain(
      'subscribeToChangeComputedDataPatch'
    )
    expect(sceneTreeSubscribesSource).toContain(
      'sceneTree.patchComputedData(elementId, patch, options)'
    )
    expect(sceneTreeSubscribesSource).toContain(
      'subscribeToUpdateComputedDataPatch'
    )
    expect(sceneTreeSubscribesSource).toContain(
      'sceneTree.patchComputedData(id, toAppliedComputedDataPatch(patch), options)'
    )
  })

  it('does not route computed patch events through render or stroke product helpers', () => {
    const sceneTreeSubscribesSource = readFileSync(
      sceneTreeSubscribesSourcePath,
      'utf8'
    )
    const reactivePublishSource = readFileSync(
      reactivePublishSourcePath,
      'utf8'
    )

    for (const forbiddenToken of [
      'stroke-render',
      'buildSourceVertexJoinFootprint',
      'buildConstrained',
      'strokePathStyle',
      'renderDescriptor',
      'strokeMaskPolygons',
      'descriptorProductPolygons',
      'fillPolygons'
    ]) {
      expect(sceneTreeSubscribesSource).not.toContain(forbiddenToken)
      expect(reactivePublishSource).not.toContain(forbiddenToken)
    }
  })

  it('matches the stroke parameter coverage matrix for this step', () => {
    assertStrokeParameterCoverageForStep('computed-patch-event')
  })
})
