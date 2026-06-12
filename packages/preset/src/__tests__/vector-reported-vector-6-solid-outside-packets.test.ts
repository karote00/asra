import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import Clipper2ZFactory from 'clipper2-wasm'
import {
  VECTOR_TOKENS,
  type VectorNetwork,
  type VectorPointNode,
  type VectorSegment
} from '@asyra/core'
import {
  StrokeJoinTypes,
  StrokePositions,
  StrokeStyles,
  createDefaultStroke
} from '@asyra/utils'
import { createClipper2GeometryBackend } from '../components/stroke-render/clipper2-geometry-backend'
import type { Clipper2Module } from '../components/stroke-render/clipper2-geometry-backend'
import { buildConstrainedSolidStrokeResolvedPackets } from '../components/stroke-render/constrained-solid-stroke-packets'
import { buildVectorGeometryModelPath } from '../components/stroke-render/path-geometry'
import { buildPathTopologyModel } from '../components/stroke-render/path-topology-model'
import { buildResolvedVectorGeometryModel } from '../components/stroke-render/resolved-vector-geometry-model'

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

const createReportedVector6Fixture = () => {
  const points: Record<string, VectorPointNode> = {
    'tp-12': {
      id: 'tp-12',
      kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
      x: 192.42083700791653,
      y: 0,
      anchorType: 'sharp'
    },
    'tp-13': {
      id: 'tp-13',
      kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
      x: 11.358174406717296,
      y: 364.1297089212308,
      anchorType: 'smooth'
    },
    'tp-12:out': {
      id: 'tp-12:out',
      kind: VECTOR_TOKENS.POINT.KIND.CONTROL,
      x: 170.10536493824844,
      y: 119.07041481724248,
      controlForId: 'tp-12',
      controlRole: 'out'
    },
    'tp-13:in': {
      id: 'tp-13:in',
      kind: VECTOR_TOKENS.POINT.KIND.CONTROL,
      x: -42.09205809548172,
      y: 343.2841182453731,
      controlForId: 'tp-13',
      controlRole: 'in'
    },
    'tp-13:out': {
      id: 'tp-13:out',
      kind: VECTOR_TOKENS.POINT.KIND.CONTROL,
      x: 78.17096503446606,
      y: 390.18669726605293,
      controlForId: 'tp-13',
      controlRole: 'out'
    },
    'tp-14': {
      id: 'tp-14',
      kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
      x: 360.120941483566,
      y: 144.31562775593738,
      anchorType: 'sharp'
    },
    'tp-15': {
      id: 'tp-15',
      kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
      x: 0,
      y: 14.030686031827244,
      anchorType: 'sharp'
    },
    'tp-16': {
      id: 'tp-16',
      kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
      x: 270.59180204238254,
      y: 345.42212754546125,
      anchorType: 'smooth'
    },
    'tp-15:out': {
      id: 'tp-15:out',
      kind: VECTOR_TOKENS.POINT.KIND.CONTROL,
      x: 0,
      y: 14.030686031827244,
      controlForId: 'tp-15',
      controlRole: 'out'
    },
    'tp-16:in': {
      id: 'tp-16:in',
      kind: VECTOR_TOKENS.POINT.KIND.CONTROL,
      x: 263.9105229796076,
      y: 362.79345310867603,
      controlForId: 'tp-16',
      controlRole: 'in'
    },
    'tp-16:out': {
      id: 'tp-16:out',
      kind: VECTOR_TOKENS.POINT.KIND.CONTROL,
      x: 277.2730811051575,
      y: 328.05080198224647,
      controlForId: 'tp-16',
      controlRole: 'out'
    }
  }
  const segments: Record<string, VectorSegment> = {
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
  }
  const network: VectorNetwork = {
    id: 'tn-4',
    pointIds: ['tp-12', 'tp-13', 'tp-14', 'tp-15', 'tp-16'],
    segmentIds: ['ts-23', 'ts-24', 'ts-25', 'ts-26', 'ts-27'],
    closed: true
  }

  return { network, points, segments }
}

