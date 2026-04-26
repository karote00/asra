import { defineComponent } from '@asyra/core'
import { PropertyTypes, setElementGeometryLocalBounds } from '@asyra/utils'
import { applyRenderableFill, DEFAULT_RECTANGLE_FILLS, getRenderableFills } from './fills'
import { createRectangleHitArea, mergeHitAreas } from './shape-hit-area'
import { DEFAULT_RECTANGLE_STROKES } from './stroke-render/constants'
import { buildConstrainedDashedStrokeResolvedPackets } from './stroke-render/constrained-dashed-stroke-packets'
import { applyCenterDashedOverlapDiagnostics } from './stroke-render/center-dashed-overlap-diagnostics'
import { buildConstrainedSolidLegalityClippingResult } from './stroke-render/constrained-solid-legality-clipping'
import { setConstrainedSolidLegalityDiagnostics } from './stroke-render/constrained-solid-legality-diagnostics'
import { setConstrainedSolidOwnershipDiagnostics } from './stroke-render/constrained-solid-ownership-diagnostics'
import { buildConstrainedSolidStrokeResolvedPackets } from './stroke-render/constrained-solid-stroke-packets'
import { buildDashedCenterStrokeResolvedPackets } from './stroke-render/dashed-center-stroke-packets'
import { renderSolidCenterStrokeEntries } from './stroke-render/solid-center-stroke-render'
import {
  applySolidCenterStrokeExportPackets,
  buildSolidCenterStrokeResolvedPackets,
  createSolidCenterStrokeHitArea,
  toSolidCenterStrokeRenderEntries
} from './stroke-render/solid-center-stroke-packets'

defineComponent({
  type: 'rect',
  idPrefix: 'rect',
  namePrefix: 'Rectangle',
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
      defaultValue: DEFAULT_RECTANGLE_FILLS
    },
    {
      name: 'strokes',
      type: PropertyTypes.STROKES,
      defaultValue: DEFAULT_RECTANGLE_STROKES
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
    const pathPoints = [
      { x: 0, y: 0 },
      { x: data.width, y: 0 },
      { x: data.width, y: data.height },
      { x: 0, y: data.height }
    ]
    const dashedCenterPackets = buildDashedCenterStrokeResolvedPackets(
      `rect:${data.id ?? 'anonymous'}:dashed-center`,
      pathPoints,
      true,
      data.strokes
    )
    const constrainedDashedCandidatePackets = buildConstrainedDashedStrokeResolvedPackets(
      `rect:${data.id ?? 'anonymous'}:constrained-dashed`,
      pathPoints,
      true,
      data.strokes,
      {
        allowRectFullLoopInsideRoundJoin: true,
        allowRectFullLoopOutsideRoundJoin: true,
        allowRectSingleEdgeInsideRoundCap: true,
        allowRectSingleEdgeOutsideRoundCap: true,
        allowRectCornerSpanningInsideBevel: true,
        allowRectCornerSpanningInsideMiter: true,
        allowRectCornerSpanningOutsideBevel: true,
        allowRectCornerSpanningOutsideMiter: true
      }
    )
    const constrainedDashedPackets =
      constrainedDashedCandidatePackets.length === 1
        ? constrainedDashedCandidatePackets
        : []
    const constrainedResult = buildConstrainedSolidLegalityClippingResult(
      [{ points: pathPoints, closed: true }],
      data.strokes,
      buildConstrainedSolidStrokeResolvedPackets(
        `rect:${data.id ?? 'anonymous'}:constrained`,
        pathPoints,
        true,
        data.strokes
      )
    )
    const constrainedPackets = constrainedResult.packets
    const strokePackets = [
      ...buildSolidCenterStrokeResolvedPackets(
        `rect:${data.id ?? 'anonymous'}:center`,
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
        ? createRectangleHitArea(data.width, data.height)
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
      graphic.rect(0, 0, data.width, data.height)
    }
    replayPath()
    applyRenderableFill(graphic, data.fills, { replayPath })
    graphic.x = data.x
    graphic.y = data.y
  }
})
