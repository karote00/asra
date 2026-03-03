import { Container, Graphics } from 'pixi.js'
import { DataTypes, DEFAULT_CANVAS_PADDING, MouseData } from '@asyra/utils'
import { Bounds } from './types'
import { RenderContainerData, RenderElementData, SceneElement } from '../../types'
import { RenderLayer } from '../scene'
import { rectToBounds } from './utils'

export class ViewportLayer {
  layer: Container
  private renderLayer: RenderLayer

  constructor() {
    this.layer = new Container()
    this.renderLayer = new RenderLayer()

    this.layer.addChild(this.renderLayer.view)
  }

  get view() {
    return this.layer
  }

  getElementById(elementId: string): SceneElement | undefined {
    return this.renderLayer.getElementById(elementId)
  }

  getAllElementsBounds(): Bounds | null {
    if (this.renderLayer.getAllElements().size === 0) {
      return null
    }

    return this.renderLayer.getAllElementsBounds(this.renderLayer.view)
  }

  switchWorkspace(workspaceData: RenderContainerData) {
    this.renderLayer.switchWorkspace(workspaceData)
  }

  addContainer(containerData: RenderContainerData) {
    return this.renderLayer.addContainer(containerData)
  }

  addElement(data: RenderElementData) {
    return this.renderLayer.addElement(data)
  }

  removeElement(elementId: string, parentId?: string) {
    return this.renderLayer.removeElement(elementId, parentId)
  }

  updateElement(
    elementId: string,
    key: string,
    before: DataTypes,
    after: DataTypes,
    data?: RenderElementData
  ) {
    this.renderLayer.updateElement(elementId, key, before, after, data)
  }

  updateElementProperties(
    element: Container | Graphics,
    key: string,
    after: DataTypes
  ) {
    this.renderLayer.updateElementProperties(element, key, after)
  }

  /**
   * Zoom to fit all elements within the specified UI bounds
   * @param uiBounds - The DOMRect representing the visible canvas area
   * @returns void
   */
  zoomFit(uiBounds: DOMRect) {
    if (this.renderLayer.getAllElements().size > 0) {
      const elementsBounds = this.renderLayer.getAllElementsBounds(
        this.renderLayer.view
      )
      this.fitBounds(elementsBounds, rectToBounds(uiBounds))
    } else {
      this.panTo(
        uiBounds.x + DEFAULT_CANVAS_PADDING,
        uiBounds.y + DEFAULT_CANVAS_PADDING
      )
    }
  }

  /**
   * Set the canvas zoom level centered on a specific point
   * @param scale - The zoom scale factor
   * @param centerX - The x-coordinate of the zoom center
   * @param centerY - The y-coordinate of the zoom center
   * @returns void
   */
  zoomToCenter(scale: number, centerX: number, centerY: number) {
    const currentScale = this.getScale()
    const currentPosition = this.getPosition()

    // Calculate the position of the mouse in world coordinates
    const worldX = (centerX - currentPosition.x) / currentScale
    const worldY = (centerY - currentPosition.y) / currentScale

    // Calculate the new position after zoom
    const newX = centerX - worldX * scale
    const newY = centerY - worldY * scale

    // Apply the new scale and position
    this.zoomTo(scale)
    this.panTo(newX, newY)
  }

  /**
   * Move the canvas to the specified position
   * @param x - The x-coordinate to move the canvas to
   * @param y - The y-coordinate to move the canvas to
   * @returns void
   */
  panTo(x: number, y: number) {
    this.layer.position.set(x, y)
  }

  /**
   * Set the canvas zoom level
   * @param scale - The zoom scale factor. A value of 1.0 represents 100% zoom.
   *               Values greater than 1.0 zoom in, values less than 1.0 zoom out.
   * @returns void
   */
  zoomTo(scale: number) {
    this.layer.scale.set(scale)
  }

  /**
   * Automatically fits all elements into the visible canvas area,
   * scaling and positioning them proportionally while maintaining aspect ratio.
   *
   * @param elementsBounds - The global bounding box of all elements
   * @param uiBounds - The visible UI canvas bounds
   * @param padding - The desired padding between elements and the canvas edges
   */
  fitBounds(
    elementsBounds: Bounds,
    uiBounds: Bounds,
    padding = DEFAULT_CANVAS_PADDING
  ) {
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

    this.panTo(offsetX, offsetY)
    this.zoomTo(newZoom)
  }

  /**
   * Get the current zoom level
   */
  getScale() {
    return this.layer.scale.x
  }

  /**
   * Get the current canvas position
   */
  getPosition() {
    return this.layer.position
  }

  getMousePosInWorkspace(mousePos: MouseData) {
    return this.layer.toLocal({
      x: mousePos.clientX,
      y: mousePos.clientY
    })
  }
}
