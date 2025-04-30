import { Application, Container, Graphics } from 'pixi.js'
import { DataTypes, MouseEventData } from '@asra/utils'
import { RenderElementData, RenderContainerData } from './types'
import { ViewportLayer } from './viewport-layer'

class Render {
  app: Application | null = null
  viewport: ViewportLayer

  constructor() {
    this.viewport = new ViewportLayer()
  }

  async init(width: number, height: number, backgroundColor: number) {
    const app = new Application()

    await app.init({
      width,
      height,
      backgroundColor,
      resolution: Math.min(window.devicePixelRatio, 2),
      resizeTo: window,
      antialias: true,
      autoDensity: true
    })

    this.app = app
    this.app.stage.eventMode = 'static'

    this._setupStageLayers()

    return this.app
  }

  private _setupStageLayers() {
    this.app?.stage.addChild(this.viewport.view)
  }

  updateSelectedSelection() {
    this.viewport.updateSelectedSelection()
  }

  switchWorkspace(workspaceData: RenderContainerData) {
    this.viewport.switchWorkspace(workspaceData)
  }

  addContainer(containerData: RenderContainerData) {
    return this.viewport.addContainer(containerData)
  }

  addElement(data: RenderElementData) {
    return this.viewport.addElement(data)
  }

  removeElement(elementId: string, parentId?: string) {
    return this.viewport.removeElement(elementId, parentId)
  }

  updateElement(
    elementId: string,
    key: string,
    before: DataTypes,
    after: DataTypes
  ) {
    this.viewport.updateElement(elementId, key, before, after)
  }

  updateElementProperties(
    element: Container | Graphics,
    key: string,
    after: DataTypes
  ) {
    this.viewport.updateElementProperties(element, key, after)
  }

  zoomFit(uiBounds: DOMRect) {
    this.viewport.zoomFit(uiBounds)
  }

  /**
   * Move the canvas to the specified position
   * @param x - The x-coordinate to move the canvas to
   * @param y - The y-coordinate to move the canvas to
   * @returns void
   */
  panTo(x: number, y: number) {
    this.viewport.panTo(x, y)
  }

  /**
   * Set the canvas zoom level
   * @param scale - The zoom scale factor. A value of 1.0 represents 100% zoom.
   *               Values greater than 1.0 zoom in, values less than 1.0 zoom out.
   * @returns void
   */
  zoomTo(scale: number) {
    this.viewport.zoomTo(scale)
  }

  /**
   * Set the canvas zoom level centered on a specific point
   * @param scale - The zoom scale factor
   * @param centerX - The x-coordinate of the zoom center
   * @param centerY - The y-coordinate of the zoom center
   * @returns void
   */
  zoomToCenter(scale: number, centerX: number, centerY: number) {
    this.viewport.zoomToCenter(scale, centerX, centerY)
  }

  getPosition() {
    return this.viewport.getPosition()
  }

  getScale() {
    return this.viewport.getScale()
  }

  getMousePosInWorkspace(mousePos: MouseEventData) {
    return this.viewport.getMousePosInWorkspace(mousePos)
  }
}

const render = new Render()

export default render
export { Render }
