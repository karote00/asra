import type { FederatedPointerEvent } from 'pixi.js'

export type InteractionHandler = (
  elementId: string,
  event: FederatedPointerEvent
) => void

export interface InteractionRegistration {
  eventType:
    | 'pointerdown'
    | 'pointerup'
    | 'pointermove'
    | 'click'
    | 'dblclick'
    | 'pointerenter'
    | 'pointerleave'
  handler: InteractionHandler
  priority?: number
}
