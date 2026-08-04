import {
  RenderEngineCapabilities,
  assertRenderEngineCapabilities,
  type RenderEngine,
  type RenderEngineProvider,
  type RenderEngineObjectHandle
} from '@asyra/render-engine'
import {
  DataTypes,
  MouseData,
  emitDiagnosticCounter,
  measureBrowserDragPhase
} from '@asyra/utils'
import type { PositionData, RenderPointerPositions } from '@asyra/utils'
import { RenderElementData, RenderContainerData } from './types.js'
import { ViewportLayer } from './layers/viewport/index.js'
import { RenderLayerRegistry } from './registries/render-layer.js'
import type { RenderLayerRegistration } from './types/render-layer.js'
import RenderInteractionBridge from './interaction/interaction-bridge.js'
import RenderEngineInteractionBridge from './interaction/engine-interaction-bridge.js'
import interactionTargetRegistry from './registries/interaction-target.js'
import renderInteractionHandlerRegistry from './registries/render-interaction-handler.js'
import {
  CanvasPipelineEvidenceKinds,
  hasCanvasPipelineEvidenceSubscribers,
  isCanvasPipelineDebuggerOwned,
  publishCanvasPipelineEvidence,
  snapshotCanvasPipelineCommand,
  snapshotCanvasPipelineValue
} from './diagnostics/canvas-pipeline.js'
import type { RenderEngineCommand } from '@asyra/render-engine'
import {
  RenderContainer,
  RenderGraphics,
  type RenderNode,
  RenderObjectRuntime
} from './types/render-object.js'
import type {
  RenderInteractionTarget,
  RenderInteractionHandlerRegistration,
  RenderInteractionEventType
} from './types/render-interaction.js'
import {
  InvalidRenderEngineProviderResultError,
  MissingRenderEngineProviderError
} from './errors.js'

const isPointerSurface = (value: unknown): value is HTMLCanvasElement =>
  typeof value === 'object' &&
  value !== null &&
  'addEventListener' in value &&
  'removeEventListener' in value

export interface RenderEngineProviderOptions {
  engine?: RenderEngine
  engineProvider?: RenderEngineProvider
}

