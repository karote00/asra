import { describe, expect, it } from 'vitest'
import {
  allocateDashedCenterStrokeIntervals,
  allocateStrokeIntervalsForDomainPlan
} from '../components/stroke-render/dashed-center-stroke-intervals'
import { getConstrainedDashedVisibleIntervals } from '../components/stroke-render/constrained-dashed-stroke-packets'
import type { NormalizedLegalDomain } from '../components/stroke-render/legal-domain-normalization'
import { buildPolylineGeometryModelPath } from '../components/stroke-render/path-geometry'
import {
  buildSourceSpanGraph,
  getSourceSpanIdsForDomainInterval,
  getSourceSpanIdsForInterval,
  resolveSourceSpanProvenanceAvailability
} from '../components/stroke-render/source-span-graph'
import { buildPathTopologyModel } from '../components/stroke-render/path-topology-model'
import { normalizeStrokeSpec } from '../components/stroke-render/renderable-stroke'
import { resolveSourceFamily } from '../components/stroke-render/resolved-source-family'
import { buildResolvedVectorGeometryModel } from '../components/stroke-render/resolved-vector-geometry-model'
import { resolveStrokeDomains } from '../components/stroke-render/stroke-domain-plan'
import {
  StrokePositions,
  StrokeStyles,
  createDefaultStroke
} from '@asyra/utils'

const withCompoundLegalDomains = (
  source: ReturnType<typeof buildPathTopologyModel>
) => ({
  ...source,
  contours: [
    ...source.contours,
    {
      ...source.contours[0],
      contourId: `${source.pathId}:contour:hole`,
      role: 'hole' as const,
      nestingDepth: 1
    }
  ],
  legalDomainDescriptors: [
    ...source.legalDomainDescriptors,
    {
      legalDomainId: `${source.pathId}:legal-domain:compound`,
      role: 'hole' as const,
      fillRule: source.fillRule,
      fillRuleBasis: source.fillRuleBasis,
      contourIds: [`${source.pathId}:contour:hole`]
    }
  ]
})

const compoundLegalDomain = (
  source: ReturnType<typeof buildPathTopologyModel>
): Pick<NormalizedLegalDomain, 'legalDomainId' | 'boundarySpans'> => ({
  legalDomainId: `${source.pathId}:normalized-legal-domain:0`,
  boundarySpans: [
    {
      boundarySpanId: `${source.pathId}:boundary-span:shell`,
      role: 'fill-exterior-edge',
      geometry: source.normalizedPoints,
      sourceContourIds: [`${source.pathId}:contour:0`],
      sourceSpanIds: [`${source.pathId}:span:shell:0`],
      seamPoint: source.normalizedPoints[0] ?? null
    },
    {
      boundarySpanId: `${source.pathId}:boundary-span:hole`,
      role: 'fill-interior-edge',
      geometry: [
        { x: 25, y: 25 },
        { x: 75, y: 25 },
        { x: 75, y: 75 },
        { x: 25, y: 75 }
      ],
      sourceContourIds: [`${source.pathId}:contour:hole`],
      sourceSpanIds: [`${source.pathId}:span:hole:0`],
      seamPoint: { x: 25, y: 25 }
    }
  ]
})

