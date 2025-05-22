import { SystemContextSnapshot } from '@asra/utils'
import { publishEvent } from '../event-bus'
import { EventTypes } from '../types'

export const decideAction = (systemContextSnapshot: SystemContextSnapshot) => {
  publishEvent({
    type: EventTypes.DECIDE_ACTION,
    payload: {
      systemContextSnapshot
    }
  })
}
