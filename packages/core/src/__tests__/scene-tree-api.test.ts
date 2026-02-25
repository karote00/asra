import { describe, expect, it, vi } from 'vitest'
import {
  EventTypes,
  subscribeToAddElement,
  subscribeToChangeComputedData
} from '@asyra/reactive-events'
import { createSceneTreeAPIs, type SceneTreeRequests } from '../apis/scene-tree'

const createRequests = (): SceneTreeRequests => ({
  sceneTreeSaveData: () => ({ workspace: '', workspaceList: [], elements: {} }),
  getAllElementsBounds: () => null,
  isContainerType: () => false
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

  it('propagates undoable=false options to each published change event', () => {
    const apis = createSceneTreeAPIs(createRequests())
    const subscriber = vi.fn()
    const subscription = subscribeToChangeComputedData(subscriber)

    subscriber.mockClear()
    apis.changeComputedData(
      ['element-1'],
      {
        x: 120,
        y: 240
      },
      { undoable: false }
    )

    expect(subscriber).toHaveBeenCalledTimes(2)
    expect(subscriber).toHaveBeenNthCalledWith(1, {
      type: EventTypes.CHANGE_COMPUTED_DATA,
      payload: {
        elementIds: ['element-1'],
        key: 'x',
        data: 120
      },
      options: {
        undoable: false
      }
    })
    expect(subscriber).toHaveBeenNthCalledWith(2, {
      type: EventTypes.CHANGE_COMPUTED_DATA,
      payload: {
        elementIds: ['element-1'],
        key: 'y',
        data: 240
      },
      options: {
        undoable: false
      }
    })

    subscription.unsubscribe()
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
