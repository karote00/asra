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
  ownerStepIds: string[]
  intervalIds: string[]
  terminalRoles: ('start' | 'end' | 'start-end' | 'middle')[]
  seamBoundaryIds: string[]
  sourceSpanIds: string[]
  sourceNetworkIds: string[]
  sourceContourIds: string[]
  legalDomainIds: string[]
  productMode?: string
  productSignature?: string
  domainMode?: string
  topologyFamily?: string
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
    ownerStepIds: [...face.ownerStepIds],
    intervalIds: [...face.intervalIds],
    terminalRoles: [...face.terminalRoles],
    seamBoundaryIds: [...face.seamBoundaryIds],
    sourceSpanIds: [...face.sourceSpanIds],
    sourceNetworkIds: [...(face.sourceNetworkIds ?? [])],
    sourceContourIds: [...face.sourceContourIds],
    legalDomainIds: [...face.legalDomainIds],
    productMode: face.debugMeta?.productMode,
    productSignature: face.debugMeta?.productSignature,
    domainMode: face.debugMeta?.domainMode,
    topologyFamily: face.debugMeta?.topologyFamily,
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
    domainPlanDomainMode: face.debugMeta?.domainPlanDomainMode,
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
