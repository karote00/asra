import {
  RenderEngineCapabilities,
  assertRenderEngineCapabilities,
  type RenderEngine,
  type RenderEngineFactory
} from '@asyra/render-engine'
import { DataTypes, MouseData } from '@asyra/utils'
import type { RenderPointerPositions } from '@asyra/utils'
import { RenderElementData, RenderContainerData } from './types'
import { ViewportLayer } from './layers/viewport'
import renderLayerRegistry from './registries/render-layer'
import type { RenderLayerRegistration } from './types/render-layer'
import RenderInteractionBridge from './interaction/interaction-bridge'
import interactionTargetRegistry from './registries/interaction-target'
import renderInteractionHandlerRegistry from './registries/render-interaction-handler'
import {
  RenderContainer,
  RenderGraphics,
  RenderObjectRuntime
} from './types/render-object'
import type {
  RenderInteractionTarget,
  RenderInteractionHandlerRegistration,
  RenderInteractionEventType
} from './types/render-interaction'

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

const isPointerSurface = (value: unknown): value is HTMLCanvasElement =>
  typeof value === 'object' &&
  value !== null &&
  'addEventListener' in value &&
  'removeEventListener' in value

export interface RenderEngineProviderOptions {
  engine?: RenderEngine
  engineFactory?: RenderEngineFactory
}

export interface RenderApplication {
  canvas: HTMLCanvasElement | null
  instance: unknown
  render: () => void
}

class Render {
  app: RenderApplication | null = null
  viewport: ViewportLayer
  private customLayerContainers: RenderContainer[] = []
  private attachedCustomLayers = new Set<RenderContainer>()
  private _tickerActive = false
  private readonly _animateHandler: () => void
  private readonly interactionBridge: RenderInteractionBridge
  private engine: RenderEngine | null = null
  private providedEngine: RenderEngine | null = null
  private engineFactory: RenderEngineFactory | null = null
  private runtime: RenderObjectRuntime | null = null
  private renderDirty = true
  private nextFrameRenderDirty = false
  private flushingFrame = false
  private updatingLayers = false
  private renderFrameId = 0

  constructor(options: RenderEngineProviderOptions = {}) {
    if (options.engine && options.engineFactory) {
      throw new Error(
        'Configure either a render engine instance or factory, not both'
      )
    }
    this.providedEngine = options.engine ?? null
    this.engineFactory = options.engineFactory ?? null
    this.viewport = new ViewportLayer()
    this._animateHandler = () => {
      this.flushFrame()
    }
    this.interactionBridge = new RenderInteractionBridge((event) =>
      this.getPointerPositions(event)
    )
  }

  setEngine(engine: RenderEngine): void {
    this.assertProviderMutable()
    this.providedEngine = engine
    this.engineFactory = null
    this.engine = null
  }

  setEngineFactory(engineFactory: RenderEngineFactory): void {
    this.assertProviderMutable()
    this.providedEngine = null
    this.engineFactory = engineFactory
    this.engine = null
  }

  getEngine(): RenderEngine | null {
    return this.engine ?? this.providedEngine
  }

  start(): void {
    if (this._tickerActive) {
      console.warn('Render ticker already started')
      return
    }

    this.run()
    this._tickerActive = true
    this.requestRender()
    this.flushFrame()
  }

  stop(): void {
    if (!this._tickerActive) {
      return
    }

    this.engine?.stopFrameLoop()
    this._tickerActive = false
  }

  run(): void {
    const engine = this.requireEngine()
    engine.startFrameLoop(this._animateHandler)
  }

  updateLayers(): boolean {
    return measureBrowserDragPhase('render:update-layers', () => {
      let didChange = false
      this.updatingLayers = true
      try {
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
      } finally {
        this.updatingLayers = false
      }
      return didChange
    })
  }

  requestRender(): void {
    if (this.flushingFrame) {
      if (this.updatingLayers) {
        this.renderDirty = true
        return
      }
      this.nextFrameRenderDirty = true
      return
    }

    this.renderDirty = true
  }

