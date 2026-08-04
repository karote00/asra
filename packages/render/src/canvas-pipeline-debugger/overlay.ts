import { markCanvasPipelineDebuggerOwned } from '../diagnostics/canvas-pipeline.js'
import { RenderContainer, RenderGraphics } from '../types/render-object.js'
import type {
  CanvasPipelineDebuggerAdapter,
  CanvasPipelineDebuggerOverlay,
  CanvasPipelineDebuggerOverlayOptions
} from './types.js'

export const CANVAS_PIPELINE_DEBUGGER_LAYER_NAME =
  'canvas-pipeline-debugger:overlay'

const CANVAS_PIPELINE_DEBUGGER_LABEL_PREFIX = 'canvas-pipeline-debugger'
const OVERLAY_COLOR = '#59b7ff'

export const createCanvasPipelineDebuggerOverlay = (
  adapter: CanvasPipelineDebuggerAdapter,
  options: CanvasPipelineDebuggerOverlayOptions = {}
): CanvasPipelineDebuggerOverlay => {
  const root = new RenderContainer({
    label: `${CANVAS_PIPELINE_DEBUGGER_LABEL_PREFIX}:root`
  })
  const graphics = new RenderGraphics()
  graphics.label = `${CANVAS_PIPELINE_DEBUGGER_LABEL_PREFIX}:geometry`
  markCanvasPipelineDebuggerOwned(root)
  markCanvasPipelineDebuggerOwned(graphics)
  root.eventMode = 'none'
  graphics.eventMode = 'none'
  root.addChild(graphics)

  let destroyed = false
  let lastGeometrySignature: string | null = null

  const handleFault = (cause: unknown) => {
    const error = cause instanceof Error ? cause : new Error(String(cause))
    try {
      options.onFault?.(error)
    } catch {
      // Diagnostic failure must never interrupt canonical rendering.
    }
  }

  return {
    registration: {
      name: CANVAS_PIPELINE_DEBUGGER_LAYER_NAME,
      layer: root,
      zIndex: Number.MAX_SAFE_INTEGER,
      shouldUpdate: () => {
        if (destroyed) {
          return false
        }
        try {
          return adapter.isObserving()
        } catch (error) {
          handleFault(error)
          return false
        }
      },
      update: () => {
        if (destroyed) {
          return false
        }
        try {
          const geometry = adapter
            .getSnapshot()
            .focusedElements.flatMap((element) =>
              element.status === 'observed' && element.projection
                ? [element.projection.canvasCorners]
                : []
            )
          const signature = JSON.stringify(geometry)
          if (signature === lastGeometrySignature) {
            return false
          }
          lastGeometrySignature = signature
          graphics.clear()
          geometry.forEach((corners) => {
            const first = corners[0]
            if (!first || corners.length < 2) {
              return
            }
            graphics.moveTo(first.x, first.y)
            corners.slice(1).forEach((point) => {
              graphics.lineTo(point.x, point.y)
            })
            graphics.closePath()
            graphics.stroke({ color: OVERLAY_COLOR, alpha: 1, width: 1 })
          })
          return true
        } catch (error) {
          handleFault(error)
          return false
        }
      }
    },
    destroy: () => {
      if (destroyed) {
        return
      }
      destroyed = true
      root.destroy({ children: true })
    }
  }
}
