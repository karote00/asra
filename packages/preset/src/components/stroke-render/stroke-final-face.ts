import {
  pushUniqueStrokeOwner,
  resolveStrokeOwnership
} from './stroke-ownership'
import type { PaintAttachedStrokeRegion } from './stroke-paint-payload'

export interface Vec2 {
  x: number
  y: number
}

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface StrokeFinalFaceDebugMetaBase {
  sourcePathId?: string
  ownerKey?: string
  networkId?: string
  strokeId?: string
  strokeIndex?: number
  contourId?: string
  legalDomainId?: string | null
  intervalId?: string
  sourceSpanIds?: string[]
  geometryFamily?: string
  resolutionStatus?: string
  runtimeStatus?: string
  runtimeReason?: string
  sourceTopology?: string
  topologyFamily?: string
  intervalTopology?: string
  strokePosition?: 'center' | 'inside' | 'outside'
  ownerSet?: StrokeOwnerKey[]
  intervalIds?: string[]
  sourceContourIds?: string[]
  legalDomainIds?: string[]
  arrangementStatus?: 'exact'
  arrangementFaceId?: string
  arrangementCandidateIds?: string[]
  arrangementLegalState?: {
    insideFillDomain: boolean
    outsideFillDomain: boolean
  }
  figmaLikeBoundaryDomainId?: string
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
  figmaLikeBoundaryPoints?: Vec2[]
  figmaLikeBoundaryStartDistance?: number
  figmaLikeBoundaryEndDistance?: number
  figmaLikeBoundaryTotalLength?: number
  visualOverlapCollapseStatus?:
    | 'exact-union'
    | 'exact-arrangement'
    | 'local-side-arrangement'
    | 'render-projection-arrangement'
  visualOverlapSourceFaceIds?: string[]
  visualOverlapSourceGeometryIds?: string[]
  figmaLikeSplitRangeTerminals?: {
    intervalId: string
    boundaryDomainId?: string
    boundaryPoints?: Vec2[]
    boundaryStartDistance?: number
    boundaryEndDistance?: number
    boundaryTotalLength?: number
    splitRangeId: string
    splitRangeStartDistance: number
    splitRangeEndDistance: number
    terminalRole: 'start' | 'end' | 'start-end' | 'middle'
    startDistance: number
    endDistance: number
    sourceSegmentIndex?: number
    selectedSide?: 1 | -1
    filledSide?: 1 | -1
    unfilledSide?: 1 | -1
    boundaryRole?: 'outer' | 'hole' | 'filled-face' | 'ambiguous'
  }[]
  visualContext?: Partial<StrokeVisualContext>
  revisionSet?: {
    strokeSpecRevision?: string | number
    paintRevision?: string | number
    legalityRevision?: string | number
  }
}

interface StrokeResolvedPacketLike<
  TDebugMeta extends StrokeFinalFaceDebugMetaBase,
  TPaint extends StrokeFinalFacePaint
> {
  geometry: {
    geometryId: string
    polygons: Vec2[][]
    bounds: Bounds
    debugMeta?: TDebugMeta
    renderDescriptor?: unknown
  }
  paint: TPaint
}

interface StrokeFinalFacePaint {
  geometryId: string
  kind?: string
  color: number
  alpha: number
  gradientStyle?: unknown
  paintKey?: string
}

export interface StrokeVisualContext {
  opacity: number
  blendMode: string
  effectKey: string
  maskKey: string
  clipKey: string
  stackingGroupKey: string
  visibilityKey: string
  runtimeFamilyKey: string
}

export interface StrokeOwnerKey {
  ownerKey?: string
  sourcePathId?: string
  networkId?: string
  strokeId?: string
  strokeIndex?: number
  contourId?: string
  intervalId?: string
}

export interface StrokeFinalFace<
  TDebugMeta extends
    StrokeFinalFaceDebugMetaBase = StrokeFinalFaceDebugMetaBase,
  TPaint extends StrokeFinalFacePaint = StrokeFinalFacePaint
