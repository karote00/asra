import {
  pushUniqueStrokeOwner,
  resolveStrokeOwnership
} from './stroke-ownership'
import type { PaintAttachedStrokeRegion } from './stroke-paint-payload'
import type { StrokeRevisionSet } from './stroke-dirty-keys'

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
  sourceNetworkIds?: string[]
  strokeId?: string
  strokeIndex?: number
  contourId?: string
  legalDomainId?: string | null
  intervalId?: string
  sourceSpanIds?: string[]
  productMode?: string
  productSignature?: string
  domainMode?: string
  topologyFamily?: string
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
  domainPlanBoundaryDomainId?: string
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
  domainPlanDomainMode?: string
  domainPlanSideResolutionStatus?: 'resolved' | 'blocked'
  domainPlanSideResolutionReason?: string
  domainPlanBoundaryPoints?: Vec2[]
  domainPlanBoundaryStartDistance?: number
  domainPlanBoundaryEndDistance?: number
  domainPlanBoundaryTotalLength?: number
  visualOverlapCollapseStatus?:
    | 'exact-union'
    | 'exact-mask'
    | 'exact-arrangement'
    | 'render-projection-merged'
    | 'render-projection-arrangement'
  visualOverlapSourceFaceIds?: string[]
  visualOverlapSourceGeometryIds?: string[]
  domainPlanSplitRangeTerminals?: {
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
  dashProductIntervals?: {
    intervalId: string
    splitRangeId?: string
    terminalRole?: 'start' | 'end' | 'start-end' | 'middle'
    startDistance?: number
    endDistance?: number
    effectiveStartDistance?: number
    effectiveEndDistance?: number
    capReachDistance?: number
    boundaryDomainId?: string
    boundaryPoints?: Vec2[]
    boundaryStartDistance?: number
    boundaryEndDistance?: number
    boundaryTotalLength?: number
    boundaryRole?: 'outer' | 'hole' | 'filled-face' | 'ambiguous'
    selectedSide?: 1 | -1
    filledSide?: 1 | -1
    unfilledSide?: 1 | -1
    sourceSegmentIndex?: number
    sourceStartDistance?: number
    sourceEndDistance?: number
    endpointCapPolicySignature?: string
    joinOwnershipSignature?: string
    smoothContinuityGroupId?: string
  }[]
  dashEndpointCapPolicySignatures?: string[]
  dashEndpointCapPolicyTerminalRoles?: (
    | 'middle'
    | 'start'
    | 'end'
    | 'start-end'
  )[]
  joinOwnershipRecords?: {
    kind: 'source-vertex' | 'boundary-terminal-pair'
    ownerId?: string
    materializationKind?:
      | 'join'
      | 'smooth-continuity-product'
      | 'smooth-continuity-bridge'
      | 'join-owned-terminal-body-bridge'
    area: number
    bounds: Bounds
    intervalIds?: string[]
    selectedSide?: 1 | -1
    domainKey?: string
    vertex?: Vec2
    previousContourPoint?: Vec2
    nextContourPoint?: Vec2
    previousDashBodyPoint?: Vec2
    nextDashBodyPoint?: Vec2
    stageBounds?: Record<string, Bounds | undefined>
  }[]
  joinOwnershipSignatures?: string[]
  smoothContinuityGroupIds?: string[]
  domainPlanBoundaryRoles?: ('outer' | 'hole' | 'filled-face' | 'ambiguous')[]
  domainPlanSplitRangeIds?: string[]
  domainPlanSelectedSides?: (1 | -1)[]
  domainPlanSourceSegmentIndexes?: number[]
  constrainedDashedJoinDiagnostics?: {
    terminalRecordCount: number
    sourceVertexRecordCount: number
    terminalPairJoinPlanCount: number
    sourceVertexJoinPlanCount: number
    joinPlanCount: number
    joinRecordCount?: number
    joinPacketCount?: number
  }
  visualContext?: Partial<StrokeVisualContext>
  revisionSet?: Partial<StrokeRevisionSet>
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
  sourceNetworkIds: string[]
  sourceContourIds: string[]
  legalDomainIds: string[]
  productMode?: string
  productSignature?: string
  domainMode?: string
  topologyFamily?: string
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

const FINAL_FACE_MICRO_EDGE_TOLERANCE = 0.03
const FINAL_FACE_COLLINEAR_TOLERANCE = 0.0075

const distanceBetween = (first: Vec2, second: Vec2) =>
  Math.hypot(first.x - second.x, first.y - second.y)

const getCrossProduct = (first: Vec2, second: Vec2) =>
  first.x * second.y - second.x * first.y

const getPolygonDoubleArea = (polygon: Vec2[]) =>
  polygon.reduce((sum, point, index) => {
    const next = polygon[(index + 1) % polygon.length]
    return sum + getCrossProduct(point, next)
  }, 0)

const getPolygonArea = (polygon: Vec2[]) => getPolygonDoubleArea(polygon) / 2

const getPolygonsBounds = (
  polygons: Vec2[][],
  defaultBounds: Bounds
): Bounds => {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let hasPoint = false

  for (const polygon of polygons) {
    for (const point of polygon) {
      hasPoint = true
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    }
  }

  if (!hasPoint) {
    return defaultBounds
  }

  return { minX, minY, maxX, maxY }
}

const isNearCollinearPoint = (previous: Vec2, point: Vec2, next: Vec2) => {
  const ax = point.x - previous.x
  const ay = point.y - previous.y
  const bx = next.x - point.x
  const by = next.y - point.y
  const cross = Math.abs(ax * by - ay * bx)
  const scale = Math.max(Math.hypot(ax, ay) + Math.hypot(bx, by), 1)
  return cross / scale <= FINAL_FACE_COLLINEAR_TOLERANCE
}

const isFinalFacePolygonAlreadyClean = (polygon: Vec2[]) => {
  for (let index = 0; index < polygon.length; index += 1) {
    const previous = polygon[(index - 1 + polygon.length) % polygon.length]
    const point = polygon[index]
    const next = polygon[(index + 1) % polygon.length]
    if (
      distanceBetween(previous, point) <= FINAL_FACE_MICRO_EDGE_TOLERANCE ||
      distanceBetween(point, next) <= FINAL_FACE_MICRO_EDGE_TOLERANCE ||
      isNearCollinearPoint(previous, point, next)
    ) {
      return false
    }
  }

  return true
}

const cleanFinalFacePolygon = (polygon: Vec2[]) => {
  if (polygon.length < 4) {
    return polygon
  }
  if (isFinalFacePolygonAlreadyClean(polygon)) {
    return polygon
  }

  const nextIndexes = polygon.map((_, index) => (index + 1) % polygon.length)
  const previousIndexes = polygon.map(
    (_, index) => (index - 1 + polygon.length) % polygon.length
  )
  let headIndex = 0
  let aliveCount = polygon.length
  let scanStartIndex = headIndex
  let doubleArea = getPolygonDoubleArea(polygon)
  let hasRemovedPoint = false

  for (let pass = 0; pass < 120 && aliveCount >= 4; pass += 1) {
    let removeIndex = -1
    let index = scanStartIndex
    while (true) {
      const point = polygon[index]
      const previous = polygon[previousIndexes[index]]
      const next = polygon[nextIndexes[index]]
      if (
        distanceBetween(previous, point) <= FINAL_FACE_MICRO_EDGE_TOLERANCE ||
        distanceBetween(point, next) <= FINAL_FACE_MICRO_EDGE_TOLERANCE ||
        isNearCollinearPoint(previous, point, next)
      ) {
        removeIndex = index
        break
      }
      const nextIndex = nextIndexes[index]
      if (nextIndex === headIndex) {
        break
      }
      index = nextIndex
    }
    if (removeIndex < 0) {
      break
    }

    const compactedLength = aliveCount - 1
    const point = polygon[removeIndex]
    const previousIndex = previousIndexes[removeIndex]
    const nextIndex = nextIndexes[removeIndex]
    const previous = polygon[previousIndex]
    const next = polygon[nextIndex]
    const nextDoubleArea =
      doubleArea -
      getCrossProduct(previous, point) -
      getCrossProduct(point, next) +
      getCrossProduct(previous, next)
    if (compactedLength < 3 || Math.abs(nextDoubleArea / 2) <= 1e-6) {
      break
    }

    const removedHeadPoint = removeIndex === headIndex
    const removedLastPoint = nextIndex === headIndex
    nextIndexes[previousIndex] = nextIndex
    previousIndexes[nextIndex] = previousIndex
    aliveCount = compactedLength
    doubleArea = nextDoubleArea
    hasRemovedPoint = true
    if (removedHeadPoint) {
      headIndex = nextIndex
    }
    scanStartIndex =
      removedHeadPoint || removedLastPoint ? headIndex : previousIndex
  }

  if (!hasRemovedPoint) {
    return polygon
  }

  const cleaned: Vec2[] = []
  let index = headIndex
  for (let count = 0; count < aliveCount; count += 1) {
    cleaned.push(polygon[index])
    index = nextIndexes[index]
  }

  return cleaned
}

const cleanFinalFacePolygons = (polygons: Vec2[][]) => {
  const cleanedPolygons: Vec2[][] = []
  for (const polygon of polygons) {
    const cleaned = cleanFinalFacePolygon(polygon)
    if (cleaned.length >= 3 && Math.abs(getPolygonArea(cleaned)) > 1e-6) {
      cleanedPolygons.push(cleaned)
    }
  }
  return cleanedPolygons
}

const pushUniqueSplitRangeTerminal = (
  terminals: NonNullable<
    StrokeFinalFaceDebugMetaBase['domainPlanSplitRangeTerminals']
  >,
  terminal: NonNullable<
    StrokeFinalFaceDebugMetaBase['domainPlanSplitRangeTerminals']
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

const pushUniqueDashProductInterval = (
  intervals: NonNullable<StrokeFinalFaceDebugMetaBase['dashProductIntervals']>,
  interval: NonNullable<
    StrokeFinalFaceDebugMetaBase['dashProductIntervals']
  >[number]
) => {
  const exists = intervals.some(
    (existing) =>
      existing.intervalId === interval.intervalId &&
      existing.splitRangeId === interval.splitRangeId &&
      existing.terminalRole === interval.terminalRole &&
      existing.startDistance === interval.startDistance &&
      existing.endDistance === interval.endDistance &&
      existing.boundaryDomainId === interval.boundaryDomainId &&
      existing.endpointCapPolicySignature ===
        interval.endpointCapPolicySignature &&
      existing.joinOwnershipSignature === interval.joinOwnershipSignature &&
      existing.smoothContinuityGroupId === interval.smoothContinuityGroupId
  )

  if (!exists) {
    intervals.push({ ...interval })
  }
}

const pushUniqueJoinOwnershipRecord = (
  records: NonNullable<StrokeFinalFaceDebugMetaBase['joinOwnershipRecords']>,
  record: NonNullable<
    StrokeFinalFaceDebugMetaBase['joinOwnershipRecords']
  >[number]
) => {
  const exists = records.some(
    (existing) =>
      existing.kind === record.kind &&
      existing.materializationKind === record.materializationKind &&
      existing.domainKey === record.domainKey &&
      existing.selectedSide === record.selectedSide &&
      JSON.stringify(existing.intervalIds ?? []) ===
        JSON.stringify(record.intervalIds ?? []) &&
      JSON.stringify(existing.vertex ?? null) ===
        JSON.stringify(record.vertex ?? null) &&
      JSON.stringify(existing.previousContourPoint ?? null) ===
        JSON.stringify(record.previousContourPoint ?? null) &&
      JSON.stringify(existing.nextContourPoint ?? null) ===
        JSON.stringify(record.nextContourPoint ?? null)
  )

  if (!exists) {
    records.push({
      ...record,
      intervalIds: record.intervalIds ? [...record.intervalIds] : undefined,
      bounds: { ...record.bounds },
      vertex: record.vertex ? { ...record.vertex } : undefined,
      previousContourPoint: record.previousContourPoint
        ? { ...record.previousContourPoint }
        : undefined,
      nextContourPoint: record.nextContourPoint
        ? { ...record.nextContourPoint }
        : undefined,
      previousDashBodyPoint: record.previousDashBodyPoint
        ? { ...record.previousDashBodyPoint }
        : undefined,
      nextDashBodyPoint: record.nextDashBodyPoint
        ? { ...record.nextDashBodyPoint }
        : undefined,
      stageBounds: record.stageBounds ? { ...record.stageBounds } : undefined
    })
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
    'dashEndpointCapPolicySignatures',
    'dashEndpointCapPolicyTerminalRoles',
    'joinOwnershipSignatures',
    'smoothContinuityGroupIds',
    'domainPlanBoundaryRoles',
    'domainPlanSplitRangeIds',
    'visualOverlapSourceFaceIds',
    'visualOverlapSourceGeometryIds'
  ].forEach((key) => {
    const typedKey = key as keyof Pick<
      StrokeFinalFaceDebugMetaBase,
      | 'intervalIds'
      | 'sourceSpanIds'
      | 'sourceContourIds'
      | 'legalDomainIds'
      | 'dashEndpointCapPolicySignatures'
      | 'dashEndpointCapPolicyTerminalRoles'
      | 'joinOwnershipSignatures'
      | 'smoothContinuityGroupIds'
      | 'domainPlanBoundaryRoles'
      | 'domainPlanSplitRangeIds'
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
  ;['domainPlanSelectedSides', 'domainPlanSourceSegmentIndexes'].forEach(
    (key) => {
      const typedKey = key as keyof Pick<
        StrokeFinalFaceDebugMetaBase,
        'domainPlanSelectedSides' | 'domainPlanSourceSegmentIndexes'
      >
      const sourceValues = source[typedKey]
      if (!sourceValues) {
        return
      }

      const targetValues = [...(target[typedKey] ?? [])]
      sourceValues.forEach((value) => pushUnique(targetValues, value))
      ;(target[typedKey] as number[] | undefined) = targetValues
    }
  )

  if (source.domainPlanSplitRangeTerminals) {
    const targetTerminals = [
      ...(target.domainPlanSplitRangeTerminals ?? [])
    ] satisfies NonNullable<
      StrokeFinalFaceDebugMetaBase['domainPlanSplitRangeTerminals']
    >
    source.domainPlanSplitRangeTerminals.forEach((terminal) =>
      pushUniqueSplitRangeTerminal(targetTerminals, terminal)
    )
    target.domainPlanSplitRangeTerminals = targetTerminals
  }

  if (source.dashProductIntervals) {
    const targetIntervals = [
      ...(target.dashProductIntervals ?? [])
    ] satisfies NonNullable<
      StrokeFinalFaceDebugMetaBase['dashProductIntervals']
    >
    source.dashProductIntervals.forEach((interval) =>
      pushUniqueDashProductInterval(targetIntervals, interval)
    )
    target.dashProductIntervals = targetIntervals
  }

  if (source.joinOwnershipRecords) {
    const targetRecords = [
      ...(target.joinOwnershipRecords ?? [])
    ] satisfies NonNullable<
      StrokeFinalFaceDebugMetaBase['joinOwnershipRecords']
    >
    source.joinOwnershipRecords.forEach((record) =>
      pushUniqueJoinOwnershipRecord(targetRecords, record)
    )
    target.joinOwnershipRecords = targetRecords
  }

  if (source.domainPlanBoundaryPoints) {
    target.domainPlanBoundaryPoints = source.domainPlanBoundaryPoints.map(
      (point) => ({ ...point })
    )
  }
  target.domainPlanBoundaryStartDistance ??=
    source.domainPlanBoundaryStartDistance
  target.domainPlanBoundaryEndDistance ??= source.domainPlanBoundaryEndDistance
  target.domainPlanBoundaryTotalLength ??= source.domainPlanBoundaryTotalLength
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
      `visibility:${packet.geometry.debugMeta?.productMode ?? 'unknown'}`,
    runtimeFamilyKey:
      context?.runtimeFamilyKey ??
      [
        packet.geometry.debugMeta?.productMode ?? 'product:unknown',
        packet.geometry.debugMeta?.productSignature ?? 'signature:unknown',
        packet.geometry.debugMeta?.domainMode ?? 'domain:unknown'
      ].join(':')
  }
}

const buildStrokeSpecKey = <
  TDebugMeta extends StrokeFinalFaceDebugMetaBase,
  TPaint extends StrokeFinalFacePaint
>(
  packet: StrokeResolvedPacketLike<TDebugMeta, TPaint>
) => {
  const revisionSet = packet.geometry.debugMeta?.revisionSet
  const hasFineGrainedStrokeRevisions =
    revisionSet?.strokeFamilyRevision !== undefined ||
    revisionSet?.strokeDomainRevision !== undefined ||
    revisionSet?.dashAndGapRevision !== undefined ||
    revisionSet?.terminalCapRevision !== undefined ||
    revisionSet?.joinShapeRevision !== undefined ||
    revisionSet?.smoothContinuityRevision !== undefined ||
    revisionSet?.productMaterializationRevision !== undefined ||
    revisionSet?.renderOutputRevision !== undefined
  const revisionKey =
    revisionSet && hasFineGrainedStrokeRevisions
      ? String(
          revisionSet.renderOutputRevision ??
            [
              revisionSet.strokeFamilyRevision ??
                revisionSet.strokeSpecRevision,
              revisionSet.terminalCapRevision,
              revisionSet.joinShapeRevision,
              revisionSet.smoothContinuityRevision,
              revisionSet.productMaterializationRevision
            ]
              .filter((value) => value !== undefined)
              .join('|')
        )
      : ''

  return String(
    revisionKey ||
      revisionSet?.strokeSpecRevision ||
      [
        packet.geometry.debugMeta?.productMode ?? 'unknown-product',
        packet.geometry.debugMeta?.strokeId ?? 'unknown-stroke',
        packet.geometry.debugMeta?.productSignature ?? 'unknown-signature'
      ].join(':')
  )
}

const buildVisualPacketKeyFromParts = <
  TDebugMeta extends StrokeFinalFaceDebugMetaBase,
  TPaint extends StrokeFinalFacePaint
>(
  packet: StrokeResolvedPacketLike<TDebugMeta, TPaint>,
  paintKey: string,
  strokeSpecKey: string
) => {
  const visualContext = buildVisualContext(packet)
  const paintRevision =
    packet.geometry.debugMeta?.revisionSet?.paintRevision ?? 'paint:unknown'

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

const buildVisualPacketKey = <
  TDebugMeta extends StrokeFinalFaceDebugMetaBase,
  TPaint extends StrokeFinalFacePaint
>(
  packet: StrokeResolvedPacketLike<TDebugMeta, TPaint>
) =>
  buildVisualPacketKeyFromParts(
    packet,
    buildPaintKey(packet),
    buildStrokeSpecKey(packet)
  )

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
  const visualPacketKey = buildVisualPacketKeyFromParts(
    packet,
    paintKey,
    strokeSpecKey
  )
  const polygons = cleanFinalFacePolygons(packet.geometry.polygons)
  const bounds = getPolygonsBounds(polygons, packet.geometry.bounds)
  const legalDomainIds =
    debugMeta?.legalDomainIds ??
    (debugMeta?.legalDomainId === undefined || debugMeta.legalDomainId === null
      ? []
      : [debugMeta.legalDomainId])
  const intervalIds =
    debugMeta?.intervalIds ??
    (debugMeta?.intervalId ? [debugMeta.intervalId] : [])
  const sourceSpanIds = debugMeta?.sourceSpanIds ?? []
  const sourceNetworkIds =
    debugMeta?.sourceNetworkIds ??
    (debugMeta?.networkId ? [debugMeta.networkId] : [])
  const sourceContourIds =
    debugMeta?.sourceContourIds ??
    (debugMeta?.contourId ? [debugMeta.contourId] : [])
  const ownership = resolveStrokeOwnership({
    ownerSet: debugMeta?.ownerSet,
    owner: buildOwnerKey(debugMeta)
  })

  return {
    collapseKey: options.includeCollapseKey
      ? `${visualPacketKey}|${buildPolygonsSignature(polygons)}`
      : packet.geometry.geometryId,
    face: {
      faceId: packet.geometry.geometryId,
      sourceGeometryIds: [packet.geometry.geometryId],
      polygons,
      bounds,
      visualPacketKey,
      paintKey,
      strokeSpecKey,
      ownerSet: ownership.ownerSet,
      intervalIds,
      sourceSpanIds,
      sourceNetworkIds,
      sourceContourIds,
      legalDomainIds,
      productMode: debugMeta?.productMode,
      productSignature: debugMeta?.productSignature,
      domainMode: debugMeta?.domainMode,
      topologyFamily: debugMeta?.topologyFamily,
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
  face.debugMeta.productMode !== undefined &&
  face.debugMeta.productMode !== 'center-product'

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
  source.sourceNetworkIds.forEach((id) =>
    pushUnique(target.sourceNetworkIds, id)
  )
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
        packet.geometry.debugMeta?.productMode !== undefined &&
        packet.geometry.debugMeta.productMode !== 'center-product'
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
  productMode: region.productMode,
  productSignature: region.productSignature,
  domainMode: region.domainMode,
  topologyFamily: region.topologyFamily,
  strokePosition: region.strokePosition,
  ownerSet: [...region.ownerSet],
  intervalIds: [...region.intervalIds],
  sourceSpanIds: [...region.sourceSpanIds],
  sourceNetworkIds: [...(region.sourceNetworkIds ?? [])],
  sourceContourIds: [...region.sourceContourIds],
  legalDomainIds: [...region.legalDomainIds],
  arrangementStatus: region.arrangementStatus,
  arrangementFaceId: region.arrangementFaceId,
  arrangementCandidateIds: region.arrangementCandidateIds
    ? [...region.arrangementCandidateIds]
    : undefined,
  arrangementLegalState: region.arrangementLegalState,
  domainPlanBoundaryDomainId: region.domainPlanBoundaryDomainId,
  domainPlanSplitRangeId: region.domainPlanSplitRangeId,
  domainPlanSplitRangeStartDistance: region.domainPlanSplitRangeStartDistance,
  domainPlanSplitRangeEndDistance: region.domainPlanSplitRangeEndDistance,
  domainPlanTerminalRole: region.domainPlanTerminalRole,
  domainPlanSplitRangeSourceSegmentIndex:
    region.domainPlanSplitRangeSourceSegmentIndex,
  domainPlanSideAuthority: region.domainPlanSideAuthority,
  domainPlanSelectedSide: region.domainPlanSelectedSide,
  domainPlanFilledSide: region.domainPlanFilledSide,
  domainPlanUnfilledSide: region.domainPlanUnfilledSide,
  domainPlanBoundaryRole: region.domainPlanBoundaryRole,
  domainPlanSideResolutionStatus: region.domainPlanSideResolutionStatus,
  domainPlanSideResolutionReason: region.domainPlanSideResolutionReason,
  domainPlanBoundaryPoints: region.domainPlanBoundaryPoints
    ? region.domainPlanBoundaryPoints.map((point) => ({ ...point }))
    : undefined,
  domainPlanBoundaryStartDistance: region.domainPlanBoundaryStartDistance,
  domainPlanBoundaryEndDistance: region.domainPlanBoundaryEndDistance,
  domainPlanBoundaryTotalLength: region.domainPlanBoundaryTotalLength,
  domainPlanSplitRangeTerminals: region.domainPlanSplitRangeTerminals
    ? region.domainPlanSplitRangeTerminals.map((terminal) => ({ ...terminal }))
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
      sourceNetworkIds: [...(region.sourceNetworkIds ?? [])],
      sourceContourIds: [...region.sourceContourIds],
      legalDomainIds: [...region.legalDomainIds],
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
