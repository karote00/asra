import { describe, expect, it, vi } from 'vitest'
import {
  EventTypes,
  subscribeToAddElement,
  subscribeToChangeComputedData,
  subscribeToChangeComputedDataBatch
} from '@asyra/reactive-events'
import { createSceneTreeAPIs, type SceneTreeRequests } from '../apis/scene-tree'

const createRequests = (): SceneTreeRequests => ({
  sceneTreeSaveData: () => ({ workspace: '', workspaceList: [], elements: {} }),
  getElementComputedData: vi.fn(() => undefined),
  moveElements: vi.fn(() => ({ elementIds: [], moves: [] })),
  removeSubtree: vi.fn((elementId: string) => ({
    elementId,
    removed: [],
    rootParentChildrenAfter: []
  })),
  preflightRestoreSubtree: vi.fn(),
  applyRestoreSubtree: vi.fn(),
  refreshComputedDataFromProperty: () => undefined,
  getAllElementsBounds: () => null,
  isContainerType: () => false
})

describe('createSceneTreeAPIs hierarchy facade', () => {
  it('publishes ID-based element creation with the exact parent slot and options', () => {
    const apis = createSceneTreeAPIs(createRequests())
    const subscriber = vi.fn()
    const subscription = subscribeToAddElement(subscriber)

    subscriber.mockClear()
    const elementId = apis.createElementInParent(
      {
        id: 'group-1',
        type: 'group',
        x: 10,
        y: 20
      },
      'workspace-1',
      2,
      { shared: 'sceneTree' }
    )

    expect(elementId).toBe('group-1')
    expect(subscriber).toHaveBeenCalledTimes(1)
    expect(subscriber).toHaveBeenCalledWith({
      type: EventTypes.ADD_ELEMENT,
      payload: {
        data: expect.objectContaining({
          id: 'group-1',
          type: 'group',
          x: 10,
          y: 20
        }),
        parentId: 'workspace-1',
        index: 2
      },
      options: { shared: 'sceneTree' }
    })

    subscription.unsubscribe()
  })

  it('returns a detached computed-data snapshot through the ID facade', () => {
    const source = {
      x: 10,
      y: 20,
      fills: [{ color: '#ffffff' }]
    }
    const requests = createRequests()
    vi.mocked(requests.getElementComputedData).mockReturnValue(source)
    const apis = createSceneTreeAPIs(requests)

    const snapshot = apis.getElementComputedData('element-1')

    expect(requests.getElementComputedData).toHaveBeenCalledWith('element-1')
    expect(snapshot).toEqual(source)
    expect(snapshot).not.toBe(source)
    expect(snapshot?.fills).not.toBe(source.fills)
  })

  it('delegates ID-based move requests and options to the supplied Scene Tree owner', () => {
    const requests = createRequests()
    const apis = createSceneTreeAPIs(requests)
    const request = {
      elementIds: ['element-2', 'element-1'],
      targetParentId: 'group-1',
      targetIndex: 0
    }
    const options = { undoable: false as const }

    apis.moveElements(request, options)

    expect(requests.moveElements).toHaveBeenCalledWith(request, options)
  })

  it('delegates subtree removal by id to the supplied Scene Tree owner', () => {
    const requests = createRequests()
    const apis = createSceneTreeAPIs(requests)

    apis.removeSubtree('group-1', { rollbackable: false })

    expect(requests.removeSubtree).toHaveBeenCalledWith('group-1', {
      rollbackable: false
    })
  })
})

describe('createSceneTreeAPIs.changeComputedData', () => {
  it('does nothing when data is empty', () => {
    const apis = createSceneTreeAPIs(createRequests())
    const subscriber = vi.fn()
    const subscription = subscribeToChangeComputedData(subscriber)

    subscriber.mockClear()
    apis.changeComputedData(['element-1'], {})

    expect(subscriber).not.toHaveBeenCalled()
    subscription.unsubscribe()
  })

  it('batches transient computed data changes with undoable=false', () => {
    const apis = createSceneTreeAPIs(createRequests())
    const singleSubscriber = vi.fn()
    const batchSubscriber = vi.fn()
    const singleSubscription = subscribeToChangeComputedData(singleSubscriber)
    const batchSubscription =
      subscribeToChangeComputedDataBatch(batchSubscriber)

    singleSubscriber.mockClear()
    batchSubscriber.mockClear()
    apis.changeComputedData(
      ['element-1'],
      {
        x: 120,
        y: 240
      },
      { undoable: false }
    )

    expect(singleSubscriber).not.toHaveBeenCalled()
    expect(batchSubscriber).toHaveBeenCalledTimes(1)
    expect(batchSubscriber).toHaveBeenCalledWith({
      type: EventTypes.CHANGE_COMPUTED_DATA_BATCH,
      payload: {
        elementIds: ['element-1'],
        data: {
          x: 120,
          y: 240
        }
      },
      options: {
        undoable: false
      }
    })

    singleSubscription.unsubscribe()
    batchSubscription.unsubscribe()
  })

  it('keeps default undoable=true behavior when options are omitted', () => {
    const apis = createSceneTreeAPIs(createRequests())
    const subscriber = vi.fn()
    const subscription = subscribeToChangeComputedData(subscriber)

    subscriber.mockClear()
    apis.changeComputedData(['element-1'], { width: 320 })

    expect(subscriber).toHaveBeenCalledTimes(1)
    expect(subscriber).toHaveBeenCalledWith({
      type: EventTypes.CHANGE_COMPUTED_DATA,
      payload: {
        elementIds: ['element-1'],
        key: 'width',
        data: 320
      },
      options: {
        undoable: true
      }
    })

    subscription.unsubscribe()
  })
})

describe('createSceneTreeAPIs.createElement', () => {
  it('propagates options to addElement events', () => {
    const apis = createSceneTreeAPIs(createRequests())
    const subscriber = vi.fn()
    const subscription = subscribeToAddElement(subscriber)

    subscriber.mockClear()
    apis.createElement(
      {
        id: 'element-1',
        type: 'rect',
        x: 10,
        y: 20
      },
      undefined,
      undefined,
      { undoable: false }
    )

    expect(subscriber).toHaveBeenCalledTimes(1)
    expect(subscriber).toHaveBeenCalledWith({
      type: EventTypes.ADD_ELEMENT,
      payload: {
        data: expect.objectContaining({
          id: 'element-1',
          type: 'rect',
          x: 10,
          y: 20
        }),
        parent: undefined,
        index: undefined
      },
      options: { undoable: false }
    })

    subscription.unsubscribe()
  })
})
