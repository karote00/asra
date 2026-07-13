import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as ReactiveEventsModule from '@asyra/reactive-events'
import type { UpdateTransactionEvent } from '@asyra/reactive-events'
import {
  SCENE_TREE_ACTIONS,
  SharedDataChannelNames,
  type SceneTreeChange,
  type ElementInstanceTypes
} from '@asyra/utils'
import { SceneTree } from '../sceneTree'

const captureUpdateTransactionEvents = () => {
  const events: UpdateTransactionEvent[] = []
  const subscription = ReactiveEventsModule.subscribeToEvents((event) => {
    if (event.type === ReactiveEventsModule.EventTypes.UPDATE_TRANSACTION) {
      events.push(event as UpdateTransactionEvent)
    }
  })
  // ReplaySubject replays last event on subscribe; reset to current test scope.
  events.length = 0

  return { events, subscription }
}

const createUpdateChange = (
  overrides: Partial<SceneTreeChange> = {}
): SceneTreeChange =>
  ({
    action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA,
    eventName: ReactiveEventsModule.EventTypes.UPDATE_COMPUTED_DATA,
    id: 'element-1',
    key: 'x',
    before: 0,
    after: 10,
    ...overrides
  }) as SceneTreeChange

describe('SceneTree transaction options', () => {
  let sceneTree: SceneTree

  beforeEach(() => {
    vi.clearAllMocks()
    sceneTree = new SceneTree()
  })

  it('batches transient computed changes before updateTransaction', () => {
    const { events, subscription } = captureUpdateTransactionEvents()
    const change = createUpdateChange({ options: { undoable: false } })
    const secondChange = createUpdateChange({
      key: 'y',
      before: 1,
      after: 20,
      options: { undoable: false }
    })
    sceneTree.addChange(change)
    sceneTree.addChange(secondChange)

    sceneTree.commitSceneTreeTransaction()

    expect(events).toEqual([
      expect.objectContaining({
        type: ReactiveEventsModule.EventTypes.UPDATE_TRANSACTION,
        eventName: change.eventName,
        payload: {
          action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_BATCH,
          eventName: ReactiveEventsModule.EventTypes.UPDATE_COMPUTED_DATA,
          id: 'element-1',
          changes: [
            {
              key: 'x',
              before: 0,
              after: 10
            },
            {
              key: 'y',
              before: 1,
              after: 20
            }
          ]
        },
        options: {
          undoable: false,
          shared: SharedDataChannelNames.SCENE_TREE
        }
      })
    ])
    subscription.unsubscribe()
  })

  it('uses commit fallback options when batching transient computed changes', () => {
    const { events, subscription } = captureUpdateTransactionEvents()
    const change = createUpdateChange()
    sceneTree.addChange(change)

    sceneTree.commitSceneTreeTransaction({ undoable: false })

    expect(events).toEqual([
      expect.objectContaining({
        type: ReactiveEventsModule.EventTypes.UPDATE_TRANSACTION,
        eventName: change.eventName,
        payload: {
          action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_BATCH,
          eventName: ReactiveEventsModule.EventTypes.UPDATE_COMPUTED_DATA,
          id: 'element-1',
          changes: [
            {
              key: 'x',
              before: 0,
              after: 10
            }
          ]
        },
        options: {
          undoable: false,
          shared: SharedDataChannelNames.SCENE_TREE
        }
      })
    ])
    subscription.unsubscribe()
  })

  it('routes computed patch changes as one shared transaction payload', () => {
    const { events, subscription } = captureUpdateTransactionEvents()
    sceneTree.addChange({
      action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_PATCH,
      eventName: ReactiveEventsModule.EventTypes.UPDATE_COMPUTED_DATA_PATCH,
      id: 'element-1',
      patch: {
        values: {
          x: {
            before: 0,
            after: 10
          }
        },
        records: {
          points: {
            set: {
              A: {
                before: { id: 'A', x: 0, y: 0 },
                after: { id: 'A', x: 10, y: 10 }
              }
            }
          }
        }
      }
    } as SceneTreeChange)

    sceneTree.commitSceneTreeTransaction({ undoable: true })

    expect(events).toEqual([
      expect.objectContaining({
        type: ReactiveEventsModule.EventTypes.UPDATE_TRANSACTION,
        eventName: ReactiveEventsModule.EventTypes.UPDATE_COMPUTED_DATA_PATCH,
        payload: {
          action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_PATCH,
          eventName: ReactiveEventsModule.EventTypes.UPDATE_COMPUTED_DATA_PATCH,
          id: 'element-1',
          patch: {
            values: {
              x: {
                before: 0,
                after: 10
              }
            },
            records: {
              points: {
                set: {
                  A: {
                    before: { id: 'A', x: 0, y: 0 },
                    after: { id: 'A', x: 10, y: 10 }
                  }
                }
              }
            }
          }
        },
        options: {
          undoable: true,
          shared: SharedDataChannelNames.SCENE_TREE
        }
      })
    ])
    subscription.unsubscribe()
  })

  it('calls updateTransaction without options when neither path provides options', () => {
    const { events, subscription } = captureUpdateTransactionEvents()
    const change = createUpdateChange()
    sceneTree.addChange(change)

    sceneTree.commitSceneTreeTransaction()

    expect(events).toEqual([
      expect.objectContaining({
        type: ReactiveEventsModule.EventTypes.UPDATE_TRANSACTION,
        eventName: change.eventName,
        payload: change,
        options: {
          shared: SharedDataChannelNames.SCENE_TREE
        }
      })
    ])
    subscription.unsubscribe()
  })

  it('passes options through updateComputedData to element level set flow', () => {
    const element = {
      get: vi.fn(() => 'element-1'),
      updateComputedData: vi.fn()
    } as unknown as ElementInstanceTypes
    sceneTree.addToMap(element)

    sceneTree.updateComputedData('element-1', 'x', 10, { undoable: false })

    expect(element.updateComputedData).toHaveBeenCalledWith('x', 10, {
      undoable: false
    })
  })

  it('patches computed keys from snapshot without reading missing setter keys', () => {
    const element = {
      get: vi.fn(() => 'element-1'),
      getAllComputedData: vi.fn(() => ({
        id: 'element-1',
        points: {}
      })),
      computed: {
        get: vi.fn(() => {
          throw new Error('Not allow to get value which is not in entity data.')
        })
      },
      updateComputedData: vi.fn()
    } as unknown as ElementInstanceTypes
    sceneTree.addToMap(element)

    expect(() =>
      sceneTree.patchComputedData('element-1', {
        values: {
          pointCoordinateSpace: 'workspace'
        }
      })
    ).not.toThrow()

    expect(element.computed.get).not.toHaveBeenCalled()
    expect(element.updateComputedData).toHaveBeenCalledWith(
      'pointCoordinateSpace',
      'workspace',
      undefined
    )
    expect(sceneTree.changes).toEqual([
      expect.objectContaining({
        action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_PATCH,
        patch: {
          values: {
            pointCoordinateSpace: {
              before: undefined,
              after: 'workspace'
            }
          }
        }
      })
    ])
  })
})
