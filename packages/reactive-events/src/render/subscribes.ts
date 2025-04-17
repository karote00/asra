import { Subscription } from 'rxjs'
import { filter } from 'rxjs/operators'
import type {
  InitRenderEvent,
  RequestRenderZoomEvent,
  ZoomFitEvent
} from './events'
import { getEventBusObserve } from '../event-bus'
import { EventTypes } from '../types'

export const subscribeToInitRender = (
  subscriber: (event: InitRenderEvent) => void
): Subscription => {
  return getEventBusObserve()
    .pipe(
      filter(
        (event): event is InitRenderEvent =>
          event.type === EventTypes.INIT_RENDER
      )
    )
    .subscribe(subscriber)
}

export const subscribeToZoomFit = (
  subscriber: (event: ZoomFitEvent) => void
): Subscription => {
  return getEventBusObserve()
    .pipe(
      filter(
        (event): event is ZoomFitEvent => event.type === EventTypes.ZOOM_FIT
      )
    )
    .subscribe(subscriber)
}

export const subscribeToRequestRenderZoom = (
  subscriber: (event: RequestRenderZoomEvent) => void
): Subscription => {
  return getEventBusObserve()
    .pipe(
      filter(
        (event): event is RequestRenderZoomEvent =>
          event.type === EventTypes.REQUEST_RENDER_ZOOM
      )
    )
    .subscribe(subscriber)
}
