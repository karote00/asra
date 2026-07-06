import { describe, expect, it } from 'vitest'
import {
  buildPathTopologyModel,
  type PathTopologyModel
} from '../components/stroke-render/path-topology-model'
import type { NormalizedLegalDomain } from '../components/stroke-render/legal-domain-normalization'
import {
  buildPolylineGeometryModelPath,
  buildVectorGeometryModelPath,
  samplePathSegmentFramesByLengthStep,
  type PathGeometry
} from '../components/stroke-render/path-geometry'
import {
  allocateDomainPlanSplitRangeDashedIntervals,
  type DomainPlanSplitRangeDashDomain
} from '../components/stroke-render/dashed-center-stroke-intervals'
import { normalizeStrokeSpec } from '../components/stroke-render/renderable-stroke'
import {
  getStrokeProductFamilyMatrix,
  resolveSourceFamily,
  type StrokeProductFamilyMatrixEntry,
  type StrokeProductFamilyScope
} from '../components/stroke-render/resolved-source-family'
import {
  buildDomainPlanSplitRangeDashDomains,
  resolveStrokeDomains
} from '../components/stroke-render/stroke-domain-plan'
import { buildResolvedVectorGeometryModel } from '../components/stroke-render/resolved-vector-geometry-model'
import {
  StrokePositions,
  StrokeStyles,
  createDefaultStroke
} from '@asyra/utils'
import type { VectorNetwork, VectorPointNode, VectorSegment } from '@asyra/core'
import {
  REPORTED_VECTOR_10_INSIDE_DASHED_NETWORK_ID,
  createReportedVector10InsideDashedDragData
} from './inside-dashed-fixtures'

const stroke = (
  style: 'solid' | 'dashed',
  position: 'center' | 'inside' | 'outside'
) =>
  normalizeStrokeSpec([
    createDefaultStroke({
      style,
      position,
      dash: style === StrokeStyles.DASHED ? 24 : 0,
      gap: style === StrokeStyles.DASHED ? 12 : 0
    })
  ]).strokes[0]

const topology = (
  points: { x: number; y: number }[],
  closed: boolean
): PathTopologyModel =>
  buildPathTopologyModel({
    pathId: `stroke-domain:${closed ? 'closed' : 'open'}:${points.length}`,
    sourceId: 'vector:stroke-domain',
    networkId: 'network:stroke-domain',
    sourceRevision: 'source-revision:stroke-domain',
    sourceFamily: 'vector',
    points,
    closed
  })

const EXPECTED_CUT_TOLERANCE = 0.75

const getDomainSourceRange = (domain: DomainPlanSplitRangeDashDomain) => {
  const startDistance = domain.sourceStartDistance ?? domain.startDistance
  const endDistance = domain.sourceEndDistance ?? domain.endDistance
  return {
    startDistance: Math.min(startDistance, endDistance),
    endDistance: Math.max(startDistance, endDistance),
    domainId: domain.domainId,
    domainMode: domain.domainMode
  }
}

const getSourceCoverageGaps = (
  domains: DomainPlanSplitRangeDashDomain[],
  totalLength: number,
  tolerance = 0.5
) => {
  const ranges = domains
    .map(getDomainSourceRange)
    .filter((range) => range.endDistance - range.startDistance > tolerance)
    .sort((left, right) => left.startDistance - right.startDistance)

  const gaps: {
    startDistance: number
    endDistance: number
    afterDomainId: string | null
    beforeDomainId: string | null
  }[] = []
  let cursor = 0
  let previousDomainId: string | null = null
  for (const range of ranges) {
    if (range.startDistance - cursor > tolerance) {
      gaps.push({
        startDistance: cursor,
        endDistance: range.startDistance,
        afterDomainId: previousDomainId,
        beforeDomainId: range.domainId
      })
    }
    if (range.endDistance > cursor) {
      cursor = range.endDistance
      previousDomainId = range.domainId
    }
  }

  if (totalLength - cursor > tolerance) {
    gaps.push({
      startDistance: cursor,
      endDistance: totalLength,
      afterDomainId: previousDomainId,
      beforeDomainId: null
    })
  }

  return gaps
}

const isAdjacentSourcePathSegment = (
  leftIndex: number,
  rightIndex: number,
  segmentCount: number,
  closed: boolean
) => {
  if (Math.abs(leftIndex - rightIndex) <= 1) {
    return true
  }
  return closed && leftIndex === 0 && rightIndex === segmentCount - 1
}

const cross2 = (
  left: { x: number; y: number },
  right: { x: number; y: number }
) => left.x * right.y - left.y * right.x

const getInclusiveSegmentIntersection = (
  leftStart: { x: number; y: number },
  leftEnd: { x: number; y: number },
  rightStart: { x: number; y: number },
  rightEnd: { x: number; y: number }
) => {
  const leftVector = {
    x: leftEnd.x - leftStart.x,
    y: leftEnd.y - leftStart.y
  }
  const rightVector = {
    x: rightEnd.x - rightStart.x,
    y: rightEnd.y - rightStart.y
  }
  const denominator = cross2(leftVector, rightVector)
  if (Math.abs(denominator) <= 1e-8) {
    return null
  }
  const delta = {
    x: rightStart.x - leftStart.x,
    y: rightStart.y - leftStart.y
  }
  const leftRatio = cross2(delta, rightVector) / denominator
  const rightRatio = cross2(delta, leftVector) / denominator
  if (
    leftRatio < -1e-6 ||
    leftRatio > 1 + 1e-6 ||
    rightRatio < -1e-6 ||
    rightRatio > 1 + 1e-6
  ) {
    return null
  }
  return {
    leftRatio: Math.max(0, Math.min(1, leftRatio)),
    rightRatio: Math.max(0, Math.min(1, rightRatio))
  }
}

