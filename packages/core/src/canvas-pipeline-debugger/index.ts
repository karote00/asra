import {
  CanvasPipelineDebuggerDisposedError,
  createCanvasPipelineDebuggerAdapter,
  createCanvasPipelineDebuggerOverlay,
  type CanvasPipelineDebuggerAdapter,
  type CanvasPipelineDebuggerOverlay,
  type CanvasPipelineSnapshot,
  type CanvasPipelineTraceEntry
} from '@asyra/render/canvas-pipeline-debugger'
import type { Core } from '../core'

export interface CanvasPipelineDebuggerOptions {
  enabled?: boolean
  traceCapacity?: number
  overlay?: Readonly<{
    visible?: boolean
    focusedElementIds?: readonly string[]
  }>
}

export interface CanvasPipelineDebugger {
  enable(): void
  disable(): void
  isEnabled(): boolean
  setOverlayVisible(visible: boolean): void
  setFocusedElementIds(ids: readonly string[]): void
  getSnapshot(): CanvasPipelineSnapshot
  getTrace(): readonly CanvasPipelineTraceEntry[]
  clearTrace(): void
  dispose(): void
}

export class CanvasPipelineDebuggerAlreadyActiveError extends Error {
  readonly code = 'CANVAS_PIPELINE_DEBUGGER_ALREADY_ACTIVE'

  constructor() {
    super('A Canvas Pipeline Debugger already owns this Render instance')
    this.name = 'CanvasPipelineDebuggerAlreadyActiveError'
  }
}

const activeSessions = new WeakMap<object, CanvasPipelineDebuggerController>()

class CanvasPipelineDebuggerController implements CanvasPipelineDebugger {
  private readonly adapter: CanvasPipelineDebuggerAdapter
  private overlay: CanvasPipelineDebuggerOverlay | null = null
  private overlayVisible: boolean
  private enabled = false
  private disposed = false
  private faultCleanupQueued = false
  private faultCleanupGeneration = 0

  constructor(
    private readonly core: Core,
    private readonly render: Core['deps']['render'],
    options: CanvasPipelineDebuggerOptions
  ) {
    this.overlayVisible = options.overlay?.visible ?? true
    this.adapter = createCanvasPipelineDebuggerAdapter(render, {
      traceCapacity: options.traceCapacity,
      focusedElementIds: options.overlay?.focusedElementIds,
      onFault: () => this.handleFault()
    })
  }

  enable(): void {
    this.assertUsable()
    if (this.faultCleanupQueued) {
      this.invalidatePendingFaultCleanup()
      this.disableActiveSession()
    }
    if (this.enabled) {
      return
    }
    this.adapter.enableObservation()
    this.enabled = true
    try {
      if (this.overlayVisible) {
        this.registerOverlay()
      }
    } catch (error) {
      this.adapter.disableObservation()
      this.enabled = false
      throw error
    }
  }

  disable(): void {
    this.assertUsable()
    this.invalidatePendingFaultCleanup()
    this.disableActiveSession()
  }

  isEnabled(): boolean {
    this.assertUsable()
    return this.enabled
  }

  setOverlayVisible(visible: boolean): void {
    this.assertUsable()
    if (this.overlayVisible === visible) {
      return
    }
    if (!this.enabled) {
      this.overlayVisible = visible
      return
    }
    if (visible) {
      this.registerOverlay()
      this.overlayVisible = true
    } else {
      this.overlayVisible = false
      this.unregisterOverlay()
    }
  }

  setFocusedElementIds(ids: readonly string[]): void {
    this.assertUsable()
    this.adapter.setFocusedElementIds(ids)
    if (this.enabled && this.overlayVisible) {
      this.render.requestRender()
    }
  }

  getSnapshot(): CanvasPipelineSnapshot {
    this.assertUsable()
    return this.adapter.getSnapshot()
  }

  getTrace(): readonly CanvasPipelineTraceEntry[] {
    this.assertUsable()
    return this.adapter.getTrace()
  }

  clearTrace(): void {
    this.assertUsable()
    this.adapter.clearTrace()
  }

