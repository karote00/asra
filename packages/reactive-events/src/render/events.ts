import type { EventTypes } from '../types'

export interface InitRenderEvent {
  type: EventTypes
  payload: {
    requestId: string
    width: number
    height: number
    color: number
  }
}

export interface EmitInitRenderEvent {
  type: EventTypes
  payload: {
    app: unknown
    requestId: string
  }
}

// export interface ZoomFitEvent {
//   type: EventTypes
//   payload: {
//     rect: DOMRect
//   }
// }

// export interface EmitZoomFitEvent {
//   type: EventTypes
// }

// export interface PanToEvent {
//   type: EventTypes
//   payload: {
//     x: number
//     y: number
//   }
// }

// export interface ZoomToCenterEvent {
//   type: EventTypes
//   payload: {
//     scale: number
//     centerX: number
//     centerY: number
//   }
// }

export type RenderEvents =
  | InitRenderEvent
  | EmitInitRenderEvent
  // | ZoomFitEvent
  // | EmitZoomFitEvent
  // | PanToEvent
  // | ZoomToCenterEvent
