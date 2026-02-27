import type {
  EmitInitRenderEvent,
  // EmitZoomFitEvent,
  InitRenderEvent
  // PanToEvent
  // ZoomFitEvent,
  // ZoomToCenterEvent
} from './events'
import { createSubscribeEvent } from '../event-bus'
import { EventTypes } from '../types'

export const subscribeToInitRender = createSubscribeEvent<InitRenderEvent>(
  EventTypes.INIT_RENDER
)

// export const subscribeToZoomFit = createSubscribeEvent<ZoomFitEvent>(
//   EventTypes.ZOOM_FIT
// )

// export const subscribeToEmitZoomFit = createSubscribeEvent<EmitZoomFitEvent>(
//   EventTypes.EMIT_ZOOM_FIT
// )

// export const subscribeToPanTo = createSubscribeEvent<PanToEvent>(
//   EventTypes.PAN_TO
// )

// export const subscribeToZoomToCenter = createSubscribeEvent<ZoomToCenterEvent>(
//   EventTypes.ZOOM_TO_CENTER
// )

export const subscribeToEmitInitRender =
  createSubscribeEvent<EmitInitRenderEvent>(EventTypes.EMIT_INIT_RENDER)
