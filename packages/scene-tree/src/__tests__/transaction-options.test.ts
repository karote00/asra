import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  EventTypes,
  subscribeToEventBatches,
  subscribeToEvents,
  type AllEvent,
  type UpdateTransactionEvent
} from '@asyra/reactive-events'
import {
  SCENE_TREE_ACTIONS,
  SharedDataChannelNames,
  type ComputedDataPatch,
  type ElementInstanceTypes,
  type ElementRawData,
  type SceneTreeChange
} from '@asyra/utils'
import { SceneTree } from '../sceneTree.js'

interface TestSubscription {
  unsubscribe(): void
}

const subscriptions: TestSubscription[] = []

const addElementFixture = (
  sceneTree: SceneTree,
  id: string,
  computedSnapshot: Record<string, unknown>,
  updateComputedData = vi.fn()
): {
  element: ElementInstanceTypes
  updateComputedData: ReturnType<typeof vi.fn>
} => {
  const element = {
    get: vi.fn((key: string) => {
      if (key === 'id') {
        return id
      }
      if (key === 'type') {
        return 'transaction-options-test'
      }
      return undefined
    }),
    getAllComputedData: vi.fn(() => computedSnapshot),
    updateComputedData,
    save: vi.fn(
      () =>
        ({
          id,
          type: 'transaction-options-test',
          name: id,
          parentId: '',
          visible: true,
          lock: false,
          props: {}
        }) as ElementRawData
    )
  } as unknown as ElementInstanceTypes
  sceneTree.addToMap(element)
  return { element, updateComputedData }
}

const captureProjectionEvidence = () => {
  const computedBatches: AllEvent[][] = []
  const transactionEvents: UpdateTransactionEvent[] = []
  subscriptions.push(
    subscribeToEventBatches((events) => {
      const computedEvents = events.filter(
        ({ type }) =>
          type === EventTypes.UPDATE_COMPUTED_DATA ||
          type === EventTypes.UPDATE_COMPUTED_DATA_PATCH
      )
      if (computedEvents.length > 0) {
        computedBatches.push(computedEvents)
      }
    }),
    subscribeToEvents((event) => {
      if (event.type === EventTypes.UPDATE_TRANSACTION) {
        transactionEvents.push(event as UpdateTransactionEvent)
      }
    })
  )
  // The event bus replays its last event to new scalar subscribers.
  transactionEvents.length = 0
  return { computedBatches, transactionEvents }
}

const expectLocalOnly = (
  sceneTree: SceneTree,
  transactionEvents: readonly UpdateTransactionEvent[]
): void => {
  expect(sceneTree.changes).toEqual([])
  expect(transactionEvents).toEqual([])
}

