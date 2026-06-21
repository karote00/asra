import type { StrokeAttrs } from '@asyra/utils'
import {
  createStrokeIntervalFrameSlicer,
  type StrokeIntervalFrame
} from './stroke-interval-frames'
import {
  getRenderableStrokes,
  type RenderableStroke
} from './renderable-stroke'
import { buildSolidCenterStrokePolygons } from './solid-center-stroke-geometry'
import {
  buildDashedCenterRibbonGeometry,
  type DashedCenterRibbonFrame
} from './dashed-center-ribbon-geometry'
import type { allocateDashedCenterStrokeIntervals } from './dashed-center-stroke-intervals'
import type {
  SolidCenterStrokeGeometryDebugMeta,
  SolidCenterStrokeRenderDescriptor,
  SolidCenterStrokeResolvedPacket
} from './solid-center-stroke-packets'
import { buildStrokeRuntimeRevisionSet } from './stroke-dirty-keys'
import {
  allocateDashedIntervalsForTopology,
  buildPathTopologyModel,
  type PathTopologyModel
} from './path-topology-model'
import { slicePathGeometryFrames, type PathGeometry } from './path-geometry'
import {
  buildSourceSpanGraph,
  getSourceSpanIdsForInterval,
  type SourceSpanGraph,
  type SourceSpanCutKind
} from './source-span-graph'

interface Vec2 {
  x: number
  y: number
}

interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

const getBounds = (polygons: Vec2[][]): Bounds => {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  polygons.forEach((polygon) =>
    polygon.forEach((point) => {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    })
  )

  return { minX, minY, maxX, maxY }
}

const buildInflatedBoundsPolygon = (points: Vec2[], padding: number) => {
  if (points.length === 0) {
    return []
  }

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  points.forEach((point) => {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  })

  if (
    !Number.isFinite(minX) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(maxY)
  ) {
    return []
  }

  return [
    { x: minX - padding, y: minY - padding },
    { x: maxX + padding, y: minY - padding },
    { x: maxX + padding, y: maxY + padding },
    { x: minX - padding, y: maxY + padding }
  ]
}

const EPSILON = 1e-6

const normalizeVector = (vector: Vec2): Vec2 | null => {
  const length = Math.hypot(vector.x, vector.y)
  if (length <= EPSILON) {
    return null
  }

  return {
    x: vector.x / length,
    y: vector.y / length
  }
}

const getEndpointTangent = (points: Vec2[], index: number): Vec2 => {
  const previous = points[index - 1]
  const current = points[index]
  const next = points[index + 1]

  if (previous && next) {
    return (
      normalizeVector({
        x: next.x - previous.x,
        y: next.y - previous.y
      }) ?? { x: 1, y: 0 }
    )
  }
  if (next) {
    return (
      normalizeVector({
        x: next.x - current.x,
        y: next.y - current.y
      }) ?? { x: 1, y: 0 }
    )
  }
  if (previous) {
    return (
      normalizeVector({
        x: current.x - previous.x,
        y: current.y - previous.y
      }) ?? { x: 1, y: 0 }
    )
  }

  return { x: 1, y: 0 }
}

const getCutKindAtDistance = (
  graph: SourceSpanGraph,
  distance: number
): SourceSpanCutKind | undefined =>
  graph.cuts.find((cut) => Math.abs(cut.distance - distance) <= EPSILON)?.kind

const getIntervalEndpointCutKind = (
  graph: SourceSpanGraph,
  distance: number,
  totalLength: number,
  closed: boolean
): SourceSpanCutKind | undefined => {
  if (
    !closed &&
    (Math.abs(distance) <= EPSILON ||
      Math.abs(distance - totalLength) <= EPSILON)
  ) {
    return 'vertex'
  }

  return getCutKindAtDistance(graph, distance)
}

const getIntervalTerminalRole = (
  interval: { startDistance: number; endDistance: number; wrapsSeam: boolean },
  totalLength: number,
  closed: boolean
): NonNullable<SolidCenterStrokeGeometryDebugMeta['intervalTerminalRole']> => {
  if (closed) {
    return interval.wrapsSeam ? 'both' : 'none'
  }

  const startsAtPathStart = Math.abs(interval.startDistance) <= EPSILON
  const endsAtPathEnd = Math.abs(interval.endDistance - totalLength) <= EPSILON

  if (startsAtPathStart && endsAtPathEnd) {
    return 'both'
  }
  if (startsAtPathStart) {
    return 'path-start'
  }
  if (endsAtPathEnd) {
    return 'path-end'
  }
  return 'none'
}

