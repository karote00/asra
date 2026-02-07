import { Container, Graphics, FederatedPointerEvent } from 'pixi.js'
import { ElementInteractionHandlers } from '../handlers'

/**
 * Element Interaction Handler
 *
 * Binds Pixi.js pointer events to framework event system.
 * This is part of the renderer adapter layer that normalizes
 * render-engine events to framework events.
 *
 * Unlike input.* events (raw DOM events), renderer events represent
 * the render engine's feedback about the scene state.
 */
export class ElementInteractionHandler {
  bindElementEvents(element: Container | Graphics) {
    // Enable Pixi's pointer event system
    element.eventMode = 'static'
    element.cursor = 'pointer'

    // Register Pixi native pointer events
    element.on('pointerenter', (e) => this.handlePointerEnter(element, e))
    element.on('pointerleave', (e) => this.handlePointerLeave(element, e))
  }

  unbindElementEvents(element: Container | Graphics) {
    element.eventMode = 'none'
    element.removeAllListeners()
  }

  private handlePointerEnter(
    element: Container | Graphics,
    e: FederatedPointerEvent
  ) {
    const elementId = element.label as string
    if (elementId) {
      ElementInteractionHandlers.handlePointerHover(elementId)
    }
  }

  private handlePointerLeave(
    element: Container | Graphics,
    e: FederatedPointerEvent
  ) {
    const elementId = element.label as string
    if (elementId) {
      ElementInteractionHandlers.handlePointerLeave(elementId)
    }
  }
}