export type RenderEngineProviderCleanup = () => void

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
  private started = false
  private frameScheduled = false
  private readonly _animateHandler: () => void
  private readonly interactionBridge: RenderInteractionBridge
  private readonly engineInteractionBridge: RenderEngineInteractionBridge
  private unsubscribeEngineInteraction: (() => void) | null = null
  private engine: RenderEngine | null = null
  private providedEngine: RenderEngine | null = null
  private engineProvider: RenderEngineProvider | null = null
  private providerToken = Symbol('render-engine-provider')
  private runtime: RenderObjectRuntime | null = null
  private renderDirty = true
  private nextFrameRenderDirty = false
  private flushingFrame = false
  private updatingLayers = false
  private renderFrameId = 0
  private currentFrameHandoffCount = 0
  private readonly renderLayerRegistry = new RenderLayerRegistry()
  private readonly teardownCleanups = new Set<() => void>()
  private readonly frameCompleteSubscribers = new Set<() => void>()

  constructor(options: RenderEngineProviderOptions = {}) {
    if (options.engine && options.engineProvider) {
      throw new Error(
        'Configure either a render engine instance or provider, not both'
      )
    }
    this.providedEngine = options.engine ?? null
    this.engineProvider = options.engineProvider ?? null
    this.viewport = new ViewportLayer()
    this._animateHandler = () => {
      if (!this.frameScheduled) {
        return
      }
      this.frameScheduled = false
      this.flushFrame()
    }
    this.interactionBridge = new RenderInteractionBridge((event) =>
      this.getPointerPositions(event)
    )
    this.engineInteractionBridge = new RenderEngineInteractionBridge((handle) =>
      this.resolveEngineInteractionTarget(handle)
    )
  }

  setEngine(engine: RenderEngine): RenderEngineProviderCleanup {
    return this.replaceEngineProvider(engine, null)
  }

  setEngineProvider(
    engineProvider: RenderEngineProvider
  ): RenderEngineProviderCleanup {
    return this.replaceEngineProvider(null, engineProvider)
  }

  getEngine(): RenderEngine | null {
    return this.engine ?? this.providedEngine
  }

  start(): void {
    if (this.started) {
      console.warn('Render ticker already started')
      return
    }

    this.requireEngine()
    this.started = true
    this.renderDirty = true
    this.flushFrame()
  }

  stop(): void {
    if (!this.started) {
      return
    }

    this.started = false
    this.cancelScheduledFrame()
  }

  updateLayers(): boolean {
    return measureBrowserDragPhase('render:update-layers', () => {
      let didChange = false
      this.updatingLayers = true
      try {
        this.renderLayerRegistry.getAll().forEach((registration) => {
          if (registration.shouldUpdate && !registration.shouldUpdate()) {
            this.publishLayerEvidence(registration, 'bypassed')
            return
          }
          const updateResult = measureBrowserDragPhase(
            `render:update-layer:${registration.name}`,
            () => registration.update?.()
          )
          didChange = didChange || updateResult === true
          this.publishLayerEvidence(
            registration,
            updateResult === true ? 'changed' : 'unchanged'
          )
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
    this.scheduleFrame()
  }

  subscribeToFrameComplete(subscriber: () => void): () => void {
    this.frameCompleteSubscribers.add(subscriber)
    return () => {
      this.frameCompleteSubscribers.delete(subscriber)
    }
  }

  flushFrame(): void {
    if (!this.app || !this.runtime || this.flushingFrame) {
      return
    }

    this.cancelScheduledFrame()
    this.flushingFrame = true
    this.renderFrameId += 1
    this.currentFrameHandoffCount = 0
    this.publishFrameEvidence('start')
    emitDiagnosticCounter('render-frame-count')
    emitDiagnosticCounter('render-frame-id', this.renderFrameId)
    let frameFailed = false
    let completedFrame = false
    try {
      measureBrowserDragPhase('render:flush-frame', () => {
        const layersChanged = this.updateLayers()
        const drawsChanged = this.runtime?.flushDraws() ?? false
        if (!this.renderDirty && !layersChanged && !drawsChanged) {
          this.publishFrameEvidence('complete', 'skipped')
          completedFrame = true
          return
        }

        measureBrowserDragPhase('render:manual-app-render', () => {
          this.app?.render()
        })
        this.renderDirty = false
        this.publishFrameEvidence('complete', 'rendered')
        completedFrame = true
      })
    } catch (error) {
      frameFailed = true
      this.publishFrameEvidence('complete', 'failed')
      throw error
    } finally {
      this.flushingFrame = false
      if (this.nextFrameRenderDirty) {
        this.renderDirty = true
        this.nextFrameRenderDirty = false
      }
      if (this.renderDirty && !frameFailed) {
        this.scheduleFrame()
      }
    }
    if (completedFrame) {
      ;[...this.frameCompleteSubscribers].forEach((subscriber) => {
        try {
          subscriber()
        } catch {
          // Frame observers cannot alter an already completed Render frame.
        }
      })
    }
  }

  private scheduleFrame(): void {
    if (!this.started || !this.app || !this.runtime || this.frameScheduled) {
      return
    }

    const engine = this.requireEngine()
    this.frameScheduled = true
    try {
      engine.requestFrame(this._animateHandler)
    } catch (error) {
      this.frameScheduled = false
      throw error
    }
  }

  private cancelScheduledFrame(): void {
    if (!this.frameScheduled) {
      return
    }
    this.frameScheduled = false
    this.engine?.cancelFrame()
  }

  registerLayer(
    registration: RenderLayerRegistration,
    options?: { override?: boolean }
  ): void {
    this.renderLayerRegistry.register(registration, options)
    try {
      this.syncCustomLayers()
    } catch (error) {
      this.renderLayerRegistry.unregister(registration.name)
      try {
        this.syncCustomLayers()
      } catch {
        // Preserve the original engine-boundary failure after rollback effort.
      }
      throw error
    }
  }

  unregisterLayer(name: string): boolean {
    const didUnregister = this.renderLayerRegistry.unregister(name)
    if (didUnregister) {
      this.syncCustomLayers()
    }
    return didUnregister
  }

  registerTeardownCleanup(cleanup: () => void): () => void {
    this.teardownCleanups.add(cleanup)
    return () => {
      this.teardownCleanups.delete(cleanup)
    }
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
      this.runtime = new RenderObjectRuntime(
        engine,
        initialized.root,
        (command, node, relatedNode) =>
          this.publishEngineHandoff(command, node, relatedNode)
      )
      this.runtime.attachRoot(this.viewport.view)
      this.app = {
        canvas: initialized.surface as HTMLCanvasElement,
        instance: initialized.runtime,
        render: () => {
          const command = { type: 'flush' } as const
          this.publishEngineHandoff(command)
          engine.execute(command)
        }
      }
      this.syncCustomLayers()
      this.unsubscribeEngineInteraction = engine.subscribeToInteraction(
        (event) => this.engineInteractionBridge.handle(event)
      )
      if (isPointerSurface(initialized.inputTarget)) {
        this.interactionBridge.attach(initialized.inputTarget)
      }
      return this.app
    } catch (error) {
      this.interactionBridge.detach()
      this.unsubscribeEngineInteraction?.()
      this.unsubscribeEngineInteraction = null
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
    const registrations = this.renderLayerRegistry.getAll()
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

  getProjectedElementCount(): number {
    return this.viewport.getProjectedElementCount()
  }

  addContainer(containerData: RenderContainerData) {
    this.publishElementEvidence('add', containerData.label, () => containerData)
    const container = this.viewport.addContainer(containerData)
    this.requestRender()
    return container
  }

  addElement(data: RenderElementData, siblingIndex?: number) {
    if (data && typeof data.id === 'string') {
      this.publishElementEvidence('add', data.id, () => data)
    }
    const element =
      siblingIndex === undefined
        ? this.viewport.addElement(data)
        : this.viewport.addElement(data, siblingIndex)
    this.requestRender()
    return element
  }

  removeElement(elementId: string, parentId?: string) {
    this.publishElementEvidence('remove', elementId, () => ({ parentId }))
    const didRemove = this.viewport.removeElement(elementId, parentId)
    this.requestRender()
    return didRemove
  }

  projectHierarchy(parentId: string, childIds: readonly string[]) {
    this.publishElementEvidence('update', parentId, () => ({
      children: [...childIds]
    }))
    this.viewport.projectHierarchy(parentId, childIds)
    this.requestRender()
  }

  updateElement(
    elementId: string,
    key: string,
    before: DataTypes,
    after: DataTypes,
    data?: RenderElementData
  ): void {
    this.publishElementEvidence('update', elementId, () => ({
      key,
      before,
      after,
      data
    }))
    this.viewport.updateElement(elementId, key, before, after, data)
    this.requestRender()
  }

  updateElementProperties(
    element: RenderContainer | RenderGraphics,
    key: string,
    after: DataTypes
  ): void {
    this.publishElementEvidence('update', element.label, () => ({ key, after }))
    this.viewport.updateElementProperties(element, key, after)
    this.requestRender()
  }

  zoomFit(uiBounds: DOMRect): void {
    this.publishViewportEvidence('zoom-fit', () => ({
      x: uiBounds.x,
      y: uiBounds.y,
      width: uiBounds.width,
      height: uiBounds.height
    }))
    this.viewport.zoomFit(uiBounds)
    this.requestRender()
  }

  panTo(x: number, y: number): void {
    this.publishViewportEvidence('pan', () => ({ x, y }))
    this.viewport.panTo(x, y)
    this.requestRender()
  }

  zoomTo(scale: number): void {
    this.publishViewportEvidence('zoom', () => ({ scale }))
    this.viewport.zoomTo(scale)
    this.requestRender()
  }

  zoomToCenter(scale: number, centerX: number, centerY: number): void {
    this.publishViewportEvidence('zoom-center', () => ({
      scale,
      centerX,
      centerY
    }))
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

  workspaceToElementLocal(
    elementId: string,
    workspacePosition: PositionData
  ): PositionData | null {
    const element = this.viewport.getElementById(elementId)
    if (!element) {
      return null
    }
    const canvasPosition = this.viewport.view.toGlobal(workspacePosition)
    const localPosition = element.toLocal(canvasPosition)
    return Number.isFinite(localPosition.x) && Number.isFinite(localPosition.y)
      ? localPosition
      : null
  }

  elementLocalToWorkspace(
    elementId: string,
    localPosition: PositionData
  ): PositionData | null {
    const element = this.viewport.getElementById(elementId)
    if (!element) {
      return null
    }
    const canvasPosition = element.toGlobal(localPosition)
    const workspacePosition = this.viewport.view.toLocal(canvasPosition)
    return Number.isFinite(workspacePosition.x) &&
      Number.isFinite(workspacePosition.y)
      ? workspacePosition
      : null
  }

  resize(width: number, height: number): void {
    this.publishViewportEvidence('resize', () => ({ width, height }))
    const command = { type: 'resize', width, height } as const
    this.publishEngineHandoff(command)
    this.requireEngine().execute(command)
    this.requestRender()
  }

  private publishElementEvidence(
    operation: 'add' | 'update' | 'remove',
    elementId: string,
    createData: () => unknown
  ): void {
    if (!hasCanvasPipelineEvidenceSubscribers(this)) {
      return
    }
    publishCanvasPipelineEvidence(this, () => ({
      kind: CanvasPipelineEvidenceKinds.ELEMENT_INPUT,
      frameId: this.renderFrameId,
      operation,
      elementId,
      data: snapshotCanvasPipelineValue(createData())
    }))
  }

  private publishViewportEvidence(
    operation: 'pan' | 'zoom' | 'zoom-center' | 'zoom-fit' | 'resize',
    createData: () => unknown
  ): void {
    if (!hasCanvasPipelineEvidenceSubscribers(this)) {
      return
    }
    publishCanvasPipelineEvidence(this, () => ({
      kind: CanvasPipelineEvidenceKinds.VIEWPORT_INPUT,
      frameId: this.renderFrameId,
      operation,
      data: snapshotCanvasPipelineValue(createData())
    }))
  }

  private publishLayerEvidence(
    registration: RenderLayerRegistration,
    outcome: 'bypassed' | 'unchanged' | 'changed'
  ): void {
    if (
      !hasCanvasPipelineEvidenceSubscribers(this) ||
      (registration.layer instanceof RenderContainer &&
        isCanvasPipelineDebuggerOwned(registration.layer))
    ) {
      return
    }
    publishCanvasPipelineEvidence(this, () => ({
      kind: CanvasPipelineEvidenceKinds.LAYER_EVALUATION,
      frameId: this.renderFrameId,
      layerName: registration.name,
      zIndex: registration.zIndex ?? 0,
      outcome
    }))
  }

  private publishEngineHandoff(
    command: RenderEngineCommand,
    node?: RenderNode,
    relatedNode?: RenderNode
  ): void {
    if (
      !hasCanvasPipelineEvidenceSubscribers(this) ||
      isCanvasPipelineDebuggerOwned(node) ||
      isCanvasPipelineDebuggerOwned(relatedNode)
    ) {
      return
    }
    if (this.flushingFrame) {
      this.currentFrameHandoffCount += 1
    }
    publishCanvasPipelineEvidence(this, () => ({
      kind: CanvasPipelineEvidenceKinds.ENGINE_HANDOFF,
      frameId: this.renderFrameId,
      command: snapshotCanvasPipelineCommand(command, {
        elementId: node?.label || null,
        objectType: node?.objectType,
        renderRole: node === this.viewport.view ? 'viewport' : undefined,
        relatedElementId: relatedNode?.label || null,
        relatedObjectType: relatedNode?.objectType,
        projection: node
          ? {
              localBounds: node.getLocalBounds(),
              worldTransform: {
                a: node.worldTransform.a,
                b: node.worldTransform.b,
                c: node.worldTransform.c,
                d: node.worldTransform.d,
                tx: node.worldTransform.tx,
                ty: node.worldTransform.ty
              },
              viewportTransform: {
                a: this.viewport.view.worldTransform.a,
                b: this.viewport.view.worldTransform.b,
                c: this.viewport.view.worldTransform.c,
                d: this.viewport.view.worldTransform.d,
                tx: this.viewport.view.worldTransform.tx,
                ty: this.viewport.view.worldTransform.ty
              }
            }
          : undefined
      })
    }))
  }

  private publishFrameEvidence(
    phase: 'start' | 'complete',
    outcome?: 'rendered' | 'skipped' | 'failed'
  ): void {
    if (!hasCanvasPipelineEvidenceSubscribers(this)) {
      return
    }
    publishCanvasPipelineEvidence(this, () => ({
      kind: CanvasPipelineEvidenceKinds.FRAME,
      frameId: this.renderFrameId,
      phase,
      outcome,
      handoffCount: this.currentFrameHandoffCount
    }))
  }

  dispose(): void {
    let cleanupFailure: unknown
    let hasCleanupFailure = false
    this.teardownCleanups.forEach((cleanup) => {
      try {
        cleanup()
      } catch (error) {
        if (!hasCleanupFailure) {
          cleanupFailure = error
          hasCleanupFailure = true
        }
      }
    })
    if (hasCleanupFailure) {
      throw cleanupFailure
    }
    this.stop()
    this.interactionBridge.detach()
    this.unsubscribeEngineInteraction?.()
    this.unsubscribeEngineInteraction = null
    this.runtime?.detachResourceLifecycles()
    this.engine?.destroy()
    this.viewport.view.releaseRuntime()
    this.customLayerContainers.forEach((layer) => layer.releaseRuntime())
    this.attachedCustomLayers.clear()
    this.runtime = null
    this.engine = null
    this.app = null
    this.frameCompleteSubscribers.clear()
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

  private resolveEngineInteractionTarget(
    handle: RenderEngineObjectHandle | null
  ): string | null {
    let target = this.runtime?.getObject(handle) ?? null
    while (target && !target.label && target.parent) {
      target = target.parent
    }
    return target?.label || null
  }

  private resolveEngine(): RenderEngine {
    if (this.engine) {
      return this.engine
    }
    if (this.providedEngine) {
      return this.providedEngine
    }
    if (!this.engineProvider) {
      throw new MissingRenderEngineProviderError()
    }
    const engine = this.engineProvider()
    if (!engine) {
      throw new InvalidRenderEngineProviderResultError()
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

  private replaceEngineProvider(
    providedEngine: RenderEngine | null,
    engineProvider: RenderEngineProvider | null
  ): RenderEngineProviderCleanup {
    this.assertProviderMutable()
    const previousProvider = {
      providedEngine: this.providedEngine,
      engineProvider: this.engineProvider,
      token: this.providerToken
    }
    const appliedToken = Symbol('render-engine-provider')
    this.providedEngine = providedEngine
    this.engineProvider = engineProvider
    this.engine = null
    this.providerToken = appliedToken

    return () => {
      if (this.providerToken !== appliedToken) return
      this.assertProviderMutable()
      this.providedEngine = previousProvider.providedEngine
      this.engineProvider = previousProvider.engineProvider
      this.engine = null
      this.providerToken = previousProvider.token
    }
  }
}

const render = new Render()

export default render
export { Render }
