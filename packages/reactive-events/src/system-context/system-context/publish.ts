import { Subscription } from 'rxjs'
import { generateRequestId, SystemContextSnapshot } from '@asra/utils'
import { FinishRequestSystemContextSnapshotEvent } from './events'
import { subscribeToFinishRequestSystemContextSnapshot } from './subscribes'
import { publishEvent } from '../../event-bus'
import { EventTypes } from '../../types'

export const requestSystemContextSnapshot = () => {
  return new Promise<SystemContextSnapshot>((resolve) => {
    const requestId = generateRequestId()
    let subscription: Subscription | null = null

    const handler = ({ payload }: FinishRequestSystemContextSnapshotEvent) => {
      // Do nothing if the requestId is different
      if (payload.requestId !== requestId) {
        return
      }

      subscription?.unsubscribe()
      resolve(payload.systemContextSnapshot)
    }

    subscription = subscribeToFinishRequestSystemContextSnapshot(handler)

    publishEvent({
      type: EventTypes.REQUEST_SYSTEM_CONTEXT_SNAPSHOT,
      payload: {
        requestId
      }
    })
  })
}

export const finishRequestSystemContextSnapshot = (
  requestId: string,
  systemContextSnapshot: SystemContextSnapshot
) => {
  publishEvent({
    type: EventTypes.FINISH_REQUEST_SYSTEM_CONTEXT_SNAPSHOT,
    payload: {
      requestId,
      systemContextSnapshot
    }
  })
}