> {
  faceId: string
  sourceGeometryIds: string[]
  polygons: Vec2[][]
  bounds: Bounds
  visualPacketKey: string
  paintKey: string
  strokeSpecKey: string
  ownerSet: StrokeOwnerKey[]
  intervalIds: string[]
  sourceSpanIds: string[]
  sourceContourIds: string[]
  legalDomainIds: string[]
  geometryFamily?: string
  resolutionStatus?: string
  runtimeStatus?: string
  sourceTopology?: string
  debugMeta?: TDebugMeta
  renderDescriptor?: unknown
  paint: TPaint
}

export interface BuildStrokeFinalFaceOptions {
  collapseDuplicateFaces?: boolean
}

const roundGeometryCoordinate = (value: number) =>
  Math.round(value * 1_000_000) / 1_000_000

const hashStableString = (prefix: string, value: string) => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return `${prefix}:${(hash >>> 0).toString(36)}`
}

const pushUnique = <T>(items: T[], value: T) => {
  if (!items.includes(value)) {
    items.push(value)
  }
}

const pushUniqueSplitRangeTerminal = (
  terminals: NonNullable<
    StrokeFinalFaceDebugMetaBase['figmaLikeSplitRangeTerminals']
  >,
  terminal: NonNullable<
    StrokeFinalFaceDebugMetaBase['figmaLikeSplitRangeTerminals']
  >[number]
) => {
  const exists = terminals.some(
    (existing) =>
      existing.intervalId === terminal.intervalId &&
      existing.splitRangeId === terminal.splitRangeId &&
      existing.terminalRole === terminal.terminalRole &&
      existing.startDistance === terminal.startDistance &&
      existing.endDistance === terminal.endDistance
  )

  if (!exists) {
    terminals.push({ ...terminal })
  }
}

const mergeFaceDebugMeta = (
  target: StrokeFinalFaceDebugMetaBase | undefined,
  source: StrokeFinalFaceDebugMetaBase | undefined
) => {
  if (!target || !source) {
    return
  }

  if (source.ownerSet) {
    target.ownerSet = target.ownerSet ? [...target.ownerSet] : []
    source.ownerSet.forEach((owner) =>
      pushUniqueStrokeOwner(target.ownerSet ?? [], owner)
    )
  }

  ;[
    'intervalIds',
    'sourceSpanIds',
    'sourceContourIds',
    'legalDomainIds',
    'visualOverlapSourceFaceIds',
    'visualOverlapSourceGeometryIds'
  ].forEach((key) => {
    const typedKey = key as keyof Pick<
      StrokeFinalFaceDebugMetaBase,
      | 'intervalIds'
      | 'sourceSpanIds'
      | 'sourceContourIds'
      | 'legalDomainIds'
      | 'visualOverlapSourceFaceIds'
      | 'visualOverlapSourceGeometryIds'
    >
    const sourceValues = source[typedKey]
    if (!sourceValues) {
      return
    }

    const targetValues = [...(target[typedKey] ?? [])]
    sourceValues.forEach((value) => pushUnique(targetValues, value))
    ;(target[typedKey] as string[] | undefined) = targetValues
  })

  if (source.figmaLikeSplitRangeTerminals) {
    const targetTerminals = [
      ...(target.figmaLikeSplitRangeTerminals ?? [])
    ] satisfies NonNullable<
      StrokeFinalFaceDebugMetaBase['figmaLikeSplitRangeTerminals']
    >
    source.figmaLikeSplitRangeTerminals.forEach((terminal) =>
      pushUniqueSplitRangeTerminal(targetTerminals, terminal)
    )
    target.figmaLikeSplitRangeTerminals = targetTerminals
  }

  if (source.figmaLikeBoundaryPoints) {
    target.figmaLikeBoundaryPoints = source.figmaLikeBoundaryPoints.map(
      (point) => ({ ...point })
    )
  }
  target.figmaLikeBoundaryStartDistance ??=
    source.figmaLikeBoundaryStartDistance
  target.figmaLikeBoundaryEndDistance ??= source.figmaLikeBoundaryEndDistance
  target.figmaLikeBoundaryTotalLength ??= source.figmaLikeBoundaryTotalLength
}

