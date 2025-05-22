import { publishEvent } from '../event-bus'
import { EventTypes } from '../types'

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
