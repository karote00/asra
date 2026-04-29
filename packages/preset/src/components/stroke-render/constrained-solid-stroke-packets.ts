import type { StrokeAttrs } from '@asyra/utils'
import { getRenderableStrokes } from './renderable-stroke'
import {
  buildConstrainedSolidStrokePolygons,
  supportsConstrainedSolidStroke
} from './constrained-solid-stroke-geometry'
import type { SolidCenterStrokeResolvedPacket } from './solid-center-stroke-packets'
import type { StrokeGeometrySourceTopology } from './solid-center-stroke-packets'
import { buildStrokeRuntimeRevisionSet } from './stroke-dirty-keys'
import {
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

interface ConstrainedSolidStrokePacketOptions {
  metadata?: {
    ownerKeyPrefix?: string
    networkId?: string
    contourId?: string
    legalDomainId?: string | null
  }
  topology?: PathTopologyModel
}

const mapTopologyFamilyToSourceTopology = (
  topology: PathTopologyModel
): StrokeGeometrySourceTopology | undefined => {
  switch (topology.topologyFamily) {
    case 'open':
    case 'rectangle-equivalent':
    case 'broader-simple-closed':
    case 'sampled-simple-closed':
    case 'self-intersecting':
      return topology.topologyFamily
    default:
      return undefined
  }
}

const getConstrainedSolidResolutionStatus = (
  topology: PathTopologyModel
): 'exact-constrained' | 'local-side-approximation' =>
  !topology.closed && !topology.isSimpleOpen
    ? 'local-side-approximation'
    : 'exact-constrained'

export const hasConstrainedSolidStrokeIntent = (
  strokes: StrokeAttrs[] | undefined
) =>
  strokes?.some(
    (stroke) =>
      stroke.visible !== false &&
      stroke.style === 'solid' &&
      (stroke.position === 'inside' || stroke.position === 'outside') &&
      stroke.width > 0
  ) === true

export const buildConstrainedSolidStrokeResolvedPackets = (
  cachePrefix: string,
  points: Vec2[],
  closed: boolean,
  strokes: StrokeAttrs[] | undefined,
  options: ConstrainedSolidStrokePacketOptions = {}
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
  const primaryContour = topology.contours[0]
  const contourId = options.metadata?.contourId ?? primaryContour?.contourId
  const legalDomainId =
    options.metadata?.legalDomainId ?? primaryContour?.legalDomainId
  const sourceTopology = mapTopologyFamilyToSourceTopology(topology)

  return getRenderableStrokes(strokes).flatMap((stroke, index) => {
    if (!supportsConstrainedSolidStroke(stroke, topology.closed)) {
      return []
    }

    const polygons = buildConstrainedSolidStrokePolygons(
      topologyPoints,
      topology.closed,
      stroke,
      {
        assumeSimpleOpen:
          !topology.closed ? true : undefined,
        assumeSimpleClosed: topology.closed ? topology.isSimpleClosed : undefined,
        assumeNormalizedOpen: !topology.closed
      }
    )
    if (polygons.length === 0) {
      return []
    }

    const geometryId = `${cachePrefix}:${index}`

    return [
      {
        geometry: {
          geometryId,
          polygons,
          bounds: getBounds(polygons),
          debugMeta: {
            sourcePathId: cachePrefix,
            ownerKey: options.metadata?.ownerKeyPrefix
              ? `${options.metadata.ownerKeyPrefix}:stroke:${index}`
              : undefined,
            networkId: options.metadata?.networkId,
            strokeId: `stroke:${index}`,
            strokeIndex: index,
            contourId,
            legalDomainId,
            geometryFamily: 'constrained-solid',
            resolutionStatus: getConstrainedSolidResolutionStatus(topology),
            runtimeStatus: 'accepted',
            runtimeReason: 'constrained-solid-exact',
            sourceTopology,
            topologyFamily: topology.topologyFamily,
            revisionSet: buildStrokeRuntimeRevisionSet({
              points: topologyPoints,
              closed: topology.closed,
              stroke,
              geometryFamily: 'constrained-solid',
              resolutionStatus: getConstrainedSolidResolutionStatus(topology),
              runtimeStatus: 'accepted',
              runtimeReason: 'constrained-solid-exact',
              ownerKey: options.metadata?.ownerKeyPrefix
                ? `${options.metadata.ownerKeyPrefix}:stroke:${index}`
                : undefined,
              networkId: options.metadata?.networkId,
              strokeId: `stroke:${index}`,
              sourceTopology: topology.topologyFamily
            })
          }
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
}
