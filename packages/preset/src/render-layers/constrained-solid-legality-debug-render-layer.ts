import { createOverlayLayerRegistration, renderSelectionStore, type OverlayCanvas } from '@asyra/core'
import type {
  RegisterRenderLayerOptions,
  RenderLayerRegistration
} from '@asyra/core'
import type { PresetDependencies } from '../types'
import type {
  ConstrainedSolidLegalityDiagnostics,
  ConstrainedSolidLegalityDiagnosticsRuntimeGraphic
} from '../components/stroke-render/constrained-solid-legality-diagnostics'
import type {
  ConstrainedSolidOwnershipDiagnostics,
  ConstrainedSolidOwnershipDiagnosticsRuntimeGraphic
} from '../components/stroke-render/constrained-solid-ownership-diagnostics'

const CONSTRAINED_SOLID_LEGALITY_DEBUG_LAYER_NAME =
  'constrained-solid-legality-debug-layer'

interface TransformMatrix {
  a: number
  b: number
  c: number
  d: number
  tx: number
  ty: number
}

interface RenderElementShape {
  worldTransform: TransformMatrix
}

type RegisterRenderLayer = (
  registration: RenderLayerRegistration,
  options?: RegisterRenderLayerOptions
) => void

const getDebugConfig = () =>
  (
    globalThis as {
      __ASYRA_PHASE4B_STROKE_DEBUG__?: {
        enabled?: boolean
        mode?: 'legality' | 'ownership' | 'all'
      }
    }
  ).__ASYRA_PHASE4B_STROKE_DEBUG__ ?? {}

const transformPoint = (
  matrix: TransformMatrix,
  point: { x: number; y: number }
) => ({
  x: matrix.a * point.x + matrix.c * point.y + matrix.tx,
  y: matrix.b * point.x + matrix.d * point.y + matrix.ty
})

const INSIDE_COLOR = 0x00ffff
const OUTSIDE_COLOR = 0xff7700
const OWNERSHIP_COLORS = [0x6eff6e, 0x4fd5ff, 0xffe16a, 0xff7bd5]

const drawDiagnostics = (
  canvas: OverlayCanvas,
  element: RenderElementShape,
  diagnostics: ConstrainedSolidLegalityDiagnostics
) => {
  diagnostics.domains.forEach((domain) => {
    const color = domain.mode === 'inside' ? INSIDE_COLOR : OUTSIDE_COLOR
    canvas.polygon(
      domain.boundaryPolygon.map((point) => transformPoint(element.worldTransform, point)),
      domain.mode === 'inside'
        ? { color, alpha: 0.12 }
        : { color, alpha: 0.035 },
      { color, width: domain.mode === 'inside' ? 3 : 6 }
    )
  })
}

const getOwnershipColor = (strokeId: string) => {
  const numericSuffix = Number(strokeId.split(':').pop())
  const colorIndex = Number.isFinite(numericSuffix)
    ? Math.abs(numericSuffix) % OWNERSHIP_COLORS.length
    : 0
  return OWNERSHIP_COLORS[colorIndex]
}

const drawOwnershipDiagnostics = (
  canvas: OverlayCanvas,
  element: RenderElementShape,
  diagnostics: ConstrainedSolidOwnershipDiagnostics
) => {
  diagnostics.ownedRegions.forEach((region) => {
    const color = getOwnershipColor(region.ownerStrokeId)
    canvas.polygon(
      region.polygon.map((point) => transformPoint(element.worldTransform, point)),
      { color, alpha: 0.12 },
      { color, width: 3 }
    )
  })
}

export const registerConstrainedSolidLegalityDebugRenderLayer = (
  registerRenderLayer: RegisterRenderLayer,
  deps: Pick<PresetDependencies, 'render'>
) => {
  const layerRegistration = createOverlayLayerRegistration({
    name: CONSTRAINED_SOLID_LEGALITY_DEBUG_LAYER_NAME,
    zIndex: 11,
    update: (canvas: OverlayCanvas) => {
      canvas.clear()

      const debugConfig = getDebugConfig()
      if (!debugConfig.enabled) {
        return
      }

      const selectedIds = [...renderSelectionStore.elementSelection]
      if (selectedIds.length !== 1) {
        return
      }

      const element = deps.render.getElementById(selectedIds[0]) as
        | (RenderElementShape &
            ConstrainedSolidLegalityDiagnosticsRuntimeGraphic &
            ConstrainedSolidOwnershipDiagnosticsRuntimeGraphic)
        | null
      const diagnostics = element?.__asyraConstrainedSolidLegalityDiagnostics
      const ownershipDiagnostics =
        element?.__asyraConstrainedSolidOwnershipDiagnostics
      if (!element) {
        return
      }

      const mode = debugConfig.mode ?? 'legality'
      if ((mode === 'legality' || mode === 'all') && diagnostics?.domains.length) {
        drawDiagnostics(canvas, element, diagnostics)
      }
      if (
        (mode === 'ownership' || mode === 'all') &&
        ownershipDiagnostics?.ownedRegions.length
      ) {
        drawOwnershipDiagnostics(canvas, element, ownershipDiagnostics)
      }
    }
  })

  registerRenderLayer(layerRegistration, { override: true })
}
