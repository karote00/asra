import { Subscription } from 'rxjs'
import { publishEvent } from '../event-bus.js'
import { EventTypes } from '../types.js'
import { EmitInitRenderEvent } from './events.js'
import { subscribeToEmitInitRender } from './subscribes.js'
import { generateRequestId } from '@asyra/utils'

export const initRender = async (
  width: number,
  height: number,
  color: number
): Promise<unknown> => {
  return new Promise<unknown>((resolve) => {
    const requestId = generateRequestId()
    let subscription: Subscription | null = null

    const handler = ({ payload }: EmitInitRenderEvent) => {
      // Do nothing if the requestId is different
      if (payload.requestId !== requestId) {
        return
      }

      subscription?.unsubscribe()
      resolve(payload.app)
    }

    subscription = subscribeToEmitInitRender(handler)

    publishEvent({
      type: EventTypes.INIT_RENDER,
      payload: {
        requestId,
        width,
        height,
        color
      }
    })
  })
}

export const emitInitRender = (requestId: string, newApp: unknown) => {
  publishEvent({
    type: EventTypes.EMIT_INIT_RENDER,
    payload: {
      app: newApp,
      requestId
    }
  })
}
