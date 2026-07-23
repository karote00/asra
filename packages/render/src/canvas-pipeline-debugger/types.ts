import type {
  CanvasPipelineDetachedValue,
  CanvasPipelineEvidence
} from '../diagnostics/canvas-pipeline'
import type { RenderLayerRegistration } from '../types/render-layer'
import type { Rect } from '@asyra/utils'

export type CanvasPipelineTraceEntry = CanvasPipelineEvidence & {
  readonly sequence: number
}

export interface CanvasPipelinePointSnapshot {
  readonly x: number
  readonly y: number
}

export interface CanvasPipelineFocusedProjection {
  readonly localBounds: Readonly<Rect>
  readonly canvasCorners: readonly CanvasPipelinePointSnapshot[]
  readonly workspaceCorners: readonly CanvasPipelinePointSnapshot[]
}

export type CanvasPipelineFocusedElementSnapshot =
  | Readonly<{
      elementId: string
      status: 'not-observed'
    }>
  | Readonly<{
      elementId: string
      status: 'observed'
      lastInputSequence?: number
      lastHandoffSequence?: number
      projection?: CanvasPipelineFocusedProjection
    }>

export interface CanvasPipelineLayerSnapshot {
  readonly name: string
  readonly zIndex: number
  readonly frameId: number
  readonly outcome: 'bypassed' | 'unchanged' | 'changed'
}

export interface CanvasPipelineFrameSnapshot {
  readonly frameId: number
  readonly phase: 'start' | 'complete'
  readonly outcome?: 'rendered' | 'skipped' | 'failed'
  readonly handoffCount: number
}

export interface CanvasPipelineViewportSnapshot {
  readonly frameId: number
  readonly operation: 'pan' | 'zoom' | 'zoom-center' | 'zoom-fit' | 'resize'
  readonly data: CanvasPipelineDetachedValue
}

export interface CanvasPipelineSnapshot {
  readonly sequence: number
  readonly droppedEntryCount: number
  readonly frame: CanvasPipelineFrameSnapshot | null
  readonly viewport: CanvasPipelineViewportSnapshot | null
  readonly layers: readonly CanvasPipelineLayerSnapshot[]
  readonly focusedElements: readonly CanvasPipelineFocusedElementSnapshot[]
  readonly fault: Readonly<{ message: string }> | null
}

export interface CanvasPipelineDebuggerAdapterOptions {
  traceCapacity?: number
  focusedElementIds?: readonly string[]
  onFault?: (error: Error) => void
}

export interface CanvasPipelineDebuggerAdapter {
  enableObservation(): void
  disableObservation(): void
  isObserving(): boolean
  reportFault(error: Error): void
  setFocusedElementIds(ids: readonly string[]): void
  getSnapshot(): CanvasPipelineSnapshot
  getTrace(): readonly CanvasPipelineTraceEntry[]
  clearTrace(): void
  dispose(): void
}

export interface CanvasPipelineDebuggerOverlay {
  readonly registration: RenderLayerRegistration
  destroy(): void
}

export interface CanvasPipelineDebuggerOverlayOptions {
  onFault?: (error: Error) => void
}
