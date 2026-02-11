/**
 * UI Context APIs - for updating UI state
 * Used in: switch-primary-tool, zoom, zoom-fit features
 */

import uiContext from '@asyra/ui-context'

export const uiContextApis = {
  /**
   * Update the primary tool in UI
   */
  updatePrimaryTool: (tool: string) => {
    uiContext.updatePrimaryTool(tool)
  },

  /**
   * Update zoom level in UI
   */
  updateZoom: (scale: number) => {
    uiContext.updateZoom(scale)
  }
}
