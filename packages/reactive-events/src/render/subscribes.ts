import type {
  EmitInitRenderEvent,
  EmitZoomFitEvent,
  FinishRequestRenderZoomEvent,
  FinishRequestViewportPositionEvent,
  FinishRequestViewportScaleEvent,
  InitRenderEvent,
  PanToEvent,
  RequestRenderZoomEvent,
  RequestViewportPositionEvent,
  RequestViewportScaleEvent,
  ZoomFitEvent,
  ZoomToCenterEvent
} from './events'
import { createSubscribeEvent } from '../event-bus'
import { EventTypes } from '../types'

export const subscribeToInitRender = createSubscribeEvent<InitRenderEvent>(
  EventTypes.INIT_RENDER
)

export const subscribeToEmitInitRender =
  createSubscribeEvent<EmitInitRenderEvent>(EventTypes.EMIT_INIT_RENDER)

export const subscribeToZoomFit = createSubscribeEvent<ZoomFitEvent>(
  EventTypes.ZOOM_FIT
)

export const subscribeToEmitZoomFit = createSubscribeEvent<EmitZoomFitEvent>(
  EventTypes.EMIT_ZOOM_FIT
)

export const subscribeToPanTo = createSubscribeEvent<PanToEvent>(
  EventTypes.PAN_TO
)

export const subscribeToZoomToCenter = createSubscribeEvent<ZoomToCenterEvent>(
  EventTypes.ZOOM_TO_CENTER
)

export const subscribeToRequestRenderZoom =
  createSubscribeEvent<RequestRenderZoomEvent>(EventTypes.REQUEST_RENDER_ZOOM)

export const subscribeToFinishRequestRenderZoom =
  createSubscribeEvent<FinishRequestRenderZoomEvent>(
    EventTypes.FINISH_REQUEST_RENDER_ZOOM
  )

export const subscribeToRequestViewportPosition =
  createSubscribeEvent<RequestViewportPositionEvent>(
    EventTypes.REQUEST_VIEWPORT_POSITION
  )

export const subscribeToFinishRequestViewportPosition =
  createSubscribeEvent<FinishRequestViewportPositionEvent>(
    EventTypes.FINISH_REQUEST_VIEWPORT_POSITION
  )

export const subscribeToRequestViewportScale =
  createSubscribeEvent<RequestViewportScaleEvent>(
    EventTypes.REQUEST_VIEWPORT_SCALE
  )

export const subscribeToFinishRequestViewportScale =
  createSubscribeEvent<FinishRequestViewportScaleEvent>(
    EventTypes.FINISH_REQUEST_VIEWPORT_SCALE
  )
