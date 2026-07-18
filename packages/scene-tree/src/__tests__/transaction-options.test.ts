import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as ReactiveEventsModule from '@asyra/reactive-events'
import type { UpdateTransactionEvent } from '@asyra/reactive-events'
import {
  SCENE_TREE_ACTIONS,
  SharedDataChannelNames,
  type SceneTreeChange,
  type ElementInstanceTypes,
  type UpdateElementPatchChange
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

  it('preserves each canonical owner in a mixed transient batch', () => {
    const { events, subscription } = captureUpdateTransactionEvents()
    sceneTree.addChange({
      ...createUpdateChange({
        key: 'visible',
        before: true,
        after: false,
        options: { undoable: false }
      }),
      owner: 'raw'
    } as SceneTreeChange)
    sceneTree.addChange({
      ...createUpdateChange({
        key: 'visible',
        before: true,
        after: false,
        options: { undoable: false }
      }),
      owner: 'computed'
    } as SceneTreeChange)

    sceneTree.commitSceneTreeTransaction()

    expect(events).toHaveLength(1)
    expect(events[0].payload).toMatchObject({
      action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_BATCH,
      changes: [
        {
          owner: 'raw',
          key: 'visible',
          before: true,
          after: false
        },
        {
          owner: 'computed',
          key: 'visible',
          before: true,
          after: false
        }
      ]
    })
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

  it('partitions transient batches and preserves effective delivery options', () => {
    const { events, subscription } = captureUpdateTransactionEvents()
    sceneTree.addChange(
      createUpdateChange({
        options: {
          undoable: false,
          rollbackable: false,
          shared: 'custom-scene',
          sharedDelivery: 'transaction-end'
        }
      })
    )
    sceneTree.addChange(
      createUpdateChange({
        key: 'y',
        before: 1,
        after: 20,
        options: {
          undoable: false,
          rollbackable: true,
          shared: SharedDataChannelNames.SCENE_TREE,
          sharedDelivery: 'immediate'
        }
      })
    )

    sceneTree.commitSceneTreeTransaction()

    expect(events).toHaveLength(2)
    expect(events[0]).toMatchObject({
      payload: {
        id: 'element-1',
        changes: [{ key: 'x', before: 0, after: 10 }]
      },
      options: {
        undoable: false,
        rollbackable: false,
        shared: 'custom-scene',
        sharedDelivery: 'transaction-end'
      }
    })
    expect(events[1]).toMatchObject({
      payload: {
        id: 'element-1',
        changes: [{ key: 'y', before: 1, after: 20 }]
      },
      options: {
        undoable: false,
        rollbackable: true,
        shared: SharedDataChannelNames.SCENE_TREE,
        sharedDelivery: 'immediate'
      }
    })

    subscription.unsubscribe()
  })

  it('preserves write order when a transient update precedes an ordinary update', () => {
    const { events, subscription } = captureUpdateTransactionEvents()
    sceneTree.addChange(
      createUpdateChange({
        before: 0,
        after: 10,
        options: { undoable: false }
      })
    )
    sceneTree.addChange(
      createUpdateChange({
        before: 10,
        after: 20
      })
    )

    sceneTree.commitSceneTreeTransaction()

    const state: Record<string, unknown> = { x: 20 }
    ;[...events].reverse().forEach((event) => {
      const payload = event.payload as {
        key?: string
        before?: unknown
        changes?: { key: string; before: unknown }[]
      }
      if (payload.changes) {
        ;[...payload.changes].reverse().forEach((change) => {
          state[change.key] = change.before
        })
        return
      }
      if (payload.key) {
        state[payload.key] = payload.before
      }
    })

    expect(events.map((event) => event.payload)).toEqual([
      expect.objectContaining({
        action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_BATCH,
        changes: [{ key: 'x', before: 0, after: 10 }]
      }),
      expect.objectContaining({
        action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA,
        key: 'x',
        before: 10,
        after: 20
      })
    ])
    expect(state.x).toBe(0)

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

  it('rejects overlapping value and record patch keys before mutation', () => {
    const element = {
      get: vi.fn(() => 'element-1'),
      getAllComputedData: vi.fn(() => ({
        points: { A: { id: 'A', x: 0, y: 0 } }
      })),
      updateComputedData: vi.fn()
    } as unknown as ElementInstanceTypes
    sceneTree.addToMap(element)

    expect(() =>
      sceneTree.patchComputedData('element-1', {
        values: {
          points: { Z: { id: 'Z', x: 9, y: 9 } }
        },
        records: {
          points: {
            set: { B: { id: 'B', x: 1, y: 1 } }
          }
        }
      })
    ).toThrow(
      'Computed data patch key "points" cannot be both value and record'
    )
    expect(element.updateComputedData).not.toHaveBeenCalled()
    expect(sceneTree.changes).toEqual([])
  })

  it('rejects an empty-string value and record overlap before mutation', () => {
    const element = {
      get: vi.fn(() => 'element-1'),
      getAllComputedData: vi.fn(() => ({ '': {} })),
      updateComputedData: vi.fn()
    } as unknown as ElementInstanceTypes
    sceneTree.addToMap(element)

    expect(() =>
      sceneTree.patchComputedData('element-1', {
        values: { '': 'replacement' },
        records: { '': { set: { child: 'value' } } }
      })
    ).toThrow('Computed data patch key "" cannot be both value and record')
    expect(element.updateComputedData).not.toHaveBeenCalled()
    expect(sceneTree.changes).toEqual([])
  })

  it.each([
    ['missing', {}],
    ['scalar', { mode: 'plain' }],
    ['array', { mode: [] }]
  ])(
    'rejects a %s record base before canonical mutation',
    (_case, snapshot) => {
      const element = {
        get: vi.fn(() => 'element-1'),
        getAllComputedData: vi.fn(() => snapshot),
        updateComputedData: vi.fn()
      } as unknown as ElementInstanceTypes
      sceneTree.addToMap(element)

      expect(() =>
        sceneTree.patchComputedData('element-1', {
          records: { mode: { set: { child: 'value' } } }
        })
      ).toThrow(
        'Computed data patch record base "mode" must already be a record'
      )
      expect(element.updateComputedData).not.toHaveBeenCalled()
      expect(sceneTree.changes).toEqual([])
    }
  )

  it('rejects a record id present in both set and remove before mutation', () => {
    const element = {
      get: vi.fn(() => 'element-1'),
      getAllComputedData: vi.fn(() => ({
        points: { A: { id: 'A', x: 0, y: 0 } }
      })),
      updateComputedData: vi.fn()
    } as unknown as ElementInstanceTypes
    sceneTree.addToMap(element)

    expect(() =>
      sceneTree.patchComputedData('element-1', {
        records: {
          points: {
            set: { A: { id: 'A', x: 1, y: 1 } },
            remove: ['A']
          }
        }
      })
    ).toThrow(
      'Computed data patch record "points.A" cannot be both set and removed'
    )
    expect(element.updateComputedData).not.toHaveBeenCalled()
    expect(sceneTree.changes).toEqual([])
  })

  it('commits one exact record patch while omitting equal and missing entries', () => {
    const { events, subscription } = captureUpdateTransactionEvents()
    const keptPoint = { id: 'kept', x: 1, y: 1 }
    const replacedBefore = { id: 'replaced', x: 2, y: 2 }
    const replacedAfter = { id: 'replaced', x: 20, y: 20 }
    const removedPoint = { id: 'removed', x: 3, y: 3 }
    const addedPoint = { id: 'added', x: 4, y: 4 }
    const element = {
      get: vi.fn(() => 'element-1'),
      getAllComputedData: vi.fn(() => ({
        id: 'element-1',
        x: 10,
        points: {
          kept: keptPoint,
          replaced: replacedBefore,
          removed: removedPoint
        }
      })),
      updateComputedData: vi.fn()
    } as unknown as ElementInstanceTypes
    sceneTree.addToMap(element)

    sceneTree.patchComputedData('element-1', {
      values: { x: 10 },
      records: {
        points: {
          set: {
            kept: keptPoint,
            replaced: replacedAfter,
            added: addedPoint
          },
          remove: ['removed', 'missing']
        }
      }
    })

    expect(element.updateComputedData).toHaveBeenCalledTimes(1)
    expect(element.updateComputedData).toHaveBeenCalledWith(
      'points',
      {
        kept: keptPoint,
        replaced: replacedAfter,
        added: addedPoint
      },
      undefined
    )
    expect(sceneTree.changes).toEqual([
      {
        action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_PATCH,
        eventName: ReactiveEventsModule.EventTypes.UPDATE_COMPUTED_DATA_PATCH,
        id: 'element-1',
        patch: {
          records: {
            points: {
              set: {
                replaced: {
                  before: replacedBefore,
                  after: replacedAfter
                },
                added: { after: addedPoint }
              },
              remove: {
                removed: { before: removedPoint }
              }
            }
          }
        }
      }
    ])

    sceneTree.commitSceneTreeTransaction({ undoable: false })

    expect(events).toEqual([
      expect.objectContaining({
        type: ReactiveEventsModule.EventTypes.UPDATE_TRANSACTION,
        eventName: ReactiveEventsModule.EventTypes.UPDATE_COMPUTED_DATA_PATCH,
        payload: {
          action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_PATCH,
          eventName: ReactiveEventsModule.EventTypes.UPDATE_COMPUTED_DATA_PATCH,
          id: 'element-1',
          patch: {
            records: {
              points: {
                set: {
                  replaced: {
                    before: replacedBefore,
                    after: replacedAfter
                  },
                  added: { after: addedPoint }
                },
                remove: {
                  removed: { before: removedPoint }
                }
              }
            }
          }
        },
        options: {
          undoable: false,
          shared: SharedDataChannelNames.SCENE_TREE
        }
      })
    ])
    subscription.unsubscribe()
  })

  it('preserves own-property existence when replacing an undefined record value', () => {
    const after = { id: 'point-1', x: 10, y: 20 }
    const element = {
      get: vi.fn(() => 'element-1'),
      getAllComputedData: vi.fn(() => ({
        points: { 'point-1': undefined }
      })),
      updateComputedData: vi.fn()
    } as unknown as ElementInstanceTypes
    sceneTree.addToMap(element)

    sceneTree.patchComputedData('element-1', {
      records: {
        points: {
          set: { 'point-1': after }
        }
      }
    })

    const change = sceneTree.changes[0]
    expect(change.action).toBe(
      SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_PATCH
    )
    if (
      change.action !== SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_PATCH
    ) {
      throw new Error('Expected one computed data patch change')
    }
    const replacement = (change as UpdateElementPatchChange).patch.records
      ?.points.set?.['point-1']
    expect(replacement).toEqual({ before: undefined, after })
    expect(Object.prototype.hasOwnProperty.call(replacement, 'before')).toBe(
      true
    )
  })

  it('commits an absent record id whose explicit value is undefined', () => {
    const updateComputedData = vi.fn()
    const element = {
      get: vi.fn(() => 'element-1'),
      getAllComputedData: vi.fn(() => ({ points: {} })),
      updateComputedData
    } as unknown as ElementInstanceTypes
    sceneTree.addToMap(element)

    sceneTree.patchComputedData('element-1', {
      records: { points: { set: { 'point-1': undefined } } }
    })

    expect(element.updateComputedData).toHaveBeenCalledTimes(1)
    const updatedRecord = updateComputedData.mock.calls[0]?.[1] as
      | Record<string, unknown>
      | undefined
    expect(updatedRecord).toBeDefined()
    expect(Object.prototype.hasOwnProperty.call(updatedRecord, 'point-1')).toBe(
      true
    )
    expect(updatedRecord?.['point-1']).toBeUndefined()
    expect(sceneTree.changes).toMatchObject([
      {
        patch: {
          records: {
            points: {
              set: { 'point-1': { after: undefined } }
            }
          }
        }
      }
    ])
  })

  it('ignores removal of an inherited record id', () => {
    const element = {
      get: vi.fn(() => 'element-1'),
      getAllComputedData: vi.fn(() => ({ points: {} })),
      updateComputedData: vi.fn()
    } as unknown as ElementInstanceTypes
    sceneTree.addToMap(element)

    sceneTree.patchComputedData('element-1', {
      records: { points: { remove: ['toString'] } }
    })

    expect(element.updateComputedData).not.toHaveBeenCalled()
    expect(sceneTree.changes).toEqual([])
  })

  it('stores a __proto__ record id as an own property', () => {
    const after = { id: '__proto__', x: 10, y: 20 }
    const set = Object.create(null) as Record<string, typeof after>
    Object.defineProperty(set, '__proto__', {
      enumerable: true,
      value: after
    })
    const updateComputedData = vi.fn()
    const element = {
      get: vi.fn(() => 'element-1'),
      getAllComputedData: vi.fn(() => ({ points: {} })),
      updateComputedData
    } as unknown as ElementInstanceTypes
    sceneTree.addToMap(element)

    sceneTree.patchComputedData('element-1', {
      records: { points: { set } }
    })

    const updatedRecord = updateComputedData.mock.calls[0]?.[1] as
      | Record<string, unknown>
      | undefined
    expect(Object.getPrototypeOf(updatedRecord)).toBe(Object.prototype)
    expect(
      Object.prototype.hasOwnProperty.call(updatedRecord, '__proto__')
    ).toBe(true)
    expect(updatedRecord?.__proto__).toBe(after)
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

  it('rejects a missing top-level value base without reading setter keys', () => {
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
    ).toThrow(
      'Computed data patch value base "pointCoordinateSpace" must already exist'
    )

    expect(element.computed.get).not.toHaveBeenCalled()
    expect(element.updateComputedData).not.toHaveBeenCalled()
    expect(sceneTree.changes).toEqual([])
  })
})
