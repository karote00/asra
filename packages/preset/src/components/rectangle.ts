import { defineComponent } from '@asyra/core'
import { PropertyTypes, setElementGeometryLocalBounds } from '@asyra/utils'
import {
  applyRenderableFill,
  DEFAULT_RECTANGLE_FILLS,
  getRenderableFills
} from './fills'
import { createRectangleHitArea, mergeHitAreas } from './shape-hit-area'
import { DEFAULT_RECTANGLE_STROKES } from './stroke-render/constants'
import {
  buildConstrainedDashedStrokeResolvedPackets,
  hasConstrainedDashedStrokeIntent
} from './stroke-render/constrained-dashed-stroke-packets'
import {
  applyCenterDashedOverlapDiagnostics,
  clearCenterDashedOverlapDiagnostics
} from './stroke-render/center-dashed-overlap-diagnostics'
import { buildConstrainedSolidLegalityClippingResult } from './stroke-render/constrained-solid-legality-clipping'
import {
  clearConstrainedSolidLegalityDiagnostics,
  setConstrainedSolidLegalityDiagnostics
} from './stroke-render/constrained-solid-legality-diagnostics'
import {
  clearConstrainedSolidOwnershipDiagnostics,
  createEmptyConstrainedSolidOwnershipDiagnostics,
  setConstrainedSolidOwnershipDiagnostics
} from './stroke-render/constrained-solid-ownership-diagnostics'
import {
  buildConstrainedSolidStrokeResolvedPackets,
  hasConstrainedSolidStrokeIntent
} from './stroke-render/constrained-solid-stroke-packets'
import {
  buildDashedCenterStrokeResolvedPackets,
  hasDashedCenterStrokeIntent
} from './stroke-render/dashed-center-stroke-packets'
import { renderSolidCenterStrokeEntries } from './stroke-render/solid-center-stroke-render'
import { buildPathTopologyModel } from './stroke-render/path-topology-model'
import {
  applySolidCenterStrokeExportPackets,
  buildSolidCenterStrokeResolvedPackets,
  createSolidCenterStrokeHitArea,
  hasSolidCenterStrokeIntent,
  toSolidCenterStrokeRenderEntries
} from './stroke-render/solid-center-stroke-packets'
import { shouldEmitFullStrokeDiagnostics } from './stroke-render/stroke-diagnostics-mode'

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
    const pathTopology = buildPathTopologyModel({
      pathId: `rect:${data.id ?? 'anonymous'}`,
      sourceId: `rect:${data.id ?? 'anonymous'}`,
      networkId: 'rect',
      sourceFamily: 'shape',
      points: pathPoints,
      closed: true
    })
    const hasCenterDashedIntent = hasDashedCenterStrokeIntent(data.strokes)
    const hasCenterSolidIntent = hasSolidCenterStrokeIntent(data.strokes)
    const shouldAttachFullStrokeDiagnostics = shouldEmitFullStrokeDiagnostics()
    const dashedCenterPackets = hasCenterDashedIntent
      ? buildDashedCenterStrokeResolvedPackets(
          `rect:${data.id ?? 'anonymous'}:dashed-center`,
          pathPoints,
          true,
          data.strokes,
          {
            metadata: {
              ownerKeyPrefix: `rect:${data.id ?? 'anonymous'}`
            },
            topology: pathTopology
          }
        )
      : []
    const hasConstrainedDashedIntent = hasConstrainedDashedStrokeIntent(
      data.strokes
    )
    const constrainedDashedCandidatePackets = hasConstrainedDashedIntent
      ? buildConstrainedDashedStrokeResolvedPackets(
          `rect:${data.id ?? 'anonymous'}:constrained-dashed`,
          pathPoints,
          true,
          data.strokes,
          {
            metadata: {
              ownerKeyPrefix: `rect:${data.id ?? 'anonymous'}`
            },
            topology: pathTopology
          }
        )
      : []
    const constrainedDashedPackets = constrainedDashedCandidatePackets
    const hasConstrainedSolidIntent = hasConstrainedSolidStrokeIntent(
      data.strokes
    )
    const constrainedResult = hasConstrainedSolidIntent
      ? buildConstrainedSolidLegalityClippingResult(
          [{ points: pathPoints, closed: true }],
          data.strokes,
          buildConstrainedSolidStrokeResolvedPackets(
            `rect:${data.id ?? 'anonymous'}:constrained`,
            pathPoints,
            true,
            data.strokes,
            {
              metadata: {
                ownerKeyPrefix: `rect:${data.id ?? 'anonymous'}`
              },
              topology: pathTopology
            }
          ),
          {
            includeOwnershipDiagnosticsForPreservedPackets:
              shouldAttachFullStrokeDiagnostics
          }
        )
      : {
          packets: [],
          legalityDiagnostics: { domains: [], acceptedGeometryIds: [] },
          ownershipDiagnostics:
            createEmptyConstrainedSolidOwnershipDiagnostics()
        }
    const constrainedPackets = constrainedResult.packets
    const strokePackets = [
      ...(hasCenterSolidIntent
        ? buildSolidCenterStrokeResolvedPackets(
            `rect:${data.id ?? 'anonymous'}:center`,
            pathPoints,
            true,
            data.strokes,
            {
              metadata: {
                ownerKeyPrefix: `rect:${data.id ?? 'anonymous'}`
              },
              topology: pathTopology
            }
          )
        : []),
      ...dashedCenterPackets,
      ...constrainedDashedPackets,
      ...constrainedPackets
    ]
    applySolidCenterStrokeExportPackets(graphic, strokePackets)
    if (shouldAttachFullStrokeDiagnostics) {
      applyCenterDashedOverlapDiagnostics(graphic, dashedCenterPackets)
      setConstrainedSolidLegalityDiagnostics(
        graphic,
        constrainedResult.legalityDiagnostics
      )
      setConstrainedSolidOwnershipDiagnostics(
        graphic,
        constrainedResult.ownershipDiagnostics
      )
    } else {
      clearCenterDashedOverlapDiagnostics(graphic)
      clearConstrainedSolidLegalityDiagnostics(graphic)
      clearConstrainedSolidOwnershipDiagnostics(graphic)
    }
    const fillHitArea =
      getRenderableFills(data.fills).length > 0
        ? createRectangleHitArea(data.width, data.height)
        : null
    ;(
      graphic as {
        hitArea: ReturnType<typeof createSolidCenterStrokeHitArea> | null
      }
    ).hitArea = mergeHitAreas(
      fillHitArea,
      createSolidCenterStrokeHitArea(strokePackets)
    )
    const replayPath = () => {
      graphic.rect(0, 0, data.width, data.height)
    }
    replayPath()
    applyRenderableFill(graphic, data.fills, { replayPath })
    renderSolidCenterStrokeEntries(
      graphic,
      toSolidCenterStrokeRenderEntries(strokePackets)
    )
    graphic.x = data.x
    graphic.y = data.y
  }
})