const buildPolygonSignature = (polygon: Vec2[]) => {
  const points = polygon.map(
    (point) =>
      `${roundGeometryCoordinate(point.x)},${roundGeometryCoordinate(point.y)}`
  )
  const rotations = points.map((_, index) => [
    ...points.slice(index),
    ...points.slice(0, index)
  ])
  const reversedPoints = [...points].reverse()
  const reversedRotations = reversedPoints.map((_, index) => [
    ...reversedPoints.slice(index),
    ...reversedPoints.slice(0, index)
  ])

  return [...rotations, ...reversedRotations]
    .map((rotation) => rotation.join('|'))
    .sort((left, right) => left.localeCompare(right))[0]
}

const buildPolygonsSignature = (polygons: Vec2[][]) =>
  polygons
    .map((polygon) => buildPolygonSignature(polygon))
    .sort((left, right) => left.localeCompare(right))
    .join('||')

const buildPaintKey = <
  TDebugMeta extends StrokeFinalFaceDebugMetaBase,
  TPaint extends StrokeFinalFacePaint
>(
  packet: StrokeResolvedPacketLike<TDebugMeta, TPaint>
) =>
  packet.paint.paintKey ??
  [
    packet.paint.kind ?? 'solid',
    packet.paint.color,
    packet.paint.alpha,
    packet.paint.gradientStyle ? 'gradient' : 'flat'
  ].join(':')

const buildVisualContext = <
  TDebugMeta extends StrokeFinalFaceDebugMetaBase,
  TPaint extends StrokeFinalFacePaint
>(
  packet: StrokeResolvedPacketLike<TDebugMeta, TPaint>
): StrokeVisualContext => {
  const context = packet.geometry.debugMeta?.visualContext

  return {
    opacity: context?.opacity ?? packet.paint.alpha,
    blendMode: context?.blendMode ?? 'normal',
    effectKey: context?.effectKey ?? 'effect:none',
    maskKey: context?.maskKey ?? 'mask:none',
    clipKey: context?.clipKey ?? 'clip:none',
    stackingGroupKey: context?.stackingGroupKey ?? 'stack:default',
    visibilityKey:
      context?.visibilityKey ??
      `visibility:${packet.geometry.debugMeta?.runtimeStatus ?? 'unknown'}`,
    runtimeFamilyKey:
      context?.runtimeFamilyKey ??
      [
        packet.geometry.debugMeta?.geometryFamily ?? 'family:unknown',
        packet.geometry.debugMeta?.resolutionStatus ?? 'resolution:unknown',
        packet.geometry.debugMeta?.runtimeStatus ?? 'runtime:unknown'
      ].join(':')
  }
}

const buildStrokeSpecKey = <
  TDebugMeta extends StrokeFinalFaceDebugMetaBase,
  TPaint extends StrokeFinalFacePaint
>(
  packet: StrokeResolvedPacketLike<TDebugMeta, TPaint>
) =>
  String(
    packet.geometry.debugMeta?.revisionSet?.strokeSpecRevision ??
      [
        packet.geometry.debugMeta?.geometryFamily ?? 'unknown-family',
        packet.geometry.debugMeta?.strokeId ?? 'unknown-stroke',
        packet.geometry.debugMeta?.resolutionStatus ?? 'unknown-resolution'
      ].join(':')
  )

const buildVisualPacketKey = <
  TDebugMeta extends StrokeFinalFaceDebugMetaBase,
  TPaint extends StrokeFinalFacePaint
>(
  packet: StrokeResolvedPacketLike<TDebugMeta, TPaint>
) => {
  const visualContext = buildVisualContext(packet)
  const paintKey = buildPaintKey(packet)
  const paintRevision =
    packet.geometry.debugMeta?.revisionSet?.paintRevision ?? 'paint:unknown'
  const strokeSpecKey = buildStrokeSpecKey(packet)

  return [
    `paintKey:${paintKey}`,
    `paintRevision:${paintRevision}`,
    `strokeSpecKey:${strokeSpecKey}`,
    `opacity:${visualContext.opacity}`,
    `blendMode:${visualContext.blendMode}`,
    `effectKey:${visualContext.effectKey}`,
    `maskKey:${visualContext.maskKey}`,
    `clipKey:${visualContext.clipKey}`,
    `stackingGroupKey:${visualContext.stackingGroupKey}`,
    `visibilityKey:${visualContext.visibilityKey}`,
    `runtimeFamilyKey:${visualContext.runtimeFamilyKey}`
  ].join('|')
}

