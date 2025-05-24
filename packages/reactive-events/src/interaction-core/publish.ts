import { SystemContextSnapshot, InputSystemEvents } from '@asra/utils'
import { publishEvent } from '../event-bus'
import { EventTypes } from '../types'

export const decideAction = (
  eventName: InputSystemEvents,
  systemContextSnapshot: SystemContextSnapshot
) => {
  publishEvent({
    type: EventTypes.DECIDE_ACTION,
    payload: {
      eventName,
      systemContextSnapshot
    }
  })
}
