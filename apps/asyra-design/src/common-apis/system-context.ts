/**
 * System Context APIs
 * For managing system-level state observables
 * Used in: features that need to update system state which uiContext then subscribes to
 */

import core from '../contexts'
import {
  type SelectedVectorPointState as CoreSelectedVectorPointState,
  type VectorEditingContinuation as CoreVectorEditingContinuation,
  type SelectedVectorSegmentState as CoreSelectedVectorSegmentState,
  type HoveredVectorSegmentInsertPointState as CoreHoveredVectorSegmentInsertPointState
} from '@asyra/core'
import type { PositionData } from '@asyra/utils'
import { PresetSystemPropertyKeys } from '@asyra/preset'
import { SystemPropertyKeys, PrimaryToolType } from '../constants'
import { selectionApis } from './selection'

export type SelectedVectorPointState = CoreSelectedVectorPointState

export type SelectedVectorSegmentState = CoreSelectedVectorSegmentState
export type HoveredVectorSegmentInsertPointState =
  CoreHoveredVectorSegmentInsertPointState

export interface ActiveGradientFillState extends Record<string, unknown> {
  elementId: string
  fillId: string
}

export type GradientHandleIndex = 0 | 1

export interface GradientHandleState extends Record<string, unknown> {
  elementId: string
  fillId: string
  handleIndex: GradientHandleIndex
}

export interface GradientStopState extends Record<string, unknown> {
  elementId: string
  fillId: string
  stopIndex: number
}

export interface AreaSelectionState extends Record<string, unknown> {
  dragStart: PositionData
  dragCurrent: PositionData
  additive: boolean
}

export interface AiDrawingProgressBounds extends Record<string, unknown> {
  readonly height: number
  readonly width: number
  readonly x: number
  readonly y: number
}

export interface AiDrawingProgressState extends Record<string, unknown> {
  readonly bounds: AiDrawingProgressBounds
  readonly completedElements: number
  readonly phase: 'drawing' | 'preparing'
  readonly totalElements: number
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

export const isAiDrawingProgressState = (
  value: unknown
): value is AiDrawingProgressState => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const state = value as Partial<AiDrawingProgressState>
  const bounds = state.bounds
  return (
    bounds !== undefined &&
    bounds !== null &&
    typeof bounds === 'object' &&
    !Array.isArray(bounds) &&
    isFiniteNumber(bounds.x) &&
    isFiniteNumber(bounds.y) &&
    isFiniteNumber(bounds.width) &&
    bounds.width > 0 &&
    isFiniteNumber(bounds.height) &&
    bounds.height > 0 &&
    (state.phase === 'preparing' || state.phase === 'drawing') &&
    Number.isInteger(state.completedElements) &&
    (state.completedElements ?? -1) >= 0 &&
    Number.isInteger(state.totalElements) &&
    (state.totalElements ?? 0) > 0 &&
    (state.completedElements ?? Number.POSITIVE_INFINITY) <=
      (state.totalElements ?? Number.NEGATIVE_INFINITY)
  )
}

export const isAiDrawingProgressStateOrNull = (
  value: unknown
): value is AiDrawingProgressState | null =>
  value === null || isAiDrawingProgressState(value)

const gradientHandleEquals = (
  current: GradientHandleState | null,
  next: GradientHandleState | null
) =>
  current?.elementId === next?.elementId &&
  current?.fillId === next?.fillId &&
  current?.handleIndex === next?.handleIndex

const gradientStopEquals = (
  current: GradientStopState | null,
  next: GradientStopState | null
) =>
  current?.elementId === next?.elementId &&
  current?.fillId === next?.fillId &&
  current?.stopIndex === next?.stopIndex

export type PathEditingContinuationState = CoreVectorEditingContinuation & {
  elementId: string
}

interface EnterPathEditingOptions {
  startNewSubpath?: boolean
}

