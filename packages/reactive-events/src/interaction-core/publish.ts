import { SystemSnapshot } from '@asra/utils'
import { publishEvent } from '../event-bus'
import { EventTypes } from '../types'

export const decideAction = (systemSnapshot: SystemSnapshot) => {
  publishEvent({
    type: EventTypes.DECIDE_ACTION,
    payload: {
      systemSnapshot
    }
  })
}
