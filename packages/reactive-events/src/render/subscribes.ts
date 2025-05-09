import { Subscription } from 'rxjs'
import { filter, throttleTime } from 'rxjs/operators'
import type {
  FinishRequestViewportPosition,
  FinishRequestViewportScale,
  InitRenderEvent,
  PanToEvent,
  RequestRenderZoomEvent,
  RequestViewportPosition,
  RequestViewportScale,
  ZoomFitEvent,
  ZoomToCenterEvent
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

export const subscribeToPanTo = (
  subscriber: (event: PanToEvent) => void
): Subscription => {
  return getEventBusObserve()
    .pipe(
      filter((event): event is PanToEvent => event.type === EventTypes.PAN_TO)
    )
    .subscribe(subscriber)
}

export const subscribeToZoomToCenter = (
  subscriber: (event: ZoomToCenterEvent) => void
): Subscription => {
  return getEventBusObserve()
    .pipe(
      filter(
        (event): event is ZoomToCenterEvent =>
          event.type === EventTypes.ZOOM_TO_CENTER
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

export const subscribeToRequestViewportPosition = (
  subscriber: (event: RequestViewportPosition) => void
): Subscription => {
  return getEventBusObserve()
    .pipe(
      filter(
        (event): event is RequestViewportPosition =>
          event.type === EventTypes.REQUEST_VIEWPORT_POSITION
      )
    )
    .subscribe(subscriber)
}

export const subscribeToFinishRequestViewportPosition = (
  subscriber: (event: FinishRequestViewportPosition) => void
): Subscription => {
  return getEventBusObserve()
    .pipe(
      filter(
        (event): event is FinishRequestViewportPosition =>
          event.type === EventTypes.FINISH_REQUEST_VIEWPORT_POSITION
      )
    )
    .subscribe(subscriber)
}

export const subscribeToRequestViewportScale = (
  subscriber: (event: RequestViewportScale) => void
): Subscription => {
  return getEventBusObserve()
    .pipe(
      filter(
        (event): event is RequestViewportScale =>
          event.type === EventTypes.REQUEST_VIEWPORT_SCALE
      )
    )
    .subscribe(subscriber)
}

export const subscribeToFinishRequestViewportScale = (
  subscriber: (event: FinishRequestViewportScale) => void
): Subscription => {
  return getEventBusObserve()
    .pipe(
      filter(
        (event): event is FinishRequestViewportScale =>
          event.type === EventTypes.FINISH_REQUEST_VIEWPORT_SCALE
      )
    )
    .subscribe(subscriber)
}
