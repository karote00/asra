import { Container, Graphics, FederatedPointerEvent } from 'pixi.js'

export class ElementInteractionHandler {
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
    console.log('pointer DOWN on', element)
    // TODO: Publish selection event here
  }

  private handlePointerMove(
    element: Container | Graphics,
    e: FederatedPointerEvent
  ) {
    console.log('pointer MOVE on', element)
  }

  private handlePointerUp(
    element: Container | Graphics,
    e: FederatedPointerEvent
  ) {
    console.log('pointer UP on', element)
  }
}
