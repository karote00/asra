import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'
import { buildPathTopologyModel } from '../components/stroke-render/path-topology-model'
import { buildPolylineGeometryModelPath } from '../components/stroke-render/path-geometry'
import { buildResolvedVectorGeometryModel } from '../components/stroke-render/resolved-vector-geometry-model'

const vectorComponentSource = () =>
  readFileSync('src/components/vector.ts', 'utf8')

const constrainedDashedPacketSource = () =>
  readFileSync(
    'src/components/stroke-render/constrained-dashed-stroke-packets.ts',
    'utf8'
  )

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
      fillRule: 'evenodd'
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

  it('should run: keep vector fill and stroke consumers wired to the same resolved geometry map', () => {
    const source = vectorComponentSource()

    expect(source.match(/buildResolvedVectorGeometryModel\(/g)).toHaveLength(1)
    expect(source).toContain('const resolvedGeometryByNetworkId = new Map<')
    expect(source).toContain(
      'resolvedGeometryByNetworkId.get(network.id)?.selfIntersecting'
    )
    expect(source).toContain('?.fillRegions ?? []')
    expect(source).toContain('?.legalBoundaryContours')
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
