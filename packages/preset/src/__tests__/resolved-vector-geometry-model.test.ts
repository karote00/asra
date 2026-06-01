import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'
import type { PolygonRegion } from '../components/stroke-render/geometry-backend'
import { buildPathTopologyModel } from '../components/stroke-render/path-topology-model'
import {
  buildVectorGeometryModelPath,
  buildPolylineGeometryModelPath,
  samplePathSegmentFrameAtLength,
  type PathGeometry
} from '../components/stroke-render/path-geometry'
import { buildResolvedVectorGeometryModel } from '../components/stroke-render/resolved-vector-geometry-model'
import type { Vec2 } from '../components/stroke-render/solid-stroke-geometry-core'
import {
  REPORTED_ROUND_INSIDE_DASHED_STAR_NETWORK_ID,
  createReportedRoundInsideDashedStarVectorData
} from './inside-dashed-fixtures'

const vectorComponentSource = () =>
  readFileSync('src/components/vector.ts', 'utf8')

const constrainedDashedPacketSource = () =>
  readFileSync(
    'src/components/stroke-render/constrained-dashed-stroke-packets.ts',
    'utf8'
  )

const isPointInPolygonEvenOdd = (point: Vec2, polygon: Vec2[]) => {
  let inside = false
  for (
    let index = 0, previousIndex = polygon.length - 1;
    index < polygon.length;
    previousIndex = index, index += 1
  ) {
    const current = polygon[index]
    const previous = polygon[previousIndex]
    const crosses =
      current.y > point.y !== previous.y > point.y &&
      point.x <
        ((previous.x - current.x) * (point.y - current.y)) /
          (previous.y - current.y) +
          current.x
    if (crosses) {
      inside = !inside
    }
  }
  return inside
}

const isPointInFillRegions = (point: Vec2, regions: PolygonRegion[]) =>
  regions.some((region) =>
    region.polygons.some((polygon) => isPointInPolygonEvenOdd(point, polygon))
  )

const sampleRangeSideOccupancy = ({
  path,
  regions,
  range
}: {
  path: PathGeometry
  regions: PolygonRegion[]
  range: {
    boundaryPoints?: Vec2[]
    sourceSegmentIndex: number
    sourceStartDistance: number
    sourceEndDistance: number
  }
}) => {
  if (range.boundaryPoints && range.boundaryPoints.length > 1) {
    const boundaryPath = buildPolylineGeometryModelPath(
      range.boundaryPoints,
      false
    )
    const targetDistance = boundaryPath.totalLength / 2
    let remainingDistance = targetDistance
    for (const segment of boundaryPath.segments) {
      if (remainingDistance <= segment.length) {
        const frame = samplePathSegmentFrameAtLength(segment, remainingDistance)
        const offset = 1
        const sidePoint = (side: 1 | -1) => ({
          x: frame.point.x - frame.tangent.y * offset * side,
          y: frame.point.y + frame.tangent.x * offset * side
        })

        return {
          leftFilled: isPointInFillRegions(sidePoint(1), regions),
          rightFilled: isPointInFillRegions(sidePoint(-1), regions)
        }
      }
      remainingDistance -= segment.length
    }
  }

  const segmentStartDistance = path.segments
    .slice(0, range.sourceSegmentIndex)
    .reduce((sum, segment) => sum + segment.length, 0)
  const segment = path.segments[range.sourceSegmentIndex]
  expect(segment).toBeDefined()
  const localMidDistance =
    (range.sourceStartDistance + range.sourceEndDistance) / 2 -
    segmentStartDistance
  const frame = samplePathSegmentFrameAtLength(segment, localMidDistance)
  const offset = 1
  const sidePoint = (side: 1 | -1) => ({
    x: frame.point.x - frame.tangent.y * offset * side,
    y: frame.point.y + frame.tangent.x * offset * side
  })

  return {
    leftFilled: isPointInFillRegions(sidePoint(1), regions),
    rightFilled: isPointInFillRegions(sidePoint(-1), regions)
  }
}

