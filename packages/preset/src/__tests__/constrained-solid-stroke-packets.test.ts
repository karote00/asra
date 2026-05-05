import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import Clipper2ZFactory from 'clipper2-wasm'
import { createDefaultStroke } from '@asyra/utils'
import {
  buildConstrainedSolidStrokeResolvedPackets,
  hasConstrainedSolidStrokeIntent
} from '../components/stroke-render/constrained-solid-stroke-packets'
import {
  buildVectorGeometryModelPath,
  slicePathGeometryPoints
} from '../components/stroke-render/path-geometry'
import { buildPathTopologyModel } from '../components/stroke-render/path-topology-model'
import {
  buildSolidCenterStrokeExportPackets,
  buildSolidCenterStrokeHitTestPackets,
  createSolidCenterStrokeHitArea
} from '../components/stroke-render/solid-center-stroke-packets'
import {
  createClipper2GeometryBackend,
  type Clipper2Module
} from '../components/stroke-render/clipper2-geometry-backend'
import {
  buildArrangedStrokeFinalFacesFromResolvedPackets,
  collapseStrokeFinalFaceVisualOverlaps
} from '../components/stroke-render/stroke-candidate-arrangement'
import { buildStrokeFinalFacesFromResolvedPackets } from '../components/stroke-render/stroke-final-face'

interface Vec2 {
  x: number
  y: number
}

const require = createRequire(import.meta.url)
const wasmPath = require.resolve('clipper2-wasm/dist/umd/clipper2z.wasm')

const loadClipperModule = async () =>
  (await (
    Clipper2ZFactory as (options: {
      wasmBinary: Uint8Array
    }) => Promise<Clipper2Module>
  )({
    wasmBinary: readFileSync(wasmPath)
  })) as Clipper2Module

const pointSegmentDistance = (point: Vec2, start: Vec2, end: Vec2) => {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared <= 1e-12) {
    return Math.hypot(point.x - start.x, point.y - start.y)
  }
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
    )
  )
  return Math.hypot(point.x - (start.x + dx * t), point.y - (start.y + dy * t))
}

const isPointInPolygon = (point: Vec2, polygon: Vec2[]) => {
  if (
    polygon.some(
      (current, index) =>
        pointSegmentDistance(
          point,
          current,
          polygon[(index + 1) % polygon.length]
        ) <= 0.25
    )
  ) {
    return true
  }

  let inside = false
  for (
    let index = 0, previousIndex = polygon.length - 1;
    index < polygon.length;
    previousIndex = index, index += 1
  ) {
    const current = polygon[index]
    const previous = polygon[previousIndex]
    const intersects =
      current.y > point.y !== previous.y > point.y &&
      point.x <
        ((previous.x - current.x) * (point.y - current.y)) /
          (previous.y - current.y) +
          current.x

    if (intersects) {
      inside = !inside
    }
  }

  return inside
}

const distanceBetween = (from: Vec2, to: Vec2) =>
  Math.hypot(to.x - from.x, to.y - from.y)

const normalizeVector = (vector: Vec2): Vec2 | null => {
  const length = Math.hypot(vector.x, vector.y)
  return length <= 1e-6
    ? null
    : {
        x: vector.x / length,
        y: vector.y / length
      }
}

const polygonListContainsPoint = (polygons: Vec2[][], point: Vec2) =>
  polygons.some(
    (polygon) =>
      polygon.some(
        (current, index) =>
          pointSegmentDistance(
            point,
            current,
            polygon[(index + 1) % polygon.length]
          ) <= 0.25
      ) || isPointInPolygon(point, polygon)
  )

const polygonListRegionCoverage = (
  polygons: Vec2[][],
  region: { x: number; y: number; width: number; height: number },
  step = 1
) => {
  let covered = 0
  let total = 0

  for (
    let y = region.y + step / 2;
    y < region.y + region.height;
    y += step
  ) {
    for (
      let x = region.x + step / 2;
      x < region.x + region.width;
      x += step
    ) {
      total += 1
      if (polygonListContainsPoint(polygons, { x, y })) {
        covered += 1
      }
    }
  }

  return total === 0 ? 0 : covered / total
}

