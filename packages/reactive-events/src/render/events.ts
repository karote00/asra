import type { EventTypes } from '../types.js'

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

export type RenderEvents = InitRenderEvent | EmitInitRenderEvent
