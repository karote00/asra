import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { assertStrokeParameterCoverageForStep } from './stroke-parameter-coverage-test-helper'
import {
  allocateDashedCenterStrokeIntervals,
  allocateStrokeIntervalsForDomainPlan
} from '../../components/stroke-render/dashed-center-stroke-intervals'
import { allocateDashedIntervalsForTopology } from '../../components/stroke-render/path-topology-model'

type RefactorStatus = 'locked' | 'active' | 'verified'

interface InspectorStep {
  id: string
  refactorStatus: RefactorStatus
  implementationFiles: string[]
  allowedInputs: string[]
  requiredOutputs: string[]
  ownerStage: string
  forbiddenContributors: string[]
  computationContract?: {
    computedAt: string
    consumesArtifacts: string[]
    producesArtifacts: string[]
    consumedBy: string[]
    mustNotRecomputeAfter: string
    forbiddenLateComputation: string[]
  }
}

interface InspectorData {
  steps: InspectorStep[]
  inspectorContractErrors: string[]
}

const repoRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../'
)
const require = createRequire(import.meta.url)
const inspectorPath = resolve(
  repoRoot,
  'docs/ai/apps/asyra-design/plans/stroke-engine-final/stroke-flow-inspector.data.js'
)
const dashIntervalsSourcePath = resolve(
  repoRoot,
  'packages/preset/src/components/stroke-render/dashed-center-stroke-intervals.ts'
)
const pathTopologySourcePath = resolve(
  repoRoot,
  'packages/preset/src/components/stroke-render/path-topology-model.ts'
)

let cachedInspectorData: InspectorData | null = null

const loadInspectorData = (): InspectorData => {
  if (cachedInspectorData) {
    return cachedInspectorData
  }
  const windowRecord: { STROKE_FLOW_INSPECTOR_DATA?: InspectorData } = {}
  ;(globalThis as typeof globalThis & { window?: unknown }).window =
    windowRecord
  Reflect.deleteProperty(require.cache, require.resolve(inspectorPath))
  require(inspectorPath)
  const data = windowRecord.STROKE_FLOW_INSPECTOR_DATA
  expect(data).toBeDefined()
  cachedInspectorData = data as InspectorData
  return cachedInspectorData
}

const expectNoVisibleStrokeProductFields = (record: unknown) => {
  const text = JSON.stringify(record, (_key, value) => {
    if (typeof value === 'function') {
      return '[function]'
    }
    return value
  })
  for (const forbiddenField of [
    'strokeMaskPolygons',
    'descriptorProductPolygons',
    'strokePathStyle',
    'renderEntries',
    'finalFaces',
    'resolvedJoin',
    'vertexAngle',
    'angleSource',
    'miterAngle',
    'capGeometry',
    'sourceVertexJoinFootprint'
  ]) {
    expect(text).not.toContain(forbiddenField)
  }
}

