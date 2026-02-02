import { Subscription } from 'rxjs'
import { publishEvent } from '../event-bus'
import { EventTypes } from '../types'
import {
  EmitInitRenderEvent,
  FinishRequestRenderZoomEvent,
  FinishRequestViewportPositionEvent,
  FinishRequestViewportScaleEvent
} from './events'
import {
  subscribeToEmitInitRender,
  subscribeToFinishRequestRenderZoom,
  subscribeToFinishRequestViewportPosition,
  subscribeToFinishRequestViewportScale
} from './subscribes'
import { generateRequestId, PositionData } from '@asyra/utils'

export const initRender = async (
  width: number,
  height: number,
  color: number
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Promise<any>((resolve) => {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const emitInitRender = (requestId: string, newApp: any) => {
  publishEvent({
    type: EventTypes.EMIT_INIT_RENDER,
    payload: {
      app: newApp,
      requestId
    }
  })
}

// export const zoomFit = (rect: DOMRect) => {
//   publishEvent({
//     type: EventTypes.ZOOM_FIT,
//     payload: {
//       rect
//     }
//   })
// }

// export const emitZoomFit = () => {
//   publishEvent({
//     type: EventTypes.EMIT_ZOOM_FIT
//   })
// }

// export const panTo = (x: number, y: number) => {
//   publishEvent({
//     type: EventTypes.PAN_TO,
//     payload: {
//       x,
//       y
//     }
//   })
// }

// export const zoomToCenter = (
//   scale: number,
//   centerX: number,
//   centerY: number
// ) => {
//   publishEvent({
//     type: EventTypes.ZOOM_TO_CENTER,
//     payload: {
//       scale,
//       centerX,
//       centerY
//     }
//   })
// }

export const requestRenderZoom = async () => {
  return new Promise<number>((resolve) => {
    const requestId = generateRequestId()
    let subscription: Subscription | null = null

    const handler = ({ payload }: FinishRequestRenderZoomEvent) => {
      // Do nothing if the requestId is different
      if (payload.requestId !== requestId) {
        return
      }

      subscription?.unsubscribe()
      resolve(payload.zoom)
    }

    subscription = subscribeToFinishRequestRenderZoom(handler)

    publishEvent({
      type: EventTypes.REQUEST_RENDER_ZOOM,
      payload: {
        requestId
      }
    })
  })
}

export const finishRequestRenderZoom = (requestId: string, newZoom: number) => {
  publishEvent({
    type: EventTypes.FINISH_REQUEST_RENDER_ZOOM,
    payload: {
      zoom: newZoom,
      requestId
    }
  })
}

export const requestViewportPosition = async () => {
  return new Promise<PositionData>((resolve) => {
    const requestId = generateRequestId()
    let subscription: Subscription | null = null

    const handler = ({ payload }: FinishRequestViewportPositionEvent) => {
      // Do nothing if the requestId is different
      if (payload.requestId !== requestId) {
        return
      }

      subscription?.unsubscribe()
      resolve({ x: payload.x, y: payload.y })
    }

    subscription = subscribeToFinishRequestViewportPosition(handler)

    publishEvent({
      type: EventTypes.REQUEST_VIEWPORT_POSITION,
      payload: {
        requestId
      }
    })
  })
}

export const finishRequestViewportPosition = (
  requestId: string,
  position: {
    x: number
    y: number
  }
) => {
  publishEvent({
    type: EventTypes.FINISH_REQUEST_VIEWPORT_POSITION,
    payload: {
      requestId,
      ...position
    }
  })
}

export const requestViewportScale = async () => {
  return new Promise<number>((resolve) => {
    const requestId = generateRequestId()
    let subscription: Subscription | null = null

    const handler = ({ payload }: FinishRequestViewportScaleEvent) => {
      // Do nothing if the requestId is different
      if (payload.requestId !== requestId) {
        return
      }

      subscription?.unsubscribe()
      resolve(payload.scale)
    }

    subscription = subscribeToFinishRequestViewportScale(handler)

    publishEvent({
      type: EventTypes.REQUEST_VIEWPORT_SCALE,
      payload: {
        requestId
      }
    })
  })
}

export const finishRequestViewportScale = (
  requestId: string,
  scale: number
) => {
  publishEvent({
    type: EventTypes.FINISH_REQUEST_VIEWPORT_SCALE,
    payload: { requestId, scale }
  })
}
