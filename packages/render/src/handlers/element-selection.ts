import { renderPointerHover, renderPointerLeave } from '@asyra/reactive-events'

/**
 * Renderer event handlers
 *
 * These handlers bridge Pixi.js native events to the framework's EventBus.
 * They normalize render-engine events so features can subscribe without
 * knowing the underlying rendering technology.
 *
 * Example flow:
 * 1. Pixi fires pointerover on element
 * 2. ElementInteractionHandler captures it
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
