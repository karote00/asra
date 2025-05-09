import { filter, firstValueFrom, Subscription } from 'rxjs'
import { getEventBus, publishEvent } from '../event-bus'
import { EventTypes } from '../types'
import {
  FinishInitRenderEvent,
  FinishRequestRenderZoomEvent,
  FinishRequestViewportPosition,
  FinishRequestViewportScale
} from './events'
import {
  subscribeToFinishRequestViewportPosition,
  subscribeToFinishRequestViewportScale,
  subscribeToRequestViewportPosition
} from './subscribes'
import { generateRequestId, PositionData } from '@asra/utils'

export const initRender = async (
  width: number,
  height: number,
  color: number
) => {
  const response$ = getEventBus().pipe(
    filter(
      (event): event is FinishInitRenderEvent =>
        event.type === EventTypes.FINISH_INIT_RENDER
    )
  )

  publishEvent({
    type: EventTypes.INIT_RENDER,
    payload: {
      width,
      height,
      color
    }
  })

  const responce = await firstValueFrom(response$)
  return responce.payload.app
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const finishInitRender = (newApp: any) => {
  publishEvent({
    type: EventTypes.FINISH_INIT_RENDER,
    payload: {
      app: newApp
    }
  })
}

export const zoomFit = (rect: DOMRect) => {
  publishEvent({
    type: EventTypes.ZOOM_FIT,
    payload: {
      rect
    }
  })
}

export const panTo = (x: number, y: number) => {
  publishEvent({
    type: EventTypes.PAN_TO,
    payload: {
      x,
      y
    }
  })
}

export const zoomToCenter = (
  scale: number,
  centerX: number,
  centerY: number
) => {
  publishEvent({
    type: EventTypes.ZOOM_TO_CENTER,
    payload: {
      scale,
      centerX,
      centerY
    }
  })
}

export const requestRenderZoom = async () => {
  const response$ = getEventBus().pipe(
    filter(
      (event): event is FinishRequestRenderZoomEvent =>
        event.type === EventTypes.FINISH_REQUEST_RENDER_ZOOM
    )
  )

  publishEvent({
    type: EventTypes.REQUEST_RENDER_ZOOM
  })

  const responce = await firstValueFrom(response$)
  return responce.payload.zoom
}

export const finishRequestRenderZoom = (newZoom: number) => {
  publishEvent({
    type: EventTypes.FINISH_REQUEST_RENDER_ZOOM,
    payload: {
      zoom: newZoom
    }
  })
}

export const requestViewportPosition = async () => {
  return new Promise<PositionData>((resolve) => {
    const requestId = generateRequestId()
    let subscription: Subscription | null = null

    const handler = ({ payload }: FinishRequestViewportPosition) => {
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

    const handler = ({ payload }: FinishRequestViewportScale) => {
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
