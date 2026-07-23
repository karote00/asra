/**
 * Viewport APIs - for canvas navigation (zoom, pan, fit)
 * Used in: zoom, zoom-fit, pan features
 */

import {
  DEFAULT_CANVAS_PADDING,
  PositionData,
  calculateZoomFit,
  calculateZoomToCenter,
  rectToBounds
} from '@asyra/utils'
import { PresetSystemPropertyKeys } from '@asyra/preset'
import core from '../contexts'

export const viewportApis = {
  /**
   * Get current viewport scale (zoom level)
   */
  getScale: () => {
    return core.getSystemProperty<number>(PresetSystemPropertyKeys.ZOOM) ?? 1
  },

  /**
   * Get current viewport position
   */
  getPosition: (): PositionData => {
    return (
      core.getSystemProperty<PositionData>(
        PresetSystemPropertyKeys.VIEWPORT_POSITION
      ) ?? {
        x: 0,
        y: 0
      }
    )
  },

  /**
   * Convert a workspace position into canvas coordinates.
   */
  getCanvasPositionFromWorkspace: (
    workspacePos: PositionData
  ): PositionData => {
    const scale = viewportApis.getScale()
    const position = viewportApis.getPosition()

    return {
      x: workspacePos.x * scale + position.x,
      y: workspacePos.y * scale + position.y
    }
  },

  /**
   * Zoom to a specific scale centered on a point
   */
  zoomToCenter: (scale: number, centerX: number, centerY: number) => {
    const currentScale = viewportApis.getScale()
    const currentPosition = viewportApis.getPosition()
    const nextState = calculateZoomToCenter({
      currentScale,
      currentPosition,
      nextScale: scale,
      center: { x: centerX, y: centerY }
    })

    core.setSystemProperty(PresetSystemPropertyKeys.ZOOM, nextState.scale)
    core.setSystemProperty(
      PresetSystemPropertyKeys.VIEWPORT_POSITION,
      nextState.position
    )
  },

  /**
   * Pan to a specific position
   */
  panTo: (x: number, y: number) => {
    core.setSystemProperty(PresetSystemPropertyKeys.VIEWPORT_POSITION, { x, y })
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
    const elementsBounds = core.getAllElementsBounds()
    if (!elementsBounds) {
      core.setSystemProperty(PresetSystemPropertyKeys.VIEWPORT_POSITION, {
        x: viewportBounds.x + DEFAULT_CANVAS_PADDING,
        y: viewportBounds.y + DEFAULT_CANVAS_PADDING
      })
      return
    }

    const nextState = calculateZoomFit({
      elementsBounds,
      viewportBounds: rectToBounds(viewportBounds),
      padding: DEFAULT_CANVAS_PADDING
    })

    core.setSystemProperty(PresetSystemPropertyKeys.ZOOM, nextState.scale)
    core.setSystemProperty(
      PresetSystemPropertyKeys.VIEWPORT_POSITION,
      nextState.position
    )
  }
}
