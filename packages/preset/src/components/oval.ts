import { defineComponent } from '@asyra/core'
import { PropertyTypes, setElementGeometryLocalBounds } from '@asyra/utils'
import {
  applyRenderableFill,
  DEFAULT_OVAL_FILLS,
  getRenderableFills
} from './fills'
import { createEllipseHitArea, mergeHitAreas } from './shape-hit-area'
import { DEFAULT_OVAL_STROKES } from './stroke-render/constants'
import { applyCenterDashedOverlapDiagnostics } from './stroke-render/center-dashed-overlap-diagnostics'
import {
  buildConstrainedDashedStrokeResolvedPackets,
  classifyConstrainedDashedRuntimeStatus,
  hasConstrainedDashedStrokeIntent
} from './stroke-render/constrained-dashed-stroke-packets'
import {
  clearConstrainedDashedRuntimeDiagnostics,
  setConstrainedDashedRuntimeDiagnostics
} from './stroke-render/constrained-dashed-runtime-diagnostics'
import { buildConstrainedSolidLegalityClippingResult } from './stroke-render/constrained-solid-legality-clipping'
import { setConstrainedSolidLegalityDiagnostics } from './stroke-render/constrained-solid-legality-diagnostics'
import {
  buildConstrainedSolidOwnershipDiagnostics,
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
import { buildEllipseLoop } from './stroke-render/ellipse-path'
import { buildPathTopologyModel } from './stroke-render/path-topology-model'
import {
  attachStrokePacketDebugMeta,
  applySolidCenterStrokeExportPackets,
  buildSolidCenterStrokeResolvedPackets,
  createSolidCenterStrokeHitArea,
  hasSolidCenterStrokeIntent,
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
    const pathTopology = buildPathTopologyModel({
      pathId: `oval:${data.id ?? 'anonymous'}`,
      sourceId: `oval:${data.id ?? 'anonymous'}`,
      networkId: 'oval',
      sourceFamily: 'shape',
      points: pathPoints,
      closed: true
    })
    const hasCenterDashedIntent = hasDashedCenterStrokeIntent(data.strokes)
    const hasCenterSolidIntent = hasSolidCenterStrokeIntent(data.strokes)
    const dashedCenterPackets = hasCenterDashedIntent
      ? buildDashedCenterStrokeResolvedPackets(
          `oval:${data.id ?? 'anonymous'}:dashed-center`,
          pathPoints,
          true,
          data.strokes,
          {
            metadata: {
              ownerKeyPrefix: `oval:${data.id ?? 'anonymous'}`
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
          `oval:${data.id ?? 'anonymous'}:constrained-dashed`,
          pathPoints,
          true,
          data.strokes,
          {
            metadata: {
              ownerKeyPrefix: `oval:${data.id ?? 'anonymous'}`
            },
            topology: pathTopology
          }
        )
      : []
    const constrainedDashedRuntimeStatus = hasConstrainedDashedIntent
      ? classifyConstrainedDashedRuntimeStatus({
          points: pathPoints,
          closed: true,
          topology: pathTopology,
          candidatePackets: constrainedDashedCandidatePackets
        })
      : null
    const constrainedDashedPackets =
      constrainedDashedRuntimeStatus?.status === 'accepted'
        ? attachStrokePacketDebugMeta(constrainedDashedCandidatePackets, {
            runtimeStatus: constrainedDashedRuntimeStatus.status,
            runtimeReason: constrainedDashedRuntimeStatus.reason,
            sourceTopology: constrainedDashedRuntimeStatus.sourceTopology,
            ownershipStatus: constrainedDashedRuntimeStatus.ownership.status,
            ownerCount: constrainedDashedRuntimeStatus.ownership.ownerKeys.length
          })
        : []
    if (constrainedDashedRuntimeStatus) {
      setConstrainedDashedRuntimeDiagnostics(
        graphic,
        [
          {
            sourceId: `oval:${data.id ?? 'anonymous'}`,
            candidatePacketCount: constrainedDashedCandidatePackets.length,
            ...constrainedDashedRuntimeStatus
          }
        ],
        () =>
          buildConstrainedSolidOwnershipDiagnostics(
            constrainedDashedCandidatePackets
          )
      )
    } else {
      clearConstrainedDashedRuntimeDiagnostics(graphic)
    }
    const hasConstrainedSolidIntent = hasConstrainedSolidStrokeIntent(
      data.strokes
    )
    const constrainedResult = hasConstrainedSolidIntent
      ? buildConstrainedSolidLegalityClippingResult(
          [{ points: pathPoints, closed: true }],
          data.strokes,
          buildConstrainedSolidStrokeResolvedPackets(
            `oval:${data.id ?? 'anonymous'}:constrained`,
            pathPoints,
            true,
            data.strokes,
            {
              metadata: {
                ownerKeyPrefix: `oval:${data.id ?? 'anonymous'}`
              },
              topology: pathTopology
            }
          )
        )
      : {
          packets: [],
          legalityDiagnostics: { domains: [], acceptedGeometryIds: [] },
          ownershipDiagnostics: createEmptyConstrainedSolidOwnershipDiagnostics()
        }
    const constrainedPackets = constrainedResult.packets
    const strokePackets = [
      ...(hasCenterSolidIntent
        ? buildSolidCenterStrokeResolvedPackets(
            `oval:${data.id ?? 'anonymous'}:center`,
            pathPoints,
            true,
            data.strokes,
            {
              metadata: {
                ownerKeyPrefix: `oval:${data.id ?? 'anonymous'}`
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
    ;(
      graphic as {
        hitArea: ReturnType<typeof createSolidCenterStrokeHitArea> | null
      }
    ).hitArea = mergeHitAreas(
      fillHitArea,
      createSolidCenterStrokeHitArea(strokePackets)
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
    renderSolidCenterStrokeEntries(
      graphic,
      toSolidCenterStrokeRenderEntries(strokePackets)
    )

    graphic.x = data.x
    graphic.y = data.y

    // Ensure graphic is rendered (force update in E2E)
    graphic.renderable = true
    graphic.visible = true
  }
})
