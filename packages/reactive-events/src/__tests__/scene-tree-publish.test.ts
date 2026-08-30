import { describe, expect, it, vi } from 'vitest'
import {
  subscribeToEventBatches,
  subscribeToSynchronousEvent
} from '../event-bus.js'
import * as sceneTreeEvents from '../scene-tree/index.js'
import {
  addElements,
  removeElements,
  subscribeToAddElements,
  subscribeToRemoveElements,
  subscribeToUpdateElementData,
  subscribeToUpdateComputedData,
  subscribeToUpdateComputedDataPatch,
  updateElementData,
  updateComputedData,
  updateComputedDataPatch,
  type UpdateElementDataEvent,
  type UpdateComputedDataEvent,
  type UpdateComputedDataPatchEvent
} from '../scene-tree/index.js'
import { EventTypes } from '../types.js'
import { SCENE_TREE_ACTIONS, type AddRemoveElementsChange } from '@asyra/utils'

type LocalComputedProjectionEvent =
  UpdateComputedDataEvent | UpdateComputedDataPatchEvent

type LocalComputedBatchPublishers = typeof sceneTreeEvents & {
  publishLocalComputedDataEvents(
    events: readonly LocalComputedProjectionEvent[]
  ): void
}

describe('scene-tree publishers', () => {
  it('does not expose shared computed command event types', () => {
    expect(
      Object.keys(EventTypes).filter((eventName) =>
        eventName.startsWith('CHANGE_COMPUTED_DATA')
      )
    ).toEqual([])
  })

  it('publishes one ordered canonical element batch', () => {
    const observed: AddRemoveElementsChange[] = []
    const subscription = subscribeToAddElements(({ payload }) => {
      observed.push(payload)
    })
    const change = {
      action: SCENE_TREE_ACTIONS.ADD_ELEMENTS,
      eventName: EventTypes.ADD_ELEMENTS,
      undoType: EventTypes.REMOVE_ELEMENTS,
      undoAction: SCENE_TREE_ACTIONS.REMOVE_ELEMENTS,
      entries: [
        {
          data: {
            id: 'element-1',
            type: 'vector',
            name: 'Vector 1',
            parentId: 'group-1',
            visible: true,
            lock: false,
            props: {
              position: 'position-1',
              dimension: 'dimension-1'
            }
          },
          parentId: 'group-1',
          index: 0
        }
      ]
    } satisfies AddRemoveElementsChange

    addElements(change)

    expect(observed).toEqual([change])
    subscription.unsubscribe()
  })

  it('publishes one ordered canonical element removal batch', () => {
    const observed: AddRemoveElementsChange[] = []
    const subscription = subscribeToRemoveElements(({ payload }) => {
      observed.push(payload)
    })
    const change = {
      action: SCENE_TREE_ACTIONS.REMOVE_ELEMENTS,
      eventName: EventTypes.REMOVE_ELEMENTS,
      undoType: EventTypes.ADD_ELEMENTS,
      undoAction: SCENE_TREE_ACTIONS.ADD_ELEMENTS,
      entries: [
        {
          data: {
            id: 'element-2',
            type: 'vector',
            name: 'Vector 2',
            parentId: 'group-1',
            visible: true,
            lock: false,
            props: {
              position: 'position-2',
              dimension: 'dimension-2'
            }
          },
          parentId: 'group-1',
          index: 1
        },
        {
          data: {
            id: 'element-1',
            type: 'vector',
            name: 'Vector 1',
            parentId: 'group-1',
            visible: true,
            lock: false,
            props: {
              position: 'position-1',
              dimension: 'dimension-1'
            }
          },
          parentId: 'group-1',
          index: 0
        }
      ]
    } satisfies AddRemoveElementsChange

    removeElements(change)

    expect(observed).toEqual([change])
    subscription.unsubscribe()
  })

  it('publishes canonical raw element batches on UPDATE_ELEMENT_DATA', () => {
    const observed: UpdateElementDataEvent[] = []
    const subscription = subscribeToUpdateElementData((event) => {
      observed.push(event)
    })
    observed.length = 0

    updateElementData('element-1', [
      {
        key: 'visible',
        before: true,
        after: false
      }
    ])

    expect(observed).toEqual([
      {
        type: EventTypes.UPDATE_ELEMENT_DATA,
        payload: {
          id: 'element-1',
          changes: [
            {
              key: 'visible',
              before: true,
              after: false
            }
          ]
        }
      }
    ])

    subscription.unsubscribe()
  })

  it('publishes one typed ordered local computed observer batch', () => {
    const batchObserver = vi.fn()
    const scalarObserver = vi.fn()
    const patchObserver = vi.fn()
    const batchSubscription = subscribeToEventBatches(batchObserver)
    const scalarSubscription = subscribeToUpdateComputedData(scalarObserver)
    const patchSubscription = subscribeToUpdateComputedDataPatch(patchObserver)
    batchObserver.mockClear()
    scalarObserver.mockClear()
    patchObserver.mockClear()
    const events = Object.freeze([
      Object.freeze({
        type: EventTypes.UPDATE_COMPUTED_DATA,
        payload: Object.freeze({
          id: 'element-1',
          key: 'x',
          before: 0,
          after: 120,
          owner: 'computed' as const
        })
      }),
      Object.freeze({
        type: EventTypes.UPDATE_COMPUTED_DATA_PATCH,
        payload: Object.freeze({
          id: 'element-2',
          patch: Object.freeze({
            values: Object.freeze({
              width: Object.freeze({
                before: 100,
                after: 240
              })
            })
          })
        })
      })
    ]) satisfies readonly LocalComputedProjectionEvent[]

    ;(
      sceneTreeEvents as LocalComputedBatchPublishers
    ).publishLocalComputedDataEvents(events)

    expect(batchObserver).toHaveBeenCalledOnce()
    expect(batchObserver).toHaveBeenCalledWith(events)
    expect(batchObserver.mock.calls[0]?.[0]).toBe(events)
    expect(scalarObserver).toHaveBeenCalledOnce()
    expect(scalarObserver).toHaveBeenCalledWith(events[0])
    expect(patchObserver).toHaveBeenCalledOnce()
    expect(patchObserver).toHaveBeenCalledWith(events[1])

    batchSubscription.unsubscribe()
    scalarSubscription.unsubscribe()
    patchSubscription.unsubscribe()
  })

  it('keeps scalar and patch computed projection as ordinary output', () => {
    const scalarObserved: UpdateComputedDataEvent[] = []
    const patchObserved: UpdateComputedDataPatchEvent[] = []
    const scalarSubscription = subscribeToUpdateComputedData((event) => {
      scalarObserved.push(event)
    })
    const patchSubscription = subscribeToUpdateComputedDataPatch((event) => {
      patchObserved.push(event)
    })
    const synchronousOwner = vi.fn()
    const scalarOwnerSubscription = subscribeToSynchronousEvent(
      EventTypes.UPDATE_COMPUTED_DATA,
      synchronousOwner
    )
    const patchOwnerSubscription = subscribeToSynchronousEvent(
      EventTypes.UPDATE_COMPUTED_DATA_PATCH,
      synchronousOwner
    )
    scalarObserved.length = 0
    patchObserved.length = 0

    updateComputedData('element-1', 'visible', true, false)
    updateComputedDataPatch('element-1', {
      values: {
        width: {
          before: 100,
          after: 240
        }
      }
    })

    expect(scalarObserved).toEqual([
      {
        type: EventTypes.UPDATE_COMPUTED_DATA,
        payload: {
          id: 'element-1',
          key: 'visible',
          before: true,
          after: false,
          owner: 'computed'
        }
      }
    ])
    expect(patchObserved).toEqual([
      {
        type: EventTypes.UPDATE_COMPUTED_DATA_PATCH,
        payload: {
          id: 'element-1',
          patch: {
            values: {
              width: {
                before: 100,
                after: 240
              }
            }
          }
        }
      }
    ])
    expect(synchronousOwner).not.toHaveBeenCalled()

    scalarSubscription.unsubscribe()
    patchSubscription.unsubscribe()
    scalarOwnerSubscription.unsubscribe()
    patchOwnerSubscription.unsubscribe()
  })
})
