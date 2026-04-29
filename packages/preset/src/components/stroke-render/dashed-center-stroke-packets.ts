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
        interval.previousVisibleIntervalId ?? 'none',
        interval.nextVisibleIntervalId ?? 'none'
      ].join(':')
    )
    .join('|')

const hasPositiveRawDashPattern = (stroke: StrokeAttrs) => {
  const sourcePattern = Array.isArray(stroke.dashPattern)
    ? stroke.dashPattern
    : []

  return sourcePattern.some((entry) => Number.isFinite(entry) && entry > 0)
}

interface DashedCenterStrokePacketOptions {
  metadata?: {
    ownerKeyPrefix?: string
    networkId?: string
  }
  topology?: PathTopologyModel
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
  strokes?.some(
    (stroke) =>
      stroke.visible !== false &&
      stroke.style === 'dashed' &&
      stroke.position === 'center' &&
      stroke.width > 0 &&
      hasPositiveRawDashPattern(stroke)
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
  const totalLength = topology.totalLength
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
      topology,
      stroke.dashPattern,
      stroke.dashOffset
    ).filter((interval) => interval.kind === 'visible')
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
      const intervalFrames = intervalFrameSlicer.slice(
        interval.startDistance,
        interval.endDistance,
        interval.wrapsSeam
      )
      const intervalPoints = intervalFrames.map(({ x, y }) => ({ x, y }))
      const coversFullClosedLoop =
        topology.closed &&
        !interval.wrapsSeam &&
        Math.abs(interval.startDistance) <= EPSILON &&
        Math.abs(interval.endDistance - totalLength) <= EPSILON

      const polygons = buildSolidCenterStrokePolygons(
        intervalPoints,
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
        authoredVisibleIntervalIndex: interval.authoredIndex,
        startDistance: interval.startDistance,
        endDistance: interval.endDistance,
        wrapsSeam: interval.wrapsSeam,
        previousVisibleIntervalId: interval.previousVisibleIntervalId,
        nextVisibleIntervalId: interval.nextVisibleIntervalId,
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
