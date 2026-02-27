import { Subscription } from 'rxjs'
import { generateRequestId } from '@asyra/utils'
import { FinishRequestCurrentPrimaryToolEvent } from './events'
import { publishEvent } from '../../event-bus'
import { subscribeToFinishRequestCurrentPrimaryTool } from './subscribes'
import { EventTypes } from '../../types'

export const requestCurrentPrimaryTool = () => {
  return new Promise<string>((resolve) => {
    const requestId = generateRequestId()
    let subscription: Subscription | null = null

    const handler = ({ payload }: FinishRequestCurrentPrimaryToolEvent) => {
      // Do nothing if the requestId is different
      if (payload.requestId !== requestId) {
        return
      }

      subscription?.unsubscribe()
      resolve(payload.tool)
    }

    subscription = subscribeToFinishRequestCurrentPrimaryTool(handler)

    publishEvent({
      type: EventTypes.REQUEST_CURRENT_PRIMARY_TOOL,
      payload: {
        requestId
      }
    })
  })
}

export const finishRequestCurrentPrimaryTool = (
  requestId: string,
  tool: string
) => {
  publishEvent({
    type: EventTypes.FINISH_REQUEST_CURRENT_PRIMARY_TOOL,
    payload: {
      requestId,
      tool
    }
  })
}
