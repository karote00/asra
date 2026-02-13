/**
 * System Context APIs
 * For managing system-level state observables
 * Used in: features that need to update system state which uiContext then subscribes to
 */

import { systemContext } from '../contexts'

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
  }
}