const buildOwnerKey = (
  debugMeta: StrokeFinalFaceDebugMetaBase | undefined
): StrokeOwnerKey => ({
  ownerKey: debugMeta?.ownerKey,
  sourcePathId: debugMeta?.sourcePathId,
  networkId: debugMeta?.networkId,
  strokeId: debugMeta?.strokeId,
  strokeIndex: debugMeta?.strokeIndex,
  contourId: debugMeta?.contourId,
  intervalId: debugMeta?.intervalId
})

const buildFaceFromPacket = <
  TDebugMeta extends StrokeFinalFaceDebugMetaBase,
  TPaint extends StrokeFinalFacePaint
>(
  packet: StrokeResolvedPacketLike<TDebugMeta, TPaint>,
  options: { includeCollapseKey: boolean }
) => {
  const debugMeta = packet.geometry.debugMeta
  const paintKey = buildPaintKey(packet)
  const strokeSpecKey = buildStrokeSpecKey(packet)
  const visualPacketKey = buildVisualPacketKey(packet)
  const legalDomainIds =
    debugMeta?.legalDomainIds ??
    (debugMeta?.legalDomainId === undefined || debugMeta.legalDomainId === null
      ? []
      : [debugMeta.legalDomainId])
  const intervalIds =
    debugMeta?.intervalIds ??
    (debugMeta?.intervalId ? [debugMeta.intervalId] : [])
  const sourceSpanIds = debugMeta?.sourceSpanIds ?? []
  const sourceContourIds =
    debugMeta?.sourceContourIds ??
    (debugMeta?.contourId ? [debugMeta.contourId] : [])
  const ownership = resolveStrokeOwnership({
    ownerSet: debugMeta?.ownerSet,
    owner: buildOwnerKey(debugMeta)
  })

  return {
    collapseKey: options.includeCollapseKey
      ? `${visualPacketKey}|${buildPolygonsSignature(packet.geometry.polygons)}`
      : packet.geometry.geometryId,
    face: {
      faceId: packet.geometry.geometryId,
      sourceGeometryIds: [packet.geometry.geometryId],
      polygons: packet.geometry.polygons,
      bounds: packet.geometry.bounds,
      visualPacketKey,
      paintKey,
      strokeSpecKey,
      ownerSet: ownership.ownerSet,
      intervalIds,
      sourceSpanIds,
      sourceContourIds,
      legalDomainIds,
      geometryFamily: debugMeta?.geometryFamily,
      resolutionStatus: debugMeta?.resolutionStatus,
      runtimeStatus: debugMeta?.runtimeStatus,
      sourceTopology: debugMeta?.sourceTopology,
      debugMeta,
      renderDescriptor: packet.geometry.renderDescriptor,
      paint: packet.paint
    } satisfies StrokeFinalFace<TDebugMeta, TPaint>
  }
}

const isExactCollapsibleFace = <
  TDebugMeta extends StrokeFinalFaceDebugMetaBase,
  TPaint extends StrokeFinalFacePaint
>(
  face: StrokeFinalFace<TDebugMeta, TPaint>
) =>
  face.debugMeta?.arrangementStatus === 'exact' &&
  face.resolutionStatus === 'exact-constrained' &&
  face.runtimeStatus === 'accepted'

const mergeFace = <
  TDebugMeta extends StrokeFinalFaceDebugMetaBase,
  TPaint extends StrokeFinalFacePaint