const buildReportedStarGeometryInput = (
  frame: number,
  kind: 'anchor' | 'in-control' | 'out-control'
) => {
  const data = createReportedRoundInsideDashedStarVectorData()
  const deltaX = Math.sin(frame / 7) * 18
  const deltaY = Math.cos(frame / 9) * 14
  const points = { ...data.points }

  if (kind === 'anchor') {
    ;(['tp-52', 'tp-52:in', 'tp-52:out'] as const).forEach((pointId) => {
      points[pointId] = {
        ...points[pointId],
        x: points[pointId].x + deltaX,
        y: points[pointId].y + deltaY
      }
    })
  } else {
    const pointId = kind === 'in-control' ? 'tp-52:in' : 'tp-52:out'
    points[pointId] = {
      ...points[pointId],
      x: points[pointId].x + deltaX,
      y: points[pointId].y + deltaY
    }
  }

  const network = data.networks[REPORTED_ROUND_INSIDE_DASHED_STAR_NETWORK_ID]
  const path = buildVectorGeometryModelPath(network, points, data.segments)
  const topology = buildPathTopologyModel({
    pathId: `cached-drag-frame:${kind}:${frame}`,
    sourceId: 'cached-drag-frame',
    networkId: network.id,
    sourceRevision: `source-revision:cached-drag-frame:${kind}:${frame}`,
    sourceFamily: 'vector',
    points: path.sampledPoints,
    closed: path.closed
  })

  return { path, topology, networkId: network.id }
}

