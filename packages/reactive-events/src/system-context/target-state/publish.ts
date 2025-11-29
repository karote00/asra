import { publishEvent } from '../../event-bus'
import { EventTypes } from '../../types'

export const updateHoveredElementId = (elementId: string | null) => {
  publishEvent({
    type: EventTypes.UPDATE_HOVERED_ELEMENT_ID,
    payload: {
      elementId
    }
  })
}