describe('stroke flow step 23: allocate-dash-intervals', () => {
  it('keeps allocate-dash-intervals as the current or verified twenty-third step', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'allocate-dash-intervals'
    )
    const activeSteps = data.steps.filter(
      (entry) => entry.refactorStatus === 'active'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(step?.refactorStatus).toMatch(/^(active|verified)$/)
    if (step?.refactorStatus === 'active') {
      expect(activeSteps.map((entry) => entry.id)).toEqual([
        'allocate-dash-intervals'
      ])
    }
  })

  it('declares the exact dash interval allocation implementation surface', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'allocate-dash-intervals'
    )

    expect(step).toMatchObject({
      ownerStage: 'Stroke Geometry',
      allowedInputs: [
        'StrokeDomainPlan interval authority',
        'domain length and closed flag',
        'dash length and gap length',
        'independent dash span flag and allocation origin',
        'dash cap footprint inputs',
        'optional domain split-range references'
      ],
      requiredOutputs: [
        'DashedCenterStrokeIntervalRecord records',
        'StrokeIntervalAllocation records grouped by domain id',
        'visible/gap interval links',
        'terminal role metadata for open paths and domain-plan split ranges'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/dashed-center-stroke-intervals.ts',
        'packages/preset/src/components/stroke-render/path-topology-model.ts'
      ]
    })
    expect(step?.forbiddenContributors).toEqual(
      expect.arrayContaining([
        'visible stroke product output',
        'source-vertex join footprint geometry',
        'endpoint cap geometry',
        'miter-resolution metadata',
        'final faces',
        'render entries',
        'renderer projection output'
      ])
    )
  })

  it('declares Step 23 as the only owner of dash endpoint classification and interval redistribution', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'allocate-dash-intervals'
    )

    expect(step?.computationContract).toMatchObject({
      computedAt: 'allocate-dash-intervals',
      consumesArtifacts: [
        'artifact:stroke-domain-plan',
        'artifact:normalized-stroke-spec'
      ],
      producesArtifacts: ['artifact:dash-product-interval'],
      consumedBy: [
        'select-stroke-product-family',
        'build-dash-interval-body-products',
        'build-source-vertex-join-products',
        'build-terminal-body-products',
        'runtime-diagnostics'
      ],
      mustNotRecomputeAfter: 'build-dash-interval-body-products'
    })
    expect(step?.computationContract?.forbiddenLateComputation).toEqual(
      expect.arrayContaining([
        'independent source-span endpoint half-dash classification',
        'dash interval endpoint relocation',
        'terminal role reinterpretation',
        'interior dash/gap redistribution',
        'configured gap floor recalculation',
        'legal-clip boundary endpoint synthesis'
      ])
    )
  })

  it('allocates open center dash intervals with terminal roles but no cap geometry', () => {
    const intervals = allocateDashedCenterStrokeIntervals(
      100,
      { dash: 20, gap: 10 },
      false,
      {
        openPathPolicy: 'network-balanced-terminals',
        strokeWidth: 10,
        cap: 'round'
      }
    )
    const visibleIntervals = intervals.filter(
      (interval) => interval.kind === 'visible'
    )

    expect(visibleIntervals[0]).toMatchObject({
      startDistance: 0,
      endDistance: 10,
      intervalLength: 10,
      openPathTerminalRole: 'path-start',
      previousVisibleIntervalId: null
    })
    expect(visibleIntervals[visibleIntervals.length - 1]).toMatchObject({
      startDistance: 90,
      endDistance: 100,
      intervalLength: 10,
      openPathTerminalRole: 'path-end',
      nextVisibleIntervalId: null
    })
    expect(
      visibleIntervals
        .slice(1, -1)
        .every((interval) => interval.openPathTerminalRole === 'middle')
    ).toBe(true)
    expectNoVisibleStrokeProductFields(intervals)
  })

  it('uses dash length, gap length, width, and cap only for interval allocation decisions', () => {
    const baselineDashAndGapIntervals = allocateDashedCenterStrokeIntervals(
      100,
      { dash: 20, gap: 10 },
      true
    )
    const shorterDashAndGapIntervals = allocateDashedCenterStrokeIntervals(
      100,
      { dash: 10, gap: 10 },
      true
    )

    expect(
      baselineDashAndGapIntervals.filter(
        (interval) => interval.kind === 'visible'
      ).length
    ).not.toBe(
      shorterDashAndGapIntervals.filter(
        (interval) => interval.kind === 'visible'
      ).length
    )

    const buttTerminals = allocateDashedCenterStrokeIntervals(
      45,
      { dash: 20, gap: 10 },
      false,
      {
        openPathPolicy: 'network-balanced-terminals',
        strokeWidth: 20,
        cap: 'butt'
      }
    )
    const roundTerminals = allocateDashedCenterStrokeIntervals(
      45,
      { dash: 20, gap: 10 },
      false,
      {
        openPathPolicy: 'network-balanced-terminals',
        strokeWidth: 20,
        cap: 'round'
      }
    )

    expect(
      roundTerminals.map(({ kind, startDistance, endDistance }) => ({
        kind,
        startDistance,
        endDistance
      }))
    ).not.toEqual(
      buttTerminals.map(({ kind, startDistance, endDistance }) => ({
        kind,
        startDistance,
        endDistance
      }))
    )
    expectNoVisibleStrokeProductFields({
      baselineDashAndGapIntervals,
      shorterDashAndGapIntervals,
      buttTerminals,
      roundTerminals
    })
  })

  it('allocates domain-plan split range intervals with provenance and terminal roles', () => {
    const allocations = allocateStrokeIntervalsForDomainPlan({
      domainPlan: {
        planId: 'plan:split',
        intervalDomainKind: 'domain-plan-split-range',
        totalLength: 80,
        closed: false,
        legalBoundaryDomains: [],
        splitRangeDomains: [
          {
            domainId: 'split:inside-excluded',
            domainMode: 'inside-excluded-open-span',
            startDistance: 0,
            endDistance: 40,
            sourceSegmentIndex: 0
          },
          {
            domainId: 'split:visible',
            boundaryDomainId: 'boundary:visible',
            boundaryPoints: [
              { x: 0, y: 0 },
              { x: 80, y: 0 }
            ],
            boundaryStartDistance: 0,
            boundaryEndDistance: 80,
            boundaryTotalLength: 80,
            startDistance: 0,
            endDistance: 80,
            allocationAliasIds: ['alias:split'],
            sourceStartDistance: 10,
            sourceEndDistance: 90,
            sourceSegmentIndex: 2,
            sideAuthority: 'implicit-fill-hole-domain',
            selectedSide: 1,
            filledSide: 1,
            unfilledSide: -1,
            boundaryRole: 'outer',
            domainMode: 'closed-constrained-domain',
            sideResolutionStatus: 'resolved'
          }
        ]
      },
      dash: 20,
      gap: 10,
      visualGap: { capExtension: 5 }
    })

    expect(allocations[0]).toEqual({
      domainId: 'split:inside-excluded',
      intervals: []
    })
    const visibleAllocation = allocations[1]
    const visibleIntervals = visibleAllocation.intervals.filter(
      (interval) => interval.kind === 'visible'
    )
    expect(visibleAllocation.domainId).toBe('split:visible')
    expect(
      visibleIntervals.map((interval) => interval.domainPlanTerminalRole)
    ).toEqual(expect.arrayContaining(['start', 'middle', 'end']))
    expect(visibleIntervals[0]).toMatchObject({
      domainPlanBoundaryDomainId: 'boundary:visible',
      domainPlanSplitRangeId: 'split:visible',
      domainPlanSplitRangeAliasIds: ['alias:split'],
      domainPlanSplitRangeSourceSegmentIndex: 2,
      domainPlanSideAuthority: 'implicit-fill-hole-domain',
      domainPlanSelectedSide: 1,
      domainPlanFilledSide: 1,
      domainPlanUnfilledSide: -1,
      domainPlanBoundaryRole: 'outer',
      domainPlanDomainMode: 'closed-constrained-domain',
      domainPlanSideResolutionStatus: 'resolved'
    })
    expectNoVisibleStrokeProductFields(allocations)
  })

  it('allocates independent split ranges with half-terminal dashes and evenly distributed interior gaps', () => {
    const allocations = allocateStrokeIntervalsForDomainPlan({
      domainPlan: {
        planId: 'plan:independent-split',
        intervalDomainKind: 'domain-plan-split-range',
        totalLength: 94,
        closed: true,
        legalBoundaryDomains: [],
        splitRangeDomains: [
          {
            domainId: 'split:independent',
            startDistance: 10,
            endDistance: 104,
            sourceStartDistance: 10,
            sourceEndDistance: 104,
            sourceSegmentIndex: 4,
            domainMode: 'closed-constrained-domain'
          }
        ]
      },
      dash: 20,
      gap: 10,
      visualGap: { capExtension: 0 }
    })
    const [allocation] = allocations
    const intervals = allocation?.intervals ?? []
    const visibleIntervals = intervals.filter(
      (interval) => interval.kind === 'visible'
    )
    const gapIntervals = intervals.filter((interval) => interval.kind === 'gap')

    expect(
      visibleIntervals.map(
        ({ startDistance, endDistance, intervalLength }) => ({
          startDistance,
          endDistance,
          intervalLength
        })
      )
    ).toEqual([
      { startDistance: 10, endDistance: 20, intervalLength: 10 },
      {
        startDistance: 31.333333333333336,
        endDistance: 51.333333333333336,
        intervalLength: 20
      },
      {
        startDistance: 62.66666666666667,
        endDistance: 82.66666666666667,
        intervalLength: 20
      },
      { startDistance: 94, endDistance: 104, intervalLength: 10 }
    ])
    expect(
      visibleIntervals.map((interval) => interval.domainPlanTerminalRole)
    ).toEqual(['start', 'middle', 'middle', 'end'])
    expect(gapIntervals.map((interval) => interval.intervalLength)).toEqual([
      11.333333333333336, 11.333333333333336, 11.333333333333329
    ])
    gapIntervals.forEach((interval) => {
      expect(interval.intervalLength).toBeGreaterThanOrEqual(10 * 0.6)
    })
    expectNoVisibleStrokeProductFields(allocations)
  })

  it('allocates every independent source segment with half-terminal dashes at both segment endpoints', () => {
    const allocations = allocateStrokeIntervalsForDomainPlan({
      domainPlan: {
        planId: 'plan:independent-segments',
        intervalDomainKind: 'domain-plan-split-range',
        totalLength: 188,
        closed: true,
        legalBoundaryDomains: [],
        splitRangeDomains: [
          {
            domainId: 'segment:0',
            startDistance: 0,
            endDistance: 94,
            sourceStartDistance: 0,
            sourceEndDistance: 94,
            sourceSegmentIndex: 0,
            domainMode: 'closed-constrained-domain'
          },
          {
            domainId: 'segment:1',
            startDistance: 94,
            endDistance: 188,
            sourceStartDistance: 94,
            sourceEndDistance: 188,
            sourceSegmentIndex: 1,
            domainMode: 'closed-constrained-domain'
          }
        ]
      },
      dash: 20,
      gap: 10,
      visualGap: { capExtension: 0 }
    })

    expect(allocations.map((allocation) => allocation.domainId)).toEqual([
      'segment:0',
      'segment:1'
    ])

    allocations.forEach((allocation, segmentIndex) => {
      const rangeStart = segmentIndex * 94
      const rangeEnd = rangeStart + 94
      const visibleIntervals = allocation.intervals.filter(
        (interval) => interval.kind === 'visible'
      )
      const gapIntervals = allocation.intervals.filter(
        (interval) => interval.kind === 'gap'
      )

      expect(
        visibleIntervals.map((interval) => ({
          startDistance: interval.startDistance,
          endDistance: interval.endDistance,
          intervalLength: interval.intervalLength,
          terminalRole: interval.domainPlanTerminalRole,
          sourceSegmentIndex: interval.domainPlanSplitRangeSourceSegmentIndex
        }))
      ).toEqual([
        {
          startDistance: rangeStart,
          endDistance: rangeStart + 10,
          intervalLength: 10,
          terminalRole: 'start',
          sourceSegmentIndex: segmentIndex
        },
        {
          startDistance: rangeStart + 21.333333333333336,
          endDistance: rangeStart + 41.333333333333336,
          intervalLength: 20,
          terminalRole: 'middle',
          sourceSegmentIndex: segmentIndex
        },
        {
          startDistance: rangeStart + 52.66666666666667,
          endDistance: rangeStart + 72.66666666666667,
          intervalLength: 20,
          terminalRole: 'middle',
          sourceSegmentIndex: segmentIndex
        },
        {
          startDistance: rangeEnd - 10,
          endDistance: rangeEnd,
          intervalLength: 10,
          terminalRole: 'end',
          sourceSegmentIndex: segmentIndex
        }
      ])
      gapIntervals.forEach((interval) => {
        expect(interval.intervalLength).toBeGreaterThanOrEqual(10 * 0.6)
      })
    })
    expectNoVisibleStrokeProductFields(allocations)
  })

  it('reduces independent split range dash count before violating the configured gap floor', () => {
    const allocations = allocateStrokeIntervalsForDomainPlan({
      domainPlan: {
        planId: 'plan:gap-floor',
        intervalDomainKind: 'domain-plan-split-range',
        totalLength: 74,
        closed: true,
        legalBoundaryDomains: [],
        splitRangeDomains: [
          {
            domainId: 'split:gap-floor',
            startDistance: 0,
            endDistance: 74,
            sourceStartDistance: 0,
            sourceEndDistance: 74,
            sourceSegmentIndex: 1,
            domainMode: 'closed-constrained-domain'
          }
        ]
      },
      dash: 20,
      gap: 20,
      visualGap: { capExtension: 0 }
    })
    const [allocation] = allocations
    const intervals = allocation?.intervals ?? []
    const visibleIntervals = intervals.filter(
      (interval) => interval.kind === 'visible'
    )
    const gapIntervals = intervals.filter((interval) => interval.kind === 'gap')

    expect(
      visibleIntervals.map((interval) => interval.domainPlanTerminalRole)
    ).toEqual(['start', 'middle', 'end'])
    expect(visibleIntervals.map((interval) => interval.intervalLength)).toEqual(
      [10, 20, 10]
    )
    expect(gapIntervals.map((interval) => interval.intervalLength)).toEqual([
      17, 17
    ])
    gapIntervals.forEach((interval) => {
      expect(interval.intervalLength).toBeGreaterThanOrEqual(20 * 0.6)
    })
    expectNoVisibleStrokeProductFields(allocations)
  })

  it('collapses independent split ranges instead of emitting a sub-floor interior gap', () => {
    const allocations = allocateStrokeIntervalsForDomainPlan({
      domainPlan: {
        planId: 'plan:gap-collapse',
        intervalDomainKind: 'domain-plan-split-range',
        totalLength: 31,
        closed: true,
        legalBoundaryDomains: [],
        splitRangeDomains: [
          {
            domainId: 'split:gap-collapse',
            startDistance: 0,
            endDistance: 31,
            sourceStartDistance: 0,
            sourceEndDistance: 31,
            sourceSegmentIndex: 1,
            domainMode: 'closed-constrained-domain'
          }
        ]
      },
      dash: 20,
      gap: 20,
      visualGap: { capExtension: 0 }
    })
    const [allocation] = allocations
    const intervals = allocation?.intervals ?? []

    expect(intervals).toHaveLength(1)
    expect(intervals[0]).toMatchObject({
      kind: 'visible',
      startDistance: 0,
      endDistance: 31,
      intervalLength: 31,
      domainPlanTerminalRole: 'start-end',
      domainPlanSplitRangeId: 'split:gap-collapse',
      domainPlanSplitRangeStartDistance: 0,
      domainPlanSplitRangeEndDistance: 31,
      domainPlanSplitRangeSourceStartDistance: 0,
      domainPlanSplitRangeSourceEndDistance: 31,
      domainPlanSplitRangeSourceSegmentIndex: 1,
      domainPlanDomainMode: 'closed-constrained-domain'
    })
    expectNoVisibleStrokeProductFields(allocations)
  })

  it('routes none, legal-boundary, and topology interval authorities without product output', () => {
    expect(
      allocateStrokeIntervalsForDomainPlan({
        domainPlan: {
          planId: 'plan:none',
          intervalDomainKind: 'none',
          totalLength: 100,
          closed: false,
          splitRangeDomains: [],
          legalBoundaryDomains: []
        },
        dash: 20,
        gap: 10
      })
    ).toEqual([])

    const legalBoundaryAllocations = allocateStrokeIntervalsForDomainPlan({
      domainPlan: {
        planId: 'plan:legal-boundary',
        intervalDomainKind: 'legal-boundary-span',
        totalLength: 100,
        closed: true,
        splitRangeDomains: [],
        legalBoundaryDomains: [
          { domainId: 'boundary:shell', totalLength: 60, closed: true },
          { domainId: 'boundary:hole', totalLength: 40, closed: true }
        ]
      },
      dash: 20,
      gap: 10
    })
    const topologyIntervals = allocateDashedIntervalsForTopology(
      { totalLength: 100, closed: true },
      { dash: 20, gap: 10 }
    )

    expect(legalBoundaryAllocations.map((entry) => entry.domainId)).toEqual([
      'boundary:shell',
      'boundary:hole'
    ])
    expect(
      legalBoundaryAllocations.every((entry) =>
        entry.intervals.every((interval) =>
          interval.intervalId.startsWith(`${entry.domainId}:`)
        )
      )
    ).toBe(true)
    expect(topologyIntervals.length).toBeGreaterThan(0)
    expectNoVisibleStrokeProductFields({
      legalBoundaryAllocations,
      topologyIntervals
    })
  })

  it('keeps dash interval code free of product, join, miter, and renderer ownership', () => {
    const dashSource = readFileSync(dashIntervalsSourcePath, 'utf8')
    const topologySource = readFileSync(pathTopologySourcePath, 'utf8')
    const topologyForwarderStart = topologySource.indexOf(
      'export const allocateDashedIntervalsForTopology'
    )
    const topologyForwarder = topologySource.slice(topologyForwarderStart)

    expect(topologyForwarder).toContain('allocateDashedCenterStrokeIntervals(')
    for (const forbiddenToken of [
      'buildSourceVertexJoinFootprint',
      'strokeMaskPolygons',
      'descriptorProductPolygons',
      'renderSolidCenterStrokeEntries',
      'strokePathStyle',
      'buildSolidCenterStrokeFinalFaces',
      'toSolidCenterStrokeRenderEntriesFromFinalFaces',
      'resolvedJoin',
      'vertexAngle',
      'angleSource',
      'miterAngle'
    ]) {
      expect(dashSource).not.toContain(forbiddenToken)
      expect(topologyForwarder).not.toContain(forbiddenToken)
    }
  })

  it('matches the stroke parameter coverage matrix for this step', () => {
    assertStrokeParameterCoverageForStep('allocate-dash-intervals')
  })
})