describe('SceneTree canonical transactions and local computed projection', () => {
  let sceneTree: SceneTree

  beforeEach(() => {
    vi.clearAllMocks()
    sceneTree = new SceneTree()
  })

  afterEach(() => {
    subscriptions.splice(0).forEach((subscription) => {
      subscription.unsubscribe()
    })
  })

  it('commits canonical raw element evidence through the shared Scene channel', () => {
    const { transactionEvents } = captureProjectionEvidence()
    const change = {
      action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_DATA,
      eventName: EventTypes.UPDATE_ELEMENT_DATA,
      id: 'element-1',
      changes: [
        {
          key: 'visible',
          before: true,
          after: false
        }
      ]
    } satisfies SceneTreeChange
    sceneTree.addChange(change)

    sceneTree.commitSceneTreeTransaction()

    expect(transactionEvents).toEqual([
      expect.objectContaining({
        type: EventTypes.UPDATE_TRANSACTION,
        eventName: EventTypes.UPDATE_ELEMENT_DATA,
        payload: change,
        options: {
          shared: SharedDataChannelNames.SCENE_TREE
        }
      })
    ])
    expect(sceneTree.changes).toEqual([])
  })

  it('publishes one ordered ordinary values batch without a shared transaction', () => {
    const first = addElementFixture(sceneTree, 'element-first', {
      x: 0,
      y: 0
    })
    const second = addElementFixture(sceneTree, 'element-second', {
      x: 10,
      y: 10
    })
    const { computedBatches, transactionEvents } = captureProjectionEvidence()

    sceneTree.updateLocalComputedData([
      {
        elementId: 'element-second',
        values: { y: 20 }
      },
      {
        elementId: 'element-first',
        values: { x: 5, y: 7 }
      }
    ])

    expect(second.updateComputedData).toHaveBeenCalledWith('y', 20)
    expect(first.updateComputedData.mock.calls).toEqual([
      ['x', 5],
      ['y', 7]
    ])
    expect(computedBatches).toEqual([
      [
        expect.objectContaining({
          type: EventTypes.UPDATE_COMPUTED_DATA,
          payload: expect.objectContaining({
            id: 'element-second',
            changes: [
              {
                owner: 'computed',
                key: 'y',
                before: 10,
                after: 20
              }
            ]
          })
        }),
        expect.objectContaining({
          type: EventTypes.UPDATE_COMPUTED_DATA,
          payload: expect.objectContaining({
            id: 'element-first',
            changes: [
              {
                owner: 'computed',
                key: 'x',
                before: 0,
                after: 5
              },
              {
                owner: 'computed',
                key: 'y',
                before: 0,
                after: 7
              }
            ]
          })
        })
      ]
    ])
    expectLocalOnly(sceneTree, transactionEvents)
  })

  it('preflights the complete patch batch before applying any prefix', () => {
    const first = addElementFixture(sceneTree, 'element-first', { x: 0 })
    const invalidSecond = addElementFixture(sceneTree, 'element-second', {})
    const { computedBatches, transactionEvents } = captureProjectionEvidence()

    expect(() =>
      sceneTree.patchLocalComputedData([
        {
          elementId: 'element-first',
          patch: { values: { x: 1 } }
        },
        {
          elementId: 'element-second',
          patch: { values: { x: 2 } }
        }
      ])
    ).toThrow('Computed data patch value base "x" must already exist')

    expect(first.updateComputedData).not.toHaveBeenCalled()
    expect(invalidSecond.updateComputedData).not.toHaveBeenCalled()
    expect(computedBatches).toEqual([])
    expectLocalOnly(sceneTree, transactionEvents)
  })

  it('rejects duplicate batch targets before applying any mutation', () => {
    const fixture = addElementFixture(sceneTree, 'element-duplicate', { x: 0 })
    const { computedBatches, transactionEvents } = captureProjectionEvidence()

    expect(() =>
      sceneTree.patchLocalComputedData([
        {
          elementId: 'element-duplicate',
          patch: { values: { x: 1 } }
        },
        {
          elementId: 'element-duplicate',
          patch: { values: { x: 2 } }
        }
      ])
    ).toThrow('Local computed patches require unique active element batches')

    expect(fixture.updateComputedData).not.toHaveBeenCalled()
    expect(computedBatches).toEqual([])
    expectLocalOnly(sceneTree, transactionEvents)
  })

  it('rejects overlapping value and record keys before mutation', () => {
    const fixture = addElementFixture(sceneTree, 'element-1', {
      points: { A: { id: 'A', x: 0, y: 0 } }
    })
    const { computedBatches, transactionEvents } = captureProjectionEvidence()

    expect(() =>
      sceneTree.patchLocalComputedData([
        {
          elementId: 'element-1',
          patch: {
            values: {
              points: { Z: { id: 'Z', x: 9, y: 9 } }
            },
            records: {
              points: {
                set: { B: { id: 'B', x: 1, y: 1 } }
              }
            }
          }
        }
      ])
    ).toThrow(
      'Computed data patch key "points" cannot be both value and record'
    )

    expect(fixture.updateComputedData).not.toHaveBeenCalled()
    expect(computedBatches).toEqual([])
    expectLocalOnly(sceneTree, transactionEvents)
  })

  it('rejects an empty-string value and record overlap before mutation', () => {
    const fixture = addElementFixture(sceneTree, 'element-1', { '': {} })
    const { transactionEvents } = captureProjectionEvidence()

    expect(() =>
      sceneTree.patchLocalComputedData([
        {
          elementId: 'element-1',
          patch: {
            values: { '': 'replacement' },
            records: { '': { set: { child: 'value' } } }
          }
        }
      ])
    ).toThrow('Computed data patch key "" cannot be both value and record')

    expect(fixture.updateComputedData).not.toHaveBeenCalled()
    expectLocalOnly(sceneTree, transactionEvents)
  })

  it.each([
    ['missing', {}],
    ['scalar', { mode: 'plain' }],
    ['array', { mode: [] }]
  ])('rejects a %s record base before mutation', (_case, snapshot) => {
    const fixture = addElementFixture(sceneTree, 'element-1', snapshot)
    const { transactionEvents } = captureProjectionEvidence()

    expect(() =>
      sceneTree.patchLocalComputedData([
        {
          elementId: 'element-1',
          patch: {
            records: { mode: { set: { child: 'value' } } }
          }
        }
      ])
    ).toThrow('Computed data patch record base "mode" must already be a record')

    expect(fixture.updateComputedData).not.toHaveBeenCalled()
    expectLocalOnly(sceneTree, transactionEvents)
  })

  it('rejects a record id present in both set and remove before mutation', () => {
    const fixture = addElementFixture(sceneTree, 'element-1', {
      points: { A: { id: 'A', x: 0, y: 0 } }
    })
    const { transactionEvents } = captureProjectionEvidence()

    expect(() =>
      sceneTree.patchLocalComputedData([
        {
          elementId: 'element-1',
          patch: {
            records: {
              points: {
                set: { A: { id: 'A', x: 1, y: 1 } },
                remove: ['A']
              }
            }
          }
        }
      ])
    ).toThrow(
      'Computed data patch record "points.A" cannot be both set and removed'
    )

    expect(fixture.updateComputedData).not.toHaveBeenCalled()
    expectLocalOnly(sceneTree, transactionEvents)
  })

  it('publishes one exact ordinary record patch while omitting no-op entries', () => {
    const keptPoint = { id: 'kept', x: 1, y: 1 }
    const replacedBefore = { id: 'replaced', x: 2, y: 2 }
    const replacedAfter = { id: 'replaced', x: 20, y: 20 }
    const removedPoint = { id: 'removed', x: 3, y: 3 }
    const addedPoint = { id: 'added', x: 4, y: 4 }
    const fixture = addElementFixture(sceneTree, 'element-1', {
      x: 10,
      points: {
        kept: keptPoint,
        replaced: replacedBefore,
        removed: removedPoint
      }
    })
    const { computedBatches, transactionEvents } = captureProjectionEvidence()

    sceneTree.patchLocalComputedData([
      {
        elementId: 'element-1',
        patch: {
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
        }
      }
    ])

    expect(fixture.updateComputedData).toHaveBeenCalledOnce()
    expect(fixture.updateComputedData).toHaveBeenCalledWith('points', {
      kept: keptPoint,
      replaced: replacedAfter,
      added: addedPoint
    })
    expect(computedBatches).toEqual([
      [
        {
          type: EventTypes.UPDATE_COMPUTED_DATA_PATCH,
          payload: {
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
        }
      ]
    ])
    expectLocalOnly(sceneTree, transactionEvents)
  })

  it('keeps no-op patches inert', () => {
    const keptPoint = { id: 'kept', x: 1, y: 1 }
    const fixture = addElementFixture(sceneTree, 'element-1', {
      x: 10,
      points: { kept: keptPoint }
    })
    const { computedBatches, transactionEvents } = captureProjectionEvidence()

    sceneTree.patchLocalComputedData([
      {
        elementId: 'element-1',
        patch: {
          values: { x: 10 },
          records: {
            points: {
              set: { kept: keptPoint },
              remove: ['missing']
            }
          }
        }
      }
    ])

    expect(fixture.updateComputedData).not.toHaveBeenCalled()
    expect(computedBatches).toEqual([])
    expectLocalOnly(sceneTree, transactionEvents)
  })

  it('preserves own-property evidence when replacing undefined', () => {
    const after = { id: 'point-1', x: 10, y: 20 }
    const fixture = addElementFixture(sceneTree, 'element-1', {
      points: { 'point-1': undefined }
    })
    const { computedBatches, transactionEvents } = captureProjectionEvidence()

    sceneTree.patchLocalComputedData([
      {
        elementId: 'element-1',
        patch: {
          records: {
            points: {
              set: { 'point-1': after }
            }
          }
        }
      }
    ])

    const replacement = (
      computedBatches[0]?.[0] as {
        payload?: {
          patch?: {
            records?: {
              points?: {
                set?: Record<string, { before?: unknown; after?: unknown }>
              }
            }
          }
        }
      }
    ).payload?.patch?.records?.points?.set?.['point-1']
    expect(replacement).toEqual({ before: undefined, after })
    expect(Object.prototype.hasOwnProperty.call(replacement, 'before')).toBe(
      true
    )
    expect(fixture.updateComputedData).toHaveBeenCalledOnce()
    expectLocalOnly(sceneTree, transactionEvents)
  })

  it('stores an absent explicit undefined record value as an own property', () => {
    const fixture = addElementFixture(sceneTree, 'element-1', { points: {} })
    const { computedBatches, transactionEvents } = captureProjectionEvidence()

    sceneTree.patchLocalComputedData([
      {
        elementId: 'element-1',
        patch: {
          records: { points: { set: { 'point-1': undefined } } }
        }
      }
    ])

    const updatedRecord = fixture.updateComputedData.mock.calls[0]?.[1] as
      | Record<string, unknown>
      | undefined
    expect(updatedRecord).toBeDefined()
    expect(Object.prototype.hasOwnProperty.call(updatedRecord, 'point-1')).toBe(
      true
    )
    expect(updatedRecord?.['point-1']).toBeUndefined()
    expect(computedBatches).toMatchObject([
      [
        {
          payload: {
            patch: {
              records: {
                points: {
                  set: { 'point-1': { after: undefined } }
                }
              }
            }
          }
        }
      ]
    ])
    expectLocalOnly(sceneTree, transactionEvents)
  })

  it('ignores removal of an inherited record id', () => {
    const fixture = addElementFixture(sceneTree, 'element-1', { points: {} })
    const { computedBatches, transactionEvents } = captureProjectionEvidence()

    sceneTree.patchLocalComputedData([
      {
        elementId: 'element-1',
        patch: {
          records: { points: { remove: ['toString'] } }
        }
      }
    ])

    expect(fixture.updateComputedData).not.toHaveBeenCalled()
    expect(computedBatches).toEqual([])
    expectLocalOnly(sceneTree, transactionEvents)
  })

  it('stores a __proto__ record id as an own property', () => {
    const after = { id: '__proto__', x: 10, y: 20 }
    const set = Object.create(null) as Record<string, typeof after>
    Object.defineProperty(set, '__proto__', {
      enumerable: true,
      value: after
    })
    const fixture = addElementFixture(sceneTree, 'element-1', { points: {} })
    const { transactionEvents } = captureProjectionEvidence()

    sceneTree.patchLocalComputedData([
      {
        elementId: 'element-1',
        patch: {
          records: { points: { set } }
        }
      }
    ])

    const updatedRecord = fixture.updateComputedData.mock.calls[0]?.[1] as
      | Record<string, unknown>
      | undefined
    expect(Object.getPrototypeOf(updatedRecord)).toBe(Object.prototype)
    expect(
      Object.prototype.hasOwnProperty.call(updatedRecord, '__proto__')
    ).toBe(true)
    expect(updatedRecord?.__proto__).toEqual(after)
    expectLocalOnly(sceneTree, transactionEvents)
  })

  it('rejects a missing top-level value base without reading setter keys', () => {
    const fixture = addElementFixture(sceneTree, 'element-1', {
      points: {}
    })
    const computedGet = vi.fn(() => {
      throw new Error('Not allowed to read a missing computed key')
    })
    Object.assign(fixture.element, {
      computed: {
        get: computedGet
      }
    })
    const { transactionEvents } = captureProjectionEvidence()

    expect(() =>
      sceneTree.patchLocalComputedData([
        {
          elementId: 'element-1',
          patch: {
            values: {
              pointCoordinateSpace: 'workspace'
            }
          }
        }
      ])
    ).toThrow(
      'Computed data patch value base "pointCoordinateSpace" must already exist'
    )

    expect(computedGet).not.toHaveBeenCalled()
    expect(fixture.updateComputedData).not.toHaveBeenCalled()
    expectLocalOnly(sceneTree, transactionEvents)
  })

  it.each(['value', 'record'] as const)(
    'preserves a special top-level %s key in one ordinary patch envelope',
    (kind) => {
      const computedSnapshot: Record<string, unknown> = { x: 0, points: {} }
      Object.defineProperty(computedSnapshot, '__proto__', {
        value: kind === 'value' ? 'before' : { existing: 'before' },
        enumerable: true,
        configurable: true,
        writable: true
      })
      const values: NonNullable<ComputedDataPatch['values']> = { x: 1 }
      const records: NonNullable<ComputedDataPatch['records']> =
        kind === 'record' ? {} : { points: { set: { added: 'after' } } }
      Object.defineProperty(kind === 'value' ? values : records, '__proto__', {
        value: kind === 'value' ? 'after' : { set: { added: 'after' } },
        enumerable: true,
        configurable: true,
        writable: true
      })
      addElementFixture(sceneTree, 'element-special', computedSnapshot)
      const { computedBatches, transactionEvents } = captureProjectionEvidence()

      sceneTree.patchLocalComputedData([
        {
          elementId: 'element-special',
          patch: { values, records }
        }
      ])

      const patch = (
        computedBatches[0]?.[0] as {
          payload?: {
            patch?: {
              values?: Record<string, unknown>
              records?: Record<string, unknown>
            }
          }
        }
      ).payload?.patch
      const specialOutput = kind === 'value' ? patch?.values : patch?.records
      expect(
        Object.prototype.hasOwnProperty.call(specialOutput, '__proto__')
      ).toBe(true)
      expect(specialOutput?.['__proto__']).toEqual(
        kind === 'value'
          ? { before: 'before', after: 'after' }
          : { set: { added: { after: 'after' } } }
      )
      expectLocalOnly(sceneTree, transactionEvents)
    }
  )
})