const isStrokeIntersectionEligible = (
  terminalRole: NonNullable<
    SolidCenterStrokeGeometryDebugMeta['intervalTerminalRole']
  >,
  startCutKind: SourceSpanCutKind | undefined,
  endCutKind: SourceSpanCutKind | undefined
) =>
  terminalRole !== 'none' ||
  startCutKind === 'self-intersection' ||
  endCutKind === 'self-intersection'

const buildVisibleIntervalSignature = (
  intervals: ReturnType<typeof allocateDashedCenterStrokeIntervals>
) =>
  intervals
    .map((interval) =>
      [
        interval.kind,
        interval.intervalId,
        interval.authoredIndex,
        interval.startDistance.toFixed(6),
        interval.endDistance.toFixed(6),
        interval.wrapsSeam ? 'wrap' : 'nowrap',
        interval.openPathTerminalRole ?? 'none',
        interval.previousVisibleIntervalId ?? 'none',
        interval.nextVisibleIntervalId ?? 'none'
      ].join(':')
    )
    .join('|')

const uniqueStrings = (values: string[]) => Array.from(new Set(values))

interface DashedCenterStrokePacketOptions {
  metadata?: {
    ownerKeyPrefix?: string
    networkId?: string
  }
  topology?: PathTopologyModel
  sourcePath?: Pick<
    PathGeometry,
    | 'segments'
    | 'closed'
    | 'totalLength'
    | 'segmentDistanceRanges'
    | 'sampledSegmentPoints'
    | 'sampledSegmentDistances'
  >
}

const interpolateSampledFrame = (
  start: { point: Vec2; distance: number },
  end: { point: Vec2; distance: number },
  distance: number
): DashedCenterRibbonFrame => {
  const length = Math.max(EPSILON, end.distance - start.distance)
  const t = Math.max(0, Math.min(1, (distance - start.distance) / length))
  const point = {
    x: start.point.x + (end.point.x - start.point.x) * t,
    y: start.point.y + (end.point.y - start.point.y) * t
  }
  const tangent = normalizeVector({
    x: end.point.x - start.point.x,
    y: end.point.y - start.point.y
  }) ?? { x: 1, y: 0 }

  return { point, tangent }
}

const dedupeSampledFrames = (frames: DashedCenterRibbonFrame[]) =>
  frames.filter((frame, index) => {
    if (index === 0) {
      return true
    }
    const previous = frames[index - 1]
    return (
      Math.abs(previous.point.x - frame.point.x) > EPSILON ||
      Math.abs(previous.point.y - frame.point.y) > EPSILON
    )
  })

const createCachedPathFrameSlicer = (
  path: DashedCenterStrokePacketOptions['sourcePath']
) => {
  if (
    !path?.segmentDistanceRanges ||
    !path.sampledSegmentPoints ||
    !path.sampledSegmentDistances
  ) {
    return null
  }

  const segments = path.segmentDistanceRanges.flatMap((range) => {
    const points = path.sampledSegmentPoints?.[range.index] ?? []
    const distances = path.sampledSegmentDistances?.[range.index] ?? []
    if (points.length < 2 || distances.length !== points.length) {
      return []
    }

    return points.slice(1).flatMap((point, index) => {
      const startPoint = points[index]
      const startDistance = range.startDistance + distances[index]
      const endDistance = range.startDistance + distances[index + 1]
      if (
        !startPoint ||
        endDistance <= startDistance + EPSILON ||
        endDistance <= range.startDistance - EPSILON ||
        startDistance >= range.endDistance + EPSILON
      ) {
        return []
      }
      return [
        {
          start: { point: startPoint, distance: startDistance },
          end: { point, distance: endDistance }
        }
      ]
    })
  })

  const sliceRange = (startDistance: number, endDistance: number) => {
    if (segments.length === 0 || endDistance <= startDistance) {
      return []
    }

    const frames: DashedCenterRibbonFrame[] = []
    for (const segment of segments) {
      if (
        segment.end.distance <= startDistance ||
        segment.start.distance >= endDistance
      ) {
        continue
      }

      const overlapStart = Math.max(startDistance, segment.start.distance)
      const overlapEnd = Math.min(endDistance, segment.end.distance)
      const startFrame = interpolateSampledFrame(
        segment.start,
        segment.end,
        overlapStart
      )
      const endFrame = interpolateSampledFrame(
        segment.start,
        segment.end,
        overlapEnd
      )
      frames.push(startFrame, endFrame)
    }

    return dedupeSampledFrames(frames)
  }

  return {
    slice: (startDistance: number, endDistance: number, wrapsSeam: boolean) => {
      if (!wrapsSeam) {
        return sliceRange(startDistance, endDistance)
      }

      return dedupeSampledFrames([
        ...sliceRange(startDistance, path.totalLength),
        ...sliceRange(0, endDistance)
      ])
    }
  }
}

