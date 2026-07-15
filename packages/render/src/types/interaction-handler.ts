import type { RenderEngineInteractionEvent } from '@asyra/render-engine'

export type InteractionHandler = (
  elementId: string,
  event: RenderEngineInteractionEvent
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