describe('reported vector-6 outside solid packet contract', () => {
  it('should run: emit bounded outside solidMaskModel packets through bounded boundary-domain', async () => {
    const { network, points, segments } = createReportedVector6Fixture()
    const sourcePath = buildVectorGeometryModelPath(network, points, segments)
    const topology = buildPathTopologyModel({
      pathId: 'reported-vector-6-outside-solid',
      sourceId: 'reported-vector-6',
      networkId: network.id,
      sourceRevision: 'source-revision:reported-vector-6',
      sourceFamily: 'vector',
      points: sourcePath.sampledPoints,
      closed: sourcePath.closed
    })
    const resolvedGeometry = buildResolvedVectorGeometryModel({
      modelId: 'reported-vector-6-outside-solid:resolved',
      fillRule: topology.fillRule,
      networks: [
        {
          networkId: network.id,
          path: sourcePath,
          topology
        }
      ]
    })
    const selfIntersecting = resolvedGeometry.networks[0]?.selfIntersecting
    const backend = createClipper2GeometryBackend(await loadClipperModule())
    const startedAt = performance.now()

    const packets = buildConstrainedSolidStrokeResolvedPackets(
      'reported-vector-6-outside-solid:packet',
      topology.normalizedPoints,
      true,
      [
        createDefaultStroke({
          width: 10,
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          color: '#df0606',
          opacity: 0.5,
          joinType: StrokeJoinTypes.MITER,
          miterAngle: 28.96
        })
      ],
      {
        topology,
        sourcePath,
        implicitFillRegions: selfIntersecting?.fillRegions ?? [],
        implicitLegalFaceBoundaries:
          selfIntersecting?.legalFaceBoundaries ?? [],
        implicitUnfilledFaceBoundaries:
          selfIntersecting?.unfilledFaceBoundaries ?? [],
        sharedSourceSplitRanges: selfIntersecting?.sourceSplitRanges ?? [],
        sharedStrokeBoundaryDomains:
          selfIntersecting?.strokeBoundaryDomains ?? [],
        exactBackend: backend,
        fillRule: topology.fillRule,
        candidateMode: 'exact-arrangement'
      }
    )
    const elapsedMs = performance.now() - startedAt
    const polygonCount = packets.reduce(
      (sum, packet) => sum + packet.geometry.polygons.length,
      0
    )
    const pointCount = packets.reduce(
      (sum, packet) =>
        sum +
        packet.geometry.polygons.reduce(
          (polygonSum, polygon) => polygonSum + polygon.length,
          0
        ),
      0
    )
    const sourceSpanIds = packets.flatMap(
      (packet) => packet.geometry.debugMeta?.sourceSpanIds ?? []
    )

    expect(elapsedMs).toBeLessThan(250)
    expect(packets.length).toBeGreaterThan(0)
    expect(polygonCount).toBeLessThanOrEqual(120)
    expect(pointCount).toBeLessThanOrEqual(4_500)
    expect(sourceSpanIds).toContain('smooth-join:3')
    expect(sourceSpanIds).not.toContain('vertex:3')
    expect(
      sourceSpanIds.some((sourceSpanId) =>
        sourceSpanId.startsWith('segment-run:')
      )
    ).toBe(false)
    expect(
      packets.every((packet) =>
        expect
          .objectContaining({
            geometryFamily: 'constrained-solid',
            resolutionStatus: 'exact-constrained',
            runtimeStatus: 'accepted',
            runtimeReason: 'constrained-solid-exact',
            sourceTopology: 'self-intersecting',
            strokePosition: 'outside',
            solidMaskModelVisibleRender: 'masked-source-stroke',
            solidMaskModelMaskSide: 'outside-exterior'
          })
          .asymmetricMatch(packet.geometry.debugMeta)
      )
    ).toBe(true)
    expect(
      packets.every(
        (packet) =>
          !packet.geometry.geometryId.includes(':boundary-domain:') &&
          packet.geometry.debugMeta?.domainPlanTerminalRole === undefined &&
          packet.geometry.debugMeta?.domainPlanSplitRangeTerminals === undefined
      )
    ).toBe(true)
  })
})