  flushFrame(): void {
    if (!this.app || !this.runtime || this.flushingFrame) {
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
    ).__asyraStrokePipelineCounterSink?.('render-frame-count', 1)
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
        const drawsChanged = this.runtime?.flushDraws() ?? false
        if (!this.renderDirty && !layersChanged && !drawsChanged) {
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
  ): void {
    renderLayerRegistry.register(registration, options)
    this.syncCustomLayers()
  }

  unregisterLayer(name: string): boolean {
    const didUnregister = renderLayerRegistry.unregister(name)
    if (didUnregister) {
      this.syncCustomLayers()
    }
    return didUnregister
  }

  async init(
    width: number,
    height: number,
    backgroundColor: number,
    host: unknown = {}
  ): Promise<RenderApplication> {
    if (this.app) {
      throw new Error('Render adapter is already initialized')
    }
    const engine = this.resolveEngine()
    try {
      assertRenderEngineCapabilities(engine, [
        RenderEngineCapabilities.OBJECTS,
        RenderEngineCapabilities.GRAPHICS,
        RenderEngineCapabilities.INTERACTION,
        RenderEngineCapabilities.RESOURCES
      ])

      const initialized = await engine.initialize({
        host,
        width,
        height,
        backgroundColor
      })
      this.engine = engine
      this.runtime = new RenderObjectRuntime(engine, initialized.root)
      this.runtime.attachRoot(this.viewport.view)
      this.app = {
        canvas: initialized.surface as HTMLCanvasElement,
        instance: initialized.surface,
        render: () => {
          engine.execute({ type: 'flush' })
        }
      }
      this.syncCustomLayers()
      if (isPointerSurface(initialized.inputTarget)) {
        this.interactionBridge.attach(initialized.inputTarget)
      }
      return this.app
    } catch (error) {
      this.interactionBridge.detach()
      this.runtime?.detachResourceLifecycles()
      engine.destroy()
      this.viewport.view.releaseRuntime()
      this.customLayerContainers.forEach((layer) => layer.releaseRuntime())
      this.attachedCustomLayers.clear()
      this.runtime = null
      this.engine = null
      this.app = null
      throw error
    }
  }

  private syncCustomLayers(): void {
    const registrations = renderLayerRegistry.getAll()
    const nextLayers = registrations
      .map((registration) => {
        const layer = registration.layer
        if (layer instanceof RenderContainer) {
          layer.zIndex = registration.zIndex ?? 0
          return layer
        }
        return null
      })
      .filter((layer): layer is RenderContainer => layer !== null)

    if (this.runtime) {
      this.attachedCustomLayers.forEach((layer) => {
        this.runtime?.detachRoot(layer)
      })
      this.attachedCustomLayers.clear()
      nextLayers.forEach((layer) => {
        this.runtime?.attachRoot(layer)
        this.attachedCustomLayers.add(layer)
      })
    }

    this.customLayerContainers = nextLayers
    this.requestRender()
  }

  getAllElementsBounds() {
    return this.viewport.getAllElementsBounds()
  }

  switchWorkspace(workspaceData: RenderContainerData): void {
    this.viewport.switchWorkspace(workspaceData)
    this.requestRender()
  }

  clearElements(): void {
    this.viewport.clearElements()
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
  ): void {
    this.viewport.updateElement(elementId, key, before, after, data)
    this.requestRender()
  }

  updateElementProperties(
    element: RenderContainer | RenderGraphics,
    key: string,
    after: DataTypes
  ): void {
    this.viewport.updateElementProperties(element, key, after)
    this.requestRender()
  }

  zoomFit(uiBounds: DOMRect): void {
    this.viewport.zoomFit(uiBounds)
    this.requestRender()
  }

  panTo(x: number, y: number): void {
    this.viewport.panTo(x, y)
    this.requestRender()
  }

  zoomTo(scale: number): void {
    this.viewport.zoomTo(scale)
    this.requestRender()
  }

  zoomToCenter(scale: number, centerX: number, centerY: number): void {
    this.viewport.zoomToCenter(scale, centerX, centerY)
    this.requestRender()
  }

  getViewportPosition() {
    return this.viewport.getPosition()
  }

  getViewportScale(): number {
    return this.viewport.getScale()
  }

  getMousePosInWorkspace(mousePos: MouseData) {
    return this.viewport.getMousePosInWorkspace(mousePos)
  }

  getElementIdAtClientPos(clientPos: { x: number; y: number }): string | null {
    if (!this.engine || !this.runtime) {
      return null
    }
    const result = this.engine.query({ type: 'hit-test', point: clientPos })
    if (result.type !== 'hit') {
      return null
    }
    let target = this.runtime.getObject(result.target)
    while (target && !target.label && target.parent) {
      target = target.parent
    }
    return target?.label || null
  }

  getElementById(elementId: string) {
    return this.viewport.getElementById(elementId)
  }

  resize(width: number, height: number): void {
    this.requireEngine().execute({ type: 'resize', width, height })
    this.requestRender()
  }

  dispose(): void {
    this.stop()
    this.interactionBridge.detach()
    this.runtime?.detachResourceLifecycles()
    this.engine?.destroy()
    this.viewport.view.releaseRuntime()
    this.customLayerContainers.forEach((layer) => layer.releaseRuntime())
    this.attachedCustomLayers.clear()
    this.runtime = null
    this.engine = null
    this.app = null
  }

  reset(): void {
    this.dispose()
  }

  registerInteractionTargets(
    targets: RenderInteractionTarget | RenderInteractionTarget[],
    options?: { override?: boolean }
  ): void {
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
  ): void {
    interactionTargetRegistry.update(targetId, patch)
  }

  unregisterInteractionTarget(targetId: string): boolean {
    return interactionTargetRegistry.unregister(targetId)
  }

  clearInteractionTargets(): void {
    interactionTargetRegistry.clear()
  }

  registerInteractionHandler(
    targetId: string | RegExp,
    registration: RenderInteractionHandlerRegistration
  ): void {
    renderInteractionHandlerRegistry.register(targetId, registration)
  }

  unregisterInteractionHandler(
    targetId: string,
    eventType?: RenderInteractionEventType
  ): void {
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
    const surface = this.app.canvas as HTMLCanvasElement & {
      getBoundingClientRect?: () => DOMRect
    }
    const bounds = surface.getBoundingClientRect?.()
    const canvas = bounds
      ? { x: client.x - bounds.left, y: client.y - bounds.top }
      : client
    const workspacePoint = this.viewport.view.toLocal(canvas)

    return {
      client,
      canvas,
      workspace: {
        x: workspacePoint.x,
        y: workspacePoint.y
      }
    }
  }

  private resolveEngine(): RenderEngine {
    if (this.engine) {
      return this.engine
    }
    const engine = this.providedEngine ?? this.engineFactory?.()
    if (!engine) {
      throw new Error('Render engine provider is not configured')
    }
    return engine
  }

  private requireEngine(): RenderEngine {
    if (!this.engine) {
      throw new Error('Render adapter is not initialized')
    }
    return this.engine
  }

  private assertProviderMutable(): void {
    if (this.app || this.engine) {
      throw new Error(
        'Render engine provider cannot change after initialization'
      )
    }
  }
}

const render = new Render()

export default render
export { Render }
