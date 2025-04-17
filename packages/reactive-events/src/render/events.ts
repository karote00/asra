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

export interface RequestRenderZoomEvent {
  type: EventTypes
}

export interface FinishRequestRenderZoomEvent {
  type: EventTypes
  payload: {
    zoom: number
  }
}

export type RenderEvents =
  | InitRenderEvent
  | FinishInitRenderEvent
  | ZoomFitEvent
  | RequestRenderZoomEvent
  | FinishRequestRenderZoomEvent