const getSourceSegmentDistanceRangesForOracle = (sourcePath: PathGeometry) => {
  let cursor = 0
  return sourcePath.segments.map((segment, segmentIndex) => {
    const startDistance = cursor
    cursor += segment.length
    return {
      segmentIndex,
      startDistance,
      endDistance: cursor,
      length: segment.length
    }
  })
}

const buildSourcePathSegmentPiecesForOracle = (sourcePath: PathGeometry) => {
  const segmentRanges = getSourceSegmentDistanceRangesForOracle(sourcePath)
  return sourcePath.segments.flatMap((segment, segmentIndex) => {
    const segmentRange = segmentRanges[segmentIndex]
    if (!segmentRange || segment.length <= 1e-6) {
      return []
    }

    const frames =
      segment.type === 'line'
        ? [{ point: segment.start }, { point: segment.end }]
        : samplePathSegmentFramesByLengthStep(segment, 0, segment.length, 0.2, {
            minCubicSamples: 48,
            maxCubicSamples: 512,
            useRangeLengthForSampleCount: true
          })

    const frameSpanCount = Math.max(1, frames.length - 1)
    return frames.slice(0, -1).flatMap((frame, frameIndex) => {
      const next = frames[frameIndex + 1]
      if (!next) {
        return []
      }
      const startDistance =
        segmentRange.startDistance +
        (segment.length * frameIndex) / frameSpanCount
      const endDistance =
        segmentRange.startDistance +
        (segment.length * (frameIndex + 1)) / frameSpanCount
      return [
        {
          segmentIndex,
          start: frame.point,
          end: next.point,
          startDistance,
          endDistance,
          sourcePathStartDistance: segmentRange.startDistance,
          sourcePathEndDistance: segmentRange.endDistance
        }
      ]
    })
  })
}

const buildExpectedSplitBreakpointsForOracle = (sourcePath: PathGeometry) => {
  const breakpointsBySegment = new Map<number, number[]>()
  getSourceSegmentDistanceRangesForOracle(sourcePath).forEach((range) => {
    breakpointsBySegment.set(range.segmentIndex, [
      range.startDistance,
      range.endDistance
    ])
  })

  const pieces = buildSourcePathSegmentPiecesForOracle(sourcePath)
  for (let leftIndex = 0; leftIndex < pieces.length - 1; leftIndex += 1) {
    const left = pieces[leftIndex]
    if (!left) {
      continue
    }
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < pieces.length;
      rightIndex += 1
    ) {
      const right = pieces[rightIndex]
      if (!right) {
        continue
      }
      if (
        left.segmentIndex === right.segmentIndex ||
        isAdjacentSourcePathSegment(
          left.segmentIndex,
          right.segmentIndex,
          sourcePath.segments.length,
          sourcePath.closed
        )
      ) {
        continue
      }
      const intersection = getInclusiveSegmentIntersection(
        left.start,
        left.end,
        right.start,
        right.end
      )
      if (!intersection) {
        continue
      }
      const leftDistance =
        left.startDistance +
        (left.endDistance - left.startDistance) * intersection.leftRatio
      const rightDistance =
        right.startDistance +
        (right.endDistance - right.startDistance) * intersection.rightRatio
      ;[
        {
          segmentIndex: left.segmentIndex,
          distance: leftDistance,
          startDistance: left.sourcePathStartDistance,
          endDistance: left.sourcePathEndDistance
        },
        {
          segmentIndex: right.segmentIndex,
          distance: rightDistance,
          startDistance: right.sourcePathStartDistance,
          endDistance: right.sourcePathEndDistance
        }
      ].forEach((cut) => {
        if (
          cut.distance <= cut.startDistance + EXPECTED_CUT_TOLERANCE ||
          cut.distance >= cut.endDistance - EXPECTED_CUT_TOLERANCE
        ) {
          return
        }
        breakpointsBySegment.get(cut.segmentIndex)?.push(cut.distance)
      })
    }
  }

  return new Map(
    [...breakpointsBySegment.entries()].map(([segmentIndex, breakpoints]) => [
      segmentIndex,
      [...breakpoints]
        .sort((left, right) => left - right)
        .reduce<number[]>((deduped, distance) => {
          const previous = deduped[deduped.length - 1]
          if (
            previous === undefined ||
            Math.abs(previous - distance) > EXPECTED_CUT_TOLERANCE
          ) {
            deduped.push(distance)
          }
          return deduped
        }, [])
    ])
  )
}

const expectSplitRangeDomainsMatchSourceIntersectionCuts = (
  sourcePath: PathGeometry,
  domains: DomainPlanSplitRangeDashDomain[]
) => {
  const expectedBreakpointsBySegment =
    buildExpectedSplitBreakpointsForOracle(sourcePath)
  const failures = [...expectedBreakpointsBySegment.entries()].flatMap(
    ([segmentIndex, breakpoints]) =>
      breakpoints.slice(0, -1).flatMap((startDistance, index) => {
        const endDistance = breakpoints[index + 1]
        if (endDistance === undefined) {
          return []
        }
        const matchingDomain = domains.find(
          (domain) =>
            domain.sourceSegmentIndex === segmentIndex &&
            Math.abs(domain.startDistance - startDistance) <=
              EXPECTED_CUT_TOLERANCE &&
            Math.abs(domain.endDistance - endDistance) <= EXPECTED_CUT_TOLERANCE
        )
        return matchingDomain
          ? []
          : [
              {
                segmentIndex,
                expectedStartDistance: startDistance,
                expectedEndDistance: endDistance,
                actualDomains: domains
                  .filter(
                    (domain) => domain.sourceSegmentIndex === segmentIndex
                  )
                  .map((domain) => ({
                    startDistance: domain.startDistance,
                    endDistance: domain.endDistance
                  }))
              }
            ]
      })
  )

  expect(failures).toEqual([])
}

