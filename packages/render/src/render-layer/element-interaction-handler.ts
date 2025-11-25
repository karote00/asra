import { Container, Graphics, FederatedPointerEvent } from 'pixi.js'
import { ElementSelectionHandlers } from '../handlers'

export class ElementInteractionHandler {
  private hasMoved = false
  private downElementId: string | null = null

  handleWorkspaceClick() {
    // Deselect all when clicking on empty space
    ElementSelectionHandlers.deselectAll()
  }

  bindElementEvents(element: Container | Graphics) {
    element.eventMode = 'static'
    element.cursor = 'pointer'

    element.on('pointerdown', (e) => this.handlePointerDown(element, e))
    element.on('pointermove', (e) => this.handlePointerMove(element, e))
    element.on('pointerup', (e) => this.handlePointerUp(element, e))
  }

  unbindElementEvents(element: Container | Graphics) {
    element.eventMode = 'none'
    element.removeAllListeners()
  }

  private handlePointerDown(
    element: Container | Graphics,
    e: FederatedPointerEvent
  ) {
    this.hasMoved = false
    this.downElementId = element.label

    // Select element on mouse down
    ElementSelectionHandlers.selectElement(element.label)
  }

  private handlePointerMove(
    element: Container | Graphics,
    e: FederatedPointerEvent
  ) {
    if (this.downElementId) {
      this.hasMoved = true
    }
  }

  private handlePointerUp(
    element: Container | Graphics,
    e: FederatedPointerEvent
  ) {
    // Reset state
    this.hasMoved = false
    this.downElementId = null
  }
}
