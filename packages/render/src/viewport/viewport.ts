import { Container } from 'pixi.js'
import { Bounds } from './types'

export class Viewport {
  constructor(private container: Container) {}

  switchContainer(container: Container) {
    this.container = container
  }

  /**
   * Move the canvas to the specified position
   */
  panTo(x: number, y: number) {
    this.container.position.set(x, y)
  }

  /**
   * Set the canvas zoom level
   */
  zoomTo(scale: number) {
    this.container.scale.set(scale)
  }

  /**
   * Move and zoom the canvas at the same time
   */
  moveTo(x: number, y: number, scale: number) {
    this.panTo(x, y)
    this.zoomTo(scale)
  }

  /**
   * Fit all elements into the visible area
   */
  fitBounds(target: Bounds, visible: Bounds, padding = 20) {
    const targetWidth = target.maxX - target.minX
    const targetHeight = target.maxY - target.minY

    const visibleWidth = visible.maxX - visible.minX - padding * 2
    const visibleHeight = visible.maxY - visible.minY - padding * 2

    const targetCenterX = (target.minX + target.maxX) / 2
    const targetCenterY = (target.minY + target.maxY) / 2

    let scale = 1
    const scaleX = visibleWidth / targetWidth
    const scaleY = visibleHeight / targetHeight
    let moveBackX = 0
    let moveBackY = 0
    if (scaleX > scaleY) {
      scale = scaleY
      moveBackX = targetCenterX * 2
    } else {
      scale = scaleX
      moveBackY = targetCenterY * 2
    }

    const visibleCenterX = (visible.minX + visible.maxX) / 2
    const visibleCenterY = (visible.minY + visible.maxY) / 2

    // Move the target to (0, 0) before calculating the final offset
    const offsetX = visibleCenterX - targetCenterX * scale - moveBackX
    const offsetY = visibleCenterY - targetCenterY * scale - moveBackY

    this.moveTo(offsetX, offsetY, scale)
  }

  /**
   * Get the current zoom level
   */
  getScale() {
    return this.container.scale.x
  }

  /**
   * Get the current canvas position
   */
  getPosition() {
    return this.container.position
  }
}