const expectSplitRangesAllocateTerminalHalfDash = (
  domains: DomainPlanSplitRangeDashDomain[],
  { dash, gap } = { dash: 27, gap: 20 }
) => {
  const allocations = allocateDomainPlanSplitRangeDashedIntervals({
    domains,
    dash,
    gap
  })
  const dashLength = dash
  const minimumCenterlineGapLength = Math.max(0, gap * 0.6 - 0.75)
  const failures = allocations.flatMap((allocation) => {
    const visible = allocation.intervals.filter(
      (interval) => interval.kind === 'visible'
    )
    if (visible.length === 0) {
      return [{ domainId: allocation.domainId, reason: 'missing-visible' }]
    }
    const first = visible[0]
    const last = visible[visible.length - 1]
    const domain = domains.find(
      (entry) => entry.domainId === allocation.domainId
    )
    if (!first || !last || !domain) {
      return [{ domainId: allocation.domainId, reason: 'missing-domain' }]
    }
    const rangeLength = domain.endDistance - domain.startDistance
    if (rangeLength <= dashLength + minimumCenterlineGapLength) {
      return first.domainPlanTerminalRole === 'start-end' &&
        Math.abs(first.startDistance - domain.startDistance) <= 1e-6 &&
        Math.abs(first.endDistance - domain.endDistance) <= 1e-6
        ? []
        : [{ domainId: allocation.domainId, reason: 'bad-short-terminal' }]
    }
    const halfDash = dashLength / 2
    return [
      first.domainPlanTerminalRole === 'start' &&
      Math.abs(first.startDistance - domain.startDistance) <= 1e-6 &&
      Math.abs(first.endDistance - (domain.startDistance + halfDash)) <= 1e-6
        ? null
        : { domainId: allocation.domainId, reason: 'bad-start-half-dash' },
      last.domainPlanTerminalRole === 'end' &&
      Math.abs(last.endDistance - domain.endDistance) <= 1e-6 &&
      Math.abs(last.startDistance - (domain.endDistance - halfDash)) <= 1e-6
        ? null
        : { domainId: allocation.domainId, reason: 'bad-end-half-dash' }
    ].filter(Boolean)
  })

  expect(failures).toEqual([])
}

const withCompoundLegalDomains = (
  source: PathTopologyModel
): PathTopologyModel => ({
  ...source,
  contours: [
    ...source.contours,
    {
      ...source.contours[0],
      contourId: `${source.pathId}:contour:hole`,
      role: 'hole',
      nestingDepth: 1
    }
  ],
  legalDomainDescriptors: [
    ...source.legalDomainDescriptors,
    {
      legalDomainId: `${source.pathId}:legal-domain:compound`,
      role: 'hole',
      fillRule: source.fillRule,
      fillRuleBasis: source.fillRuleBasis,
      contourIds: [`${source.pathId}:contour:hole`]
    }
  ]
})

const compoundLegalDomain = (
  source: PathTopologyModel
): Pick<NormalizedLegalDomain, 'legalDomainId' | 'boundarySpans'> => ({
  legalDomainId: `${source.pathId}:normalized-legal-domain:0`,
  boundarySpans: [
    {
      boundarySpanId: `${source.pathId}:boundary-span:shell`,
      role: 'fill-exterior-edge',
      geometry: source.normalizedPoints,
      sourceContourIds: [`${source.pathId}:contour:0`],
      sourceSpanIds: [`${source.pathId}:span:shell`],
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
      sourceSpanIds: [`${source.pathId}:span:hole`],
      seamPoint: { x: 25, y: 25 }
    }
  ]
})

const topologyForFamilyScope = (
  familyScope: StrokeProductFamilyScope
): PathTopologyModel => {
  if (familyScope === 'open') {
    return topology(
      [
        { x: 0, y: 0 },
        { x: 120, y: 0 }
      ],
      false
    )
  }

  if (familyScope === 'self-intersecting-closed') {
    const sourcePath = buildPolylineGeometryModelPath(
      [
        { x: 0, y: 0 },
        { x: 120, y: 220 },
        { x: 240, y: 0 },
        { x: 0, y: 140 },
        { x: 240, y: 140 }
      ],
      true
    )
    return topology(sourcePath.sampledPoints, true)
  }

  const closedTopology = topology(
    [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 }
    ],
    true
  )

  return familyScope === 'compound-closed'
    ? withCompoundLegalDomains(closedTopology)
    : closedTopology
}

