import { publishEvent } from '../event-bus'
import { EventTypes } from '../types'
import { PositionData, DimensionData } from '@asra/utils'

export const switchInputSystemWatchedElement = (
  watchedElement: HTMLElement
) => {
  publishEvent({
    type: EventTypes.SWITCH_INPUT_SYSTEM_WATCHED_ELEMENT,
    payload: {
      watchedElement
    }
  })
}
