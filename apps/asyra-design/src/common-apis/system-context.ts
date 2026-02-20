/**
 * System Context APIs
 * For managing system-level state observables
 * Used in: features that need to update system state which uiContext then subscribes to
 */

import core, { systemContext } from '../contexts'

export const systemContextApis = {
  /**
   * Switch the primary tool
   */
  switchPrimaryTool: (tool: string) => {
    systemContext.switchPrimaryTool(tool)
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
    systemContext.updateHoveredElementId(elementId)
  },

  /**
   * Current vector being edited by pen tool
   */
  getPathEditingVectorId: (): string | null => {
    return core.getSystemProperty<string | null>('pathEditingVectorId') ?? null
  },

  setPathEditingVectorId: (elementId: string | null) => {
    core.setSystemProperty('pathEditingVectorId', elementId)
  },

  getPathEditingStartNewSubpath: (): boolean => {
    return core.getSystemProperty<boolean>('pathEditingStartNewSubpath') ?? false
  },

  setPathEditingStartNewSubpath: (value: boolean) => {
    core.setSystemProperty('pathEditingStartNewSubpath', value)
  },

  // Backward compatibility for in-progress refactor
  getPenEditingVectorId: (): string | null => {
    return systemContextApis.getPathEditingVectorId()
  },

  setPenEditingVectorId: (elementId: string | null) => {
    systemContextApis.setPathEditingVectorId(elementId)
  }
}