const createReportedMixedStarSourcePath = () => {
  const points: Record<string, VectorPointNode> = {
    'tp-12': {
      id: 'tp-12',
      kind: 'anchor',
      x: 188.1928217922337,
      y: 0,
      anchorType: 'smooth'
    },
    'tp-13': {
      id: 'tp-13',
      kind: 'anchor',
      x: 11.358174406717296,
      y: 365.76797704068724,
      anchorType: 'smooth'
    },
    'tp-12:out': {
      id: 'tp-12:out',
      kind: 'control',
      x: 164.3673966581619,
      y: 140.9198821588739,
      controlForId: 'tp-12',
      controlRole: 'out'
    },
    'tp-13:in': {
      id: 'tp-13:in',
      kind: 'control',
      x: -42.09205809548172,
      y: 344.92238636482955,
      controlForId: 'tp-13',
      controlRole: 'in'
    },
    'tp-13:out': {
      id: 'tp-13:out',
      kind: 'control',
      x: 78.17096503446606,
      y: 391.8249653855095,
      controlForId: 'tp-13',
      controlRole: 'out'
    },
    'tp-14': {
      id: 'tp-14',
      kind: 'anchor',
      x: 360.12094148356584,
      y: 145.95389587539378,
      anchorType: 'sharp'
    },
    'tp-15': {
      id: 'tp-15',
      kind: 'anchor',
      x: 0,
      y: 15.668954151283657,
      anchorType: 'sharp'
    },
    'tp-16': {
      id: 'tp-16',
      kind: 'anchor',
      x: 270.59180204238254,
      y: 347.0603956649177,
      anchorType: 'smooth'
    },
    'tp-15:out': {
      id: 'tp-15:out',
      kind: 'control',
      x: 0,
      y: 15.668954151283657,
      controlForId: 'tp-15',
      controlRole: 'out'
    },
    'tp-16:in': {
      id: 'tp-16:in',
      kind: 'control',
      x: 263.9105229796075,
      y: 364.43172122813246,
      controlForId: 'tp-16',
      controlRole: 'in'
    },
    'tp-16:out': {
      id: 'tp-16:out',
      kind: 'control',
      x: 277.27308110515736,
      y: 329.6890701017029,
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
  return buildVectorGeometryModelPath(network, points, segments)
}

const resolvePlanForMatrixEntry = (entry: StrokeProductFamilyMatrixEntry) => {
  const pathTopology = topologyForFamilyScope(entry.familyScope)
  const renderableStroke = stroke(entry.strokeStyle, entry.strokePosition)
  const sourcePath = buildPolylineGeometryModelPath(
    pathTopology.normalizedPoints,
    pathTopology.closed
  )
  const resolvedGeometry =
    entry.familyScope === 'self-intersecting-closed' &&
    entry.strokePosition !== StrokePositions.CENTER
      ? buildResolvedVectorGeometryModel({
          modelId: `stroke-domain:matrix:${entry.familyScope}:resolved-geometry`,
          fillRule: pathTopology.fillRule,
          networks: [
            {
              networkId: pathTopology.networkId,
              path: sourcePath,
              topology: pathTopology
            }
          ]
        })
      : null
  const sharedSourceSplitRanges =
    resolvedGeometry?.networks[0]?.selfIntersecting?.sourceSplitRanges ?? []
  const sharedStrokeBoundaryDomains =
    resolvedGeometry?.networks[0]?.selfIntersecting?.strokeBoundaryDomains ?? []

  return resolveStrokeDomains({
    topology: pathTopology,
    sourceFamily: resolveSourceFamily({
      topology: pathTopology,
      stroke: renderableStroke
    }),
    stroke: renderableStroke,
    sourcePath,
    sharedSourceSplitRanges,
    sharedStrokeBoundaryDomains,
    normalizedLegalDomain:
      entry.familyScope === 'compound-closed'
        ? compoundLegalDomain(pathTopology)
        : undefined
  })
}

describe('stroke domain plan', () => {
  it('should run: resolve every Asyra canonical family matrix entry to an explicit Step14 domain classification', () => {
    getStrokeProductFamilyMatrix().forEach((entry) => {
      const plan = resolvePlanForMatrixEntry(entry)

      expect(plan.intervalDomainKind, JSON.stringify(entry)).not.toBe('none')
      expect(plan.diagnostics.length, JSON.stringify(entry)).toBeGreaterThan(0)

      if (entry.strokePosition === StrokePositions.CENTER) {
        expect(plan).toMatchObject({
          domainMode: 'center-product',
          intervalDomainKind: 'topology-arc-length',
          sideAuthority: 'none',
          requiresImplicitFillHoleSideResolution: false
        })
        return
      }

      if (entry.familyScope === 'open') {
        expect(plan).toMatchObject({
          domainMode: 'center-product',
          intervalDomainKind: 'topology-arc-length',
          sideAuthority: 'none'
        })
        return
      }

      if (entry.familyScope === 'compound-closed') {
        expect(plan).toMatchObject({
          domainMode: 'closed-constrained-domain',
          intervalDomainKind: 'legal-boundary-span',
          sideAuthority: 'implicit-fill-hole-domain',
          requiresImplicitFillHoleSideResolution: true
        })
        expect(plan.legalBoundaryDomains).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              role: 'fill-exterior-edge',
              selectedStrokePosition: entry.strokePosition
            }),
            expect.objectContaining({
              role: 'fill-interior-edge',
              selectedStrokePosition:
                entry.strokePosition === StrokePositions.INSIDE
                  ? StrokePositions.OUTSIDE
                  : StrokePositions.INSIDE
            })
          ])
        )
        return
      }

      if (entry.familyScope === 'self-intersecting-closed') {
        expect(plan).toMatchObject({
          domainMode: 'closed-constrained-domain',
          sideAuthority: 'implicit-fill-hole-domain',
          requiresImplicitFillHoleSideResolution: true
        })
        expect(plan.splitRangeDomains.length).toBeGreaterThan(0)
        expect(
          plan.splitRangeDomains.every(
            (domain) => domain.sideResolutionStatus === 'resolved'
          )
        ).toBe(true)
        return
      }

      expect(plan).toMatchObject({
        intervalDomainKind: 'source-path',
        sideAuthority: 'source-path-orientation',
        requiresImplicitFillHoleSideResolution: false
      })
    })
  })

  it('should run: resolve self-intersecting inside dashed as filled-face boundary split ranges with implicit face authority', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 120, y: 220 },
      { x: 240, y: 0 },
      { x: 0, y: 140 },
      { x: 240, y: 140 }
    ]
    const sourcePath = buildPolylineGeometryModelPath(points, true)
    const pathTopology = topology(sourcePath.sampledPoints, true)
    const renderableStroke = stroke(StrokeStyles.DASHED, StrokePositions.INSIDE)
    const sourceFamily = resolveSourceFamily({
      topology: pathTopology,
      stroke: renderableStroke
    })
    const resolvedGeometry = buildResolvedVectorGeometryModel({
      modelId: 'stroke-domain:self-intersecting:resolved-geometry',
      fillRule: pathTopology.fillRule,
      networks: [
        {
          networkId: pathTopology.networkId,
          path: sourcePath,
          topology: pathTopology
        }
      ]
    })
    const sharedSourceSplitRanges =
      resolvedGeometry.networks[0]?.selfIntersecting?.sourceSplitRanges ?? []
    const sharedStrokeBoundaryDomains =
      resolvedGeometry.networks[0]?.selfIntersecting?.strokeBoundaryDomains ??
      []
    const plan = resolveStrokeDomains({
      topology: pathTopology,
      sourceFamily,
      stroke: renderableStroke,
      sourcePath,
      sharedSourceSplitRanges,
      sharedStrokeBoundaryDomains
    })

    expect(pathTopology.topologyFamily).toBe('self-intersecting')
    expect(plan).toMatchObject({
      domainMode: 'closed-constrained-domain',
      intervalDomainKind: 'domain-plan-split-range',
      sideAuthority: 'implicit-fill-hole-domain',
      requiresImplicitFillHoleSideResolution: true
    })
    expect(plan.splitRangeDomains.length).toBeGreaterThan(
      sourcePath.segments.length
    )
    expect(plan.splitRangeDomains).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceSegmentIndex: expect.any(Number),
          sideResolutionStatus: 'resolved',
          selectedSide: expect.any(Number),
          filledSide: expect.any(Number),
          unfilledSide: expect.any(Number),
          boundaryRole: 'filled-face'
        })
      ])
    )
    expect(
      plan.splitRangeDomains.every(
        (domain) =>
          !domain.domainId.startsWith('closed-constrained-source-domain:') &&
          domain.domainMode !== 'open-dangling-outside-both-sides'
      )
    ).toBe(true)
    expect(
      plan.splitRangeDomains.some(
        (domain) =>
          domain.boundaryRole === 'filled-face' &&
          (domain.boundaryPoints?.length ?? 0) >= 2
      )
    ).toBe(true)
    expect(
      plan.splitRangeDomains.every(
        (domain) =>
          domain.sideResolutionStatus === 'resolved' &&
          (domain.selectedSide === 1 || domain.selectedSide === -1) &&
          domain.filledSide !== domain.unfilledSide
      )
    ).toBe(true)
    expect(plan.diagnostics).toContain(
      'constrained-domains-use-stroke-domain-plan'
    )
    expect(plan.diagnostics).toContain(
      'side-authority-is-implicit-fill-hole-domain'
    )
    expect('intervals' in plan).toBe(false)
  })

  it('should run: keep reported inside dashed drag on split-range domains with implicit fill clipping', () => {
    const data = createReportedVector10InsideDashedDragData()
    const network = data.networks[REPORTED_VECTOR_10_INSIDE_DASHED_NETWORK_ID]
    const renderableStroke = normalizeStrokeSpec(data.strokes).strokes[0]

    expect(network).toBeDefined()
    expect(renderableStroke).toBeDefined()

    const sourcePath = buildVectorGeometryModelPath(
      network,
      data.points,
      data.segments
    )
    const pathTopology = buildPathTopologyModel({
      pathId: data.id,
      sourceId: data.id,
      networkId: network.id,
      sourceRevision: 'source-revision:reported-vector-10',
      sourceFamily: 'vector',
      points: sourcePath.sampledPoints,
      closed: network.closed
    })
    const resolvedGeometry = buildResolvedVectorGeometryModel({
      modelId: 'stroke-domain:reported-vector-10:resolved-geometry',
      fillRule: pathTopology.fillRule,
      networks: [
        {
          networkId: pathTopology.networkId,
          path: sourcePath,
          topology: pathTopology
        }
      ]
    })
    const selfIntersecting = resolvedGeometry.networks[0]?.selfIntersecting
    const plan = resolveStrokeDomains({
      topology: pathTopology,
      sourceFamily: resolveSourceFamily({
        topology: pathTopology,
        stroke: renderableStroke
      }),
      stroke: renderableStroke,
      sourcePath,
      implicitFillRegions: selfIntersecting?.fillRegions ?? [],
      sharedSourceSplitRanges: selfIntersecting?.sourceSplitRanges ?? [],
      sharedStrokeBoundaryDomains: selfIntersecting?.strokeBoundaryDomains ?? []
    })

    expect(pathTopology.topologyFamily).toBe('self-intersecting')
    expect(plan.domainMode).toBe('closed-constrained-domain')
    expect(plan.intervalDomainKind).toBe('domain-plan-split-range')
    expect(plan.sideAuthority).toBe('implicit-fill-hole-domain')
    expect(plan.requiresImplicitFillHoleSideResolution).toBe(true)
    expect(plan.diagnostics).toContain(
      'constrained-domains-use-stroke-domain-plan'
    )
    expect(plan.diagnostics).toContain(
      'side-authority-is-implicit-fill-hole-domain'
    )
    expect(plan.splitRangeDomains.length).toBeGreaterThan(0)
    expect(
      plan.splitRangeDomains.every(
        (domain) =>
          domain.sideResolutionStatus === 'resolved' &&
          (domain.selectedSide === 1 || domain.selectedSide === -1) &&
          domain.filledSide !== domain.unfilledSide
      )
    ).toBe(true)
    expect(plan.legalBoundaryDomains).toHaveLength(0)
    expect(plan.diagnostics).toContain(
      'closed-constrained-source-coverage-domains-added'
    )
    if (
      !plan.sideResolutionContext ||
      (plan.sideResolutionContext.implicitFillRegions?.length ?? 0) === 0
    ) {
      throw new Error(
        `reported vector-10 inside dashed domain plan did not preserve implicit fill clip context: ${JSON.stringify(
          {
            diagnostics: plan.diagnostics,
            splitRangeDomains: plan.splitRangeDomains.length,
            implicitFillRegionCount:
              plan.sideResolutionContext?.implicitFillRegions?.length ?? 0
          }
        )}`
      )
    }
    expect(plan.sideResolutionContext.sourcePath.closed).toBe(true)
    expect(plan.sideResolutionContext.sourcePath.segments).toHaveLength(
      network.segmentIds.length
    )
    expect(plan.sideResolutionContext.sourcePath.totalLength).toBeGreaterThan(0)
    expect(plan.sideResolutionContext.strokePosition).toBe('inside')
    expect(
      plan.sideResolutionContext.implicitFillRegions?.length ?? 0
    ).toBeGreaterThan(0)
    expect(sourcePath.segments.every((segment) => segment.length > 0)).toBe(
      true
    )
  })

  it('should run: resolve self-intersecting outside dashed from exterior boundary domains only', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 120, y: 220 },
      { x: 240, y: 0 },
      { x: 0, y: 140 },
      { x: 240, y: 140 }
    ]
    const sourcePath = buildPolylineGeometryModelPath(points, true)
    const pathTopology = topology(sourcePath.sampledPoints, true)
    const renderableStroke = stroke(
      StrokeStyles.DASHED,
      StrokePositions.OUTSIDE
    )
    const resolvedGeometry = buildResolvedVectorGeometryModel({
      modelId: 'stroke-domain:self-intersecting:outside-boundaries',
      fillRule: pathTopology.fillRule,
      networks: [
        {
          networkId: pathTopology.networkId,
          path: sourcePath,
          topology: pathTopology
        }
      ]
    })
    const selfIntersecting = resolvedGeometry.networks[0]?.selfIntersecting
    expect(
      selfIntersecting?.strokeBoundaryDomains.some(
        (domain) => domain.boundaryRole === 'filled-face'
      )
    ).toBe(true)

    const plan = resolveStrokeDomains({
      topology: pathTopology,
      sourceFamily: resolveSourceFamily({
        topology: pathTopology,
        stroke: renderableStroke
      }),
      stroke: renderableStroke,
      sourcePath,
      sharedSourceSplitRanges: selfIntersecting?.sourceSplitRanges ?? [],
      sharedStrokeBoundaryDomains: selfIntersecting?.strokeBoundaryDomains ?? []
    })

    expect(plan).toMatchObject({
      intervalDomainKind: 'domain-plan-split-range',
      sideAuthority: 'implicit-fill-hole-domain',
      requiresImplicitFillHoleSideResolution: true
    })
    expect(plan.splitRangeDomains.length).toBeGreaterThan(0)
    expect(
      plan.splitRangeDomains.some(
        (domain) => domain.boundaryRole === 'filled-face'
      )
    ).toBe(false)
    expect(
      plan.splitRangeDomains.every(
        (domain) =>
          domain.boundaryRole === 'outer' &&
          domain.selectedSide === domain.unfilledSide &&
          domain.selectedSide !== domain.filledSide
      )
    ).toBe(true)
  })

  it('should run: preserve actual boundary-domain geometry metrics for inside filled-face dash allocation', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 120, y: 220 },
      { x: 240, y: 0 },
      { x: 0, y: 140 },
      { x: 240, y: 140 }
    ]
    const sourcePath = buildPolylineGeometryModelPath(points, true)
    const pathTopology = topology(sourcePath.sampledPoints, true)
    const resolvedGeometry = buildResolvedVectorGeometryModel({
      modelId: 'stroke-domain:self-intersecting:filled-face-boundary-metrics',
      fillRule: pathTopology.fillRule,
      networks: [
        {
          networkId: pathTopology.networkId,
          path: sourcePath,
          topology: pathTopology
        }
      ]
    })
    const selfIntersecting = resolvedGeometry.networks[0]?.selfIntersecting
    const filledFaceDomains =
      selfIntersecting?.strokeBoundaryDomains.filter(
        (domain) => domain.boundaryRole === 'filled-face'
      ) ?? []

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
      expect(record.boundaryStartDistance).toEqual(expect.any(Number))
      expect(record.boundaryEndDistance).toEqual(expect.any(Number))
      expect(record.boundaryTotalLength).toEqual(expect.any(Number))
      expect(record.boundaryStartDistance).toBe(0)
      expect(record.boundaryEndDistance).toBe(record.boundaryTotalLength)
      expect(record.sourceStartDistance).toEqual(expect.any(Number))
      expect(record.sourceEndDistance).toEqual(expect.any(Number))
      expect(record.sourceEndDistance as number).toBeGreaterThan(
        record.sourceStartDistance as number
      )
      expect(record.boundaryEndDistance as number).toBeGreaterThan(
        record.boundaryStartDistance as number
      )
      expect(record.boundaryTotalLength as number).toBeGreaterThanOrEqual(
        (record.boundaryEndDistance as number) -
          (record.boundaryStartDistance as number) -
          1e-6
      )
    })
  })

  it('should run: build split-range domains at source-path intersections', () => {
    const sourcePath = buildPolylineGeometryModelPath(
      [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
        { x: 100, y: 0 }
      ],
      true
    )

    const domains = buildDomainPlanSplitRangeDashDomains(sourcePath)
    const sourcePathSegmentBoundaries = new Set(
      sourcePath.segments
        .reduce<
          number[]
        >((distances, segment) => [...distances, distances[distances.length - 1] + segment.length], [0])
        .map((distance) => Number(distance.toFixed(6)))
    )

    expect(domains.length).toBeGreaterThan(sourcePath.segments.length)
    expect(
      domains.every((domain) => Number.isInteger(domain.sourceSegmentIndex))
    ).toBe(true)
    expect(
      domains
        .flatMap((domain) => [domain.startDistance, domain.endDistance])
        .some(
          (distance) =>
            !sourcePathSegmentBoundaries.has(Number(distance.toFixed(6)))
        )
    ).toBe(true)
  })

  it('should run: split source-path segments at non-adjacent source-path intersections before half-dash allocation', () => {
    const sourcePath = buildPolylineGeometryModelPath(
      [
        { x: 0, y: 0 },
        { x: 140, y: 210 },
        { x: 280, y: 0 },
        { x: 0, y: 130 },
        { x: 280, y: 130 }
      ],
      true
    )
    const domains = buildDomainPlanSplitRangeDashDomains(sourcePath)

    expectSplitRangeDomainsMatchSourceIntersectionCuts(sourcePath, domains)
    expectSplitRangesAllocateTerminalHalfDash(domains)
  })

  it('should run: apply the same generic split-domain oracle to mixed curve/line self-intersecting vectors', () => {
    const sourcePath = createReportedMixedStarSourcePath()
    const domains = buildDomainPlanSplitRangeDashDomains(sourcePath)

    expectSplitRangeDomainsMatchSourceIntersectionCuts(sourcePath, domains)
    expectSplitRangesAllocateTerminalHalfDash(domains, { dash: 27, gap: 20 })
  })

  it('should run: keep simple closed constrained strokes on source path domains with orientation authority', () => {
    const pathTopology = topology(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 80 },
        { x: 0, y: 80 }
      ],
      true
    )
    const renderableStroke = stroke(
      StrokeStyles.DASHED,
      StrokePositions.OUTSIDE
    )

    const plan = resolveStrokeDomains({
      topology: pathTopology,
      sourceFamily: resolveSourceFamily({
        topology: pathTopology,
        stroke: renderableStroke
      }),
      stroke: renderableStroke,
      sourcePath: buildPolylineGeometryModelPath(
        pathTopology.normalizedPoints,
        true
      )
    })

    expect(plan).toMatchObject({
      intervalDomainKind: 'source-path',
      sideAuthority: 'source-path-orientation',
      requiresImplicitFillHoleSideResolution: false,
      splitRangeDomains: []
    })
  })

  it('should run: resolve compound constrained dashed through normalized legal boundary spans with hole-side inversion', () => {
    const pathTopology = withCompoundLegalDomains(
      topology(
        [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 }
        ],
        true
      )
    )
    const renderableStroke = stroke(StrokeStyles.DASHED, StrokePositions.INSIDE)

    const plan = resolveStrokeDomains({
      topology: pathTopology,
      sourceFamily: resolveSourceFamily({
        topology: pathTopology,
        stroke: renderableStroke
      }),
      stroke: renderableStroke,
      sourcePath: buildPolylineGeometryModelPath(
        pathTopology.normalizedPoints,
        true
      ),
      normalizedLegalDomain: compoundLegalDomain(pathTopology)
    })

    expect(plan).toMatchObject({
      intervalDomainKind: 'legal-boundary-span',
      sideAuthority: 'implicit-fill-hole-domain',
      requiresImplicitFillHoleSideResolution: true,
      splitRangeDomains: []
    })
    expect(plan.legalBoundaryDomains).toEqual([
      expect.objectContaining({
        role: 'fill-exterior-edge',
        selectedStrokePosition: StrokePositions.INSIDE,
        sourceContourIds: [`${pathTopology.pathId}:contour:0`]
      }),
      expect.objectContaining({
        role: 'fill-interior-edge',
        selectedStrokePosition: StrokePositions.OUTSIDE,
        sourceContourIds: [`${pathTopology.pathId}:contour:hole`]
      })
    ])
    expect(plan.diagnostics).toContain(
      'compound-constrained-uses-normalized-legal-boundary-domains'
    )
  })

  it('should run: mark simple open inside/outside strokes as unbounded center product without split-range domains', () => {
    const pathTopology = topology(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      ],
      false
    )
    const renderableStroke = stroke(StrokeStyles.DASHED, StrokePositions.INSIDE)

    const plan = resolveStrokeDomains({
      topology: pathTopology,
      sourceFamily: resolveSourceFamily({
        topology: pathTopology,
        stroke: renderableStroke
      }),
      stroke: renderableStroke
    })

    expect(plan).toMatchObject({
      domainMode: 'center-product',
      intervalDomainKind: 'topology-arc-length',
      sideAuthority: 'none',
      splitRangeDomains: []
    })
  })

  it('should run: split open self-intersecting dashed domains into contour and dangling rules', () => {
    const points = {
      'tp-36': {
        id: 'tp-36',
        kind: 'anchor',
        x: 672.1796903067977,
        y: -25.577192537243718,
        anchorType: 'sharp',
        handleMode: 'none'
      },
      'tp-39': {
        id: 'tp-39',
        kind: 'anchor',
        x: 494.0219478943302,
        y: 383.5816904608811,
        anchorType: 'smooth',
        handleMode: 'none'
      },
      'tp-36:in': {
        id: 'tp-36:in',
        kind: 'control',
        x: 672.1796903067977,
        y: -25.577192537243718,
        controlForId: 'tp-36',
        controlRole: 'in'
      },
      'tp-39:out': {
        id: 'tp-39:out',
        kind: 'control',
        x: 420.04119045186485,
        y: 382.0718790845042,
        controlForId: 'tp-39',
        controlRole: 'out'
      },
      'tp-39:in': {
        id: 'tp-39:in',
        kind: 'control',
        x: 568.0027053367955,
        y: 385.09150183725797,
        controlForId: 'tp-39',
        controlRole: 'in'
      },
      'tp-40': {
        id: 'tp-40',
        kind: 'anchor',
        x: 847.3178099665117,
        y: 155.6001726279776,
        anchorType: 'sharp',
        handleMode: 'none'
      },
      'tp-41': {
        id: 'tp-41',
        kind: 'anchor',
        x: 486.47289101244587,
        y: 158.61979538073132,
        anchorType: 'sharp',
        handleMode: 'none'
      },
      'tp-42': {
        id: 'tp-42',
        kind: 'anchor',
        x: 823.1608279444822,
        y: 344.32659467508313,
        anchorType: 'sharp',
        handleMode: 'none'
      }
    } satisfies Record<string, VectorPointNode>
    const segments = {
      'ts-55': {
        id: 'ts-55',
        startId: 'tp-39',
        endId: 'tp-36',
        outControlId: 'tp-39:out',
        inControlId: 'tp-36:in'
      },
      'ts-56': {
        id: 'ts-56',
        startId: 'tp-40',
        endId: 'tp-39',
        outControlId: null,
        inControlId: 'tp-39:in'
      },
      'ts-57': {
        id: 'ts-57',
        startId: 'tp-41',
        endId: 'tp-40',
        outControlId: null,
        inControlId: null
      },
      'ts-58': {
        id: 'ts-58',
        startId: 'tp-42',
        endId: 'tp-41',
        outControlId: null,
        inControlId: null
      }
    } satisfies Record<string, VectorSegment>
    const network = {
      id: 'open-self-intersecting-pentagram',
      pointIds: ['tp-42', 'tp-41', 'tp-40', 'tp-39', 'tp-36'],
      segmentIds: ['ts-58', 'ts-57', 'ts-56', 'ts-55'],
      closed: false
    } satisfies VectorNetwork
    const sourcePath = buildVectorGeometryModelPath(network, points, segments)
    const pathTopology = buildPathTopologyModel({
      pathId: 'stroke-domain:open-self-intersecting-pentagram',
      sourceId: 'vector:stroke-domain-open-self-intersecting',
      networkId: network.id,
      sourceRevision: 'source-revision:stroke-domain-open-self-intersecting',
      sourceFamily: 'vector',
      points: sourcePath.sampledPoints,
      closed: network.closed
    })
    const resolvedGeometry = buildResolvedVectorGeometryModel({
      modelId: 'stroke-domain:open-self-intersecting:resolved-geometry',
      fillRule: pathTopology.fillRule,
      networks: [
        {
          networkId: pathTopology.networkId,
          path: sourcePath,
          topology: pathTopology
        }
      ]
    })
    const selfIntersecting = resolvedGeometry.networks[0]?.selfIntersecting

    expect(pathTopology.closed).toBe(false)
    expect(selfIntersecting?.fillRegions.length ?? 0).toBeGreaterThan(0)

    const resolveOpenPlan = (position: 'inside' | 'outside') => {
      const renderableStroke = stroke(StrokeStyles.DASHED, position)
      return resolveStrokeDomains({
        topology: pathTopology,
        sourceFamily: resolveSourceFamily({
          topology: pathTopology,
          stroke: renderableStroke
        }),
        stroke: renderableStroke,
        sourcePath,
        implicitFillRegions: selfIntersecting?.fillRegions ?? [],
        sharedSourceSplitRanges: selfIntersecting?.sourceSplitRanges ?? [],
        sharedStrokeBoundaryDomains:
          selfIntersecting?.strokeBoundaryDomains ?? []
      })
    }

    const insidePlan = resolveOpenPlan(StrokePositions.INSIDE)
    expect(insidePlan.domainMode).toBe('open-contour-constrained-domain')
    expect(insidePlan.intervalDomainKind).toBe('domain-plan-split-range')
    expect(insidePlan.diagnostics).toContain('inside-excluded-open-spans-added')
    const insideExcludedDomains = insidePlan.splitRangeDomains.filter(
      (domain) => domain.domainMode === 'inside-excluded-open-span'
    )
    expect(insideExcludedDomains.length).toBeGreaterThan(0)
    expect(
      insidePlan.splitRangeDomains.some(
        (domain) =>
          domain.domainMode === 'open-dangling-outside-both-sides' ||
          domain.domainId.startsWith('open-dangling-outside-domain:')
      )
    ).toBe(false)
    expect(
      insidePlan.splitRangeDomains.every(
        (domain) =>
          domain.domainMode === 'open-contour-constrained-domain' ||
          domain.domainMode === 'inside-excluded-open-span'
      )
    ).toBe(true)
    expect(
      allocateDomainPlanSplitRangeDashedIntervals({
        domains: insideExcludedDomains,
        dash: 24,
        gap: 12
      }).every((allocation) => allocation.intervals.length === 0)
    ).toBe(true)

    const outsidePlan = resolveOpenPlan(StrokePositions.OUTSIDE)
    expect(outsidePlan.domainMode).toBe('open-contour-constrained-domain')
    expect(outsidePlan.intervalDomainKind).toBe('domain-plan-split-range')
    expect(outsidePlan.diagnostics).toContain(
      'open-dangling-outside-domains-added'
    )
    expect(
      outsidePlan.splitRangeDomains.some(
        (domain) =>
          domain.domainMode === 'open-dangling-outside-both-sides' &&
          domain.domainId.startsWith('open-dangling-outside-domain:')
      )
    ).toBe(true)
    expect(
      outsidePlan.splitRangeDomains.every((domain) => {
        const isDanglingDomain = domain.domainId.startsWith(
          'open-dangling-outside-domain:'
        )
        return (
          (isDanglingDomain &&
            domain.domainMode === 'open-dangling-outside-both-sides') ||
          (!isDanglingDomain &&
            domain.domainMode === 'open-contour-constrained-domain')
        )
      })
    ).toBe(true)
    expect(
      getSourceCoverageGaps(
        outsidePlan.splitRangeDomains,
        sourcePath.totalLength
      )
    ).toEqual([])
  })
})
