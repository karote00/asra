import { defineComponent } from '@asyra/core'
import { PropertyTypes, setElementGeometryLocalBounds } from '@asyra/utils'
import { applyRenderableFill, DEFAULT_OVAL_FILLS, getRenderableFills } from './fills'
import { createEllipseHitArea, mergeHitAreas } from './shape-hit-area'
import { DEFAULT_OVAL_STROKES } from './stroke-render/constants'
import { applyCenterDashedOverlapDiagnostics } from './stroke-render/center-dashed-overlap-diagnostics'
import { buildConstrainedDashedStrokeResolvedPackets } from './stroke-render/constrained-dashed-stroke-packets'
import { buildConstrainedSolidLegalityClippingResult } from './stroke-render/constrained-solid-legality-clipping'
import { setConstrainedSolidLegalityDiagnostics } from './stroke-render/constrained-solid-legality-diagnostics'
import { setConstrainedSolidOwnershipDiagnostics } from './stroke-render/constrained-solid-ownership-diagnostics'
import { buildConstrainedSolidStrokeResolvedPackets } from './stroke-render/constrained-solid-stroke-packets'
import { buildDashedCenterStrokeResolvedPackets } from './stroke-render/dashed-center-stroke-packets'
import { renderSolidCenterStrokeEntries } from './stroke-render/solid-center-stroke-render'
import { buildEllipseLoop } from './stroke-render/ellipse-path'
import {
  applySolidCenterStrokeExportPackets,
  buildSolidCenterStrokeResolvedPackets,
  createSolidCenterStrokeHitArea,
  toSolidCenterStrokeRenderEntries
} from './stroke-render/solid-center-stroke-packets'

defineComponent({
  type: 'oval',
  idPrefix: 'oval',
  namePrefix: 'Oval',
  properties: [
    {
      name: PropertyTypes.POSITION,
      type: PropertyTypes.POSITION,
      alias: ['x', 'y']
    },
    {
      name: PropertyTypes.DIMENSION,
      type: PropertyTypes.DIMENSION,
      alias: ['width', 'height']
    },
    {
      name: 'fills',
      type: PropertyTypes.FILLS,
      defaultValue: DEFAULT_OVAL_FILLS
    },
    {
      name: 'strokes',
      type: PropertyTypes.STROKES,
      defaultValue: DEFAULT_OVAL_STROKES
    }
  ],
  renderStrategy: (graphic, data) => {
    graphic.clear()
    setElementGeometryLocalBounds(
      graphic as Parameters<typeof setElementGeometryLocalBounds>[0],
      {
        x: 0,
        y: 0,
        width: data.width,
        height: data.height
      }
    )
    const pathPoints = buildEllipseLoop(data.width, data.height)
    const dashedCenterPackets = buildDashedCenterStrokeResolvedPackets(
      `oval:${data.id ?? 'anonymous'}:dashed-center`,
      pathPoints,
      true,
      data.strokes
    )
    const constrainedDashedCandidatePackets = buildConstrainedDashedStrokeResolvedPackets(
      `oval:${data.id ?? 'anonymous'}:constrained-dashed`,
      pathPoints,
      true,
      data.strokes
    )
    const constrainedDashedPackets =
      constrainedDashedCandidatePackets.length === 1
        ? constrainedDashedCandidatePackets
        : []
    const constrainedResult = buildConstrainedSolidLegalityClippingResult(
      [{ points: pathPoints, closed: true }],
      data.strokes,
      buildConstrainedSolidStrokeResolvedPackets(
        `oval:${data.id ?? 'anonymous'}:constrained`,
        pathPoints,
        true,
        data.strokes
      )
    )
    const constrainedPackets = constrainedResult.packets
    const strokePackets = [
      ...buildSolidCenterStrokeResolvedPackets(
        `oval:${data.id ?? 'anonymous'}:center`,
        pathPoints,
        true,
        data.strokes
      ),
      ...dashedCenterPackets,
      ...constrainedDashedPackets,
      ...constrainedPackets
    ]
    applySolidCenterStrokeExportPackets(graphic, strokePackets)
    applyCenterDashedOverlapDiagnostics(graphic, dashedCenterPackets)
    setConstrainedSolidLegalityDiagnostics(
      graphic,
      constrainedResult.legalityDiagnostics
    )
    setConstrainedSolidOwnershipDiagnostics(
      graphic,
      constrainedResult.ownershipDiagnostics
    )
    const fillHitArea =
      getRenderableFills(data.fills).length > 0
        ? createEllipseHitArea(data.width, data.height)
        : null
    ;(graphic as { hitArea: ReturnType<typeof createSolidCenterStrokeHitArea> | null })
      .hitArea = mergeHitAreas(
      fillHitArea,
      createSolidCenterStrokeHitArea(strokePackets)
    )
    renderSolidCenterStrokeEntries(
      graphic,
      toSolidCenterStrokeRenderEntries(strokePackets)
    )

    const replayPath = () => {
      // Draw ellipse
      graphic.ellipse(
        data.width / 2,
        data.height / 2,
        data.width / 2,
        data.height / 2
      )
    }
    replayPath()
    applyRenderableFill(graphic, data.fills, { replayPath })

    graphic.x = data.x
    graphic.y = data.y

    // Ensure graphic is rendered (force update in E2E)
    graphic.renderable = true
    graphic.visible = true
  }
})
