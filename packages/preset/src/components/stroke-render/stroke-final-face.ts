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
  TDebugMeta extends StrokeFinalFaceDebugMetaBase = StrokeFinalFaceDebugMetaBase,
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

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }

  return `{${Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(',')}}`
}

const pushUnique = <T>(items: T[], value: T) => {
  if (!items.includes(value)) {
    items.push(value)
  }
}

const pushUniqueOwner = (owners: StrokeOwnerKey[], owner: StrokeOwnerKey) => {
  if (!hasDefinedOwnerField(owner)) {
    return
  }

  const signature = stableStringify(owner)
  if (!owners.some((candidate) => stableStringify(candidate) === signature)) {
    owners.push(owner)
  }
}

const hasDefinedOwnerField = (owner: StrokeOwnerKey) =>
  Object.values(owner).some((value) => value !== undefined)

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
    debugMeta?.intervalIds ?? (debugMeta?.intervalId ? [debugMeta.intervalId] : [])
  const sourceSpanIds = debugMeta?.sourceSpanIds ?? []
  const sourceContourIds =
    debugMeta?.sourceContourIds ??
    (debugMeta?.contourId ? [debugMeta.contourId] : [])

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
      ownerSet:
        debugMeta?.ownerSet?.filter(hasDefinedOwnerField) ??
        [buildOwnerKey(debugMeta)].filter(hasDefinedOwnerField),
      intervalIds,
      sourceSpanIds,
      sourceContourIds,
      legalDomainIds,
      geometryFamily: debugMeta?.geometryFamily,
      resolutionStatus: debugMeta?.resolutionStatus,
      runtimeStatus: debugMeta?.runtimeStatus,
      sourceTopology: debugMeta?.sourceTopology,
      debugMeta,
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
  source.sourceGeometryIds.forEach((id) => pushUnique(target.sourceGeometryIds, id))
  source.ownerSet.forEach((owner) => pushUniqueOwner(target.ownerSet, owner))
  source.intervalIds.forEach((id) => pushUnique(target.intervalIds, id))
  source.sourceSpanIds.forEach((id) => pushUnique(target.sourceSpanIds, id))
  source.sourceContourIds.forEach((id) => pushUnique(target.sourceContourIds, id))
  source.legalDomainIds.forEach((id) => pushUnique(target.legalDomainIds, id))
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
  const facesByCollapseKey = new Map<string, StrokeFinalFace<TDebugMeta, TPaint>>()
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

export const collapseExactDuplicateFinalFaces = <
  TDebugMeta extends StrokeFinalFaceDebugMetaBase,
  TPaint extends StrokeFinalFacePaint
>(
  faces: readonly StrokeFinalFace<TDebugMeta, TPaint>[]
): StrokeFinalFace<TDebugMeta, TPaint>[] => {
  const facesByCollapseKey = new Map<string, StrokeFinalFace<TDebugMeta, TPaint>>()

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
