import { describe, expect, it, vi } from 'vitest'
import {
  EventTypes,
  subscribeToSelectElements,
  subscribeToSelectVectorPoints,
  subscribeToSelectVectorSegments
} from '@asyra/reactive-events'
import { createElementSelectionAPIs } from '../apis/element-selection'

describe('createElementSelectionAPIs.selectElements', () => {
  it('propagates options to selection events', () => {
    const apis = createElementSelectionAPIs()
    const subscriber = vi.fn()
    const subscription = subscribeToSelectElements(subscriber)

    subscriber.mockClear()
    apis.selectElements(['element-1'], { undoable: false })

    expect(subscriber).toHaveBeenCalledTimes(1)
    expect(subscriber).toHaveBeenCalledWith({
      type: EventTypes.SELECT_ELEMENTS,
      payload: {
        after: ['element-1']
      },
      options: {
        undoable: false
      }
    })

    subscription.unsubscribe()
  })

  it('publishes vector-point selection events with options', () => {
    const apis = createElementSelectionAPIs()
    const subscriber = vi.fn()
    const subscription = subscribeToSelectVectorPoints(subscriber)

    subscriber.mockClear()
    apis.selectVectorPoints(['vector-1:point-1:anchor'], { undoable: false })

    expect(subscriber).toHaveBeenCalledTimes(1)
    expect(subscriber).toHaveBeenCalledWith({
      type: EventTypes.SELECT_VECTOR_POINTS,
      payload: {
        after: ['vector-1:point-1:anchor']
      },
      options: {
        undoable: false
      }
    })

    subscription.unsubscribe()
  })

  it('publishes vector-segment selection events with options', () => {
    const apis = createElementSelectionAPIs()
    const subscriber = vi.fn()
    const subscription = subscribeToSelectVectorSegments(subscriber)

    subscriber.mockClear()
    apis.selectVectorSegments(['vector-1:segment-1'], { undoable: false })

    expect(subscriber).toHaveBeenCalledTimes(1)
    expect(subscriber).toHaveBeenCalledWith({
      type: EventTypes.SELECT_VECTOR_SEGMENTS,
      payload: {
        after: ['vector-1:segment-1']
      },
      options: {
        undoable: false
      }
    })

    subscription.unsubscribe()
  })
})
