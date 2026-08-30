import type { Render } from '../render.js'
import { transformGeometryPoint } from '@asyra/utils'
import {
  subscribeToCanvasPipelineEvidence,
  type CanvasPipelineEvidence,
  type CanvasPipelineMatrixSnapshot,
  type CanvasPipelineProjectionSnapshot
} from '../diagnostics/canvas-pipeline.js'
import type {
  CanvasPipelineDebuggerAdapter,
  CanvasPipelineDebuggerAdapterOptions,
  CanvasPipelineFocusedElementSnapshot,
  CanvasPipelineFocusedProjection,
  CanvasPipelineSnapshot,
  CanvasPipelineTraceEntry
} from './types.js'
import { freezeEvidence as freezeDeep } from '../diagnostics/freeze-evidence.js'

const DEFAULT_TRACE_CAPACITY = 256

const stableUnique = (ids: readonly string[]): string[] => {
  const seen = new Set<string>()
  return ids.filter((id) => {
    if (seen.has(id)) {
      return false
    }
    seen.add(id)
    return true
  })
}

const applyInverseMatrix = (
  matrix: CanvasPipelineMatrixSnapshot,
  point: { x: number; y: number }
): { x: number; y: number } | null => {
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c
  if (Math.abs(determinant) <= Number.EPSILON) {
    return null
  }
  const x = point.x - matrix.tx
  const y = point.y - matrix.ty
  return {
    x: (matrix.d * x - matrix.c * y) / determinant,
    y: (-matrix.b * x + matrix.a * y) / determinant
  }
}

const projectGeometry = (
  projection: CanvasPipelineProjectionSnapshot,
  latestViewportTransform?: CanvasPipelineMatrixSnapshot
): CanvasPipelineFocusedProjection | undefined => {
  const { localBounds, worldTransform, viewportTransform } = projection
  const localCorners = [
    { x: localBounds.x, y: localBounds.y },
    { x: localBounds.x + localBounds.width, y: localBounds.y },
    {
      x: localBounds.x + localBounds.width,
      y: localBounds.y + localBounds.height
    },
    { x: localBounds.x, y: localBounds.y + localBounds.height }
  ]
  const observedCanvasCorners = localCorners.map((point) =>
    transformGeometryPoint(worldTransform, point)
  )
  const workspaceCorners = observedCanvasCorners.map((point) =>
    applyInverseMatrix(viewportTransform, point)
  )
  if (workspaceCorners.some((point) => point === null)) {
    return
  }
  const resolvedWorkspaceCorners = workspaceCorners as {
    x: number
    y: number
  }[]
  const canvasCorners = resolvedWorkspaceCorners.map((point) =>
    transformGeometryPoint(latestViewportTransform ?? viewportTransform, point)
  )
  return freezeDeep({
    localBounds: { ...localBounds },
    canvasCorners,
    workspaceCorners: resolvedWorkspaceCorners
  })
}

interface FocusedState {
  /** Last expected attachment state observed at the pre-engine handoff boundary. */
  detached: boolean
  lastInput?: CanvasPipelineTraceEntry & { kind: 'element-input' }
  lastHandoff?: CanvasPipelineTraceEntry & { kind: 'engine-handoff' }
}

export class CanvasPipelineDebuggerDisposedError extends Error {
  readonly code = 'CANVAS_PIPELINE_DEBUGGER_DISPOSED'

  constructor() {
    super('Canvas Pipeline Debugger has been disposed')
    this.name = 'CanvasPipelineDebuggerDisposedError'
  }
}

class CanvasPipelineTraceAdapter implements CanvasPipelineDebuggerAdapter {
  private readonly traceCapacity: number
  private readonly onFault?: (error: Error) => void
  private trace: CanvasPipelineTraceEntry[] = []
  private focusedElementIds: string[]
  private readonly focusedState = new Map<string, FocusedState>()
  private readonly layers = new Map<
    string,
    CanvasPipelineTraceEntry & { kind: 'layer-evaluation' }
  >()
  private sequence = 0
  private droppedEntryCount = 0
  private lastFrame: (CanvasPipelineTraceEntry & { kind: 'frame' }) | null =
    null
  private lastViewport:
    (CanvasPipelineTraceEntry & { kind: 'viewport-input' }) | null = null
  private latestViewportTransform: CanvasPipelineMatrixSnapshot | null = null
  private fault: Error | null = null
  private unsubscribe: (() => void) | null = null
  private disposed = false