>(
  target: StrokeFinalFace<TDebugMeta, TPaint>,
  source: StrokeFinalFace<TDebugMeta, TPaint>
) => {
  source.sourceGeometryIds.forEach((id) =>
    pushUnique(target.sourceGeometryIds, id)
  )
  source.ownerSet.forEach((owner) =>
    pushUniqueStrokeOwner(target.ownerSet, owner)
  )
  source.intervalIds.forEach((id) => pushUnique(target.intervalIds, id))
  source.sourceSpanIds.forEach((id) => pushUnique(target.sourceSpanIds, id))
  source.sourceContourIds.forEach((id) =>
    pushUnique(target.sourceContourIds, id)
  )
  source.legalDomainIds.forEach((id) => pushUnique(target.legalDomainIds, id))
  mergeFaceDebugMeta(target.debugMeta, source.debugMeta)
  if (target.renderDescriptor === undefined) {
    target.renderDescriptor = source.renderDescriptor
  }
  target.faceId = hashStableString(
    'final-face',
    `${target.visualPacketKey}|${target.sourceGeometryIds.join('|')}`
  )
}

export const buildStrokeFinalFacesFromResolvedPackets = <
  TDebugMeta extends StrokeFinalFaceDebugMetaBase,
  TPaint extends StrokeFinalFacePaint,
  T extends StrokeResolvedPacketLike<TDebugMeta, TPaint>
>(
  packets: readonly T[],
  options: BuildStrokeFinalFaceOptions = {}
): StrokeFinalFace<TDebugMeta, TPaint>[] => {
  const facesByCollapseKey = new Map<
    string,
    StrokeFinalFace<TDebugMeta, TPaint>
  >()
  const shouldCollapse = options.collapseDuplicateFaces === true

  packets.forEach((packet) => {
    const { collapseKey, face } = buildFaceFromPacket(packet, {
      includeCollapseKey:
        shouldCollapse &&
        packet.geometry.debugMeta?.arrangementStatus === 'exact' &&
        packet.geometry.debugMeta?.resolutionStatus === 'exact-constrained' &&
        packet.geometry.debugMeta?.runtimeStatus === 'accepted'
    })
    if (!shouldCollapse || !isExactCollapsibleFace(face)) {
      facesByCollapseKey.set(face.faceId, face)
      return
    }

    const existing = facesByCollapseKey.get(collapseKey)
    if (existing) {
      mergeFace(existing, face)
      return
    }

    facesByCollapseKey.set(collapseKey, face)
  })

  return [...facesByCollapseKey.values()]
}

const buildDebugMetaFromPaintAttachedRegion = (
  region: PaintAttachedStrokeRegion
): StrokeFinalFaceDebugMetaBase => ({
  geometryFamily: region.geometryFamily,
  resolutionStatus: region.resolutionStatus,
  runtimeStatus: region.runtimeStatus,
  runtimeReason: region.runtimeReason,
  sourceTopology: region.sourceTopology,
  topologyFamily: region.topologyFamily,
  intervalTopology: region.intervalTopology,
  strokePosition: region.strokePosition,
  ownerSet: [...region.ownerSet],
  intervalIds: [...region.intervalIds],
  sourceSpanIds: [...region.sourceSpanIds],
  sourceContourIds: [...region.sourceContourIds],
  legalDomainIds: [...region.legalDomainIds],
  arrangementStatus: region.arrangementStatus,
  arrangementFaceId: region.arrangementFaceId,
  arrangementCandidateIds: region.arrangementCandidateIds
    ? [...region.arrangementCandidateIds]
    : undefined,
  arrangementLegalState: region.arrangementLegalState,
  figmaLikeBoundaryDomainId: region.figmaLikeBoundaryDomainId,
  figmaLikeSplitRangeId: region.figmaLikeSplitRangeId,
  figmaLikeSplitRangeStartDistance: region.figmaLikeSplitRangeStartDistance,
  figmaLikeSplitRangeEndDistance: region.figmaLikeSplitRangeEndDistance,
  figmaLikeTerminalRole: region.figmaLikeTerminalRole,
  figmaLikeSplitRangeSourceSegmentIndex:
    region.figmaLikeSplitRangeSourceSegmentIndex,
  figmaLikeSideAuthority: region.figmaLikeSideAuthority,
  figmaLikeSelectedSide: region.figmaLikeSelectedSide,
  figmaLikeFilledSide: region.figmaLikeFilledSide,
  figmaLikeUnfilledSide: region.figmaLikeUnfilledSide,
  figmaLikeBoundaryRole: region.figmaLikeBoundaryRole,
  figmaLikeSideResolutionStatus: region.figmaLikeSideResolutionStatus,
  figmaLikeSideResolutionReason: region.figmaLikeSideResolutionReason,
  figmaLikeBoundaryPoints: region.figmaLikeBoundaryPoints
    ? region.figmaLikeBoundaryPoints.map((point) => ({ ...point }))
    : undefined,
  figmaLikeBoundaryStartDistance: region.figmaLikeBoundaryStartDistance,
  figmaLikeBoundaryEndDistance: region.figmaLikeBoundaryEndDistance,
  figmaLikeBoundaryTotalLength: region.figmaLikeBoundaryTotalLength,
  figmaLikeSplitRangeTerminals: region.figmaLikeSplitRangeTerminals
    ? region.figmaLikeSplitRangeTerminals.map((terminal) => ({ ...terminal }))
    : undefined,
  revisionSet: {
    ...region.revisionSet,
    paintRevision: region.paint.paintKey
  }
})