export const supportsDashedCenterStroke = (
  stroke: Pick<
    RenderableStroke,
    | 'style'
    | 'position'
    | 'width'
    | 'join'
    | 'miterLimit'
    | 'cap'
    | 'dashPattern'
  >
) =>
  stroke.style === 'dashed' &&
  stroke.position === 'center' &&
  stroke.width > 0 &&
  stroke.dashPattern.length > 0 &&
  (stroke.join === 'miter' ||
    stroke.join === 'bevel' ||
    stroke.join === 'round') &&
  stroke.miterLimit >= 1 &&
  (stroke.cap === 'butt' || stroke.cap === 'square' || stroke.cap === 'round')

export const hasDashedCenterStrokeIntent = (
  strokes: StrokeAttrs[] | undefined
) =>
  getRenderableStrokes(strokes).some(
    (stroke) =>
      stroke.style === 'dashed' &&
      stroke.position === 'center' &&
      stroke.width > 0 &&
      stroke.dashPattern.length > 0
  ) === true

export const buildDashedCenterStrokeResolvedPackets = (
  cachePrefix: string,
  points: Vec2[],
  closed: boolean,
  strokes: StrokeAttrs[] | undefined,
  options: DashedCenterStrokePacketOptions = {}
): SolidCenterStrokeResolvedPacket[] => {
  const topology =
    options.topology ??
    buildPathTopologyModel({
      pathId: cachePrefix,
      networkId: options.metadata?.networkId,
      points,
      closed
    })
  const topologyPoints = topology.normalizedPoints
  const intervalDomain =
    options.sourcePath && Number.isFinite(options.sourcePath.totalLength)
      ? {
          totalLength: options.sourcePath.totalLength,
          closed: options.sourcePath.closed
        }
      : topology
  const totalLength = intervalDomain.totalLength
  return getRenderableStrokes(strokes).flatMap((stroke, strokeIndex) => {
    if (!supportsDashedCenterStroke(stroke)) {
      return []
    }

    const halfWidth = stroke.width / 2
    const intervalSourceFrames: StrokeIntervalFrame[] = topologyPoints.map(
      (point) => ({
        x: point.x,
        y: point.y,
        widthLeft: halfWidth,
        widthRight: halfWidth
      })
    )
    const intervalFrameSlicer = createStrokeIntervalFrameSlicer(
      intervalSourceFrames,
      topology.closed
    )
    const intervals = allocateDashedIntervalsForTopology(
      intervalDomain,
      stroke.dashPattern,
      stroke.dashOffset,
      intervalDomain.closed
        ? undefined
        : {
            openPathPolicy: 'network-balanced-terminals',
            strokeWidth: stroke.width,
            cap: stroke.cap
          }
    ).filter((interval) => interval.kind === 'visible')
    const dashPlacementMode = 'arc-length-pattern'
    const sourceSpanGraph = buildSourceSpanGraph(topology, intervals)
    const intervalSignature = buildVisibleIntervalSignature(intervals)
    const cachedPathFrameSlicer = createCachedPathFrameSlicer(
      options.sourcePath
    )
    const revisionSetsByProductSignature = new Map<
      string,
      SolidCenterStrokeGeometryDebugMeta['revisionSet']
    >()
    const getRevisionSet = (
      interval: (typeof intervals)[number],
      intervalTerminalRole: NonNullable<
        SolidCenterStrokeGeometryDebugMeta['intervalTerminalRole']
      >
    ) => {
      const policySignature = [
        'center-product',
        interval.intervalId,
        intervalTerminalRole,
        stroke.cap,
        stroke.join,
        stroke.miterLimit,
        interval.startDistance.toFixed(6),
        interval.endDistance.toFixed(6),
        interval.wrapsSeam ? 'wrap' : 'nowrap'
      ].join(':')
      const cached = revisionSetsByProductSignature.get(policySignature)
      if (cached) {
        return cached
      }

      const revisionSet = buildStrokeRuntimeRevisionSet({
        points: topologyPoints,
        closed: topology.closed,
        stroke,
        productMode: 'center-product',
        domainMode: 'center-product',
        ownerKey: options.metadata?.ownerKeyPrefix
          ? `${options.metadata.ownerKeyPrefix}:stroke:${strokeIndex}`
          : undefined,
        networkId: options.metadata?.networkId,
        strokeId: `stroke:${strokeIndex}`,
        intervalSignature: `${intervalSignature}:${interval.intervalId}`,
        endpointCapPolicySignature: policySignature,
        joinOwnershipSignature: [
          'center-product-join',
          stroke.join,
          stroke.miterLimit,
          intervalTerminalRole
        ].join(':'),
        strokeProductSignature: 'center-product:dashed',
        smoothContinuitySignature: `center-product:${interval.intervalId}`,
        productMaterializationSignature: policySignature,
        ownerCount: 1
      })
      revisionSetsByProductSignature.set(policySignature, revisionSet)
      return revisionSet
    }

    const buildAggregatedDescriptorPacket = (): {
      packet: SolidCenterStrokeResolvedPacket
      intervalIds: Set<string>
    } | null => {
      if (
        intervals.length === 0 ||
        stroke.kind !== 'solid' ||
        cachedPathFrameSlicer === null
      ) {
        return null
      }

      const descriptorIntervals = topology.closed
        ? intervals
        : intervals.filter(
            (interval) =>
              getIntervalTerminalRole(
                interval,
                totalLength,
                topology.closed
              ) === 'none'
          )
      if (descriptorIntervals.length < 2) {
        return null
      }

      const strokePathGroups: NonNullable<
        SolidCenterStrokeRenderDescriptor['strokePathGroups']
      > = []
      const carrierPoints: Vec2[] = []
      const intervalIds: string[] = []
      let wrapsSeam = false

      for (const interval of descriptorIntervals) {
        const coversFullClosedLoop =
          topology.closed &&
          !interval.wrapsSeam &&
          Math.abs(interval.startDistance) <= EPSILON &&
          Math.abs(interval.endDistance - totalLength) <= EPSILON
        if (coversFullClosedLoop) {
          return null
        }

        const intervalPath = cachedPathFrameSlicer
          .slice(
            interval.startDistance,
            interval.endDistance,
            interval.wrapsSeam
          )
          .map((frame) => frame.point)
        if (intervalPath.length < 2) {
          return null
        }

        intervalIds.push(interval.intervalId)
        carrierPoints.push(...intervalPath)
        wrapsSeam = wrapsSeam || interval.wrapsSeam
        strokePathGroups.push({
          strokePaths: [intervalPath],
          strokePathStyle: {
            width: stroke.width,
            cap: stroke.cap,
            join: stroke.join,
            miterLimit: stroke.miterLimit,
            closed: false
          }
        })
      }

      const carrierPolygon = buildInflatedBoundsPolygon(
        carrierPoints,
        stroke.width * Math.max(2, Math.min(8, stroke.miterLimit || 4))
      )
      if (carrierPolygon.length < 3) {
        return null
      }

      const firstInterval = intervals[0]
      const lastInterval = intervals[intervals.length - 1]
      if (!firstInterval || !lastInterval) {
        return null
      }

      const sourceSpanIds = uniqueStrings(
        descriptorIntervals.flatMap((interval) =>
          getSourceSpanIdsForInterval(sourceSpanGraph, interval)
        )
      )
      const geometryId = [
        cachePrefix,
        strokeIndex,
        topology.closed
          ? 'center-dashed-descriptor'
          : 'open-center-dashed-middle-descriptor'
      ].join(':')
      const policySignature = [
        'center-product',
        'descriptor',
        stroke.cap,
        stroke.join,
        stroke.miterLimit,
        topology.closed ? 'all' : 'middle',
        intervalSignature
      ].join(':')
      const debugMeta: SolidCenterStrokeGeometryDebugMeta = {
        sourcePathId: cachePrefix,
        ownerKey: options.metadata?.ownerKeyPrefix
          ? `${options.metadata.ownerKeyPrefix}:stroke:${strokeIndex}`
          : undefined,
        networkId: options.metadata?.networkId,
        strokeId: `stroke:${strokeIndex}`,
        strokeIndex,
        intervalId: firstInterval.intervalId,
        intervalIds,
        strokePosition: 'center',
        productMode: 'center-product',
        productSignature: 'center-product:dashed',
        domainMode: 'center-product',
        topologyFamily: topology.topologyFamily,
        sourceSpanIds,
        startDistance: firstInterval.startDistance,
        endDistance: lastInterval.endDistance,
        wrapsSeam,
        intervalTerminalRole: 'none',
        strokeIntersectionEligible: false,
        dashPlacementMode,
        revisionSet: buildStrokeRuntimeRevisionSet({
          points: topologyPoints,
          closed: topology.closed,
          stroke,
          productMode: 'center-product',
          domainMode: 'center-product',
          ownerKey: options.metadata?.ownerKeyPrefix
            ? `${options.metadata.ownerKeyPrefix}:stroke:${strokeIndex}`
            : undefined,
          networkId: options.metadata?.networkId,
          strokeId: `stroke:${strokeIndex}`,
          intervalSignature: `descriptor:${intervalSignature}`,
          endpointCapPolicySignature: policySignature,
          joinOwnershipSignature: [
            'center-product-join',
            'descriptor',
            stroke.join,
            stroke.miterLimit
          ].join(':'),
          strokeProductSignature: 'center-product:dashed',
          smoothContinuitySignature: `center-product:descriptor:${intervalSignature}`,
          productMaterializationSignature: policySignature,
          ownerCount: Math.max(intervalIds.length, sourceSpanIds.length, 1)
        })
      }
      const polygons = [carrierPolygon]

      return {
        packet: {
          geometry: {
            geometryId,
            polygons,
            bounds: getBounds(polygons),
            debugMeta,
            renderDescriptor: { strokePathGroups }
          },
          paint: {
            geometryId,
            kind: stroke.kind,
            color: stroke.color,
            alpha: stroke.alpha,
            gradientStyle: stroke.gradientStyle,
            paintKey: stroke.paintKey
          }
        },
        intervalIds: new Set(intervalIds)
      }
    }

    const aggregatedDescriptorPacket = buildAggregatedDescriptorPacket()
    const intervalsForIndividualPackets = aggregatedDescriptorPacket
      ? intervals.filter(
          (interval) =>
            !aggregatedDescriptorPacket.intervalIds.has(interval.intervalId)
        )
      : intervals
    if (
      aggregatedDescriptorPacket &&
      intervalsForIndividualPackets.length === 0
    ) {
      return [aggregatedDescriptorPacket.packet]
    }

    return [
      ...(aggregatedDescriptorPacket
        ? [aggregatedDescriptorPacket.packet]
        : []),
      ...intervalsForIndividualPackets.flatMap((interval) => {
        const shouldUseSourcePathRibbon =
          !topology.closed ||
          options.sourcePath?.segments.some(
            (segment) => segment.type === 'cubic'
          ) === true
        const coversFullClosedLoop =
          topology.closed &&
          !interval.wrapsSeam &&
          Math.abs(interval.startDistance) <= EPSILON &&
          Math.abs(interval.endDistance - totalLength) <= EPSILON
        const intervalTerminalRole = getIntervalTerminalRole(
          interval,
          totalLength,
          topology.closed
        )
        const suppressOpenStartCap =
          !topology.closed &&
          (intervalTerminalRole === 'path-start' ||
            intervalTerminalRole === 'both')
        const suppressOpenEndCap =
          !topology.closed &&
          (intervalTerminalRole === 'path-end' ||
            intervalTerminalRole === 'both')
        const canAttemptStrokePathDescriptor =
          topology.closed &&
          stroke.kind === 'solid' &&
          stroke.alpha >= 1 - EPSILON &&
          !coversFullClosedLoop
        const intervalFrames =
          canAttemptStrokePathDescriptor && cachedPathFrameSlicer
            ? cachedPathFrameSlicer.slice(
                interval.startDistance,
                interval.endDistance,
                interval.wrapsSeam
              )
            : options.sourcePath
              ? slicePathGeometryFrames(
                  options.sourcePath,
                  interval.startDistance,
                  interval.endDistance,
                  interval.wrapsSeam,
                  0.18
                ).map(
                  (frame): DashedCenterRibbonFrame => ({
                    point: frame.point,
                    tangent: frame.tangent,
                    sharpJoin: frame.sharpJoin
                  })
                )
              : (() => {
                  const slicedFrames = intervalFrameSlicer.slice(
                    interval.startDistance,
                    interval.endDistance,
                    interval.wrapsSeam
                  )
                  const points = slicedFrames.map(({ x, y }) => ({ x, y }))
                  return points.map(
                    (point, index): DashedCenterRibbonFrame => ({
                      point,
                      tangent: getEndpointTangent(points, index),
                      sharpJoin: index > 0 && index < points.length - 1
                    })
                  )
                })()

        const intervalPath = intervalFrames.map((frame) => frame.point)
        const canUseStrokePathDescriptor =
          canAttemptStrokePathDescriptor &&
          intervalPath.length >= 2 &&
          cachedPathFrameSlicer !== null
        const renderDescriptor: SolidCenterStrokeRenderDescriptor | undefined =
          canUseStrokePathDescriptor
            ? {
                strokePathGroups: [
                  {
                    strokePaths: [intervalPath],
                    strokePathStyle: {
                      width: stroke.width,
                      cap: stroke.cap,
                      join: stroke.join,
                      miterLimit: stroke.miterLimit,
                      closed: false
                    }
                  }
                ]
              }
            : undefined
        const ribbonGeometry =
          !renderDescriptor &&
          shouldUseSourcePathRibbon &&
          !coversFullClosedLoop
            ? buildDashedCenterRibbonGeometry(
                intervalFrames,
                {
                  width: stroke.width,
                  join: stroke.join,
                  miterLimit: stroke.miterLimit,
                  cap: stroke.cap
                },
                {
                  allowRoundCapBackendOffset: true,
                  suppressStartCap: suppressOpenStartCap,
                  suppressEndCap: suppressOpenEndCap
                }
              )
            : null
        const polygons =
          renderDescriptor !== undefined
            ? [
                buildInflatedBoundsPolygon(
                  intervalPath,
                  stroke.width *
                    Math.max(2, Math.min(8, stroke.miterLimit || 4))
                )
              ].filter((polygon) => polygon.length >= 3)
            : (ribbonGeometry?.polygons ??
              buildSolidCenterStrokePolygons(
                intervalPath,
                coversFullClosedLoop,
                {
                  style: 'solid',
                  position: 'center',
                  width: stroke.width,
                  join: stroke.join,
                  miterLimit: stroke.miterLimit,
                  cap: stroke.cap
                }
              ))

        if (polygons.length === 0) {
          return []
        }

        const intervalStartCutKind = getIntervalEndpointCutKind(
          sourceSpanGraph,
          interval.startDistance,
          totalLength,
          topology.closed
        )
        const intervalEndCutKind = getIntervalEndpointCutKind(
          sourceSpanGraph,
          interval.endDistance,
          totalLength,
          topology.closed
        )
        const geometryId = `${cachePrefix}:${strokeIndex}:${interval.intervalId}`
        const debugMeta: SolidCenterStrokeGeometryDebugMeta = {
          sourcePathId: cachePrefix,
          ownerKey: options.metadata?.ownerKeyPrefix
            ? `${options.metadata.ownerKeyPrefix}:stroke:${strokeIndex}`
            : undefined,
          networkId: options.metadata?.networkId,
          strokeId: `stroke:${strokeIndex}`,
          strokeIndex,
          intervalId: interval.intervalId,
          strokePosition: 'center',
          productMode: 'center-product',
          productSignature: 'center-product:dashed',
          domainMode: 'center-product',
          topologyFamily: topology.topologyFamily,
          sourceSpanIds: getSourceSpanIdsForInterval(sourceSpanGraph, interval),
          authoredVisibleIntervalIndex: interval.authoredIndex,
          startDistance: interval.startDistance,
          endDistance: interval.endDistance,
          wrapsSeam: interval.wrapsSeam,
          previousVisibleIntervalId: interval.previousVisibleIntervalId,
          nextVisibleIntervalId: interval.nextVisibleIntervalId,
          intervalTerminalRole,
          intervalStartCutKind,
          intervalEndCutKind,
          strokeIntersectionEligible: isStrokeIntersectionEligible(
            intervalTerminalRole,
            intervalStartCutKind,
            intervalEndCutKind
          ),
          ribbonValidityStatus: ribbonGeometry?.validityStatus,
          dashPlacementMode,
          revisionSet: getRevisionSet(interval, intervalTerminalRole)
        }

        return [
          {
            geometry: {
              geometryId,
              polygons,
              bounds: getBounds(polygons),
              debugMeta,
              renderDescriptor
            },
            paint: {
              geometryId,
              kind: stroke.kind,
              color: stroke.color,
              alpha: stroke.alpha,
              gradientStyle: stroke.gradientStyle,
              paintKey: stroke.paintKey
            }
          }
        ]
      })
    ]
  })
}
