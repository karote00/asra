import { describe, expect, it } from 'vitest'
import {
  buildCompoundLegalDomainNormalization,
  type NormalizedLegalDomain
} from '../components/stroke-render/legal-domain-normalization'
import { buildPathTopologyModel } from '../components/stroke-render/path-topology-model'
import {
  DEFAULT_GEOMETRY_BACKEND_COORDINATE_POLICY,
  createGeometryBackendCapabilities,
  type FillRule,
  type GeometryBackend,
  type PolygonRegion
} from '../components/stroke-render/geometry-backend'

const rect = (
  pathId: string,
  networkId: string,
  x: number,
  y: number,
  width: number,
  height: number
) =>
  buildPathTopologyModel({
    pathId,
    networkId,
    sourceFamily: 'vector',
    points: [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height }
    ],
    closed: true
  })

const expectNormalized = (
  result: ReturnType<typeof buildCompoundLegalDomainNormalization>
): NormalizedLegalDomain => {
  if (result.status !== 'normalized') {
    throw new Error(`Expected normalized legal domain, got ${result.status}`)
  }
  return result.legalDomain
}

describe('legal domain normalization', () => {
  it('should run: normalize containment-only compound domains without a boolean backend', () => {
    const legalDomain = expectNormalized(
      buildCompoundLegalDomainNormalization(
        [
          rect('compound:outer', 'outer', 0, 0, 100, 100),
          rect('compound:hole', 'hole', 25, 25, 50, 50)
        ],
        {
          legalDomainId: 'compound:legal-domain:0'
        }
      )
    )

    expect(legalDomain).toMatchObject({
      legalDomainId: 'compound:legal-domain:0',
      fillRule: 'nonzero',
      mode: 'containment-depth',
      classifications: [
        expect.objectContaining({
          networkId: 'outer',
          role: 'shell',
          legalDomainId: 'compound:legal-domain:0'
        }),
        expect.objectContaining({
          networkId: 'hole',
          role: 'hole',
          legalDomainId: 'compound:legal-domain:0'
        })
      ]
    })
    expect(legalDomain.regions).toEqual([
      {
        polygons: [
          [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
            { x: 0, y: 100 }
          ]
        ]
      },
      {
        polygons: [
          [
            { x: 25, y: 75 },
            { x: 75, y: 75 },
            { x: 75, y: 25 },
            { x: 25, y: 25 }
          ]
        ]
      }
    ])
    expect(legalDomain.boundarySpans).toHaveLength(2)
    expect(legalDomain.boundarySpans.map((span) => span.role)).toEqual([
      'fill-exterior-edge',
      'fill-interior-edge'
    ])
    expect(legalDomain.boundarySpans[0]?.seamPoint).toEqual({ x: 0, y: 0 })
    expect(legalDomain.boundarySpans[1]?.seamPoint).toEqual({ x: 25, y: 25 })
    expect(legalDomain.boundarySpans[1]?.sourceContourIds).toEqual([
      'compound:hole:contour:0'
    ])
  })

  it('should not run: normalize overlapping holes without an exact backend', () => {
    const result = buildCompoundLegalDomainNormalization(
      [
        rect('compound-overlap:outer', 'outer', 0, 0, 240, 160),
        rect('compound-overlap:left-hole', 'left-hole', 45, 45, 90, 70),
        rect('compound-overlap:right-hole', 'right-hole', 95, 45, 90, 70)
      ],
      {
        legalDomainId: 'compound-overlap:legal-domain:0'
      }
    )

    expect(result).toMatchObject({
      status: 'blocked',
      reason: 'requires-exact-backend',
      classifications: [
        expect.objectContaining({ networkId: 'outer', role: 'shell' }),
        expect.objectContaining({ networkId: 'left-hole', role: 'hole' }),
        expect.objectContaining({ networkId: 'right-hole', role: 'hole' })
      ]
    })
  })

  it('should run: normalize overlapping holes through the selected exact backend contract', () => {
    const calls: string[] = []
    const normalizedRegion: PolygonRegion = {
      polygons: [
        [
          { x: 0, y: 0 },
          { x: 240, y: 0 },
          { x: 240, y: 160 },
          { x: 0, y: 160 }
        ],
        [
          { x: 45, y: 45 },
          { x: 185, y: 45 },
          { x: 185, y: 115 },
          { x: 45, y: 115 }
        ]
      ]
    }
    const backend: GeometryBackend = {
      backendId: 'mock-legal-domain',
      backendVersion: '1.0.0-test',
      capabilities: createGeometryBackendCapabilities(true),
      coordinatePolicy: DEFAULT_GEOMETRY_BACKEND_COORDINATE_POLICY,
      union: (regions: PolygonRegion[], fillRule: FillRule) => {
        calls.push(`union:${regions.length}:${fillRule}`)
        return regions
      },
      difference: (
        subject: PolygonRegion[],
        clip: PolygonRegion[],
        fillRule: FillRule
      ) => {
        calls.push(`difference:${subject.length}:${clip.length}:${fillRule}`)
        return [normalizedRegion]
      },
      intersection: () => [],
      offset: () => [],
      buildArrangement: () => []
    }

    const legalDomain = expectNormalized(
      buildCompoundLegalDomainNormalization(
        [
          rect('compound-overlap:outer', 'outer', 0, 0, 240, 160),
          rect('compound-overlap:left-hole', 'left-hole', 45, 45, 90, 70),
          rect('compound-overlap:right-hole', 'right-hole', 95, 45, 90, 70)
        ],
        {
          legalDomainId: 'compound-overlap:legal-domain:0',
          backend,
          allowBackendNormalization: true
        }
      )
    )

    expect(calls).toEqual([
      'union:1:nonzero',
      'union:2:nonzero',
      'difference:1:2:nonzero'
    ])
    expect(legalDomain).toMatchObject({
      legalDomainId: 'compound-overlap:legal-domain:0',
      mode: 'backend-boolean',
      regions: [normalizedRegion]
    })
    expect(legalDomain.boundarySpans).toHaveLength(2)
    expect(legalDomain.boundarySpans.map((span) => span.role)).toEqual([
      'fill-exterior-edge',
      'fill-interior-edge'
    ])
    expect(legalDomain.boundarySpans[0]?.sourceContourIds).toEqual([
      'compound-overlap:outer:contour:0',
      'compound-overlap:left-hole:contour:0',
      'compound-overlap:right-hole:contour:0'
    ])
    expect(legalDomain.boundarySpans[1]?.seamPoint).toEqual({ x: 45, y: 45 })
  })
})
