import { Subscription } from 'rxjs'
import { generateRequestId, PrimaryToolType } from '@asra/utils'
import { FinishRequestCurrentPrimaryToolEvent } from './events'
import { subscribeToFinishRequestCurrentPrimaryTool } from './subscribes'
import { publishEvent } from '../../event-bus'
import { EventTypes } from '../../types'

export const switchPrimaryTool = (tool: PrimaryToolType) => {
  publishEvent({
    type: EventTypes.SWITCH_PRIMARY_TOOL,
    payload: {
      tool
    }
  })
}

export const emitSwitchPrimaryTool = () => {
  publishEvent({
    type: EventTypes.EMIT_SWITCH_PRIMARY_TOOL
  })
}

export const requestCurrentPrimaryTool = () => {
  return new Promise<PrimaryToolType>((resolve) => {
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
  tool: PrimaryToolType
) => {
  publishEvent({
    type: EventTypes.FINISH_REQUEST_CURRENT_PRIMARY_TOOL,
    payload: {
      requestId,
      tool
    }
  })
}