export const buildStrokeFinalFacesFromPaintAttachedRegions = (
  regions: readonly PaintAttachedStrokeRegion[],
  options: BuildStrokeFinalFaceOptions = {}
): StrokeFinalFace<
  StrokeFinalFaceDebugMetaBase,
  PaintAttachedStrokeRegion['paint']
>[] => {
  const faces = regions.map((region) => {
    const debugMeta = buildDebugMetaFromPaintAttachedRegion(region)
    const packet = {
      geometry: {
        geometryId: region.regionId,
        polygons: region.polygons,
        bounds: region.bounds,
        debugMeta
      },
      paint: region.paint
    }
    const paintKey = region.paintKey
    const strokeSpecKey = buildStrokeSpecKey(packet)
    const visualPacketKey = buildVisualPacketKey(packet)

    return {
      faceId: region.regionId,
      sourceGeometryIds: [...region.sourceGeometryIds],
      polygons: region.polygons,
      bounds: region.bounds,
      visualPacketKey,
      paintKey,
      strokeSpecKey,
      ownerSet: [...region.ownerSet],
      intervalIds: [...region.intervalIds],
      sourceSpanIds: [...region.sourceSpanIds],
      sourceContourIds: [...region.sourceContourIds],
      legalDomainIds: [...region.legalDomainIds],
      geometryFamily: region.geometryFamily,
      resolutionStatus: region.resolutionStatus,
      runtimeStatus: region.runtimeStatus,
      sourceTopology: region.sourceTopology,
      debugMeta,
      paint: region.paint
    } satisfies StrokeFinalFace<
      StrokeFinalFaceDebugMetaBase,
      PaintAttachedStrokeRegion['paint']
    >
  })

  return options.collapseDuplicateFaces === true
    ? collapseExactDuplicateFinalFaces(faces)
    : faces
}

export const collapseExactDuplicateFinalFaces = <
  TDebugMeta extends StrokeFinalFaceDebugMetaBase,
  TPaint extends StrokeFinalFacePaint
>(
  faces: readonly StrokeFinalFace<TDebugMeta, TPaint>[]
): StrokeFinalFace<TDebugMeta, TPaint>[] => {
  const facesByCollapseKey = new Map<
    string,
    StrokeFinalFace<TDebugMeta, TPaint>
  >()

  faces.forEach((face) => {
    if (!isExactCollapsibleFace(face)) {
      facesByCollapseKey.set(face.faceId, face)
      return
    }

    const collapseKey = `${face.visualPacketKey}|${buildPolygonsSignature(
      face.polygons
    )}`
    const existing = facesByCollapseKey.get(collapseKey)
    if (existing && isExactCollapsibleFace(existing)) {
      mergeFace(existing, face)
      return
    }

    facesByCollapseKey.set(collapseKey, face)
  })

  return [...facesByCollapseKey.values()]
}
