import { publishEvent } from '../event-bus'
import { EventTypes } from '../types'

export const selectElements = (elementIds: string[]) => {
  publishEvent({
    type: EventTypes.SELECT_ELEMENTS,
    payload: {
      after: elementIds
    }
  })
}
