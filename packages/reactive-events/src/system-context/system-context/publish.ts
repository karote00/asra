import { Subscription } from 'rxjs'
import { generateRequestId, SystemSnapshot } from '@asra/utils'
import { FinishRequestSystemSnapshotEvent } from './events'
import { subscribeToFinishRequestSystemSnapsho } from './subscribes'
import { publishEvent } from '../../event-bus'
import { EventTypes } from '../../types'

export const requestSystemSnapshot = () => {
  return new Promise<SystemSnapshot>((resolve) => {
    const requestId = generateRequestId()
    let subscription: Subscription | null = null

    const handler = ({ payload }: FinishRequestSystemSnapshotEvent) => {
      // Do nothing if the requestId is different
      if (payload.requestId !== requestId) {
        return
      }

      subscription?.unsubscribe()
      resolve(payload.systemSnapshot)
    }

    subscription = subscribeToFinishRequestSystemSnapsho(handler)

    publishEvent({
      type: EventTypes.REQUEST_SYSTEM_SNAPSHOT,
      payload: {
        requestId
      }
    })
  })
}

export const finishRequestSystemSnapshot = (
  requestId: string,
  systemSnapshot: SystemSnapshot
) => {
  publishEvent({
    type: EventTypes.FINISH_REQUEST_SYSTEM_SNAPSHOT,
    payload: {
      requestId,
      systemSnapshot
    }
  })
}
