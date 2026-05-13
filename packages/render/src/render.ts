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

const measureBrowserDragPhase = <T>(phaseName: string, run: () => T): T => {
  const sink = (
    globalThis as typeof globalThis & {
      __asyraBrowserDragPhaseSink?: (
        phaseName: string,
        durationMs: number
      ) => void
    }
  ).__asyraBrowserDragPhaseSink
  if (!sink) {
    return run()
  }

  const start = performance.now()
  try {
    return run()
  } finally {
    sink(phaseName, performance.now() - start)
  }
}

type RenderCallable = (...args: unknown[]) => unknown
interface InstrumentableRenderTarget {
  render?: RenderCallable
  __asyraPixiRenderInstrumented?: boolean
}

interface InstrumentablePixiApplication extends Application {
  render?: RenderCallable
  renderer?: InstrumentableRenderTarget
  __asyraPixiRenderInstrumented?: boolean
}

class Render {
  app: Application | null = null
  viewport: ViewportLayer
  private customLayerContainers: Container[] = []
  private _tickerActive: boolean = false
  private _animateHandler: () => void
  private interactionBridge: RenderInteractionBridge
  private pixiRenderInstrumentationDepth = 0
  private renderDirty = true
  private nextFrameRenderDirty = false
  private flushingFrame = false
  private renderFrameId = 0

  constructor() {
    this.viewport = new ViewportLayer()

    // Don't auto-start ticker in constructor to support controlled initialization
    this._tickerActive = false
    this._animateHandler = () => {
      this.flushFrame()
    }
    this.interactionBridge = new RenderInteractionBridge((event) =>
      this.getPointerPositions(event)
    )
  }

  start() {
    if (this._tickerActive) {
      console.warn('Render ticker already started')
      return
    }

    this.run()
    this._tickerActive = true
    this.requestRender()
    this.flushFrame()
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
    return measureBrowserDragPhase('render:update-layers', () => {
      let didChange = false
      renderLayerRegistry.getAll().forEach((registration) => {
        if (registration.shouldUpdate && !registration.shouldUpdate()) {
          return
        }
        const updateResult = measureBrowserDragPhase(
          `render:update-layer:${registration.name}`,
          () => registration.update?.()
        )
        didChange = didChange || updateResult === true
      })
      return didChange
    })
  }

  requestRender() {
    if (this.flushingFrame) {
      this.nextFrameRenderDirty = true
      return
    }

    this.renderDirty = true
  }

  flushFrame() {
    if (!this.app || this.flushingFrame) {
      return
    }

    this.flushingFrame = true
    this.renderFrameId += 1
    ;(
      globalThis as typeof globalThis & {
        __asyraStrokePipelineCounterSink?: (
          counterName: string,
          value: number
        ) => void
      }
    ).__asyraStrokePipelineCounterSink?.('render-frame-count')
    ;(
      globalThis as typeof globalThis & {
        __asyraStrokePipelineCounterSink?: (
          counterName: string,
          value: number
        ) => void
      }
    ).__asyraStrokePipelineCounterSink?.('render-frame-id', this.renderFrameId)
    try {
      measureBrowserDragPhase('render:flush-frame', () => {
        const layersChanged = this.updateLayers()
        if (!this.renderDirty && !layersChanged) {
          return
        }

        measureBrowserDragPhase('render:manual-app-render', () => {
          this.app?.render()
        })
        this.renderDirty = false
      })
    } finally {
      this.flushingFrame = false
      if (this.nextFrameRenderDirty) {
        this.renderDirty = true
        this.nextFrameRenderDirty = false
      }
    }
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
      autoDensity: true,
      autoStart: false
    })
    this.installPixiRenderInstrumentation(app)

    this.app = app
    this.app.stage.eventMode = 'static'

    this._setupStageLayers()
    if (this.app.canvas) {
      this.interactionBridge.attach(this.app.canvas)
    }

    return this.app
  }

  private installPixiRenderInstrumentation(app: Application) {
    const instrumentedApp = app as InstrumentablePixiApplication
    if (instrumentedApp.__asyraPixiRenderInstrumented) {
      return
    }

    const wrapRender = (
      target: InstrumentableRenderTarget | undefined,
      phaseName: string
    ) => {
      if (!target || typeof target.render !== 'function') {
        return
      }

      const originalRender = target.render
      target.render = (...args: unknown[]) => {
        if (this.pixiRenderInstrumentationDepth > 0) {
          return originalRender.apply(target, args)
        }

        this.pixiRenderInstrumentationDepth += 1
        try {
          return measureBrowserDragPhase(phaseName, () =>
            originalRender.apply(target, args)
          )
        } finally {
          this.pixiRenderInstrumentationDepth -= 1
        }
      }
    }

    wrapRender(instrumentedApp, 'render:pixi-app-render')
    wrapRender(instrumentedApp.renderer, 'render:pixi-renderer-render')
    instrumentedApp.__asyraPixiRenderInstrumented = true
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
    this.requestRender()
  }

  getAllElementsBounds() {
    return this.viewport.getAllElementsBounds()
  }

  switchWorkspace(workspaceData: RenderContainerData) {
    this.viewport.switchWorkspace(workspaceData)
    this.requestRender()
  }

  addContainer(containerData: RenderContainerData) {
    const container = this.viewport.addContainer(containerData)
    this.requestRender()
    return container
  }

  addElement(data: RenderElementData) {
    const element = this.viewport.addElement(data)
    this.requestRender()
    return element
  }

  removeElement(elementId: string, parentId?: string) {
    const didRemove = this.viewport.removeElement(elementId, parentId)
    this.requestRender()
    return didRemove
  }

  updateElement(
    elementId: string,
    key: string,
    before: DataTypes,
    after: DataTypes,
    data?: RenderElementData
  ) {
    this.viewport.updateElement(elementId, key, before, after, data)
    this.requestRender()
  }

  updateElementProperties(
    element: Container | Graphics,
    key: string,
    after: DataTypes
  ) {
    this.viewport.updateElementProperties(element, key, after)
    this.requestRender()
  }

  /**
   * Zoom to fit all elements within the specified UI bounds
   * @param uiBounds - The DOMRect representing the visible canvas area
   * @returns void
   */
  zoomFit(uiBounds: DOMRect) {
    this.viewport.zoomFit(uiBounds)
    this.requestRender()
  }

  /**
   * Move the canvas to the specified position
   * @param x - The x-coordinate to move the canvas to
   * @param y - The y-coordinate to move the canvas to
   * @returns void
   */
  panTo(x: number, y: number) {
    this.viewport.panTo(x, y)
    this.requestRender()
  }

  /**
   * Set the canvas zoom level
   * @param scale - The zoom scale factor. A value of 1.0 represents 100% zoom.
   *               Values greater than 1.0 zoom in, values less than 1.0 zoom out.
   * @returns void
   */
  zoomTo(scale: number) {
    this.viewport.zoomTo(scale)
    this.requestRender()
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
    this.requestRender()
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
