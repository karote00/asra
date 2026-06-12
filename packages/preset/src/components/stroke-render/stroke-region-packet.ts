import type {
  Bounds,
  StrokeFinalFace,
  StrokeOwnerKey,
  Vec2
} from './stroke-final-face'
import {
  buildStrokeFinalFacesFromResolvedPackets,
  type StrokeFinalFaceDebugMetaBase
} from './stroke-final-face'
import type { StrokeRevisionSet } from './stroke-dirty-keys'

interface StrokeResolvedPacketLike {
  geometry: {
    geometryId: string
    polygons: Vec2[][]
    bounds: Bounds
    debugMeta?: StrokeFinalFaceDebugMetaBase
  }
  paint: {
    geometryId: string
    color: number
    alpha: number
    kind?: string
    gradientStyle?: unknown
    paintKey?: string
  }
}

export type StrokeRegionRevisionSet = Omit<StrokeRevisionSet, 'paintRevision'>

export interface StrokeRegionPacket {
  regionId: string
  sourceGeometryIds: string[]
  polygons: Vec2[][]
  bounds: Bounds
  ownerSet: StrokeOwnerKey[]
  intervalIds: string[]
  sourceSpanIds: string[]
  sourceContourIds: string[]
  legalDomainIds: string[]
  geometryFamily?: string
  resolutionStatus?: string
  runtimeStatus?: string
  runtimeReason?: string
  sourceTopology?: string
  topologyFamily?: string
  intervalTopology?: string
  strokePosition?: 'center' | 'inside' | 'outside'
  domainPlanBoundaryDomainId?: string
  domainPlanBoundaryPoints?: StrokeFinalFaceDebugMetaBase['domainPlanBoundaryPoints']
  domainPlanBoundaryStartDistance?: number
  domainPlanBoundaryEndDistance?: number
  domainPlanBoundaryTotalLength?: number
  domainPlanSplitRangeId?: string
  domainPlanSplitRangeStartDistance?: number
  domainPlanSplitRangeEndDistance?: number
  domainPlanTerminalRole?: 'start' | 'end' | 'start-end' | 'middle'
  domainPlanSplitRangeSourceSegmentIndex?: number
  domainPlanSideAuthority?: 'implicit-fill-hole-domain'
  domainPlanSelectedSide?: 1 | -1
  domainPlanFilledSide?: 1 | -1
  domainPlanUnfilledSide?: 1 | -1
  domainPlanBoundaryRole?: 'outer' | 'hole' | 'filled-face' | 'ambiguous'
  domainPlanSideResolutionStatus?: 'resolved' | 'blocked'
  domainPlanSideResolutionReason?: string
  domainPlanSplitRangeTerminals?: NonNullable<
    StrokeFinalFaceDebugMetaBase['domainPlanSplitRangeTerminals']
  >
  arrangementStatus?: 'exact'
  arrangementFaceId?: string
  arrangementCandidateIds?: string[]
  arrangementLegalState?: {
    insideFillDomain: boolean
    outsideFillDomain: boolean
  }
  revisionSet?: Partial<StrokeRegionRevisionSet>
}

const omitPaintRevision = (
  revisionSet: Partial<StrokeRevisionSet> | undefined
): Partial<StrokeRegionRevisionSet> | undefined => {
  if (!revisionSet) {
    return undefined
  }

  const { paintRevision: _paintRevision, ...regionRevisionSet } = revisionSet
  return regionRevisionSet
}

export const buildStrokeRegionPacketsFromFinalFaces = (
  faces: readonly StrokeFinalFace[]
): StrokeRegionPacket[] =>
  faces.map((face) => ({
    regionId: face.faceId,
    sourceGeometryIds: [...face.sourceGeometryIds],
    polygons: face.polygons,
    bounds: face.bounds,
    ownerSet: [...face.ownerSet],
    intervalIds: [...face.intervalIds],
    sourceSpanIds: [...face.sourceSpanIds],
    sourceContourIds: [...face.sourceContourIds],
    legalDomainIds: [...face.legalDomainIds],
    geometryFamily: face.geometryFamily,
    resolutionStatus: face.resolutionStatus,
    runtimeStatus: face.runtimeStatus,
    runtimeReason: face.debugMeta?.runtimeReason,
    sourceTopology: face.sourceTopology,
    topologyFamily: face.debugMeta?.topologyFamily,
    intervalTopology: face.debugMeta?.intervalTopology,
    strokePosition: face.debugMeta?.strokePosition,
    domainPlanBoundaryDomainId: face.debugMeta?.domainPlanBoundaryDomainId,
    domainPlanBoundaryPoints: face.debugMeta?.domainPlanBoundaryPoints
      ? face.debugMeta.domainPlanBoundaryPoints.map((point) => ({ ...point }))
      : undefined,
    domainPlanBoundaryStartDistance:
      face.debugMeta?.domainPlanBoundaryStartDistance,
    domainPlanBoundaryEndDistance:
      face.debugMeta?.domainPlanBoundaryEndDistance,
    domainPlanBoundaryTotalLength:
      face.debugMeta?.domainPlanBoundaryTotalLength,
    domainPlanSplitRangeId: face.debugMeta?.domainPlanSplitRangeId,
    domainPlanSplitRangeStartDistance:
      face.debugMeta?.domainPlanSplitRangeStartDistance,
    domainPlanSplitRangeEndDistance:
      face.debugMeta?.domainPlanSplitRangeEndDistance,
    domainPlanTerminalRole: face.debugMeta?.domainPlanTerminalRole,
    domainPlanSplitRangeSourceSegmentIndex:
      face.debugMeta?.domainPlanSplitRangeSourceSegmentIndex,
    domainPlanSideAuthority: face.debugMeta?.domainPlanSideAuthority,
    domainPlanSelectedSide: face.debugMeta?.domainPlanSelectedSide,
    domainPlanFilledSide: face.debugMeta?.domainPlanFilledSide,
    domainPlanUnfilledSide: face.debugMeta?.domainPlanUnfilledSide,
    domainPlanBoundaryRole: face.debugMeta?.domainPlanBoundaryRole,
    domainPlanSideResolutionStatus:
      face.debugMeta?.domainPlanSideResolutionStatus,
    domainPlanSideResolutionReason:
      face.debugMeta?.domainPlanSideResolutionReason,
    domainPlanSplitRangeTerminals: face.debugMeta?.domainPlanSplitRangeTerminals
      ? face.debugMeta.domainPlanSplitRangeTerminals.map((terminal) => ({
          ...terminal
        }))
      : undefined,
    arrangementStatus: face.debugMeta?.arrangementStatus,
    arrangementFaceId: face.debugMeta?.arrangementFaceId,
    arrangementCandidateIds: face.debugMeta?.arrangementCandidateIds
      ? [...face.debugMeta.arrangementCandidateIds]
      : undefined,
    arrangementLegalState: face.debugMeta?.arrangementLegalState,
    revisionSet: omitPaintRevision(face.debugMeta?.revisionSet)
  }))

export const buildStrokeRegionPacketsFromResolvedPackets = (
  packets: readonly StrokeResolvedPacketLike[]
): StrokeRegionPacket[] =>
  buildStrokeRegionPacketsFromFinalFaces(
    buildStrokeFinalFacesFromResolvedPackets(packets)
  )
