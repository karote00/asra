/**
 * System Context APIs
 * For managing system-level state observables
 * Used in: features that need to update system state which uiContext then subscribes to
 */

import core, { systemContext } from '../contexts'
import type { VectorPointTarget as CoreVectorPointTarget } from '@asyra/core'
import { selectionApis } from './selection'

export type VectorPointTarget = CoreVectorPointTarget

export interface SelectedVectorPointState extends Record<string, unknown> {
  elementId: string
  pointId: string
  index: number
  target: VectorPointTarget
  x: number
  y: number
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

  clearVectorPointState: () => {
    systemContextApis.setSelectedVectorPoint(null)
    systemContextApis.setHoveredVectorPoint(null)
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
  }
}
