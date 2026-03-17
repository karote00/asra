import { Application, Container, Graphics, Ticker } from 'pixi.js'
import { DataTypes, MouseData } from '@asyra/utils'
import type { RenderPointerPositions } from '@asyra/utils'
import { RenderElementData, RenderContainerData } from './types'
import { ViewportLayer } from './layers/viewport'
import renderLayerRegistry from './registries/render-layer'
import type { RenderLayerRegistration } from './types/render-layer'
import RenderInteractionBridge from './interaction/interaction-bridge'
import interactionTargetRegistry from './registries/interaction-target'
import renderInteractionHandlerRegistry from './registries/render-interaction-handler'
import type {
  RenderInteractionTarget,
  RenderInteractionHandlerRegistration,
  RenderInteractionEventType
} from './types/render-interaction'

const ticker = Ticker.shared

class Render {
  app: Application | null = null
  viewport: ViewportLayer
  private customLayerContainers: Container[] = []
  private _tickerActive: boolean = false
  private _animateHandler: () => void
  private interactionBridge: RenderInteractionBridge

  constructor() {
    this.viewport = new ViewportLayer()

    // Don't auto-start ticker in constructor to support controlled initialization
    this._tickerActive = false
    this._animateHandler = () => {
      this.updateLayers()
    }
    this.interactionBridge = new RenderInteractionBridge(
      (event) => this.getPointerPositions(event)
    )
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
    if (this.app.canvas) {
      this.interactionBridge.attach(this.app.canvas)
    }

    return this.app
  }

  private _setupStageLayers() {
    this.app?.stage.addChild(this.viewport.view)
    this.syncCustomLayers()
  }

  private syncCustomLayers() {
    if (!this.app) {
      return
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

  getElementIdAtClientPos(clientPos: { x: number; y: number }): string | null {
    if (!this.app) {
      return null
    }

    const events = this.app.renderer.events
    if (!events || !events.rootBoundary) {
      return null
    }

    // Use Pixi's internal hit testing for precise geometry-aware detection
    // In Pixi v8, manual hit testing is done via rootBoundary.hitTest(x, y)
    const hit = events.rootBoundary.hitTest(clientPos.x, clientPos.y)

    if (hit) {
      // Traverse up to find an object with a label (elementId)
      let target: Container | null = hit as Container
      while (target && !target.label && target.parent) {
        target = target.parent as Container
      }
      return (target?.label as string) ?? null
    }

    return null
  }

  getElementById(elementId: string) {
    return this.viewport.getElementById(elementId)
  }

  dispose() {
    this.stop()
    this.customLayerContainers = []
    this.interactionBridge.detach()

    if (this.app) {
      this.app.destroy(true)
      this.app = null
    }
  }

  reset() {
    this.dispose()
    this.app = null
  }

  registerInteractionTargets(
    targets: RenderInteractionTarget | RenderInteractionTarget[],
    options?: { override?: boolean }
  ) {
    if (Array.isArray(targets)) {
      interactionTargetRegistry.registerMany(targets, options)
    } else {
      interactionTargetRegistry.register(targets, options)
    }
  }

  updateInteractionTarget(
    targetId: string,
    patch:
      | Partial<RenderInteractionTarget>
      | ((current: RenderInteractionTarget) => Partial<RenderInteractionTarget>)
  ) {
    interactionTargetRegistry.update(targetId, patch)
  }

  unregisterInteractionTarget(targetId: string) {
    return interactionTargetRegistry.unregister(targetId)
  }

  clearInteractionTargets() {
    interactionTargetRegistry.clear()
  }

  registerInteractionHandler(
    targetId: string | RegExp,
    registration: RenderInteractionHandlerRegistration
  ) {
    renderInteractionHandlerRegistry.register(targetId, registration)
  }

  unregisterInteractionHandler(
    targetId: string,
    eventType?: RenderInteractionEventType
  ) {
    renderInteractionHandlerRegistry.unregister(targetId, eventType)
  }

  private getPointerPositions(
    event: PointerEvent
  ): RenderPointerPositions | null {
    if (!this.app?.canvas) {
      return null
    }

    const client = {
      x: event.clientX,
      y: event.clientY
    }
    const bounds = this.app.canvas.getBoundingClientRect()
    const canvas = bounds
      ? { x: client.x - bounds.left, y: client.y - bounds.top }
      : client
    const workspacePoint = this.viewport.view.toLocal({
      x: canvas.x,
      y: canvas.y
    })

    return {
      client,
      canvas,
      workspace: {
        x: workspacePoint.x,
        y: workspacePoint.y
      }
    }
  }
}

const render = new Render()

export default render
export { Render }
