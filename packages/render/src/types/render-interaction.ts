import type {
  Bounds,
  PositionData,
  RenderInteractionCaptureMode,
  RenderPointerPayload
} from '@asyra/utils'

export type RenderInteractionTargetSpace = 'canvas' | 'workspace'

export type RenderInteractionTargetBounds = Bounds

export interface RenderInteractionTarget {
  id: string
  type: string
  zIndex?: number
  space?: RenderInteractionTargetSpace
  bounds?: RenderInteractionTargetBounds
  hitTest?: (point: PositionData) => boolean
  capture?: RenderInteractionCaptureMode
  meta?: Record<string, unknown>
}

export type RenderInteractionEventType =
  | 'pointerdown'
  | 'pointermove'
  | 'pointerup'
  | 'pointerenter'
  | 'pointerleave'

export interface RenderInteractionEvent {
  type: RenderInteractionEventType
  payload: RenderPointerPayload
}

export type RenderInteractionHandler = (event: RenderInteractionEvent) => void

export interface RenderInteractionHandlerRegistration {
  eventType: RenderInteractionEventType
  handler: RenderInteractionHandler
  priority?: number
}
