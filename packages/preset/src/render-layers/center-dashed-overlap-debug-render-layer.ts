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
  CenterDashedDebugConfig,
  CenterDashedOverlapDiagnostics,
  CenterDashedOverlapDiagnosticsRuntimeGraphic
} from '../components/stroke-render/center-dashed-overlap-diagnostics'

const CENTER_DASHED_OVERLAP_DEBUG_LAYER_NAME = 'center-dashed-overlap-debug-layer'

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

const COMPONENT_COLORS = [0xff00ff, 0x00ffff, 0xffff00, 0x8de24f, 0xff9500]
const OWNERSHIP_COLORS = [0x00ff66, 0x33d1ff, 0xffe066, 0xff8f40, 0xb06cff]
const BAILOUT_FILL_COLOR = 0xff7a00
const BAILOUT_STROKE_COLOR = 0xff3300

const getDebugConfig = (): CenterDashedDebugConfig =>
  (
    globalThis as {
      __ASYRA_PHASE4A_STROKE_DEBUG__?: CenterDashedDebugConfig
    }
  ).__ASYRA_PHASE4A_STROKE_DEBUG__ ?? {}

const transformPoint = (
  matrix: TransformMatrix,
  point: { x: number; y: number }
) => ({
  x: matrix.a * point.x + matrix.c * point.y + matrix.tx,
  y: matrix.b * point.x + matrix.d * point.y + matrix.ty
})

const drawDiagnostics = (
  canvas: OverlayCanvas,
  element: RenderElementShape,
  diagnostics: CenterDashedOverlapDiagnostics
) => {
  diagnostics.components.forEach((component, index) => {
    const color = COMPONENT_COLORS[index % COMPONENT_COLORS.length]
    component.polygons.forEach((polygon) => {
      canvas.polygon(
        polygon.map((point) => transformPoint(element.worldTransform, point)),
        { color, alpha: 0.18 },
        { color, width: 1 }
      )
    })
  })
}

const drawOwnershipDiagnostics = (
  canvas: OverlayCanvas,
  element: RenderElementShape,
  diagnostics: CenterDashedOverlapDiagnostics
) => {
  const ownerColorByStrokeId = new Map<string, number>()
  diagnostics.ownership.ownedRegions.forEach((region) => {
    const nextColor =
      ownerColorByStrokeId.get(region.ownerStrokeId) ??
      OWNERSHIP_COLORS[ownerColorByStrokeId.size % OWNERSHIP_COLORS.length]
    ownerColorByStrokeId.set(region.ownerStrokeId, nextColor)

    canvas.polygon(
      region.polygon.map((point) => transformPoint(element.worldTransform, point)),
      { color: nextColor, alpha: 0.26 },
      { color: nextColor, width: 1.5 }
    )
  })
}

const drawBailoutDiagnostics = (
  canvas: OverlayCanvas,
  element: RenderElementShape,
  diagnostics: CenterDashedOverlapDiagnostics
) => {
  diagnostics.ownership.unresolvedBailouts.forEach((bailout) => {
    bailout.preservedPreviewPolygons.forEach((polygon) => {
      canvas.polygon(
        polygon.map((point) => transformPoint(element.worldTransform, point)),
        { color: BAILOUT_FILL_COLOR, alpha: 0.28 },
        { color: BAILOUT_STROKE_COLOR, width: 2 }
      )
    })
  })
}

export const registerCenterDashedOverlapDebugRenderLayer = (
  registerRenderLayer: RegisterRenderLayer,
  deps: Pick<PresetDependencies, 'render'>
) => {
  const layerRegistration = createOverlayLayerRegistration({
    name: CENTER_DASHED_OVERLAP_DEBUG_LAYER_NAME,
    zIndex: 10,
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
        | (RenderElementShape & CenterDashedOverlapDiagnosticsRuntimeGraphic)
        | null
      const diagnostics = element?.__asyraCenterDashedOverlapDiagnostics
      if (!element || !diagnostics || diagnostics.components.length === 0) {
        return
      }

      const mode = debugConfig.mode ?? 'all'

      if (mode === 'overlap' || mode === 'all') {
        drawDiagnostics(canvas, element, diagnostics)
      }

      if (mode === 'ownership' || mode === 'all') {
        drawOwnershipDiagnostics(canvas, element, diagnostics)
      }

      if (mode === 'bailout' || mode === 'all') {
        drawBailoutDiagnostics(canvas, element, diagnostics)
      }
    }
  })

  registerRenderLayer(layerRegistration, { override: true })
}
