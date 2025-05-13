import type { EventTypes } from '../types'

export interface InitRenderEvent {
  type: EventTypes
  payload: {
    width: number
    height: number
    color: number
  }
}

export interface FinishInitRenderEvent {
  type: EventTypes
  payload: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    app: any
  }
}

export interface ZoomFitEvent {
  type: EventTypes
  payload: {
    rect: DOMRect
  }
}

export interface FinishZoomFitEvent {
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
}

export interface FinishRequestRenderZoomEvent {
  type: EventTypes
  payload: {
    zoom: number
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
  | FinishInitRenderEvent
  | ZoomFitEvent
  | PanToEvent
  | ZoomToCenterEvent
  | RequestRenderZoomEvent
  | FinishRequestRenderZoomEvent
  | RequestViewportPositionEvent
  | FinishRequestViewportPositionEvent
  | RequestViewportScaleEvent
  | FinishRequestViewportScaleEvent