describe('resolved vector geometry model', () => {
  it('should run: resolve self-intersecting fill regions and legal descriptors from one shared model', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 40, y: 40 },
      { x: 0, y: 40 },
      { x: 40, y: 0 }
    ]
    const path = buildPolylineGeometryModelPath(points, true)
    const topology = buildPathTopologyModel({
      pathId: 'shared-self-intersection',
      sourceId: 'shared-vector',
      networkId: 'network-0',
      sourceRevision: 'source-revision:shared-vector:network-0',
      sourceFamily: 'vector',
      points: path.sampledPoints,
      closed: path.closed
    })

    const model = buildResolvedVectorGeometryModel({
      modelId: 'shared-vector-model',
      fillRule: topology.fillRule,
      networks: [
        {
          networkId: 'network-0',
          path,
          topology
        }
      ]
    })
    const networkModel = model.networks[0]

    expect(model).toMatchObject({
      modelId: 'shared-vector-model',
      fillRule: 'nonzero'
    })
    expect(networkModel?.path).toBe(path)
    expect(networkModel?.topology).toBe(topology)
    expect(networkModel?.selfIntersecting?.fillRegions.length).toBeGreaterThan(
      0
    )
    expect(
      networkModel?.selfIntersecting?.legalBoundaryContours.length
    ).toBeGreaterThan(0)
  })

  it('should run: classify self-intersecting split ranges by filled-face boundary domains', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 120, y: 220 },
      { x: 240, y: 0 },
      { x: 0, y: 140 },
      { x: 240, y: 140 }
    ]
    const path = buildPolylineGeometryModelPath(points, true)
    const topology = buildPathTopologyModel({
      pathId: 'shared-star-hole-side',
      sourceId: 'shared-star',
      networkId: 'network-0',
      sourceRevision: 'source-revision:shared-star:network-0',
      sourceFamily: 'vector',
      points: path.sampledPoints,
      closed: path.closed
    })

    const model = buildResolvedVectorGeometryModel({
      modelId: 'shared-star-hole-side-model',
      fillRule: topology.fillRule,
      networks: [
        {
          networkId: 'network-0',
          path,
          topology
        }
      ]
    })
    const sourceSplitRanges =
      model.networks[0]?.selfIntersecting?.sourceSplitRanges ?? []
    const strokeBoundaryDomains =
      model.networks[0]?.selfIntersecting?.strokeBoundaryDomains ?? []
    const fillRegions = model.networks[0]?.selfIntersecting?.fillRegions ?? []

    expect(sourceSplitRanges.length).toBeGreaterThan(points.length)
    expect(strokeBoundaryDomains).toHaveLength(sourceSplitRanges.length)
    expect(fillRegions.length).toBeGreaterThan(0)
    sourceSplitRanges.forEach((range) => {
      const occupancy = sampleRangeSideOccupancy({
        path,
        regions: fillRegions,
        range
      })
      expect(range.sideResolutionStatus).toBe('resolved')
      if (range.boundaryRole === 'filled-face') {
        expect(range.filledSide).toBe(range.legalSide)
        expect(range.unfilledSide).toBe(range.legalSide === 1 ? -1 : 1)
        expect(range.legalFaceIds.length).toBeGreaterThan(0)
        expect(range.oppositeFaceIds.length).toBeGreaterThan(0)
      } else {
        expect(occupancy.leftFilled).not.toBe(occupancy.rightFilled)
        expect(range.filledSide).toBe(occupancy.leftFilled ? 1 : -1)
        expect(range.unfilledSide).toBe(occupancy.leftFilled ? -1 : 1)
      }
    })
    expect(sourceSplitRanges.map((range) => range.boundaryRole)).toContain(
      'outer'
    )
    expect(sourceSplitRanges.map((range) => range.boundaryRole)).toContain(
      'filled-face'
    )
    expect(
      sourceSplitRanges
        .filter((range) => range.boundaryRole === 'filled-face')
        .every(
          (range) =>
            range.legalFaceIds.length > 0 &&
            range.oppositeFaceIds.length > 0 &&
            range.contourIds.length > 0
        )
    ).toBe(true)
    expect(
      strokeBoundaryDomains
        .filter((domain) => domain.boundaryRole === 'filled-face')
        .every(
          (domain) =>
            domain.insideEligible === true &&
            domain.outsideEligible === false &&
            domain.insideSelectedSide === domain.filledSide &&
            domain.outsideSelectedSide === null &&
            domain.adjacentFilledFaceIds.length > 0 &&
            domain.adjacentUnfilledFaceIds.length > 0
        )
    ).toBe(true)
    expect(
      strokeBoundaryDomains
        .filter((domain) => domain.boundaryRole === 'outer')
        .every(
          (domain) =>
            domain.insideEligible === true &&
            domain.outsideEligible === true &&
            domain.insideSelectedSide === domain.filledSide &&
            domain.outsideSelectedSide === domain.unfilledSide
        )
    ).toBe(true)
  })

  it('should run: expose bounded unfilled faces for evenodd self-intersection masks', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 120, y: 220 },
      { x: 240, y: 0 },
      { x: 0, y: 140 },
      { x: 240, y: 140 }
    ]
    const path = buildPolylineGeometryModelPath(points, true)
    const topology = buildPathTopologyModel({
      pathId: 'shared-star-evenodd-unfilled-faces',
      sourceId: 'shared-star-evenodd',
      networkId: 'network-0',
      sourceRevision: 'source-revision:shared-star-evenodd:network-0',
      sourceFamily: 'vector',
      points: path.sampledPoints,
      closed: path.closed,
      fillRule: 'evenodd'
    })

    const model = buildResolvedVectorGeometryModel({
      modelId: 'shared-star-evenodd-unfilled-faces-model',
      fillRule: topology.fillRule,
      networks: [
        {
          networkId: 'network-0',
          path,
          topology
        }
      ]
    })
    const selfIntersecting = model.networks[0]?.selfIntersecting
    const unfilledFaceBoundaries =
      selfIntersecting?.unfilledFaceBoundaries ?? []
    const legalFaceIds = new Set(
      selfIntersecting?.legalFaceBoundaries.map((face) => face.faceId) ?? []
    )

    expect(topology.fillRule).toBe('evenodd')
    expect(selfIntersecting?.fillRegions.length).toBeGreaterThan(0)
    expect(unfilledFaceBoundaries.length).toBeGreaterThan(0)
    expect(
      unfilledFaceBoundaries.every(
        (face) =>
          face.faceId.startsWith('face:') &&
          !legalFaceIds.has(face.faceId) &&
          face.points.length >= 3 &&
          face.edges.length >= 3 &&
          face.edges.every((edge) => edge.edgeId.includes(':edge:'))
      ),
      JSON.stringify(
        {
          legalFaceIds: [...legalFaceIds],
          unfilledFaceBoundaries: unfilledFaceBoundaries.map((face) => ({
            faceId: face.faceId,
            pointCount: face.points.length,
            edgeIds: face.edges.map((edge) => edge.edgeId)
          }))
        },
        null,
        2
      )
    ).toBe(true)
  })

  it('should run: expose filled-face stroke domains as actual boundary geometry, not source-range labels', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 120, y: 220 },
      { x: 240, y: 0 },
      { x: 0, y: 140 },
      { x: 240, y: 140 }
    ]
    const path = buildPolylineGeometryModelPath(points, true)
    const topology = buildPathTopologyModel({
      pathId: 'shared-star-hole-boundary-domain',
      sourceId: 'shared-star-hole-boundary',
      networkId: 'network-0',
      sourceRevision: 'source-revision:shared-star-hole-boundary:network-0',
      sourceFamily: 'vector',
      points: path.sampledPoints,
      closed: path.closed
    })

    const model = buildResolvedVectorGeometryModel({
      modelId: 'shared-star-hole-boundary-domain-model',
      fillRule: topology.fillRule,
      networks: [
        {
          networkId: 'network-0',
          path,
          topology
        }
      ]
    })
    const strokeBoundaryDomains =
      model.networks[0]?.selfIntersecting?.strokeBoundaryDomains ?? []
    const filledFaceDomains = strokeBoundaryDomains.filter(
      (domain) => domain.boundaryRole === 'filled-face'
    )

    expect(filledFaceDomains.length).toBeGreaterThan(0)
    filledFaceDomains.forEach((domain) => {
      const record = domain as unknown as Record<string, unknown>
      expect(record.boundaryPoints).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            x: expect.any(Number),
            y: expect.any(Number)
          })
        ])
      )
      expect(
        (record.boundaryPoints as unknown[]).length
      ).toBeGreaterThanOrEqual(2)
      expect(record.boundaryTotalLength).toEqual(expect.any(Number))
      expect(record.boundaryStartDistance).toBe(0)
      expect(record.boundaryEndDistance).toBe(record.boundaryTotalLength)
      expect(record.boundaryTotalLength as number).toBeGreaterThan(0)
      expect(record.boundaryDomainId).not.toBe(
        `stroke-boundary-domain:${domain.rangeId}`
      )
      expect(domain.insideEligible).toBe(true)
      expect(domain.outsideEligible).toBe(false)
    })
  })

  it('should run: keep cached self-intersection drag frames equivalent to full rebuilds', () => {
    let previousCache:
      | ReturnType<typeof buildResolvedVectorGeometryModel>['cache']
      | undefined
    ;(
      [
        ['anchor', 0],
        ['anchor', 1],
        ['in-control', 2],
        ['out-control', 3],
        ['anchor', 4]
      ] as const
    ).forEach(([kind, frame]) => {
      const { path, topology, networkId } = buildReportedStarGeometryInput(
        frame,
        kind
      )
      const networks = [
        {
          networkId,
          path,
          topology
        }
      ]
      const fullModel = buildResolvedVectorGeometryModel({
        modelId: `full:${kind}:${frame}`,
        fillRule: topology.fillRule,
        networks
      })
      const cachedModel = buildResolvedVectorGeometryModel({
        modelId: `cached:${kind}:${frame}`,
        fillRule: topology.fillRule,
        networks,
        previousCache
      })

      expect(cachedModel.networks[0]?.selfIntersecting).toEqual(
        fullModel.networks[0]?.selfIntersecting
      )
      previousCache = cachedModel.cache
    })
  })

  it('should run: keep vector fill and stroke consumers wired to the same resolved geometry map', () => {
    const source = vectorComponentSource()

    expect(source.match(/buildResolvedVectorGeometryModel\(/g)).toHaveLength(1)
    expect(source).toContain('const resolvedGeometryByNetworkId = new Map<')
    expect(source).toContain(
      'resolvedGeometryByNetworkId.get(network.id)?.selfIntersecting'
    )
    expect(source).toContain('?.fillRegions ?? []')
    expect(source).toContain('?.unfilledFaceBoundaries ?? []')
    expect(source).toContain('?.legalBoundaryContours')
    expect(source).toContain('implicitUnfilledFaceBoundaries')
    expect(source).not.toMatch(/buildSelfIntersectingEvenOddResolvedGeometry/)
  })

  it('should run: keep legal boundary evidence out of constrained dashed product construction', () => {
    const vectorSource = vectorComponentSource()
    const dashedPacketSource = constrainedDashedPacketSource()

    expect(dashedPacketSource).not.toContain('legalBoundaryContours')
    expect(vectorSource).toContain('clipInsideToFillDomain:')
    expect(vectorSource).not.toMatch(
      /buildConstrainedDashedStrokeResolvedPackets[\s\S]{0,1400}legalBoundaryContours/
    )
  })
})
