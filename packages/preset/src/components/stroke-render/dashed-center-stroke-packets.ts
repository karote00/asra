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

const getFallbackTangent = (points: Vec2[], index: number): Vec2 => {
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

interface DashedCenterStrokePacketOptions {
  metadata?: {
    ownerKeyPrefix?: string
    networkId?: string
  }
  topology?: PathTopologyModel
  sourcePath?: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>
}

const mapCenterTopologyToSourceTopology = (
  topology: PathTopologyModel
): NonNullable<SolidCenterStrokeGeometryDebugMeta['sourceTopology']> => {
  if (topology.topologyFamily === 'open') {
    return 'open'
  }
  if (topology.topologyFamily === 'self-intersecting') {
    return 'self-intersecting'
  }
  if (topology.topologyFamily === 'degenerate') {
    return 'degenerate'
  }
  return 'sampled-simple-closed'
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
  const sourceTopology = mapCenterTopologyToSourceTopology(topology)
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
    const revisionSetsByIntervalTopology = new Map<
      string,
      SolidCenterStrokeGeometryDebugMeta['revisionSet']
    >()
    const getRevisionSet = (intervalTopology: string) => {
      const cached = revisionSetsByIntervalTopology.get(intervalTopology)
      if (cached) {
        return cached
      }

      const revisionSet = buildStrokeRuntimeRevisionSet({
        points: topologyPoints,
        closed: topology.closed,
        stroke,
        geometryFamily: 'dashed-center',
        resolutionStatus: 'native-center',
        runtimeStatus: 'not-applicable',
        runtimeReason: 'center-stroke',
        sourceTopology,
        ownerKey: options.metadata?.ownerKeyPrefix
          ? `${options.metadata.ownerKeyPrefix}:stroke:${strokeIndex}`
          : undefined,
        networkId: options.metadata?.networkId,
        strokeId: `stroke:${strokeIndex}`,
        intervalSignature,
        intervalTopology
      })
      revisionSetsByIntervalTopology.set(intervalTopology, revisionSet)
      return revisionSet
    }

    return intervals.flatMap((interval) => {
      const shouldUseSourcePathRibbon =
        options.sourcePath?.segments.some(
          (segment) => segment.type === 'cubic'
        ) === true
      const coversFullClosedLoop =
        topology.closed &&
        !interval.wrapsSeam &&
        Math.abs(interval.startDistance) <= EPSILON &&
        Math.abs(interval.endDistance - totalLength) <= EPSILON
      const intervalFrames = options.sourcePath
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
                tangent: getFallbackTangent(points, index),
                sharpJoin: index > 0 && index < points.length - 1
              })
            )
          })()

      const ribbonGeometry =
        shouldUseSourcePathRibbon && !coversFullClosedLoop
          ? buildDashedCenterRibbonGeometry(
              intervalFrames,
              {
                width: stroke.width,
                join: stroke.join,
                miterLimit: stroke.miterLimit,
                cap: stroke.cap
              },
              {
                allowRoundCapBackendOffset: true
              }
            )
          : null
      const polygons =
        ribbonGeometry?.polygons ??
        buildSolidCenterStrokePolygons(
          intervalFrames.map((frame) => frame.point),
          coversFullClosedLoop,
          {
            style: 'solid',
            position: 'center',
            width: stroke.width,
            join: stroke.join,
            miterLimit: stroke.miterLimit,
            cap: stroke.cap
          }
        )

      if (polygons.length === 0) {
        return []
      }

      const intervalTerminalRole = getIntervalTerminalRole(
        interval,
        totalLength,
        topology.closed
      )
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
        geometryFamily: 'dashed-center',
        resolutionStatus: 'native-center',
        runtimeStatus: 'not-applicable',
        runtimeReason: 'center-stroke',
        sourceTopology,
        topologyFamily: topology.topologyFamily,
        revisionSet: getRevisionSet(
          interval.wrapsSeam ? 'seam-wrapping' : 'visible'
        )
      }

      return [
        {
          geometry: {
            geometryId,
            polygons,
            bounds: getBounds(polygons),
            debugMeta
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
  })
}