describe('source span graph', () => {
  it('should run: make source-span provenance availability explicit for render packet modes', () => {
    expect(resolveSourceSpanProvenanceAvailability()).toEqual({
      available: true,
      reason: 'available'
    })
    expect(
      resolveSourceSpanProvenanceAvailability({ visualOnly: true })
    ).toEqual({
      available: false,
      reason: 'visual-only'
    })
    expect(
      resolveSourceSpanProvenanceAvailability({
        omitDiagnosticMetadata: true
      })
    ).toEqual({
      available: false,
      reason: 'diagnostic-metadata-omitted'
    })
    expect(
      resolveSourceSpanProvenanceAvailability({
        visualOnly: true,
        omitDiagnosticMetadata: true
      })
    ).toEqual({
      available: false,
      reason: 'visual-only'
    })
  })

  it('should run: split source spans at vertices and dash interval boundaries', () => {
    const topology = buildPathTopologyModel({
      pathId: 'span:rect',
      points: [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      closed: true
    })
    const intervals = allocateDashedCenterStrokeIntervals(
      topology.totalLength,
      [30, 10],
      0,
      topology.closed
    ).filter((interval) => interval.kind === 'visible')
    const graph = buildSourceSpanGraph(topology, intervals)

    expect(graph.cuts.map((cut) => cut.kind)).toContain('dash-boundary')
    expect(graph.cuts.map((cut) => cut.kind)).toContain('vertex')
    const firstInterval = intervals[0]
    const secondInterval = intervals[1]
    expect(firstInterval).toBeDefined()
    expect(secondInterval).toBeDefined()
    if (!firstInterval || !secondInterval) {
      throw new Error(
        'Expected two visible intervals for source span graph test'
      )
    }

    expect(getSourceSpanIdsForInterval(graph, firstInterval)).toEqual([
      'span:rect:contour:0:source-span:0'
    ])
    expect(getSourceSpanIdsForInterval(graph, secondInterval)).toEqual([
      'span:rect:contour:0:source-span:2'
    ])
  })

  it('should run: split a self-intersecting interval at the crossing before face ownership', () => {
    const topology = buildPathTopologyModel({
      pathId: 'span:self-crossing',
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
        { x: 100, y: 0 }
      ],
      closed: true
    })
    const [firstInterval] = allocateDashedCenterStrokeIntervals(
      topology.totalLength,
      [200, 20],
      0,
      topology.closed
    ).filter((interval) => interval.kind === 'visible')
    const graph = buildSourceSpanGraph(
      topology,
      firstInterval ? [firstInterval] : []
    )

    expect(graph.cuts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'self-intersection' })
      ])
    )
    const selfIntersectionCuts = graph.cuts.filter(
      (cut) => cut.kind === 'self-intersection'
    )
    expect(selfIntersectionCuts).toHaveLength(2)
    expect(
      new Set(selfIntersectionCuts.map((cut) => cut.crossingId)).size
    ).toBe(1)
    expect(selfIntersectionCuts[0]?.distance).toBeCloseTo(70.710678, 5)
    expect(selfIntersectionCuts[1]?.distance).toBeCloseTo(312.132034, 5)
    const sourceSpanIds = firstInterval
      ? getSourceSpanIdsForInterval(graph, firstInterval)
      : []
    expect(sourceSpanIds).toEqual(
      expect.arrayContaining([
        'span:self-crossing:contour:0:source-span:0',
        'span:self-crossing:contour:0:source-span:1',
        'span:self-crossing:contour:0:source-span:2'
      ])
    )
    expect(sourceSpanIds.length).toBeGreaterThanOrEqual(3)
  })

  it('should run: preserve source-span provenance for StrokeDomainPlan split-range intervals', () => {
    const sourcePath = buildPolylineGeometryModelPath(
      [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
        { x: 100, y: 0 }
      ],
      true
    )
    const topology = buildPathTopologyModel({
      pathId: 'span:stroke-domain-plan',
      points: sourcePath.sampledPoints,
      closed: true
    })
    const stroke = normalizeStrokeSpec([
      createDefaultStroke({
        width: 10,
        style: StrokeStyles.DASHED,
        position: StrokePositions.INSIDE,
        dashPattern: [20, 10]
      })
    ]).strokes[0]
    const resolvedGeometry = buildResolvedVectorGeometryModel({
      modelId: 'span:stroke-domain-plan:resolved-geometry',
      fillRule: topology.fillRule,
      networks: [
        {
          networkId: topology.networkId,
          path: sourcePath,
          topology
        }
      ]
    })
    const sharedSourceSplitRanges =
      resolvedGeometry.networks[0]?.selfIntersecting?.sourceSplitRanges ?? []
    const domainPlan = resolveStrokeDomains({
      topology,
      sourceFamily: resolveSourceFamily({ topology, stroke }),
      stroke,
      sourcePath,
      sharedSourceSplitRanges
    })
    const intervals = getConstrainedDashedVisibleIntervals(
      topology,
      stroke,
      sourcePath,
      domainPlan
    )
    const graph = buildSourceSpanGraph(topology, intervals)
    const graphCutDistances = new Set(
      graph.cuts.map((cut) => cut.distance.toFixed(6))
    )

    expect(domainPlan.intervalDomainKind).toBe('domain-plan-split-range')
    expect(domainPlan.splitRangeDomains.length).toBeGreaterThan(
      sourcePath.segments.length
    )
    domainPlan.splitRangeDomains.forEach((domain) => {
      expect(graphCutDistances.has(domain.startDistance.toFixed(6))).toBe(true)
      expect(graphCutDistances.has(domain.endDistance.toFixed(6))).toBe(true)
    })
    intervals.forEach((interval) => {
      const sourceSpanIds = getSourceSpanIdsForInterval(graph, interval)
      expect(sourceSpanIds.length).toBeGreaterThan(0)
      expect(
        sourceSpanIds.every(
          (sourceSpanId) =>
            sourceSpanId.startsWith(
              'span:stroke-domain-plan:contour:0:source-span:'
            ) &&
            !sourceSpanId.includes('legal-domain') &&
            !sourceSpanId.includes('hole')
        )
      ).toBe(true)
    })
  })

  it('should run: resolve Step15 legal-boundary intervals to typed shell and hole source-span provenance', () => {
    const topology = withCompoundLegalDomains(
      buildPathTopologyModel({
        pathId: 'span:compound-domain-plan',
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 }
        ],
        closed: true
      })
    )
    const stroke = normalizeStrokeSpec([
      createDefaultStroke({
        width: 10,
        style: StrokeStyles.DASHED,
        position: StrokePositions.INSIDE,
        dashPattern: [20, 10]
      })
    ]).strokes[0]
    const domainPlan = resolveStrokeDomains({
      topology,
      sourceFamily: resolveSourceFamily({ topology, stroke }),
      stroke,
      sourcePath: buildPolylineGeometryModelPath(
        topology.normalizedPoints,
        true
      ),
      normalizedLegalDomain: compoundLegalDomain(topology)
    })
    const allocations = allocateStrokeIntervalsForDomainPlan({
      domainPlan,
      dashPattern: stroke.dashPattern,
      dashOffset: stroke.dashOffset
    })
    const graph = buildSourceSpanGraph(topology)

    expect(domainPlan.intervalDomainKind).toBe('legal-boundary-span')
    expect(allocations).toHaveLength(2)
    allocations.forEach((allocation) => {
      const visibleInterval = allocation.intervals.find(
        (interval) => interval.kind === 'visible'
      )
      expect(visibleInterval).toBeDefined()
      if (!visibleInterval) {
        throw new Error('Expected visible legal-boundary interval')
      }

      const sourceSpanIds = getSourceSpanIdsForDomainInterval({
        graph,
        domainPlan,
        allocationDomainId: allocation.domainId,
        interval: visibleInterval
      })
      expect(sourceSpanIds).toEqual(
        allocation.domainId.includes('boundary-domain:0')
          ? [`${topology.pathId}:span:shell:0`]
          : [`${topology.pathId}:span:hole:0`]
      )
    })
  })
})
