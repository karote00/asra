import { publishEvent } from '../event-bus.js'
import { EventTypes } from '../types.js'

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
