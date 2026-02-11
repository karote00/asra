/**
 * Viewport APIs - for canvas navigation (zoom, pan, fit)
 * Used in: zoom, zoom-fit, pan features
 */

import { render } from '../contexts'
import { uiContextApis } from './ui-context'

export const viewportApis = {
  /**
   * Get current viewport scale (zoom level)
   */
  getScale: () => render.getViewportScale(),

  /**
   * Get current viewport position
   */
  getPosition: () => render.getViewportPosition(),

  /**
   * Zoom to a specific scale centered on a point
   */
  zoomToCenter: (scale: number, centerX: number, centerY: number) => {
    render.zoomToCenter(scale, centerX, centerY)
  },

  /**
   * Pan to a specific position
   */
  panTo: (x: number, y: number) => {
    render.panTo(x, y)
  },

  /**
   * Zoom to fit content within visible viewport area
   * Accounts for UI layout (sidebars, toolbars)
   */
  zoomFit: () => {
    const viewportAnchor = document.getElementById('viewport-anchor')
    if (!viewportAnchor) {
      return
    }

    const viewportBounds = viewportAnchor.getBoundingClientRect()
    render.zoomFit(viewportBounds)
  },

  /**
   * Update zoom level in UI context
   */
  updateZoomUI: (scale: number) => {
    uiContextApis.updateZoom(scale)
  }
}