describe('constrained solid stroke packets', () => {
  it('should detect constrained solid intent only for positive-width inside/outside solid strokes', () => {
    expect(
      hasConstrainedSolidStrokeIntent([
        createDefaultStroke({ width: 4, style: 'solid', position: 'inside' })
      ])
    ).toBe(true)

    expect(
      hasConstrainedSolidStrokeIntent([
        createDefaultStroke({ width: 4, style: 'solid', position: 'center' })
      ])
    ).toBe(false)

    expect(
      hasConstrainedSolidStrokeIntent([
        createDefaultStroke({ width: 4, style: 'dashed', position: 'inside' })
      ])
    ).toBe(false)

    expect(
      hasConstrainedSolidStrokeIntent([
        createDefaultStroke({ width: 0, style: 'solid', position: 'outside' })
      ])
    ).toBe(false)

    expect(
      hasConstrainedSolidStrokeIntent([
        createDefaultStroke({
          visible: false,
          width: 4,
          style: 'solid',
          position: 'inside'
        })
      ])
    ).toBe(false)
  })

  it('should run: derive render, hit, and export packets from the same constrained final geometry source', () => {
    const packets = buildConstrainedSolidStrokeResolvedPackets(
      'rect:test',
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 }
      ],
      true,
      [createDefaultStroke({ width: 4, style: 'solid', position: 'inside' })]
    )

    expect(packets).toHaveLength(1)

    const [resolved] = packets
    const [hit] = buildSolidCenterStrokeHitTestPackets(packets)
    const [exportPacket] = buildSolidCenterStrokeExportPackets(packets)

    expect(hit.geometryId).toBe(resolved.geometry.geometryId)
    expect(exportPacket.geometryId).toBe(resolved.geometry.geometryId)
    expect(hit.polygons).toBe(resolved.geometry.polygons)
    expect(exportPacket.polygons).toBe(resolved.geometry.polygons)
    expect(hit.bounds).toEqual(resolved.geometry.bounds)
    expect(exportPacket.bounds).toEqual(resolved.geometry.bounds)
  })

  it('should run: materialize constrained solid packets as final faces with legal-domain metadata', () => {
    const packets = buildConstrainedSolidStrokeResolvedPackets(
      'vector:test:network-a:constrained-solid',
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 }
      ],
      true,
      [createDefaultStroke({ width: 4, style: 'solid', position: 'inside' })],
      {
        metadata: {
          ownerKeyPrefix: 'vector:test:network-a',
          networkId: 'network-a',
          contourId: 'contour-a',
          legalDomainId: 'legal-domain-a'
        }
      }
    )

    const [face] = buildStrokeFinalFacesFromResolvedPackets(packets)

    expect(face).toMatchObject({
      faceId: packets[0]?.geometry.geometryId,
      geometryFamily: 'constrained-solid',
      resolutionStatus: 'exact-constrained',
      runtimeStatus: 'accepted',
      sourceTopology: 'rectangle-equivalent',
      sourceContourIds: ['contour-a'],
      legalDomainIds: ['legal-domain-a']
    })
    expect(face?.ownerSet).toEqual([
      {
        ownerKey: 'vector:test:network-a:stroke:0',
        sourcePathId: 'vector:test:network-a:constrained-solid',
        networkId: 'network-a',
        strokeId: 'stroke:0',
        strokeIndex: 0,
        contourId: 'contour-a'
      }
    ])
  })

  it('should run: reject open constrained solid packet construction because product open paths are center-equivalent', () => {
    const packets = buildConstrainedSolidStrokeResolvedPackets(
      'line:test',
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 }
      ],
      false,
      [createDefaultStroke({ width: 4, style: 'solid', position: 'inside' })]
    )

    expect(packets).toEqual([])
  })

  it('should run: attach typed owner and network metadata to constrained solid packets', () => {
    const packets = buildConstrainedSolidStrokeResolvedPackets(
      'opaque-cache-key',
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 }
      ],
      true,
      [createDefaultStroke({ width: 4, style: 'solid', position: 'inside' })],
      {
        metadata: {
          ownerKeyPrefix: 'typed-vector:network-a',
          networkId: 'network-a'
        }
      }
    )

    expect(packets).toHaveLength(1)
    expect(packets[0].geometry.debugMeta).toMatchObject({
      sourcePathId: 'opaque-cache-key',
      ownerKey: 'typed-vector:network-a:stroke:0',
      networkId: 'network-a',
      strokeId: 'stroke:0',
      strokeIndex: 0,
      contourId: 'opaque-cache-key:contour:0',
      legalDomainId: 'opaque-cache-key:legal-domain:0',
      sourceTopology: 'rectangle-equivalent',
      topologyFamily: 'rectangle-equivalent'
    })
  })

  it('should run: preserve constrained solid legal-domain metadata across render, hit, and export packets', () => {
    const packets = buildConstrainedSolidStrokeResolvedPackets(
      'rect:legal-domain',
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 }
      ],
      true,
      [createDefaultStroke({ width: 4, style: 'solid', position: 'inside' })],
      {
        metadata: {
          ownerKeyPrefix: 'rect:legal-domain',
          networkId: 'shape'
        }
      }
    )

    const [resolved] = packets
    const [hit] = buildSolidCenterStrokeHitTestPackets(packets)
    const [exportPacket] = buildSolidCenterStrokeExportPackets(packets)

    expect(resolved.geometry.debugMeta).toMatchObject({
      sourcePathId: 'rect:legal-domain',
      ownerKey: 'rect:legal-domain:stroke:0',
      strokeIndex: 0,
      contourId: 'rect:legal-domain:contour:0',
      legalDomainId: 'rect:legal-domain:legal-domain:0',
      geometryFamily: 'constrained-solid',
      resolutionStatus: 'exact-constrained',
      runtimeStatus: 'accepted',
      runtimeReason: 'constrained-solid-exact',
      sourceTopology: 'rectangle-equivalent',
      topologyFamily: 'rectangle-equivalent'
    })
    expect(hit.debugMeta).toBe(resolved.geometry.debugMeta)
    expect(exportPacket.debugMeta).toBe(resolved.geometry.debugMeta)
  })

  it('should run: keep non-overflow constrained hit inside the legal owner domain', () => {
    const packets = buildConstrainedSolidStrokeResolvedPackets(
      'rect:test',
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 }
      ],
      true,
      [createDefaultStroke({ width: 4, style: 'solid', position: 'inside' })]
    )

    const hitArea = createSolidCenterStrokeHitArea(packets)

    expect(hitArea?.contains(1, 1)).toBe(true)
    expect(hitArea?.contains(10, 10)).toBe(false)
    expect(hitArea?.contains(-1, -1)).toBe(false)
  })

  it('should run: reject open constrained solid hit packets because open product paths are center-equivalent', () => {
    const insidePackets = buildConstrainedSolidStrokeResolvedPackets(
      'line:test:inside',
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 }
      ],
      false,
      [createDefaultStroke({ width: 4, style: 'solid', position: 'inside' })]
    )
    const outsidePackets = buildConstrainedSolidStrokeResolvedPackets(
      'line:test:outside',
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 }
      ],
      false,
      [createDefaultStroke({ width: 4, style: 'solid', position: 'outside' })]
    )

    expect(insidePackets).toEqual([])
    expect(outsidePackets).toEqual([])
    expect(createSolidCenterStrokeHitArea(insidePackets)).toBeNull()
    expect(createSolidCenterStrokeHitArea(outsidePackets)).toBeNull()
  })

  it('should run: reject local-side constrained solid packets for self-intersecting open paths', () => {
    const packets = buildConstrainedSolidStrokeResolvedPackets(
      'open-self-intersecting:test',
      [
        { x: 0, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 },
        { x: 20, y: 0 }
      ],
      false,
      [createDefaultStroke({ width: 4, style: 'solid', position: 'inside' })]
    )

    expect(packets).toEqual([])
  })

  it('should run: keep reported vector-6 outside solid exact-arrangement candidates covering authored segments', async () => {
    const points = {
      'tp-12': {
        id: 'tp-12',
        kind: 'anchor',
        x: 192.42083700791653,
        y: 0,
        anchorType: 'sharp'
      },
      'tp-13': {
        id: 'tp-13',
        kind: 'anchor',
        x: 11.358174406717296,
        y: 364.1297089212308,
        anchorType: 'smooth'
      },
      'tp-12:out': {
        id: 'tp-12:out',
        kind: 'control',
        x: 170.10536493824844,
        y: 119.07041481724248,
        controlForId: 'tp-12',
        controlRole: 'out'
      },
      'tp-13:in': {
        id: 'tp-13:in',
        kind: 'control',
        x: -42.09205809548172,
        y: 343.2841182453731,
        controlForId: 'tp-13',
        controlRole: 'in'
      },
      'tp-13:out': {
        id: 'tp-13:out',
        kind: 'control',
        x: 78.17096503446606,
        y: 390.18669726605293,
        controlForId: 'tp-13',
        controlRole: 'out'
      },
      'tp-14': {
        id: 'tp-14',
        kind: 'anchor',
        x: 360.120941483566,
        y: 144.31562775593738,
        anchorType: 'sharp'
      },
      'tp-15': {
        id: 'tp-15',
        kind: 'anchor',
        x: 0,
        y: 14.030686031827244,
        anchorType: 'sharp'
      },
      'tp-16': {
        id: 'tp-16',
        kind: 'anchor',
        x: 270.59180204238254,
        y: 345.42212754546125,
        anchorType: 'smooth'
      },
      'tp-15:out': {
        id: 'tp-15:out',
        kind: 'control',
        x: 0,
        y: 14.030686031827244,
        controlForId: 'tp-15',
        controlRole: 'out'
      },
      'tp-16:in': {
        id: 'tp-16:in',
        kind: 'control',
        x: 263.9105229796076,
        y: 362.79345310867603,
        controlForId: 'tp-16',
        controlRole: 'in'
      },
      'tp-16:out': {
        id: 'tp-16:out',
        kind: 'control',
        x: 277.2730811051575,
        y: 328.05080198224647,
        controlForId: 'tp-16',
        controlRole: 'out'
      }
    } as const
    const segments = {
      'ts-23': {
        id: 'ts-23',
        startId: 'tp-12',
        endId: 'tp-13',
        outControlId: 'tp-12:out',
        inControlId: 'tp-13:in'
      },
      'ts-24': {
        id: 'ts-24',
        startId: 'tp-13',
        endId: 'tp-14',
        outControlId: 'tp-13:out',
        inControlId: null
      },
      'ts-25': {
        id: 'ts-25',
        startId: 'tp-14',
        endId: 'tp-15',
        outControlId: null,
        inControlId: null
      },
      'ts-26': {
        id: 'ts-26',
        startId: 'tp-15',
        endId: 'tp-16',
        outControlId: 'tp-15:out',
        inControlId: 'tp-16:in'
      },
      'ts-27': {
        id: 'ts-27',
        startId: 'tp-16',
        endId: 'tp-12',
        outControlId: 'tp-16:out',
        inControlId: null
      }
    } as const
    const network = {
      id: 'tn-4',
      pointIds: ['tp-12', 'tp-13', 'tp-14', 'tp-15', 'tp-16'],
      segmentIds: ['ts-23', 'ts-24', 'ts-25', 'ts-26', 'ts-27'],
      closed: true
    }
    const sourcePath = buildVectorGeometryModelPath(network, points, segments)
    const topology = buildPathTopologyModel({
      pathId: 'vector-6:reported-solid-outside',
      networkId: 'tn-4',
      points: sourcePath.sampledPoints,
      closed: true
    })
    const guardPoints = [
      { x: points['tp-12'].x, y: points['tp-12'].y, sharp: true },
      { x: points['tp-13'].x, y: points['tp-13'].y, sharp: false },
      { x: points['tp-14'].x, y: points['tp-14'].y, sharp: true },
      { x: points['tp-15'].x, y: points['tp-15'].y, sharp: true },
      { x: points['tp-16'].x, y: points['tp-16'].y, sharp: false }
    ]
    const backend = createClipper2GeometryBackend(await loadClipperModule())
    const profileVector6Solid =
      process.env.ASYRA_STROKE_API_PROFILE === '1'
    const profileStart = performance.now()
    const packets = buildConstrainedSolidStrokeResolvedPackets(
      'vector-6:reported-solid-outside',
      topology.normalizedPoints,
      true,
      [
        createDefaultStroke({
          width: 10,
          style: 'solid',
          position: 'outside',
          joinType: 'miter',
          capType: 'butt'
        })
      ],
      {
        topology,
        sourcePath,
        selectedSideGuardPoints: guardPoints,
        candidateMode: 'exact-arrangement',
        exactBackend: backend
      }
    )
    const packetsMs = performance.now() - profileStart

    expect(packets.length).toBeGreaterThan(0)
    // Solid constrained geometry is represented as full-coverage source-span
    // candidates plus vertex joins. It must not be split into hundreds of
    // per-sample cells; doing so turns exact arrangement into a multi-second
    // product render path for vector-6.
    expect(packets.length).toBeLessThanOrEqual(16)
    expect(
      packets.every(
        (packet) =>
          packet.geometry.debugMeta?.resolutionStatus ===
          'exact-constrained'
      )
    ).toBe(true)

    const authoredSegmentBodyProbePoints = [
      { id: 'ts-23', x: 73.48, y: 218.9 },
      { id: 'ts-24', x: 210.79, y: 263.99 },
      { id: 'ts-25', x: 180.06, y: 79.17 },
      { id: 'ts-26', x: 132.79, y: 186.24 },
      { id: 'ts-27', x: 234.01, y: 166.2 }
    ]
    const forbiddenBridgeProbePoints = [
      { id: 'upper-left empty face', x: 120, y: 80 },
      { id: 'upper-right empty face', x: 292, y: 72 },
      { id: 'right interior empty face', x: 315, y: 150 },
      { id: 'center interior empty face', x: 168, y: 165 },
      { id: 'lower-right interior empty face', x: 244, y: 274 }
    ]
    // Self-intersection is not a product clipping boundary for solid strokes:
    // typed one-sided candidates own the side, while arrangement/collapse only
    // remove same-visual duplicate coverage. Applying fill-domain clipping here
    // deletes authored segments.
    const arrangementStart = performance.now()
    const arrangedFaces = buildArrangedStrokeFinalFacesFromResolvedPackets(
      packets,
      { backend }
    )
    const arrangementMs = performance.now() - arrangementStart
    const collapseStart = performance.now()
    const collapsedFaces = collapseStrokeFinalFaceVisualOverlaps(
      arrangedFaces,
      { backend }
    )
    expect(arrangedFaces.length).toBeLessThanOrEqual(32)
    expect(collapsedFaces.length).toBeLessThanOrEqual(32)
    const collapseMs = performance.now() - collapseStart
    if (profileVector6Solid) {
      console.info('[vector-6 outside solid profile]', {
        packets: packets.length,
        arrangedFaces: arrangedFaces.length,
        collapsedFaces: collapsedFaces.length,
        packetsMs: Number(packetsMs.toFixed(3)),
        arrangementMs: Number(arrangementMs.toFixed(3)),
        collapseMs: Number(collapseMs.toFixed(3)),
        totalMs: Number((packetsMs + arrangementMs + collapseMs).toFixed(3))
      })
    }
    const bridgeFinalFaceCoverage = forbiddenBridgeProbePoints.flatMap(
      (point) => {
        const coveringFaceIds = collapsedFaces.flatMap((face) =>
          face.polygons.some((polygon) => isPointInPolygon(point, polygon))
            ? [face.faceId]
            : []
        )

        return coveringFaceIds.length === 0
          ? []
          : [{ point: point.id, coveringFaceIds }]
      }
    )
    expect(bridgeFinalFaceCoverage).toEqual([])

    const collapsedPolygons = collapsedFaces.flatMap((face) => face.polygons)
    const missingSegmentBodyCoverage = authoredSegmentBodyProbePoints.flatMap(
      (point) =>
        polygonListContainsPoint(collapsedPolygons, point) ? [] : [point.id]
    )
    expect(missingSegmentBodyCoverage).toEqual([])

    const upperRightForbiddenRegion = {
      x: 326,
      y: 141,
      width: 12,
      height: 18
    }
    const upperRightForbiddenCoverage = polygonListRegionCoverage(
      collapsedPolygons,
      upperRightForbiddenRegion
    )
    const upperRightArrangedCoveringFaces = arrangedFaces
      .map((face) => ({
        faceId: face.faceId,
        geometryIds: face.sourceGeometryIds,
        sourceSpanIds: face.sourceSpanIds,
        coverage: polygonListRegionCoverage(
          face.polygons,
          upperRightForbiddenRegion
        )
      }))
      .filter((face) => face.coverage > 0)
    const upperRightCoveringFaces = collapsedFaces
      .map((face) => ({
        faceId: face.faceId,
        geometryIds: face.sourceGeometryIds,
        sourceSpanIds: face.sourceSpanIds,
        coverage: polygonListRegionCoverage(
          face.polygons,
          upperRightForbiddenRegion
        )
      }))
      .filter((face) => face.coverage > 0)
    expect(
      upperRightForbiddenCoverage,
      JSON.stringify(
        {
          arranged: upperRightArrangedCoveringFaces,
          collapsed: upperRightCoveringFaces
        },
        null,
        2
      )
    ).toBeLessThan(0.03)
    expect(
      polygonListRegionCoverage(collapsedPolygons, {
        x: 78,
        y: 348,
        width: 8,
        height: 8
      })
    ).toBeGreaterThan(0.22)

    // Exact self-intersecting solid packets are candidate faces. Inside/outside
    // legality is resolved after arrangement, so packet-level candidates must
    // not be filtered by sampled fill-domain guesses.
  })
})
