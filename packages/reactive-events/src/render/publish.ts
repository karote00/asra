import { filter, firstValueFrom } from 'rxjs'
import { getEventBus, publishEvent } from '../event-bus'
import { EventTypes } from '../types'
import { FinishInitRenderEvent, FinishRequestRenderZoomEvent } from './events'

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