export const systemContextApis = {
  /**
   * Switch the primary tool
   */
  switchPrimaryTool: (tool: string) => {
    core.setSystemProperty(PresetSystemPropertyKeys.PRIMARY_TOOL, tool)
  },

  /**
   * Get the current system context snapshot
   */
  getSystemContextSnapshot: () => {
    return core.getSystemContextSnapshot()
  },

  /**
   * Update the hovered element ID in system state
   */
  updateHoveredElementId: (elementId: string | null) => {
    core.setSystemProperty(
      PresetSystemPropertyKeys.HOVERED_ELEMENT_ID,
      elementId
    )
  },

  getAreaSelection: (): AreaSelectionState | null => {
    return (
      core.getSystemProperty<AreaSelectionState | null>('areaSelection') ?? null
    )
  },

  setAreaSelection: (selection: AreaSelectionState | null) => {
    core.setSystemProperty('areaSelection', selection)
  },

  clearAreaSelection: () => {
    systemContextApis.setAreaSelection(null)
  },

  getAiDrawingProgress: (): AiDrawingProgressState | null => {
    return (
      core.getSystemProperty<AiDrawingProgressState | null>(
        SystemPropertyKeys.AI_DRAWING_PROGRESS
      ) ?? null
    )
  },

  setAiDrawingProgress: (progress: AiDrawingProgressState | null) => {
    core.setSystemProperty(SystemPropertyKeys.AI_DRAWING_PROGRESS, progress)
  },

  clearAiDrawingProgress: () => {
    systemContextApis.setAiDrawingProgress(null)
  },

  /**
   * Current vector being edited by pen tool
   */
  getPathEditingVectorId: (): string | null => {
    return (
      core.getSystemProperty<string | null>(
        PresetSystemPropertyKeys.PATH_EDITING_VECTOR_ID
      ) ?? null
    )
  },

  getPathEditingMode: (): boolean => {
    return (
      core.getSystemProperty<boolean>(
        PresetSystemPropertyKeys.PATH_EDITING_MODE
      ) ?? false
    )
  },

  setPathEditingMode: (enabled: boolean) => {
    core.setSystemProperty(PresetSystemPropertyKeys.PATH_EDITING_MODE, enabled)
  },

  setPathEditingVectorId: (elementId: string | null) => {
    core.setSystemProperty(
      PresetSystemPropertyKeys.PATH_EDITING_VECTOR_ID,
      elementId
    )
    systemContextApis.setPathEditingMode(elementId !== null)
  },

  getPathEditingStartNewSubpath: (): boolean => {
    return (
      core.getSystemProperty<boolean>(
        PresetSystemPropertyKeys.PATH_EDITING_START_NEW_SUBPATH
      ) ?? false
    )
  },

  setPathEditingStartNewSubpath: (value: boolean) => {
    core.setSystemProperty(
      PresetSystemPropertyKeys.PATH_EDITING_START_NEW_SUBPATH,
      value
    )
  },

  getSelectedVectorPoint: (): SelectedVectorPointState | null => {
    return (
      core.getSystemProperty<SelectedVectorPointState | null>(
        PresetSystemPropertyKeys.SELECTED_VECTOR_POINT
      ) ?? null
    )
  },

  setSelectedVectorPoint: (point: SelectedVectorPointState | null) => {
    core.setSystemProperty(
      PresetSystemPropertyKeys.SELECTED_VECTOR_POINT,
      point
    )
  },

  getHoveredVectorPoint: (): SelectedVectorPointState | null => {
    return (
      core.getSystemProperty<SelectedVectorPointState | null>(
        PresetSystemPropertyKeys.HOVERED_VECTOR_POINT
      ) ?? null
    )
  },

  setHoveredVectorPoint: (point: SelectedVectorPointState | null) => {
    core.setSystemProperty(PresetSystemPropertyKeys.HOVERED_VECTOR_POINT, point)
  },

  getSelectedVectorSegment: (): SelectedVectorSegmentState | null => {
    return (
      core.getSystemProperty<SelectedVectorSegmentState | null>(
        PresetSystemPropertyKeys.SELECTED_VECTOR_SEGMENT
      ) ?? null
    )
  },

  setSelectedVectorSegment: (segment: SelectedVectorSegmentState | null) => {
    core.setSystemProperty(
      PresetSystemPropertyKeys.SELECTED_VECTOR_SEGMENT,
      segment
    )
  },

  getHoveredVectorSegment: (): SelectedVectorSegmentState | null => {
    return (
      core.getSystemProperty<SelectedVectorSegmentState | null>(
        PresetSystemPropertyKeys.HOVERED_VECTOR_SEGMENT
      ) ?? null
    )
  },

  setHoveredVectorSegment: (segment: SelectedVectorSegmentState | null) => {
    core.setSystemProperty(
      PresetSystemPropertyKeys.HOVERED_VECTOR_SEGMENT,
      segment
    )
  },

  getHoveredVectorSegmentInsertPoint:
    (): HoveredVectorSegmentInsertPointState | null => {
      return (
        core.getSystemProperty<HoveredVectorSegmentInsertPointState | null>(
          PresetSystemPropertyKeys.HOVERED_VECTOR_SEGMENT_INSERT_POINT
        ) ?? null
      )
    },

  setHoveredVectorSegmentInsertPoint: (
    point: HoveredVectorSegmentInsertPointState | null
  ) => {
    core.setSystemProperty(
      PresetSystemPropertyKeys.HOVERED_VECTOR_SEGMENT_INSERT_POINT,
      point
    )
  },

  clearVectorPointState: () => {
    systemContextApis.setSelectedVectorPoint(null)
    systemContextApis.setHoveredVectorPoint(null)
    systemContextApis.setSelectedVectorSegment(null)
    systemContextApis.setHoveredVectorSegment(null)
    systemContextApis.setHoveredVectorSegmentInsertPoint(null)
  },

  getActiveGradientFill: (): ActiveGradientFillState | null => {
    return (
      core.getSystemProperty<ActiveGradientFillState | null>(
        'activeGradientFill'
      ) ?? null
    )
  },

  setActiveGradientFill: (fill: ActiveGradientFillState | null) => {
    const current = systemContextApis.getActiveGradientFill()
    const hasChanged =
      current?.elementId !== fill?.elementId || current?.fillId !== fill?.fillId

    core.setSystemProperty('activeGradientFill', fill)
    if (hasChanged) {
      systemContextApis.setSelectedGradientHandle(null)
      systemContextApis.setHoveredGradientStop(null)
      systemContextApis.setSelectedGradientStop(null)
    }
  },

  getHoveredGradientHandle: (): GradientHandleState | null => {
    return (
      core.getSystemProperty<GradientHandleState | null>(
        'hoveredGradientHandle'
      ) ?? null
    )
  },

  setHoveredGradientHandle: (handle: GradientHandleState | null) => {
    const current = systemContextApis.getHoveredGradientHandle()
    if (gradientHandleEquals(current, handle)) {
      return
    }
    core.setSystemProperty('hoveredGradientHandle', handle)
  },

  getSelectedGradientHandle: (): GradientHandleState | null => {
    return (
      core.getSystemProperty<GradientHandleState | null>(
        'selectedGradientHandle'
      ) ?? null
    )
  },

  setSelectedGradientHandle: (handle: GradientHandleState | null) => {
    const current = systemContextApis.getSelectedGradientHandle()
    if (gradientHandleEquals(current, handle)) {
      return
    }
    core.setSystemProperty('selectedGradientHandle', handle)
  },

  getHoveredGradientStop: (): GradientStopState | null => {
    return (
      core.getSystemProperty<GradientStopState | null>('hoveredGradientStop') ??
      null
    )
  },

  setHoveredGradientStop: (stop: GradientStopState | null) => {
    const current = systemContextApis.getHoveredGradientStop()
    if (gradientStopEquals(current, stop)) {
      return
    }
    core.setSystemProperty('hoveredGradientStop', stop)
  },

  getSelectedGradientStop: (): GradientStopState | null => {
    return (
      core.getSystemProperty<GradientStopState | null>(
        'selectedGradientStop'
      ) ?? null
    )
  },

  setSelectedGradientStop: (stop: GradientStopState | null) => {
    const current = systemContextApis.getSelectedGradientStop()
    if (gradientStopEquals(current, stop)) {
      return
    }
    core.setSystemProperty('selectedGradientStop', stop)
  },

  clearGradientFillEditingState: () => {
    systemContextApis.setActiveGradientFill(null)
    systemContextApis.setSelectedGradientHandle(null)
    systemContextApis.setHoveredGradientStop(null)
    systemContextApis.setSelectedGradientStop(null)
  },

  enterPathEditingMode: (
    elementId: string,
    options: EnterPathEditingOptions = {}
  ) => {
    systemContextApis.setPathEditingMode(true)
    systemContextApis.setPathEditingVectorId(elementId)
    systemContextApis.setPathEditingStartNewSubpath(
      options.startNewSubpath ?? true
    )
    selectionApis.clearVectorPointSelection({ undoable: false })
    selectionApis.clearVectorSegmentSelection({ undoable: false })
    systemContextApis.clearVectorPointState()
  },

  exitPathEditingMode: () => {
    systemContextApis.setPathEditingMode(false)
    systemContextApis.setPathEditingVectorId(null)
    systemContextApis.setPathEditingStartNewSubpath(false)
    selectionApis.clearVectorPointSelection({ undoable: false })
    selectionApis.clearVectorSegmentSelection({ undoable: false })
    systemContextApis.clearVectorPointState()
    systemContextApis.switchPrimaryTool(PrimaryToolType.SELECT)
  },

  getPathEditingContinuation: (): PathEditingContinuationState | null => {
    return (
      core.getSystemProperty<PathEditingContinuationState | null>(
        PresetSystemPropertyKeys.PATH_EDITING_CONTINUATION
      ) ?? null
    )
  },

  setPathEditingContinuation: (
    continuation: PathEditingContinuationState | null
  ) => {
    core.setSystemProperty(
      PresetSystemPropertyKeys.PATH_EDITING_CONTINUATION,
      continuation
    )
  }
}
