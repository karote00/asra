import {
  createOverlayLayerRegistration,
  type OverlayCanvas,
  type RegisterRenderLayer
} from '@asyra/core'
import { rectFromPoints, type PositionData, type Rect } from '@asyra/utils'
import type { AreaSelectionState } from '../common-apis/system-context'
import type { SystemPropertyReader } from './system-property-reader'

const AREA_SELECTION_LAYER_NAME = 'area-selection-layer'
const AREA_SELECTION_STROKE_COLOR = 0x157ae7
const AREA_SELECTION_STROKE_WIDTH = 1
const AREA_SELECTION_FILL_ALPHA = 0.3

const getRectPoints = (
  rect: Rect
): [PositionData, PositionData, PositionData, PositionData] => {
  const topLeft = { x: rect.x, y: rect.y }
  const topRight = { x: rect.x + rect.width, y: rect.y }
  const bottomRight = {
    x: rect.x + rect.width,
    y: rect.y + rect.height
  }
  const bottomLeft = { x: rect.x, y: rect.y + rect.height }

  return [topLeft, topRight, bottomRight, bottomLeft]
}

const drawRectOutline = (
  canvas: OverlayCanvas,
  rectPoints: [PositionData, PositionData, PositionData, PositionData]
) => {
  canvas.line(rectPoints[0], rectPoints[1], {
    width: AREA_SELECTION_STROKE_WIDTH,
    color: AREA_SELECTION_STROKE_COLOR
  })
  canvas.line(rectPoints[1], rectPoints[2], {
    width: AREA_SELECTION_STROKE_WIDTH,
    color: AREA_SELECTION_STROKE_COLOR
  })
  canvas.line(rectPoints[2], rectPoints[3], {
    width: AREA_SELECTION_STROKE_WIDTH,
    color: AREA_SELECTION_STROKE_COLOR
  })
  canvas.line(rectPoints[3], rectPoints[0], {
    width: AREA_SELECTION_STROKE_WIDTH,
    color: AREA_SELECTION_STROKE_COLOR
  })
}
export const registerAreaSelectionRenderLayer = (
  registerRenderLayer: RegisterRenderLayer,
  deps: {
    systemProperties: SystemPropertyReader
    viewportApis: {
      getCanvasPositionFromWorkspace: (pos: PositionData) => PositionData
    }
  }
) => {
  let lastDrawSignature = ''
  const layerRegistration = createOverlayLayerRegistration({
    name: AREA_SELECTION_LAYER_NAME,
    zIndex: 9,
    update: (canvas: OverlayCanvas) => {
      const selection =
        deps.systemProperties.getSystemProperty<AreaSelectionState | null>(
          'areaSelection'
        ) ?? null
      const drawSignature = selection
        ? [
            selection.dragStart.x,
            selection.dragStart.y,
            selection.dragCurrent.x,
            selection.dragCurrent.y
          ].join('|')
        : 'empty'
      if (drawSignature === lastDrawSignature) {
        return false
      }
      lastDrawSignature = drawSignature

      canvas.clear()
      if (!selection) {
        return true
      }

      const startCanvas = deps.viewportApis.getCanvasPositionFromWorkspace(
        selection.dragStart
      )
      const currentCanvas = deps.viewportApis.getCanvasPositionFromWorkspace(
        selection.dragCurrent
      )
      const rect = rectFromPoints(startCanvas, currentCanvas)

      if (rect.width <= 0 || rect.height <= 0) {
        return true
      }

      const rectPoints = getRectPoints(rect)
      canvas.polygon(rectPoints, {
        color: AREA_SELECTION_STROKE_COLOR,
        alpha: AREA_SELECTION_FILL_ALPHA
      })
      drawRectOutline(canvas, rectPoints)
      return true
    }
  })

  registerRenderLayer(layerRegistration, { override: true })
}
