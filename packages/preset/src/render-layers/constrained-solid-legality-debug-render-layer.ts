import {
  createOverlayLayerRegistration,
  renderSelectionStore,
  type OverlayCanvas
} from '@asyra/core'
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
      __ASYRA_CONSTRAINED_SOLID_LEGALITY_DEBUG__?: {
        enabled?: boolean
        mode?: 'legality' | 'ownership' | 'all'
      }
    }
  ).__ASYRA_CONSTRAINED_SOLID_LEGALITY_DEBUG__ ?? {}

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
      domain.boundaryPolygon.map((point) =>
        transformPoint(element.worldTransform, point)
      ),
      domain.mode === 'inside'
        ? { color, alpha: 0.12 }
        : { color, alpha: 0.035 },
      { color, width: domain.mode === 'inside' ? 3 : 6 }
    )
  })
}

const getOwnershipColor = (strokeIndex: number | undefined) => {
  const colorIndex =
    typeof strokeIndex === 'number' && Number.isFinite(strokeIndex)
      ? Math.abs(strokeIndex) % OWNERSHIP_COLORS.length
      : 0
  return OWNERSHIP_COLORS[colorIndex]
}

const drawOwnershipDiagnostics = (
  canvas: OverlayCanvas,
  element: RenderElementShape,
  diagnostics: ConstrainedSolidOwnershipDiagnostics
) => {
  diagnostics.ownedRegions.forEach((region) => {
    const color = getOwnershipColor(region.ownerStrokeIndex)
    canvas.polygon(
      region.polygon.map((point) =>
        transformPoint(element.worldTransform, point)
      ),
      { color, alpha: 0.12 },
      { color, width: 3 }
    )
  })
}

export const registerConstrainedSolidLegalityDebugRenderLayer = (
  registerRenderLayer: RegisterRenderLayer,
  deps: Pick<PresetDependencies, 'render'>
) => {
  let lastDrawState: {
    enabled: boolean
    mode: string
    selectedId: string
    diagnostics: ConstrainedSolidLegalityDiagnostics | null
    ownershipDiagnostics: ConstrainedSolidOwnershipDiagnostics | null
  } | null = null
  const layerRegistration = createOverlayLayerRegistration({
    name: CONSTRAINED_SOLID_LEGALITY_DEBUG_LAYER_NAME,
    zIndex: 11,
    update: (canvas: OverlayCanvas) => {
      const debugConfig = getDebugConfig()
      const selectedIds = [...renderSelectionStore.elementSelection]
      const selectedId = selectedIds.length === 1 ? selectedIds[0] : ''
      const element = deps.render.getElementById(selectedId) as
        | (RenderElementShape &
            ConstrainedSolidLegalityDiagnosticsRuntimeGraphic &
            ConstrainedSolidOwnershipDiagnosticsRuntimeGraphic)
        | null
      const diagnostics =
        debugConfig.enabled === true
          ? (element?.__asyraConstrainedSolidLegalityDiagnostics ?? null)
          : null
      const ownershipDiagnostics =
        debugConfig.enabled === true
          ? (element?.__asyraConstrainedSolidOwnershipDiagnostics ?? null)
          : null
      const nextDrawState = {
        enabled: debugConfig.enabled === true,
        mode: debugConfig.mode ?? 'legality',
        selectedId,
        diagnostics,
        ownershipDiagnostics
      }
      if (
        lastDrawState &&
        lastDrawState.enabled === nextDrawState.enabled &&
        lastDrawState.mode === nextDrawState.mode &&
        lastDrawState.selectedId === nextDrawState.selectedId &&
        lastDrawState.diagnostics === nextDrawState.diagnostics &&
        lastDrawState.ownershipDiagnostics ===
          nextDrawState.ownershipDiagnostics
      ) {
        return false
      }
      lastDrawState = nextDrawState

      canvas.clear()
      if (!debugConfig.enabled) {
        return true
      }

      if (selectedIds.length !== 1) {
        return true
      }

      if (!element) {
        return true
      }

      const mode = debugConfig.mode ?? 'legality'
      if (
        (mode === 'legality' || mode === 'all') &&
        diagnostics?.domains.length
      ) {
        drawDiagnostics(canvas, element, diagnostics)
      }
      if (
        (mode === 'ownership' || mode === 'all') &&
        ownershipDiagnostics?.ownedRegions.length
      ) {
        drawOwnershipDiagnostics(canvas, element, ownershipDiagnostics)
      }
      return true
    }
  })

  registerRenderLayer(layerRegistration, { override: true })
}
