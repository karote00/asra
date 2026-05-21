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
  figmaLikeBoundaryDomainId?: string
  figmaLikeBoundaryPoints?: StrokeFinalFaceDebugMetaBase['figmaLikeBoundaryPoints']
  figmaLikeBoundaryStartDistance?: number
  figmaLikeBoundaryEndDistance?: number
  figmaLikeBoundaryTotalLength?: number
  figmaLikeSplitRangeId?: string
  figmaLikeSplitRangeStartDistance?: number
  figmaLikeSplitRangeEndDistance?: number
  figmaLikeTerminalRole?: 'start' | 'end' | 'start-end' | 'middle'
  figmaLikeSplitRangeSourceSegmentIndex?: number
  figmaLikeSideAuthority?: 'implicit-fill-hole-domain'
  figmaLikeSelectedSide?: 1 | -1
  figmaLikeFilledSide?: 1 | -1
  figmaLikeUnfilledSide?: 1 | -1
  figmaLikeBoundaryRole?: 'outer' | 'hole' | 'filled-face' | 'ambiguous'
  figmaLikeSideResolutionStatus?: 'resolved' | 'blocked'
  figmaLikeSideResolutionReason?: string
  figmaLikeSplitRangeTerminals?: NonNullable<
    StrokeFinalFaceDebugMetaBase['figmaLikeSplitRangeTerminals']
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
    figmaLikeBoundaryDomainId: face.debugMeta?.figmaLikeBoundaryDomainId,
    figmaLikeBoundaryPoints: face.debugMeta?.figmaLikeBoundaryPoints
      ? face.debugMeta.figmaLikeBoundaryPoints.map((point) => ({ ...point }))
      : undefined,
    figmaLikeBoundaryStartDistance:
      face.debugMeta?.figmaLikeBoundaryStartDistance,
    figmaLikeBoundaryEndDistance: face.debugMeta?.figmaLikeBoundaryEndDistance,
    figmaLikeBoundaryTotalLength: face.debugMeta?.figmaLikeBoundaryTotalLength,
    figmaLikeSplitRangeId: face.debugMeta?.figmaLikeSplitRangeId,
    figmaLikeSplitRangeStartDistance:
      face.debugMeta?.figmaLikeSplitRangeStartDistance,
    figmaLikeSplitRangeEndDistance:
      face.debugMeta?.figmaLikeSplitRangeEndDistance,
    figmaLikeTerminalRole: face.debugMeta?.figmaLikeTerminalRole,
    figmaLikeSplitRangeSourceSegmentIndex:
      face.debugMeta?.figmaLikeSplitRangeSourceSegmentIndex,
    figmaLikeSideAuthority: face.debugMeta?.figmaLikeSideAuthority,
    figmaLikeSelectedSide: face.debugMeta?.figmaLikeSelectedSide,
    figmaLikeFilledSide: face.debugMeta?.figmaLikeFilledSide,
    figmaLikeUnfilledSide: face.debugMeta?.figmaLikeUnfilledSide,
    figmaLikeBoundaryRole: face.debugMeta?.figmaLikeBoundaryRole,
    figmaLikeSideResolutionStatus:
      face.debugMeta?.figmaLikeSideResolutionStatus,
    figmaLikeSideResolutionReason:
      face.debugMeta?.figmaLikeSideResolutionReason,
    figmaLikeSplitRangeTerminals: face.debugMeta?.figmaLikeSplitRangeTerminals
      ? face.debugMeta.figmaLikeSplitRangeTerminals.map((terminal) => ({
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
