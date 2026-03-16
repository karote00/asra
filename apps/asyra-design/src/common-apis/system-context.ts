/**
 * System Context APIs
 * For managing system-level state observables
 * Used in: features that need to update system state which uiContext then subscribes to
 */

import core, { systemContext } from '../contexts'
import {
  type VectorPointTarget as CoreVectorPointTarget,
  type SelectedVectorPointState as CoreSelectedVectorPointState,
  type VectorEditingContinuation as CoreVectorEditingContinuation,
  type SelectedVectorSegmentState as CoreSelectedVectorSegmentState,
  type HoveredVectorSegmentInsertPointState as CoreHoveredVectorSegmentInsertPointState
} from '@asyra/core'
import { selectionApis } from './selection'

export type VectorPointTarget = CoreVectorPointTarget
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
    core.setSystemProperty('primaryTool', tool)
  },

  /**
   * Get the current system context snapshot
   */
  getSystemContextSnapshot: () => {
    return systemContext.getSystemContextSnapshot()
  },

  /**
   * Update the hovered element ID in system state
   */
  updateHoveredElementId: (elementId: string | null) => {
    core.setSystemProperty('hoveredElementId', elementId)
  },

  /**
   * Current vector being edited by pen tool
   */
  getPathEditingVectorId: (): string | null => {
    return core.getSystemProperty<string | null>('pathEditingVectorId') ?? null
  },

  getPathEditingMode: (): boolean => {
    return core.getSystemProperty<boolean>('pathEditingMode') ?? false
  },

  setPathEditingMode: (enabled: boolean) => {
    core.setSystemProperty('pathEditingMode', enabled)
  },

  setPathEditingVectorId: (elementId: string | null) => {
    core.setSystemProperty('pathEditingVectorId', elementId)
    systemContextApis.setPathEditingMode(elementId !== null)
  },

  getPathEditingStartNewSubpath: (): boolean => {
    return (
      core.getSystemProperty<boolean>('pathEditingStartNewSubpath') ?? false
    )
  },

  setPathEditingStartNewSubpath: (value: boolean) => {
    core.setSystemProperty('pathEditingStartNewSubpath', value)
  },

  getSelectedVectorPoint: (): SelectedVectorPointState | null => {
    return (
      core.getSystemProperty<SelectedVectorPointState | null>(
        'selectedVectorPoint'
      ) ?? null
    )
  },

  setSelectedVectorPoint: (point: SelectedVectorPointState | null) => {
    core.setSystemProperty('selectedVectorPoint', point)
  },

  getHoveredVectorPoint: (): SelectedVectorPointState | null => {
    return (
      core.getSystemProperty<SelectedVectorPointState | null>(
        'hoveredVectorPoint'
      ) ?? null
    )
  },

  setHoveredVectorPoint: (point: SelectedVectorPointState | null) => {
    core.setSystemProperty('hoveredVectorPoint', point)
  },

  getSelectedVectorSegment: (): SelectedVectorSegmentState | null => {
    return (
      core.getSystemProperty<SelectedVectorSegmentState | null>(
        'selectedVectorSegment'
      ) ?? null
    )
  },

  setSelectedVectorSegment: (segment: SelectedVectorSegmentState | null) => {
    core.setSystemProperty('selectedVectorSegment', segment)
  },

  getHoveredVectorSegment: (): SelectedVectorSegmentState | null => {
    return (
      core.getSystemProperty<SelectedVectorSegmentState | null>(
        'hoveredVectorSegment'
      ) ?? null
    )
  },

  setHoveredVectorSegment: (segment: SelectedVectorSegmentState | null) => {
    core.setSystemProperty('hoveredVectorSegment', segment)
  },

  getHoveredVectorSegmentInsertPoint:
    (): HoveredVectorSegmentInsertPointState | null => {
      return (
        core.getSystemProperty<HoveredVectorSegmentInsertPointState | null>(
          'hoveredVectorSegmentInsertPoint'
        ) ?? null
      )
    },

  setHoveredVectorSegmentInsertPoint: (
    point: HoveredVectorSegmentInsertPointState | null
  ) => {
    core.setSystemProperty('hoveredVectorSegmentInsertPoint', point)
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
    core.setSystemProperty('selectedGradientHandle', handle)
  },

  getHoveredGradientStop: (): GradientStopState | null => {
    return (
      core.getSystemProperty<GradientStopState | null>('hoveredGradientStop') ??
      null
    )
  },

  setHoveredGradientStop: (stop: GradientStopState | null) => {
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
  },

  getPathEditingContinuation: (): PathEditingContinuationState | null => {
    return (
      core.getSystemProperty<PathEditingContinuationState | null>(
        'pathEditingContinuation'
      ) ?? null
    )
  },

  setPathEditingContinuation: (
    continuation: PathEditingContinuationState | null
  ) => {
    core.setSystemProperty('pathEditingContinuation', continuation)
  }
}
