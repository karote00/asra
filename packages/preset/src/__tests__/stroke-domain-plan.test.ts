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
  allocateFigmaLikeSplitRangeDashedIntervals,
  type FigmaLikeSplitRangeDashDomain
} from '../components/stroke-render/dashed-center-stroke-intervals'
import { normalizeStrokeSpec } from '../components/stroke-render/renderable-stroke'
import {
  getFigmaStrokeFamilyMatrix,
  resolveSourceFamily,
  type FigmaStrokeFamilyMatrixEntry,
  type FigmaStrokeFamilyScope
} from '../components/stroke-render/resolved-source-family'
import {
  buildFigmaLikeSplitRangeDashDomains,
  resolveStrokeDomains
} from '../components/stroke-render/stroke-domain-plan'
import { buildResolvedVectorGeometryModel } from '../components/stroke-render/resolved-vector-geometry-model'
import {
  StrokePositions,
  StrokeStyles,
  createDefaultStroke
} from '@asyra/utils'
import type { VectorNetwork, VectorPointNode, VectorSegment } from '@asyra/core'

const stroke = (
  style: 'solid' | 'dashed',
  position: 'center' | 'inside' | 'outside'
) =>
  normalizeStrokeSpec([
    createDefaultStroke({
      style,
      position,
      dashPattern: style === StrokeStyles.DASHED ? [24, 12] : []
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

const isAdjacentSourceTopologySegment = (
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

const buildSourceTopologySegmentPiecesForOracle = (
  sourcePath: PathGeometry
) => {
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
          sourceTopologyStartDistance: segmentRange.startDistance,
          sourceTopologyEndDistance: segmentRange.endDistance
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

  const pieces = buildSourceTopologySegmentPiecesForOracle(sourcePath)
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
        isAdjacentSourceTopologySegment(
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
          startDistance: left.sourceTopologyStartDistance,
          endDistance: left.sourceTopologyEndDistance
        },
        {
          segmentIndex: right.segmentIndex,
          distance: rightDistance,
          startDistance: right.sourceTopologyStartDistance,
          endDistance: right.sourceTopologyEndDistance
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
  domains: FigmaLikeSplitRangeDashDomain[]
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
  domains: FigmaLikeSplitRangeDashDomain[],
  dashPattern = [27, 20]
) => {
  const allocations = allocateFigmaLikeSplitRangeDashedIntervals({
    domains,
    dashPattern
  })
  const dashLength = dashPattern[0] ?? 0
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
    if (rangeLength <= dashLength) {
      return first.figmaLikeTerminalRole === 'start-end' &&
        Math.abs(first.startDistance - domain.startDistance) <= 1e-6 &&
        Math.abs(first.endDistance - domain.endDistance) <= 1e-6
        ? []
        : [{ domainId: allocation.domainId, reason: 'bad-short-terminal' }]
    }
    const halfDash = dashLength / 2
    return [
      first.figmaLikeTerminalRole === 'start' &&
      Math.abs(first.startDistance - domain.startDistance) <= 1e-6 &&
      Math.abs(first.endDistance - (domain.startDistance + halfDash)) <= 1e-6
        ? null
        : { domainId: allocation.domainId, reason: 'bad-start-half-dash' },
      last.figmaLikeTerminalRole === 'end' &&
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
  familyScope: FigmaStrokeFamilyScope
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

const resolvePlanForMatrixEntry = (entry: FigmaStrokeFamilyMatrixEntry) => {
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

  return resolveStrokeDomains({
    topology: pathTopology,
    sourceFamily: resolveSourceFamily({
      topology: pathTopology,
      stroke: renderableStroke
    }),
    stroke: renderableStroke,
    sourcePath,
    sharedSourceSplitRanges,
    normalizedLegalDomain:
      entry.familyScope === 'compound-closed'
        ? compoundLegalDomain(pathTopology)
        : undefined
  })
}

describe('stroke domain plan', () => {
  it('should run: resolve every Figma family matrix entry to an explicit Step14 domain classification', () => {
    getFigmaStrokeFamilyMatrix().forEach((entry) => {
      const plan = resolvePlanForMatrixEntry(entry)

      expect(plan.intervalDomainKind, JSON.stringify(entry)).not.toBe('none')
      expect(plan.diagnostics.length, JSON.stringify(entry)).toBeGreaterThan(0)

      if (entry.strokePosition === StrokePositions.CENTER) {
        expect(plan).toMatchObject({
          intervalDomainKind: 'topology-arc-length',
          sideAuthority: 'none',
          requiresImplicitFillHoleSideResolution: false
        })
        return
      }

      if (entry.familyScope === 'open') {
        expect(plan).toMatchObject({
          supportState: 'center-equivalent',
          intervalDomainKind: 'topology-arc-length',
          sideAuthority: 'center-equivalent'
        })
        return
      }

      if (entry.familyScope === 'compound-closed') {
        expect(plan).toMatchObject({
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

  it('should run: resolve self-intersecting inside dashed as split-range intervals with implicit fill/hole side authority', () => {
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
    const intersectionSplitDomains =
      buildFigmaLikeSplitRangeDashDomains(sourcePath)

    const plan = resolveStrokeDomains({
      topology: pathTopology,
      sourceFamily,
      stroke: renderableStroke,
      sourcePath,
      sharedSourceSplitRanges
    })

    expect(pathTopology.topologyFamily).toBe('self-intersecting')
    expect(plan).toMatchObject({
      supportState: 'supported',
      intervalDomainKind: 'figma-like-split-range',
      sideAuthority: 'implicit-fill-hole-domain',
      requiresImplicitFillHoleSideResolution: true
    })
    expect(plan.splitRangeDomains.length).toBeGreaterThan(
      sourcePath.segments.length
    )
    expect(plan.splitRangeDomains).toHaveLength(intersectionSplitDomains.length)
    expect(plan.splitRangeDomains.map((domain) => domain.domainId)).toEqual(
      intersectionSplitDomains.map((domain) => domain.domainId)
    )
    expect(plan.splitRangeDomains).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceSegmentIndex: expect.any(Number),
          sideAuthority: 'implicit-fill-hole-domain',
          sideResolutionStatus: 'resolved',
          selectedSide: expect.any(Number),
          contourIds: expect.arrayContaining([expect.any(String)]),
          legalDomainIds: expect.arrayContaining([expect.any(String)])
        })
      ])
    )
    expect(
      plan.splitRangeDomains.every(
        (domain) =>
          domain.sideResolutionStatus === 'resolved' &&
          (domain.selectedSide === 1 || domain.selectedSide === -1)
      )
    ).toBe(true)
    expect(plan.diagnostics).toContain(
      'dash-domains-follow-source-split-ranges'
    )
    expect(plan.diagnostics).toContain(
      'side-authority-is-implicit-fill-hole-domain'
    )
    expect('intervals' in plan).toBe(false)
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

    const domains = buildFigmaLikeSplitRangeDashDomains(sourcePath)
    const sourceTopologySegmentBoundaries = new Set(
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
            !sourceTopologySegmentBoundaries.has(Number(distance.toFixed(6)))
        )
    ).toBe(true)
  })

  it('should run: split source-topology segments at non-adjacent source-path intersections before half-dash allocation', () => {
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
    const domains = buildFigmaLikeSplitRangeDashDomains(sourcePath)

    expectSplitRangeDomainsMatchSourceIntersectionCuts(sourcePath, domains)
    expectSplitRangesAllocateTerminalHalfDash(domains)
  })

  it('should run: apply the same generic split-domain oracle to mixed curve/line self-intersecting vectors', () => {
    const sourcePath = createReportedMixedStarSourcePath()
    const domains = buildFigmaLikeSplitRangeDashDomains(sourcePath)

    expectSplitRangeDomainsMatchSourceIntersectionCuts(sourcePath, domains)
    expectSplitRangesAllocateTerminalHalfDash(domains, [27, 20])
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

  it('should run: mark open inside/outside strokes as center-equivalent without split-range domains', () => {
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
      supportState: 'center-equivalent',
      intervalDomainKind: 'topology-arc-length',
      sideAuthority: 'center-equivalent',
      splitRangeDomains: []
    })
    expect(plan.blockedReason).toBeUndefined()
  })
})
