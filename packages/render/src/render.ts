import { Application, Container, Graphics, Ticker } from 'pixi.js'
import { DataTypes, MouseData } from '@asyra/utils'
import { RenderElementData, RenderContainerData, SceneElement } from './types'
import { ViewportLayer } from './layers/viewport'
import { SelectionLayer } from './layers/selection'
import renderLayerRegistry from './registries/render-layer'
import renderSelection from './stores/selection'
import type { RenderLayerRegistration } from './types/render-layer'

const ticker = Ticker.shared

class Render {
  app: Application | null = null
  viewport: ViewportLayer
  selection: SelectionLayer
  private customLayerContainers: Container[] = []
  private _tickerActive: boolean = false
  private _animateHandler: () => void

  constructor() {
    this.viewport = new ViewportLayer()
    this.selection = new SelectionLayer({
      getSelectedElements: this.getSelectedElements.bind(this),
      getHoverElement: () => null
    })

    // Don't auto-start ticker in constructor to support controlled initialization
    this._tickerActive = false
    this._animateHandler = () => {
      this.updateLayers()
    }
  }

  start() {
    if (this._tickerActive) {
      console.warn('Render ticker already started')
      return
    }

    this.run()
    this._tickerActive = true
  }

  stop() {
    if (!this._tickerActive) {
      return
    }

    ticker.remove(this._animateHandler)
    this._tickerActive = false
  }

  run() {
    ticker.add(this._animateHandler)
  }

  updateLayers() {
    renderLayerRegistry.getAll().forEach((registration) => {
      registration.update?.()
    })
    this.selection.update()
  }

  registerLayer(
    registration: RenderLayerRegistration,
    options?: { override?: boolean }
  ) {
    renderLayerRegistry.register(registration, options)
    this.syncCustomLayers()
  }

  unregisterLayer(name: string) {
    const didUnregister = renderLayerRegistry.unregister(name)
    if (didUnregister) {
      this.syncCustomLayers()
    }
    return didUnregister
  }

  private createApplication() {
    const app = new Application()

    return app
  }

  async init(width: number, height: number, backgroundColor: number) {
    const app = this.createApplication()

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
    this.syncCustomLayers()
    this.app?.stage.addChild(this.selection.view)
  }

  private syncCustomLayers() {
    if (!this.app) {
      return
    }

    const shouldRestoreSelection = this.selection.view.parent === this.app.stage
    if (shouldRestoreSelection) {
      this.app.stage.removeChild(this.selection.view)
    }

    this.customLayerContainers.forEach((layer) => {
      this.app?.stage.removeChild(layer)
    })
    this.customLayerContainers = renderLayerRegistry
      .getAll()
      .map((registration) => registration.layer)
      .filter((layer): layer is Container => layer instanceof Container)

    this.customLayerContainers.forEach((layer) => {
      this.app?.stage.addChild(layer)
    })

    if (shouldRestoreSelection) {
      this.app.stage.addChild(this.selection.view)
    }
  }

  getSelectedElements(): SceneElement[] {
    return [...renderSelection.elementSelection]
      .map((elementId) => this.viewport.getElementById(elementId))
      .filter((element): element is SceneElement => !!element)
  }

  getAllElementsBounds() {
    return this.viewport.getAllElementsBounds()
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
    after: DataTypes,
    data?: RenderElementData
  ) {
    this.viewport.updateElement(elementId, key, before, after, data)
  }

  updateElementProperties(
    element: Container | Graphics,
    key: string,
    after: DataTypes
  ) {
    this.viewport.updateElementProperties(element, key, after)
  }

  /**
   * Zoom to fit all elements within the specified UI bounds
   * @param uiBounds - The DOMRect representing the visible canvas area
   * @returns void
   */
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

  getViewportPosition() {
    return this.viewport.getPosition()
  }

  getViewportScale() {
    return this.viewport.getScale()
  }

  getMousePosInWorkspace(mousePos: MouseData) {
    return this.viewport.getMousePosInWorkspace(mousePos)
  }

  dispose() {
    this.stop()
    this.customLayerContainers = []

    if (this.app) {
      this.app.destroy(true)
      this.app = null
    }
  }

  reset() {
    this.dispose()
    this.app = null
  }
}

const render = new Render()

export default render
export { Render }
