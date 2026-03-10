import {
  createOverlayLayerRegistration,
  type OverlayCanvas,
  type RegisterRenderLayerOptions,
  type RenderLayerRegistration
} from '@asyra/core'
import { fillApis, type GradientHandleIndex } from '../common-apis/fills'
import type {
  ActiveGradientFillState,
  GradientHandleState
} from '../common-apis/system-context'

const GRADIENT_FILL_HANDLES_LAYER_NAME = 'gradient-fill-handles-layer'
const HANDLE_LINE_COLOR = 0x4c95ff
const HANDLE_LINE_WIDTH = 2
const HANDLE_FILL_COLOR = 0xffffff
const HANDLE_STROKE_COLOR = 0x1b1d20
const HANDLE_ACTIVE_STROKE_COLOR = 0x4c95ff
const HANDLE_RADIUS = 6
const HANDLE_ACTIVE_RADIUS = 7
const STOP_RADIUS = 4
const STOP_STROKE_COLOR = 0x1b1d20

interface SystemContextLike {
  getManagedProperty: <T>(key: string) => T | undefined
}

type RegisterRenderLayer = (
  registration: RenderLayerRegistration,
  options?: RegisterRenderLayerOptions
) => void

const isHandleActive = (
  handleState: GradientHandleState | null,
  fillState: ActiveGradientFillState,
  handleIndex: GradientHandleIndex
) =>
  !!handleState &&
  handleState.elementId === fillState.elementId &&
  handleState.fillId === fillState.fillId &&
  handleState.handleIndex === handleIndex

export const registerGradientFillHandlesRenderLayer = (
  registerRenderLayer: RegisterRenderLayer,
  deps: {
    systemContext: SystemContextLike
  }
) => {
  const layerRegistration = createOverlayLayerRegistration({
    name: GRADIENT_FILL_HANDLES_LAYER_NAME,
    zIndex: 12,
    update: (canvas: OverlayCanvas) => {
      canvas.clear()

      const activeGradientFill =
        deps.systemContext.getManagedProperty<ActiveGradientFillState | null>(
          'activeGradientFill'
        ) ?? null
      if (!activeGradientFill) {
        return
      }

      const geometry = fillApis.getGradientHandleGeometry(
        activeGradientFill.elementId,
        activeGradientFill.fillId
      )
      if (!geometry) {
        return
      }

      const hoveredHandle =
        deps.systemContext.getManagedProperty<GradientHandleState | null>(
          'hoveredGradientHandle'
        ) ?? null
      const selectedHandle =
        deps.systemContext.getManagedProperty<GradientHandleState | null>(
          'selectedGradientHandle'
        ) ?? null

      canvas.line(geometry.canvasHandles[0], geometry.canvasHandles[1], {
        width: HANDLE_LINE_WIDTH,
        color: HANDLE_LINE_COLOR
      })

      geometry.fill.gradient?.gradientStops
        .filter((stop) => stop.position > 0 && stop.position < 1)
        .forEach((stop) => {
          const start = geometry.canvasHandles[0]
          const end = geometry.canvasHandles[1]
          const position = {
            x: start.x + (end.x - start.x) * stop.position,
            y: start.y + (end.y - start.y) * stop.position
          }

          canvas.circle(position, STOP_RADIUS, HANDLE_FILL_COLOR, {
            width: 2,
            color: STOP_STROKE_COLOR
          })
        })

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
    }
  })

  registerRenderLayer(layerRegistration, { override: true })
}
