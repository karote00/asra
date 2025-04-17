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
   * Automatically fits all elements into the visible canvas area,
   * scaling and positioning them proportionally while maintaining aspect ratio.
   *
   * @param elementsBounds - The global bounding box of all elements
   * @param uiBounds - The visible UI canvas bounds
   * @param padding - The desired padding between elements and the canvas edges
   */
  fitBounds(elementsBounds: Bounds, uiBounds: Bounds, padding = 20) {
    // The available inner canvas area (excluding padding)
    const availableWidth = uiBounds.maxX - uiBounds.minX - padding * 2
    const availableHeight = uiBounds.maxY - uiBounds.minY - padding * 2

    const contentWidth = elementsBounds.maxX - elementsBounds.minX
    const contentHeight = elementsBounds.maxY - elementsBounds.minY

    // Calculate proportional zoom ratio
    const scaleX = availableWidth / contentWidth
    const scaleY = availableHeight / contentHeight

    const newZoom = Math.min(scaleX, scaleY)

    // Compute the offset to align the content to the padded area
    const offsetX = uiBounds.minX + padding - elementsBounds.minX * newZoom
    const offsetY = uiBounds.minY + padding - elementsBounds.minY * newZoom

    this.moveTo(offsetX, offsetY, newZoom)
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
