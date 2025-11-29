import { Container, Graphics, FederatedPointerEvent } from 'pixi.js'
import { ElementSelectionHandlers } from '../handlers'

export class ElementInteractionHandler {
  bindElementEvents(element: Container | Graphics) {
    element.eventMode = 'static'
    element.cursor = 'pointer'

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
    ElementSelectionHandlers.updateHoveredElement(element.label)
  }

  private handlePointerLeave(
    element: Container | Graphics,
    e: FederatedPointerEvent
  ) {
    ElementSelectionHandlers.updateHoveredElement(null)
  }
}
