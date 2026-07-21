import {
  createOverlayLayerRegistration,
  type OverlayCanvas,
  type RegisterRenderLayer
} from '@asyra/core'
import { parseColor, rgbaToColorInt, type PositionData } from '@asyra/utils'
import { fillApis, type GradientHandleIndex } from '../common-apis/fills'
import type {
  ActiveGradientFillState,
  GradientHandleState,
  GradientStopState
} from '../common-apis/system-context'

const GRADIENT_FILL_HANDLES_LAYER_NAME = 'gradient-fill-handles-layer'
const HANDLE_LINE_COLOR = 0x4c95ff
const HANDLE_LINE_WIDTH = 2
const HANDLE_FILL_COLOR = 0xffffff
const HANDLE_STROKE_COLOR = 0x1b1d20
const HANDLE_ACTIVE_STROKE_COLOR = 0x4c95ff
const HANDLE_RADIUS = 6
const HANDLE_ACTIVE_RADIUS = 7

/** Size of the gradient stop color rectangle (pixels). */
const STOP_RECT_SIZE = 16
const STOP_RECT_HALF = STOP_RECT_SIZE / 2
/** Height of the triangle pointer from rectangle edge to the gradient line. */
const STOP_TRIANGLE_HEIGHT = 6
const STOP_STROKE_COLOR = 0xffffff
const STOP_ACTIVE_STROKE_COLOR = 0x4c95ff
const STOP_STROKE_WIDTH = 2
/** Gap between the gradient line and the rectangle edge. */
const STOP_OFFSET_FROM_LINE = STOP_TRIANGLE_HEIGHT + 2

interface SystemContextLike {
  getManagedProperty: <T>(key: string) => T | undefined
}

const isHandleActive = (
  handleState: GradientHandleState | null,
  fillState: ActiveGradientFillState,
  handleIndex: GradientHandleIndex
) =>
  !!handleState &&
  handleState.elementId === fillState.elementId &&
  handleState.fillId === fillState.fillId &&
  handleState.handleIndex === handleIndex

const isStopActive = (
  stopState: GradientStopState | null,
  fillState: ActiveGradientFillState,
  stopIndex: number
) =>
  !!stopState &&
  stopState.elementId === fillState.elementId &&
  stopState.fillId === fillState.fillId &&
  stopState.stopIndex === stopIndex

const stopColorCache = new Map<string, number>()

/**
 * Convert a CSS hex color string to a numeric color int for the overlay canvas.
 */
const hexToColorInt = (hex: string): number => {
  const cached = stopColorCache.get(hex)
  if (cached !== undefined) {
    return cached
  }

  const parsed = parseColor(hex)
  if (!parsed) {
    return 0xffffff
  }

  const colorInt = rgbaToColorInt(parsed)
  stopColorCache.set(hex, colorInt)
  if (stopColorCache.size > 256) {
    stopColorCache.clear()
  }
  return colorInt
}

/**
 * Compute the perpendicular and parallel unit vectors for the gradient line.
 */
const getLineVectors = (
  start: PositionData,
  end: PositionData
): { ux: number; uy: number; px: number; py: number } => {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const dist = Math.max(0.001, Math.sqrt(dx * dx + dy * dy))
  const ux = dx / dist // unit along gradient
  const uy = dy / dist
  return { ux, uy, px: -uy, py: ux } // px,py = perpendicular (left side)
}

/**
 * Draw a gradient stop indicator: a 16×16 colored rectangle offset from the
 * gradient line, with a small triangle pointer that points at the stop's
 * position on the line.
 */
const drawStopIndicator = (
  canvas: OverlayCanvas,
  linePos: PositionData,
  vectors: { ux: number; uy: number; px: number; py: number },
  fillColor: number,
  strokeColor: number = STOP_STROKE_COLOR
) => {
  const { ux, uy, px, py } = vectors

  // Center of the rectangle, offset perpendicular to the line
  const offsetDist = STOP_OFFSET_FROM_LINE + STOP_RECT_HALF
  const cx = linePos.x + px * offsetDist
  const cy = linePos.y + py * offsetDist

  // Rectangle corners (rotated to align with gradient direction)
  const rectPoints: PositionData[] = [
    {
      x: cx - ux * STOP_RECT_HALF - px * STOP_RECT_HALF,
      y: cy - uy * STOP_RECT_HALF - py * STOP_RECT_HALF
    },
    {
      x: cx + ux * STOP_RECT_HALF - px * STOP_RECT_HALF,
      y: cy + uy * STOP_RECT_HALF - py * STOP_RECT_HALF
    },
    {
      x: cx + ux * STOP_RECT_HALF + px * STOP_RECT_HALF,
      y: cy + uy * STOP_RECT_HALF + py * STOP_RECT_HALF
    },
    {
      x: cx - ux * STOP_RECT_HALF + px * STOP_RECT_HALF,
      y: cy - uy * STOP_RECT_HALF + py * STOP_RECT_HALF
    }
  ]

  canvas.polygon(rectPoints, fillColor, {
    width: STOP_STROKE_WIDTH,
    color: strokeColor
  })

  // Triangle pointer: from the edge of the rectangle toward the gradient line
  const triBase = STOP_RECT_HALF * 0.5 // half-width of triangle base
  const triTip = linePos // tip touches the line position
  const edgeMid = {
    x: linePos.x + px * STOP_OFFSET_FROM_LINE,
    y: linePos.y + py * STOP_OFFSET_FROM_LINE
  }
  const triLeft = {
    x: edgeMid.x - ux * triBase,
    y: edgeMid.y - uy * triBase
  }
  const triRight = {
    x: edgeMid.x + ux * triBase,
    y: edgeMid.y + uy * triBase
  }

  canvas.polygon([triTip, triLeft, triRight], fillColor, {
    width: STOP_STROKE_WIDTH,
    color: strokeColor
  })
}

