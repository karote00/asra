import { describe, expect, it, vi } from 'vitest'
import {
  EventTypes,
  subscribeToSelectElements
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
})
