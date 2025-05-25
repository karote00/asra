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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    app: any
    requestId: string
  }
}

export interface ZoomFitEvent {
  type: EventTypes
  payload: {
    rect: DOMRect
  }
}

export interface EmitZoomFitEvent {
  type: EventTypes
}

export interface PanToEvent {
  type: EventTypes
  payload: {
    x: number
    y: number
  }
}

export interface ZoomToCenterEvent {
  type: EventTypes
  payload: {
    scale: number
    centerX: number
    centerY: number
  }
}

export interface RequestRenderZoomEvent {
  type: EventTypes
  payload: {
    requestId: string
  }
}

export interface FinishRequestRenderZoomEvent {
  type: EventTypes
  payload: {
    zoom: number
    requestId: string
  }
}

export interface RequestViewportPositionEvent {
  type: EventTypes
  payload: {
    requestId: string
  }
}

export interface FinishRequestViewportPositionEvent {
  type: EventTypes
  payload: {
    requestId: string
    x: number
    y: number
  }
}

export interface RequestViewportScaleEvent {
  type: EventTypes
  payload: {
    requestId: string
  }
}

export interface FinishRequestViewportScaleEvent {
  type: EventTypes
  payload: {
    requestId: string
    scale: number
  }
}

export type RenderEvents =
  | InitRenderEvent
  | EmitInitRenderEvent
  | ZoomFitEvent
  | EmitZoomFitEvent
  | PanToEvent
  | ZoomToCenterEvent
  | RequestRenderZoomEvent
  | FinishRequestRenderZoomEvent
  | RequestViewportPositionEvent
  | FinishRequestViewportPositionEvent
  | RequestViewportScaleEvent
  | FinishRequestViewportScaleEvent
