import { renderPointerHover, renderPointerLeave } from '@asyra/reactive-events'

/**
 * Renderer event handlers
 *
 * These handlers publish normalized render-engine events to the framework's
 * EventBus so features remain independent of the selected engine.
 *
 * Example flow:
 * 1. The selected engine returns a normalized pointerover event and handle
 * 2. @asyra/render maps the opaque handle to an element id
 * 3. renderPointerHover publishes to EventBus
 * 4. hover-element feature subscribes and updates systemContext
 */
export const ElementInteractionHandlers = {
  handlePointerHover: (elementId: string) => {
    renderPointerHover(elementId)
  },

  handlePointerLeave: (elementId: string) => {
    renderPointerLeave(elementId)
  }
}
