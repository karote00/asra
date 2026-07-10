import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import {
  alternateStrokeParameterPayload,
  assertStrokeParameterCoverageForStep,
  expectNoStrokeParameterOutputKeys,
  representativeStrokeParameterPayload,
  strokeParameterPayloadAllowedKeys
} from './stroke-parameter-coverage-test-helper'
import * as ReactiveEventsModule from '@asyra/reactive-events'
import {
  SCENE_TREE_ACTIONS,
  SharedDataChannelNames,
  type ElementInstanceTypes
} from '@asyra/utils'
import { SceneTree } from '../../../../../packages/scene-tree/src/sceneTree'

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
const coreSceneTreeApiSourcePath = resolve(
  repoRoot,
  'packages/core/src/apis/scene-tree.ts'
)
const sceneTreeSourcePath = resolve(
  repoRoot,
  'packages/scene-tree/src/sceneTree.ts'
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

const captureUpdateTransactionEvents = () => {
  const events: ReactiveEventsModule.UpdateTransactionEvent[] = []
  const subscription = ReactiveEventsModule.subscribeToEvents((event) => {
    if (event.type === ReactiveEventsModule.EventTypes.UPDATE_TRANSACTION) {
      events.push(event as ReactiveEventsModule.UpdateTransactionEvent)
    }
  })
  events.length = 0

  return { events, subscription }
}

describe('stroke flow step 10: scene-tree-commit', () => {
  it('keeps scene-tree-commit as the current or verified tenth step', () => {
    const data = loadInspectorData()
    const step = data.steps.find((entry) => entry.id === 'scene-tree-commit')
    const activeSteps = data.steps.filter(
      (entry) => entry.refactorStatus === 'active'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(step?.refactorStatus).toMatch(/^(locked|active|verified)$/)
    if (step?.refactorStatus === 'active') {
      expect(activeSteps.map((entry) => entry.id)).toEqual([
        'scene-tree-commit'
      ])
    }
  })

  it('applies computed patch values and records to scene-tree model data', () => {
    const sceneTree = new SceneTree()
    const element = {
      get: vi.fn(() => 'element:step-10'),
      getAllComputedData: vi.fn(() => ({
        width: 60,
        points: {
          'point:a': {
            id: 'point:a',
            x: 10,
            y: 20
          }
        }
      })),
      updateComputedData: vi.fn()
    } as unknown as ElementInstanceTypes
    sceneTree.addToMap(element)

    sceneTree.patchComputedData('element:step-10', {
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
          },
          remove: ['point:a']
        }
      }
    })

    expect(element.updateComputedData).toHaveBeenCalledWith(
      'width',
      80,
      undefined
    )
    expect(element.updateComputedData).toHaveBeenCalledWith(
      'points',
      {
        'point:b': {
          id: 'point:b',
          x: 90,
          y: 80
        }
      },
      undefined
    )
    expect(sceneTree.changes).toEqual([
      expect.objectContaining({
        action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_PATCH,
        id: 'element:step-10',
        patch: {
          values: {
            width: {
              before: 60,
              after: 80
            }
          },
          records: {
            points: {
              set: {
                'point:b': {
                  after: {
                    id: 'point:b',
                    x: 90,
                    y: 80
                  }
                }
              },
              remove: {
                'point:a': {
                  before: {
                    id: 'point:a',
                    x: 10,
                    y: 20
                  }
                }
              }
            }
          }
        }
      })
    ])
  })

  it('commits computed patch changes through the scene-tree shared transaction channel', () => {
    const sceneTree = new SceneTree()
    const { events, subscription } = captureUpdateTransactionEvents()

    sceneTree.addChange({
      action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_PATCH,
      eventName: ReactiveEventsModule.EventTypes.UPDATE_COMPUTED_DATA_PATCH,
      id: 'element:step-10',
      patch: {
        values: {
          width: {
            before: 60,
            after: 80
          }
        }
      }
    })
    sceneTree.commitSceneTreeTransaction({ undoable: true })

    expect(events).toEqual([
      expect.objectContaining({
        type: ReactiveEventsModule.EventTypes.UPDATE_TRANSACTION,
        eventName: ReactiveEventsModule.EventTypes.UPDATE_COMPUTED_DATA_PATCH,
        payload: expect.objectContaining({
          action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_PATCH,
          id: 'element:step-10'
        }),
        options: {
          undoable: true,
          shared: SharedDataChannelNames.SCENE_TREE
        }
      })
    ])
    subscription.unsubscribe()
  })

  it('preserves stroke parameter computed values as scene-tree model data only', () => {
    const sceneTree = new SceneTree()
    const element = {
      get: vi.fn(() => 'element:stroke-step-10'),
      getAllComputedData: vi.fn(() => ({
        strokes: [alternateStrokeParameterPayload],
        fills: [alternateStrokeParameterPayload.fill]
      })),
      updateComputedData: vi.fn()
    } as unknown as ElementInstanceTypes
    sceneTree.addToMap(element)

    sceneTree.patchComputedData('element:stroke-step-10', {
      values: {
        strokes: [representativeStrokeParameterPayload],
        fills: [representativeStrokeParameterPayload.fill]
      }
    })

    expect(element.updateComputedData).toHaveBeenCalledWith(
      'strokes',
      [representativeStrokeParameterPayload],
      undefined
    )
    expect(element.updateComputedData).toHaveBeenCalledWith(
      'fills',
      [representativeStrokeParameterPayload.fill],
      undefined
    )
    expect(sceneTree.changes).toEqual([
      expect.objectContaining({
        action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_PATCH,
        id: 'element:stroke-step-10',
        patch: {
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
      })
    ])
    expectNoStrokeParameterOutputKeys(
      sceneTree.changes[0],
      strokeParameterPayloadAllowedKeys
    )
  })

  it('keeps the core API bridge on computed patch events instead of render shortcuts', () => {
    const coreSceneTreeApiSource = readFileSync(
      coreSceneTreeApiSourcePath,
      'utf8'
    )
    const sceneTreeSource = readFileSync(sceneTreeSourcePath, 'utf8')

    expect(coreSceneTreeApiSource).toContain('changeComputedDataPatch(')
    expect(coreSceneTreeApiSource).toContain(
      'changeComputedDataPatch(elementIds, patch, options)'
    )
    expect(sceneTreeSource).toContain('patchComputedData(')
    expect(sceneTreeSource).toContain(
      'SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_PATCH'
    )
  })

  it('does not route scene-tree commit through render or stroke product helpers', () => {
    const coreSceneTreeApiSource = readFileSync(
      coreSceneTreeApiSourcePath,
      'utf8'
    )
    const sceneTreeSource = readFileSync(sceneTreeSourcePath, 'utf8')

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
      expect(coreSceneTreeApiSource).not.toContain(forbiddenToken)
      expect(sceneTreeSource).not.toContain(forbiddenToken)
    }
  })

  it('matches the stroke parameter coverage matrix for this step', () => {
    assertStrokeParameterCoverageForStep('scene-tree-commit')
  })
})