  dispose(): void {
    if (this.disposed) {
      return
    }
    this.invalidatePendingFaultCleanup()
    const failures: unknown[] = []
    try {
      this.disableActiveSession()
    } catch (error) {
      failures.push(error)
    }
    try {
      this.adapter.dispose()
    } catch (error) {
      failures.push(error)
    }
    activeSessions.delete(this.render)
    this.disposed = true
    if (failures.length > 0) {
      throw failures[0]
    }
  }

  private registerOverlay(): void {
    if (this.overlay) {
      return
    }
    const overlay = createCanvasPipelineDebuggerOverlay(this.adapter, {
      onFault: (error) => this.handleFault(error)
    })
    try {
      this.core.registerRenderLayer(overlay.registration)
      this.overlay = overlay
    } catch (error) {
      try {
        overlay.destroy()
      } catch {
        // Preserve the registration failure after best-effort local cleanup.
      }
      throw error
    }
  }

  private unregisterOverlay(): void {
    if (!this.overlay) {
      return
    }
    const overlay = this.overlay
    this.overlay = null
    const failures: unknown[] = []
    try {
      this.core.unregisterRenderLayer(overlay.registration.name)
    } catch (error) {
      failures.push(error)
    }
    try {
      overlay.destroy()
    } catch (error) {
      failures.push(error)
    }
    if (failures.length > 0) {
      throw failures[0]
    }
  }

  private disableActiveSession(): void {
    const failures: unknown[] = []
    try {
      this.unregisterOverlay()
    } catch (error) {
      failures.push(error)
    }
    try {
      if (this.adapter.isObserving()) {
        this.adapter.disableObservation()
      }
    } catch (error) {
      failures.push(error)
    }
    this.enabled = false
    if (failures.length > 0) {
      throw failures[0]
    }
  }

  private handleFault(error?: Error): void {
    if (error) {
      try {
        this.adapter.reportFault(error)
      } catch {
        // Fault recording is diagnostic-only and cannot block session cleanup.
      }
    }
    this.enabled = false
    if (this.faultCleanupQueued || this.disposed) {
      return
    }
    this.faultCleanupQueued = true
    const generation = ++this.faultCleanupGeneration
    queueMicrotask(() => {
      if (generation !== this.faultCleanupGeneration) {
        return
      }
      this.faultCleanupQueued = false
      if (this.disposed) {
        return
      }
      try {
        this.disableActiveSession()
      } catch {
        // Fault cleanup is diagnostic-only and cannot escape the microtask.
      }
    })
  }

  private invalidatePendingFaultCleanup(): void {
    if (!this.faultCleanupQueued) {
      return
    }
    this.faultCleanupQueued = false
    this.faultCleanupGeneration += 1
  }

  private assertUsable(): void {
    if (this.disposed) {
      throw new CanvasPipelineDebuggerDisposedError()
    }
  }
}

export const createCanvasPipelineDebugger = (
  core: Core,
  options: CanvasPipelineDebuggerOptions = {}
): CanvasPipelineDebugger => {
  const render = core.deps.render
  if (activeSessions.has(render)) {
    throw new CanvasPipelineDebuggerAlreadyActiveError()
  }
  const controller = new CanvasPipelineDebuggerController(core, render, options)
  activeSessions.set(render, controller)
  if (options.enabled) {
    try {
      controller.enable()
    } catch (error) {
      try {
        controller.dispose()
      } catch {
        // Preserve the enable failure after best-effort session cleanup.
      }
      throw error
    }
  }
  return controller
}

export { CanvasPipelineDebuggerDisposedError }
export type {
  CanvasPipelineFocusedElementSnapshot,
  CanvasPipelineFocusedProjection,
  CanvasPipelineFrameSnapshot,
  CanvasPipelineLayerSnapshot,
  CanvasPipelinePointSnapshot,
  CanvasPipelineSnapshot,
  CanvasPipelineTraceEntry,
  CanvasPipelineViewportSnapshot
} from '@asyra/render/canvas-pipeline-debugger'