export const registerGradientFillHandlesRenderLayer = (
  registerRenderLayer: RegisterRenderLayer,
  deps: {
    systemContext: SystemContextLike
  }
) => {
  let lastDrawSignature = ''
  const layerRegistration = createOverlayLayerRegistration({
    name: GRADIENT_FILL_HANDLES_LAYER_NAME,
    zIndex: 12,
    update: (canvas: OverlayCanvas) => {
      const activeGradientFill =
        deps.systemContext.getManagedProperty<ActiveGradientFillState | null>(
          'activeGradientFill'
        ) ?? null
      if (!activeGradientFill) {
        if (lastDrawSignature === 'empty') {
          return false
        }
        lastDrawSignature = 'empty'
        canvas.clear()
        return true
      }

      const geometry = fillApis.getGradientHandleGeometry(
        activeGradientFill.elementId,
        activeGradientFill.fillId
      )
      if (!geometry) {
        const missingSignature = [
          'missing',
          activeGradientFill.elementId,
          activeGradientFill.fillId
        ].join('|')
        if (lastDrawSignature === missingSignature) {
          return false
        }
        lastDrawSignature = missingSignature
        canvas.clear()
        return true
      }

      const hoveredHandle =
        deps.systemContext.getManagedProperty<GradientHandleState | null>(
          'hoveredGradientHandle'
        ) ?? null
      const selectedHandle =
        deps.systemContext.getManagedProperty<GradientHandleState | null>(
          'selectedGradientHandle'
        ) ?? null
      const hoveredStop =
        deps.systemContext.getManagedProperty<GradientStopState | null>(
          'hoveredGradientStop'
        ) ?? null
      const selectedStop =
        deps.systemContext.getManagedProperty<GradientStopState | null>(
          'selectedGradientStop'
        ) ?? null

      const drawSignature = [
        activeGradientFill.elementId,
        activeGradientFill.fillId,
        ...geometry.canvasHandles.map((point) => `${point.x},${point.y}`),
        ...(geometry.fill.gradient?.gradientStops.map(
          (stop) => `${stop.position},${stop.color}`
        ) ?? []),
        hoveredHandle
          ? `${hoveredHandle.elementId},${hoveredHandle.fillId},${hoveredHandle.handleIndex}`
          : '',
        selectedHandle
          ? `${selectedHandle.elementId},${selectedHandle.fillId},${selectedHandle.handleIndex}`
          : '',
        hoveredStop
          ? `${hoveredStop.elementId},${hoveredStop.fillId},${hoveredStop.stopIndex}`
          : '',
        selectedStop
          ? `${selectedStop.elementId},${selectedStop.fillId},${selectedStop.stopIndex}`
          : ''
      ].join('|')
      if (drawSignature === lastDrawSignature) {
        return false
      }
      lastDrawSignature = drawSignature

      canvas.clear()

      // Draw the gradient line
      canvas.line(geometry.canvasHandles[0], geometry.canvasHandles[1], {
        width: HANDLE_LINE_WIDTH,
        color: HANDLE_LINE_COLOR
      })

      // Draw gradient stop indicators as colored rectangles with triangle pointers
      const start = geometry.canvasHandles[0]
      const end = geometry.canvasHandles[1]

      const lineVectors = getLineVectors(start, end)
      geometry.fill.gradient?.gradientStops.forEach((stop, stopIndex) => {
        const linePos = {
          x: start.x + (end.x - start.x) * stop.position,
          y: start.y + (end.y - start.y) * stop.position
        }

        const active =
          isStopActive(selectedStop, activeGradientFill, stopIndex) ||
          isStopActive(hoveredStop, activeGradientFill, stopIndex)

        drawStopIndicator(
          canvas,
          linePos,
          lineVectors,
          hexToColorInt(stop.color),
          active ? STOP_ACTIVE_STROKE_COLOR : STOP_STROKE_COLOR
        )
      })

      // Draw start/end handle circles
      geometry.canvasHandles.forEach((position, handleIndex) => {
        const active =
          isHandleActive(
            selectedHandle,
            activeGradientFill,
            handleIndex as 0 | 1
          ) ||
          isHandleActive(
            hoveredHandle,
            activeGradientFill,
            handleIndex as 0 | 1
          )

        canvas.circle(
          position,
          active ? HANDLE_ACTIVE_RADIUS : HANDLE_RADIUS,
          HANDLE_FILL_COLOR,
          {
            width: 2,
            color: active ? HANDLE_ACTIVE_STROKE_COLOR : HANDLE_STROKE_COLOR
          }
        )
      })
      return true
    }
  })

  registerRenderLayer(layerRegistration, { override: true })
}
