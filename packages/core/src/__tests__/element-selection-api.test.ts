import { describe, expect, it, vi } from 'vitest'
import {
  EventTypes,
  subscribeToUpdateTransaction
} from '@asyra/reactive-events'
import { SharedDataChannelNames } from '@asyra/utils'
import { BaseSelection } from '@asyra/selection'
import { createElementSelectionAPIs } from '../apis/element-selection'

describe('createElementSelectionAPIs.selectElements', () => {
  const channels = {
    element: 'element',
    vectorPoint: 'vectorPoint',
    vectorSegment: 'vectorSegment'
  } as const

  const createSelectionDeps = () => {
    const selections = new Map<string, BaseSelection>([
      [
        channels.element,
        new BaseSelection({
          selectionType: channels.element,
          selectAction: 'selectElements',
          eventName: 'selectElements'
        })
      ],
      [
        channels.vectorPoint,
        new BaseSelection({
          selectionType: channels.vectorPoint,
          selectAction: 'selectVectorPoints',
          eventName: 'selectVectorPoints'
        })
      ],
      [
        channels.vectorSegment,
        new BaseSelection({
          selectionType: channels.vectorSegment,
          selectAction: 'selectVectorSegments',
          eventName: 'selectVectorSegments'
        })
      ]
    ])
    return {
      get: (type: string) => selections.get(type),
      getChannelByAction: (action: string) => {
        if (action === 'selectElements') return channels.element
        if (action === 'selectVectorPoints') return channels.vectorPoint
        if (action === 'selectVectorSegments') return channels.vectorSegment
        return undefined
      }
    }
  }

  it('propagates options to selection events', () => {
    const apis = createElementSelectionAPIs(createSelectionDeps())
    const subscriber = vi.fn()
    const subscription = subscribeToUpdateTransaction(subscriber)

    subscriber.mockClear()
    apis.selectElements(['element-1'], { undoable: false })

    expect(subscriber).toHaveBeenCalledTimes(1)
    expect(subscriber).toHaveBeenCalledWith({
      type: EventTypes.UPDATE_TRANSACTION,
      eventName: 'selectElements',
      payload: expect.objectContaining({
        selectionType: channels.element,
        action: 'selectElements',
        eventName: 'selectElements',
        after: ['element-1']
      }),
      options: {
        undoable: false,
        shared: SharedDataChannelNames.SELECTION
      }
    })

    subscription.unsubscribe()
  })

  it('publishes vector-point selection events with options', () => {
    const apis = createElementSelectionAPIs(createSelectionDeps())
    const subscriber = vi.fn()
    const subscription = subscribeToUpdateTransaction(subscriber)

    subscriber.mockClear()
    apis.selectVectorPoints(['vector-1:point-1:anchor'], { undoable: false })

    expect(subscriber).toHaveBeenCalledTimes(1)
    expect(subscriber).toHaveBeenCalledWith({
      type: EventTypes.UPDATE_TRANSACTION,
      eventName: 'selectVectorPoints',
      payload: expect.objectContaining({
        selectionType: channels.vectorPoint,
        action: 'selectVectorPoints',
        eventName: 'selectVectorPoints',
        after: ['vector-1:point-1:anchor']
      }),
      options: {
        undoable: false,
        shared: SharedDataChannelNames.SELECTION
      }
    })

    subscription.unsubscribe()
  })

  it('publishes vector-segment selection events with options', () => {
    const apis = createElementSelectionAPIs(createSelectionDeps())
    const subscriber = vi.fn()
    const subscription = subscribeToUpdateTransaction(subscriber)

    subscriber.mockClear()
    apis.selectVectorSegments(['vector-1:segment-1'], { undoable: false })

    expect(subscriber).toHaveBeenCalledTimes(1)
    expect(subscriber).toHaveBeenCalledWith({
      type: EventTypes.UPDATE_TRANSACTION,
      eventName: 'selectVectorSegments',
      payload: expect.objectContaining({
        selectionType: channels.vectorSegment,
        action: 'selectVectorSegments',
        eventName: 'selectVectorSegments',
        after: ['vector-1:segment-1']
      }),
      options: {
        undoable: false,
        shared: SharedDataChannelNames.SELECTION
      }
    })

    subscription.unsubscribe()
  })

  it('does not publish a transaction when selection ids are unchanged', () => {
    const deps = createSelectionDeps()
    const apis = createElementSelectionAPIs(deps)
    const subscriber = vi.fn()
    const subscription = subscribeToUpdateTransaction(subscriber)

    deps.get(channels.vectorPoint)?.select(['vector-1:point-1:anchor'])
    subscriber.mockClear()

    apis.selectVectorPoints(['vector-1:point-1:anchor'])

    expect(subscriber).not.toHaveBeenCalled()

    subscription.unsubscribe()
  })

  it('throws when wrapper action channel is not registered', () => {
    const apis = createElementSelectionAPIs({
      get: () => undefined,
      getChannelByAction: () => undefined
    })

    expect(() => apis.selectElements(['element-1'])).toThrow(
      'Selection channel is not registered for action "selectElements"'
    )
  })
})
