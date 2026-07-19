import { describe, expect, it } from 'vitest'
import {
  subscribeToUpdateComputedData,
  updateComputedData,
  type UpdateComputedDataEvent
} from '../scene-tree'
import { EventTypes } from '../types'

describe('scene-tree publishers', () => {
  it('publishes computed replay requests with explicit owner provenance', () => {
    const observed: UpdateComputedDataEvent[] = []
    const subscription = subscribeToUpdateComputedData((event) => {
      observed.push(event)
    })
    observed.length = 0

    updateComputedData('element-1', 'visible', true, false)

    expect(observed).toEqual([
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

    subscription.unsubscribe()
  })
})
