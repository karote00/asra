import { publishEvent } from '../event-bus'
import { EventTypes } from '../types'
import type { EVENT_OPTIONS } from '@asyra/utils'

export const selectElements = (
  elementIds: string[],
  options?: EVENT_OPTIONS
) => {
  publishEvent({
    type: EventTypes.SELECT_ELEMENTS,
    payload: {
      after: elementIds
    },
    options
  })
}