  constructor(
    private readonly render: Render,
    options: CanvasPipelineDebuggerAdapterOptions = {}
  ) {
    const capacity = options.traceCapacity ?? DEFAULT_TRACE_CAPACITY
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new RangeError('traceCapacity must be a positive integer')
    }
    this.traceCapacity = capacity
    this.onFault = options.onFault
    this.focusedElementIds = stableUnique(options.focusedElementIds ?? [])
    this.reconcileFocusedState()
  }

  enableObservation(): void {
    this.assertUsable()
    if (this.unsubscribe) {
      return
    }
    this.fault = null
    this.unsubscribe = subscribeToCanvasPipelineEvidence(this.render, {
      onEvidence: (evidence) => this.record(evidence),
      onError: (error) => {
        this.unsubscribe = null
        this.fault = error
        try {
          this.onFault?.(error)
        } catch {
          // Fault reporting is diagnostic-only and cannot affect rendering.
        }
      }
    })
  }

  disableObservation(): void {
    this.assertUsable()
    this.unsubscribe?.()
    this.unsubscribe = null
  }

  isObserving(): boolean {
    this.assertUsable()
    return this.unsubscribe !== null
  }

  reportFault(error: Error): void {
    this.assertUsable()
    this.fault = error
  }

  setFocusedElementIds(ids: readonly string[]): void {
    this.assertUsable()
    this.focusedElementIds = stableUnique(ids)
    this.reconcileFocusedState()
  }

  getTrace(): readonly CanvasPipelineTraceEntry[] {
    this.assertUsable()
    return freezeDeep([...this.trace])
  }

  clearTrace(): void {
    this.assertUsable()
    this.trace = []
    this.droppedEntryCount = 0
  }

  getSnapshot(): CanvasPipelineSnapshot {
    this.assertUsable()
    const focusedElements = this.focusedElementIds.map((elementId) =>
      this.snapshotFocusedElement(elementId)
    )
    return freezeDeep({
      sequence: this.sequence,
      droppedEntryCount: this.droppedEntryCount,
      frame: this.lastFrame
        ? {
            frameId: this.lastFrame.frameId,
            phase: this.lastFrame.phase,
            outcome: this.lastFrame.outcome,
            handoffCount: this.lastFrame.handoffCount
          }
        : null,
      viewport: this.lastViewport
        ? {
            frameId: this.lastViewport.frameId,
            operation: this.lastViewport.operation,
            data: this.lastViewport.data
          }
        : null,
      layers: [...this.layers.values()].map((entry) => ({
        name: entry.layerName,
        zIndex: entry.zIndex,
        frameId: entry.frameId,
        outcome: entry.outcome
      })),
      focusedElements,
      fault: this.fault ? { message: this.fault.message } : null
    })
  }

  dispose(): void {
    if (this.disposed) {
      return
    }
    this.unsubscribe?.()
    this.unsubscribe = null
    this.trace = []
    this.focusedElementIds = []
    this.focusedState.clear()
    this.layers.clear()
    this.lastFrame = null
    this.lastViewport = null
    this.latestViewportTransform = null
    this.fault = null
    this.disposed = true
  }

  private record(evidence: CanvasPipelineEvidence): void {
    this.sequence += 1
    const entry = freezeDeep({
      ...this.projectEvidence(evidence),
      sequence: this.sequence
    }) as CanvasPipelineTraceEntry
    this.trace.push(entry)
    if (this.trace.length > this.traceCapacity) {
      this.trace.shift()
      this.droppedEntryCount += 1
    }
    this.updateReadModel(entry)
  }

  private projectEvidence(
    evidence: CanvasPipelineEvidence
  ): CanvasPipelineEvidence {
    if (evidence.kind !== 'engine-handoff') {
      return evidence
    }
    const command = evidence.command
    if (!command.elementId || this.focusedState.has(command.elementId)) {
      return evidence
    }
    return {
      ...evidence,
      command: {
        type: command.type,
        ...(command.elementId ? { elementId: command.elementId } : {}),
        ...(command.objectType ? { objectType: command.objectType } : {}),
        ...(command.renderRole ? { renderRole: command.renderRole } : {}),
        ...(command.relatedElementId
          ? { relatedElementId: command.relatedElementId }
          : {}),
        ...(command.relatedObjectType
          ? { relatedObjectType: command.relatedObjectType }
          : {}),
        ...(command.requestId ? { requestId: command.requestId } : {})
      }
    }
  }

  private updateReadModel(entry: CanvasPipelineTraceEntry): void {
    switch (entry.kind) {
      case 'frame':
        this.lastFrame = entry
        if (entry.phase === 'start') {
          this.layers.clear()
        }
        return
      case 'viewport-input':
        this.lastViewport = entry
        return
      case 'layer-evaluation':
        this.layers.set(entry.layerName, entry)
        return
      case 'element-input': {
        const state = this.focusedState.get(entry.elementId)
        if (state) {
          state.lastInput = entry
        }
        return
      }
      case 'engine-handoff': {
        if (
          entry.command.renderRole === 'viewport' &&
          entry.command.projection
        ) {
          this.latestViewportTransform = entry.command.projection.worldTransform
        }
        const elementId = entry.command.elementId
        const state = elementId ? this.focusedState.get(elementId) : undefined
        if (state) {
          this.updateFocusedHandoff(state, entry)
        }
      }
    }
  }

  private reconcileFocusedState(): void {
    const previousState = new Map(this.focusedState)
    const newlyFocusedIds = new Set<string>()
    this.focusedState.clear()
    this.focusedElementIds.forEach((elementId) => {
      const existingState = previousState.get(elementId)
      if (existingState) {
        this.focusedState.set(elementId, existingState)
        return
      }
      this.focusedState.set(elementId, { detached: true })
      newlyFocusedIds.add(elementId)
    })
    if (newlyFocusedIds.size > 0) {
      this.trace.forEach((entry) =>
        this.updateFocusedState(entry, newlyFocusedIds)
      )
    }
  }

  private updateFocusedState(
    entry: CanvasPipelineTraceEntry,
    targetElementIds?: ReadonlySet<string>
  ): void {
    if (entry.kind === 'element-input') {
      if (targetElementIds && !targetElementIds.has(entry.elementId)) {
        return
      }
      const state = this.focusedState.get(entry.elementId)
      if (state) {
        state.lastInput = entry
      }
      return
    }
    if (entry.kind === 'engine-handoff' && entry.command.elementId) {
      if (targetElementIds && !targetElementIds.has(entry.command.elementId)) {
        return
      }
      const state = this.focusedState.get(entry.command.elementId)
      if (state) {
        this.updateFocusedHandoff(state, entry)
      }
    }
  }

  private updateFocusedHandoff(
    state: FocusedState,
    entry: CanvasPipelineTraceEntry & { kind: 'engine-handoff' }
  ): void {
    if (
      entry.command.type === 'remove-child' ||
      entry.command.type === 'destroy-object'
    ) {
      state.lastHandoff = undefined
      state.detached = true
      return
    }
    if (entry.command.type === 'append-child') {
      state.detached = false
      state.lastHandoff = entry
      return
    }
    if (state.detached) {
      return
    }
    state.lastHandoff = entry
  }

  private snapshotFocusedElement(
    elementId: string
  ): CanvasPipelineFocusedElementSnapshot {
    const state = this.focusedState.get(elementId)
    if (!state || state.detached || (!state.lastInput && !state.lastHandoff)) {
      return freezeDeep({ elementId, status: 'not-observed' as const })
    }
    const projection = state.lastHandoff?.command.projection
      ? projectGeometry(
          state.lastHandoff.command.projection,
          this.latestViewportTransform ?? undefined
        )
      : undefined
    return freezeDeep({
      elementId,
      status: 'observed' as const,
      ...(state.lastInput
        ? { lastInputSequence: state.lastInput.sequence }
        : {}),
      ...(state.lastHandoff
        ? { lastHandoffSequence: state.lastHandoff.sequence }
        : {}),
      ...(projection ? { projection } : {})
    })
  }

  private assertUsable(): void {
    if (this.disposed) {
      throw new CanvasPipelineDebuggerDisposedError()
    }
  }
}

export const createCanvasPipelineDebuggerAdapter = (
  render: Render,
  options?: CanvasPipelineDebuggerAdapterOptions
): CanvasPipelineDebuggerAdapter =>
  new CanvasPipelineTraceAdapter(render, options)
