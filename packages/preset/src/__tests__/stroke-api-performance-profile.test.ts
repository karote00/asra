import { describe, expect, it } from 'vitest'
import {
  StrokeCapTypes,
  StrokeJoinTypes,
  createDefaultStroke
} from '@asyra/utils'
import { buildCenterDashedOverlapCandidatesFromResolvedPackets } from '../components/stroke-render/center-dashed-overlap-candidates'
import { buildCenterDashedOverlapDiagnosticsFromResolvedPackets } from '../components/stroke-render/center-dashed-overlap-diagnostics'
import {
  buildCenterDashedOverlapGraph,
  extractCenterDashedOverlapComponents,
  polygonsHavePositiveAreaOverlap
} from '../components/stroke-render/center-dashed-overlap-graph'
import { resolveCenterDashedOwnershipForComponent } from '../components/stroke-render/center-dashed-ownership'
import {
  buildConstrainedDashedRuntimeDiagnostics,
  clearConstrainedDashedRuntimeDiagnostics,
  setConstrainedDashedRuntimeDiagnostics
} from '../components/stroke-render/constrained-dashed-runtime-diagnostics'
import {
  classifyConstrainedDashedInterval,
  classifyConstrainedDashedOwnership,
  classifyConstrainedDashedRuntimeStatus,
  classifyConstrainedDashedSource,
  hasConstrainedDashedStrokeIntent,
  supportsConstrainedDashedStroke,
  buildConstrainedDashedStrokeResolvedPackets
} from '../components/stroke-render/constrained-dashed-stroke-packets'
import { buildConstrainedSolidLegalityClippingResult } from '../components/stroke-render/constrained-solid-legality-clipping'
import {
  buildConstrainedSolidLegalityDomain,
  isPointInConstrainedSolidLegalityDomain
} from '../components/stroke-render/constrained-solid-legality-domain'
import {
  buildConstrainedSolidOwnershipDiagnostics,
  createEmptyConstrainedSolidOwnershipDiagnostics
} from '../components/stroke-render/constrained-solid-ownership-diagnostics'
import {
  buildConstrainedSolidRuntimeDiagnostics,
  clearConstrainedSolidRuntimeDiagnostics,
  setConstrainedSolidRuntimeDiagnostics
} from '../components/stroke-render/constrained-solid-runtime-diagnostics'
import { buildConstrainedSolidStrokePolygons } from '../components/stroke-render/constrained-solid-stroke-geometry'
import {
  buildConstrainedSolidStrokeResolvedPackets,
  hasConstrainedSolidStrokeIntent
} from '../components/stroke-render/constrained-solid-stroke-packets'
import { allocateDashedCenterStrokeIntervals } from '../components/stroke-render/dashed-center-stroke-intervals'
import {
  buildDashedCenterStrokeResolvedPackets,
  supportsDashedCenterStroke
} from '../components/stroke-render/dashed-center-stroke-packets'
import { buildEllipseLoop } from '../components/stroke-render/ellipse-path'
import { buildPolylineGeometryModelPath } from '../components/stroke-render/path-geometry'
import {
  allocateDashedIntervalsForTopology,
  buildPathTopologyModel,
  classifyCompoundClosedLegalDomains,
  classifyPathTopologyModel,
  isPointInsideTopologyPolygon
} from '../components/stroke-render/path-topology-model'
import {
  getRenderableStrokes,
  getStrokeHitWidth
} from '../components/stroke-render/renderable-stroke'
import { buildSolidCenterStrokePolygons } from '../components/stroke-render/solid-center-stroke-geometry'
import {
  applySolidCenterStrokeExportPackets,
  attachStrokePacketDebugMeta,
  buildSolidCenterStrokeExportPackets,
  buildSolidCenterStrokeHitTestPackets,
  buildSolidCenterStrokeResolvedPackets,
  createSolidCenterStrokeHitArea,
  normalizeResolvedStrokePacketGeometry,
  toSolidCenterStrokeRenderEntries
} from '../components/stroke-render/solid-center-stroke-packets'
import { renderSolidCenterStrokeEntries } from '../components/stroke-render/solid-center-stroke-render'
import {
  add,
  buildOffsetSegments,
  createOffsetSegment,
  dedupeAdjacent,
  dedupeClosed,
  distance,
  extendForCap,
  isSimpleClosedPolygon,
  isSimpleOpenPath,
  normalize,
  normalizeClosed,
  offsetPath,
  perpendicularLeft,
  polygonArea,
  scale,
  subtract
} from '../components/stroke-render/solid-stroke-geometry-core'
import {
  buildStrokeRuntimeRevisionSet,
  computeStrokeDirtyKeys,
  updateStrokeRuntimeRevisionSetFromMetadata
} from '../components/stroke-render/stroke-dirty-keys'
import { sliceStrokeIntervalFrames } from '../components/stroke-render/stroke-interval-frames'
import { Container } from 'pixi.js'

interface Vec2 {
  x: number
  y: number
}

interface ProfileResult {
  name: string
  iterations: number
  totalMs: number
  avgMs: number
  resultCount: number
}

const describeProfile =
  process.env.ASYRA_STROKE_API_PROFILE === '1' ? describe : describe.skip

const insideDashedStroke = createDefaultStroke({
  width: 6,
  style: 'dashed',
  position: 'inside',
  joinType: StrokeJoinTypes.ROUND,
  capType: StrokeCapTypes.ROUND,
  dashPattern: [18, 10],
  dashOffset: 0
})

const insideSolidStroke = createDefaultStroke({
  width: 6,
  style: 'solid',
  position: 'inside',
  joinType: StrokeJoinTypes.ROUND,
  capType: StrokeCapTypes.ROUND
})

const centerSolidStroke = createDefaultStroke({
  width: 6,
  style: 'solid',
  position: 'center',
  joinType: StrokeJoinTypes.ROUND,
  capType: StrokeCapTypes.ROUND
})

const centerDashedStroke = createDefaultStroke({
  width: 6,
  style: 'dashed',
  position: 'center',
  joinType: StrokeJoinTypes.ROUND,
  capType: StrokeCapTypes.ROUND,
  dashPattern: [18, 10],
  dashOffset: 0
})

const buildOpenSinePoints = (): Vec2[] =>
  Array.from({ length: 72 }, (_, index) => ({
    x: index * 6,
    y: 80 + Math.sin(index * 0.24) * 28
  }))

const buildSimpleStarPoints = (): Vec2[] => {
  const center = { x: 90, y: 90 }
  return Array.from({ length: 10 }, (_, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / 10
    const radius = index % 2 === 0 ? 78 : 38
    return {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius
    }
  })
}

const measure = (
  name: string,
  iterations: number,
  run: () => number
): ProfileResult => {
  let resultCount = 0
  const start = performance.now()
  for (let index = 0; index < iterations; index += 1) {
    resultCount += run()
  }
  const totalMs = performance.now() - start

  return {
    name,
    iterations,
    totalMs,
    avgMs: totalMs / iterations,
    resultCount
  }
}

const printProfileResults = (results: ProfileResult[]) => {
  const ranked = [...results].sort((left, right) => right.avgMs - left.avgMs)
  console.table(
    ranked.map((result) => ({
      api: result.name,
      iterations: result.iterations,
      totalMs: Number(result.totalMs.toFixed(3)),
      avgMs: Number(result.avgMs.toFixed(5)),
      resultCount: result.resultCount
    }))
  )
}

describeProfile('stroke API performance profile', () => {
  it('should profile: rank the current stroke hot-path helper costs', () => {
    const openSine = buildOpenSinePoints()
    const simpleStar = buildSimpleStarPoints()
    const openTopology = buildPathTopologyModel({
      pathId: 'profile:open-sine',
      sourceId: 'profile:open-sine',
      networkId: 'open-sine',
      sourceFamily: 'vector',
      points: openSine,
      closed: false
    })
    const starTopology = buildPathTopologyModel({
      pathId: 'profile:simple-star',
      sourceId: 'profile:simple-star',
      networkId: 'simple-star',
      sourceFamily: 'vector',
      points: simpleStar,
      closed: true
    })
    const starIntervalFrames = starTopology.normalizedPoints.map((point) => ({
      x: point.x,
      y: point.y,
      widthLeft: 0,
      widthRight: 0
    }))
    const [visibleInterval] = allocateDashedIntervalsForTopology(
      starTopology,
      [18, 10],
      0
    ).filter((interval) => interval.kind === 'visible')
    const renderPackets = buildConstrainedDashedStrokeResolvedPackets(
      'profile:render:dashed',
      starTopology.normalizedPoints,
      starTopology.closed,
      [insideDashedStroke],
      { topology: starTopology }
    )
    const renderEntries = renderPackets.map((packet) => ({
      cacheKey: packet.geometry.geometryId,
      polygons: packet.geometry.polygons,
      stroke: packet.paint,
      debugMeta: packet.geometry.debugMeta
    }))
    const renderHost = new Container()
    renderSolidCenterStrokeEntries(renderHost, renderEntries)
    const centerDashedPackets = buildDashedCenterStrokeResolvedPackets(
      'profile:star:center-dashed',
      starTopology.normalizedPoints,
      starTopology.closed,
      [centerDashedStroke],
      { topology: starTopology }
    )
    const solidCenterPackets = buildSolidCenterStrokeResolvedPackets(
      'profile:star:center-solid',
      starTopology.normalizedPoints,
      starTopology.closed,
      [centerSolidStroke],
      { topology: starTopology }
    )
    const constrainedSolidPackets = buildConstrainedSolidStrokeResolvedPackets(
      'profile:star:constrained-solid',
      starTopology.normalizedPoints,
      starTopology.closed,
      [insideSolidStroke],
      { topology: starTopology }
    )
    const overlapCandidates =
      buildCenterDashedOverlapCandidatesFromResolvedPackets(centerDashedPackets)
    const overlapGraph = buildCenterDashedOverlapGraph(overlapCandidates)
    const overlapComponents = extractCenterDashedOverlapComponents(overlapGraph)
    expect(overlapComponents.length).toBeGreaterThan(0)
    const legalityDomain = buildConstrainedSolidLegalityDomain(
      starTopology.normalizedPoints,
      starTopology.closed,
      'inside'
    )
    const baseRevisionSet = buildStrokeRuntimeRevisionSet({
      points: starTopology.normalizedPoints,
      closed: starTopology.closed,
      stroke: getRenderableStrokes([insideDashedStroke])[0],
      geometryFamily: 'constrained-dashed',
      resolutionStatus: 'exact-constrained',
      runtimeStatus: 'candidate',
      ownerKey: 'profile:owner',
      networkId: 'profile:network',
      strokeId: 'stroke:0',
      intervalSignature: 'profile:intervals',
      sourceTopology: starTopology.topologyFamily,
      intervalTopology: 'single-edge'
    })
    const paintRevisionSet = buildStrokeRuntimeRevisionSet({
      points: starTopology.normalizedPoints,
      closed: starTopology.closed,
      stroke: {
        ...getRenderableStrokes([insideDashedStroke])[0],
        color: 0xff0000
      },
      geometryFamily: 'constrained-dashed',
      resolutionStatus: 'exact-constrained',
      runtimeStatus: 'candidate',
      ownerKey: 'profile:owner',
      networkId: 'profile:network',
      strokeId: 'stroke:0',
      intervalSignature: 'profile:intervals',
      sourceTopology: starTopology.topologyFamily,
      intervalTopology: 'single-edge'
    })
    const graphicsHost: Record<string, unknown> = {}

    const results = [
      measure(
        'getRenderableStrokes(3 strokes)',
        3000,
        () =>
          getRenderableStrokes([
            insideDashedStroke,
            insideSolidStroke,
            centerDashedStroke
          ]).length
      ),
      measure('getStrokeHitWidth(3 strokes)', 3000, () =>
        getStrokeHitWidth([
          insideDashedStroke,
          insideSolidStroke,
          centerDashedStroke
        ])
      ),
      measure('solid core vector math batch', 5000, () => {
        const a = openSine[0]
        const b = openSine[1]
        const delta = subtract(b, a)
        const normalized = normalize(delta)
        const left = perpendicularLeft(a, b)
        const mixed = add(scale(delta, 0.5), normalized ?? { x: 0, y: 0 })
        return (
          distance(a, b) + mixed.x + mixed.y + (left?.x ?? 0) + (left?.y ?? 0)
        )
      }),
      measure('dedupe/normalize/polygonArea(simple star)', 2500, () =>
        polygonArea(dedupeClosed(normalizeClosed(dedupeAdjacent(simpleStar))))
      ),
      measure('isSimpleOpenPath(open 72 points)', 1000, () =>
        isSimpleOpenPath(openSine) ? 1 : 0
      ),
      measure('isSimpleClosedPolygon(star)', 1000, () =>
        isSimpleClosedPolygon(simpleStar) ? 1 : 0
      ),
      measure('createOffsetSegment(line)', 5000, () => {
        const segment = createOffsetSegment(openSine[0], openSine[1], 3)
        return segment ? segment.start.x + segment.end.y : 0
      }),
      measure(
        'buildOffsetSegments(open 72 points)',
        1000,
        () => buildOffsetSegments(openSine, false, 3).length
      ),
      measure(
        'offsetPath(star)',
        1000,
        () =>
          offsetPath(simpleStar, true, 3, {
            join: 'round',
            miterLimit: 4,
            width: 6
          }).length
      ),
      measure(
        'extendForCap(open sine)',
        1500,
        () =>
          extendForCap(openSine, {
            cap: 'square',
            width: 6
          }).length
      ),
      measure(
        'buildPolylineGeometryModelPath(open 72 points)',
        1000,
        () => buildPolylineGeometryModelPath(openSine, false).segments.length
      ),
      measure(
        'buildEllipseLoop(180x120)',
        1000,
        () => buildEllipseLoop(180, 120).length
      ),
      measure(
        'buildPathTopologyModel(open 72 points)',
        1000,
        () =>
          buildPathTopologyModel({
            pathId: 'profile:open-sine',
            sourceId: 'profile:open-sine',
            networkId: 'open-sine',
            sourceFamily: 'vector',
            points: openSine,
            closed: false
          }).normalizedPoints.length
      ),
      measure(
        'buildPathTopologyModel(closed 10-point star)',
        1000,
        () =>
          buildPathTopologyModel({
            pathId: 'profile:simple-star',
            sourceId: 'profile:simple-star',
            networkId: 'simple-star',
            sourceFamily: 'vector',
            points: simpleStar,
            closed: true
          }).normalizedPoints.length
      ),
      measure('classifyPathTopologyModel(star)', 3000, () =>
        classifyPathTopologyModel(starTopology) === 'sampled-simple-closed'
          ? 1
          : 0
      ),
      measure(
        'classifyCompoundClosedLegalDomains(single star)',
        1000,
        () => classifyCompoundClosedLegalDomains([starTopology]).length
      ),
      measure('isPointInsideTopologyPolygon(star)', 3000, () =>
        isPointInsideTopologyPolygon(
          { x: 90, y: 90 },
          starTopology.normalizedPoints
        )
          ? 1
          : 0
      ),
      measure(
        'allocateDashedCenterStrokeIntervals(open)',
        1500,
        () =>
          allocateDashedCenterStrokeIntervals(
            openTopology.totalLength,
            [18, 10],
            0,
            openTopology.closed
          ).length
      ),
      measure(
        'allocateDashedIntervalsForTopology(star)',
        1500,
        () =>
          allocateDashedIntervalsForTopology(starTopology, [18, 10], 0).length
      ),
      measure('sliceStrokeIntervalFrames(first star dash)', 1500, () =>
        visibleInterval
          ? sliceStrokeIntervalFrames(
              starIntervalFrames,
              starTopology.closed,
              visibleInterval.startDistance,
              visibleInterval.endDistance,
              visibleInterval.wrapsSeam
            ).length
          : 0
      ),
      measure('supportsDashedCenterStroke(renderable)', 5000, () =>
        supportsDashedCenterStroke(
          getRenderableStrokes([centerDashedStroke])[0]
        )
          ? 1
          : 0
      ),
      measure(
        'buildSolidCenterStrokePolygons(star)',
        800,
        () =>
          buildSolidCenterStrokePolygons(
            starTopology.normalizedPoints,
            starTopology.closed,
            {
              style: 'solid',
              position: 'center',
              width: 6,
              join: 'round',
              miterLimit: 4,
              cap: 'round'
            }
          ).length
      ),
      measure(
        'buildSolidCenterStrokeResolvedPackets(star)',
        600,
        () =>
          buildSolidCenterStrokeResolvedPackets(
            'profile:star:center-solid',
            starTopology.normalizedPoints,
            starTopology.closed,
            [centerSolidStroke],
            { topology: starTopology }
          ).length
      ),
      measure(
        'buildDashedCenterStrokeResolvedPackets(star)',
        300,
        () =>
          buildDashedCenterStrokeResolvedPackets(
            'profile:star:center-dashed',
            starTopology.normalizedPoints,
            starTopology.closed,
            [centerDashedStroke],
            { topology: starTopology }
          ).length
      ),
      measure(
        'buildConstrainedSolidStrokePolygons(star)',
        600,
        () =>
          buildConstrainedSolidStrokePolygons(
            starTopology.normalizedPoints,
            starTopology.closed,
            {
              style: 'solid',
              position: 'inside',
              width: 6,
              join: 'round',
              miterLimit: 4,
              cap: 'round'
            }
          ).length
      ),
      measure('hasConstrainedSolidStrokeIntent', 5000, () =>
        hasConstrainedSolidStrokeIntent([insideSolidStroke]) ? 1 : 0
      ),
      measure(
        'buildConstrainedSolidStrokeResolvedPackets(star)',
        600,
        () =>
          buildConstrainedSolidStrokeResolvedPackets(
            'profile:star:solid',
            starTopology.normalizedPoints,
            starTopology.closed,
            [insideSolidStroke],
            { topology: starTopology }
          ).length
      ),
      measure('hasConstrainedDashedStrokeIntent', 5000, () =>
        hasConstrainedDashedStrokeIntent([insideDashedStroke]) ? 1 : 0
      ),
      measure('supportsConstrainedDashedStroke(renderable)', 5000, () =>
        supportsConstrainedDashedStroke(
          getRenderableStrokes([insideDashedStroke])[0],
          starTopology.closed
        )
          ? 1
          : 0
      ),
      measure('classifyConstrainedDashedSource(star)', 3000, () =>
        classifyConstrainedDashedSource(
          starTopology.normalizedPoints,
          starTopology.closed,
          starTopology
        ) === 'sampled-simple-closed'
          ? 1
          : 0
      ),
      measure('classifyConstrainedDashedInterval(first visible)', 3000, () =>
        visibleInterval
          ? classifyConstrainedDashedInterval(
              starTopology.normalizedPoints,
              starTopology.closed,
              {
                startDistance: visibleInterval.startDistance,
                endDistance: visibleInterval.endDistance,
                totalLength: starTopology.totalLength,
                wrapsSeam: visibleInterval.wrapsSeam
              },
              getRenderableStrokes([insideDashedStroke])[0],
              { topology: starTopology }
            ).acceptsSingleEdgeRoundCap
            ? 1
            : 0
          : 0
      ),
      measure(
        'buildConstrainedDashedStrokeResolvedPackets(star)',
        300,
        () =>
          buildConstrainedDashedStrokeResolvedPackets(
            'profile:star:dashed',
            starTopology.normalizedPoints,
            starTopology.closed,
            [insideDashedStroke],
            { topology: starTopology }
          ).length
      ),
      measure(
        'buildConstrainedDashedStrokeResolvedPackets(open)',
        300,
        () =>
          buildConstrainedDashedStrokeResolvedPackets(
            'profile:open:dashed',
            openTopology.normalizedPoints,
            openTopology.closed,
            [insideDashedStroke],
            { topology: openTopology }
          ).length
      ),
      measure(
        'classifyConstrainedDashedOwnership(star packets)',
        3000,
        () => classifyConstrainedDashedOwnership(renderPackets).packetCount
      ),
      measure(
        'classifyConstrainedDashedRuntimeStatus(star)',
        3000,
        () =>
          classifyConstrainedDashedRuntimeStatus({
            points: starTopology.normalizedPoints,
            closed: starTopology.closed,
            topology: starTopology,
            candidatePackets: renderPackets
          }).ownership.packetCount
      ),
      measure(
        'buildConstrainedDashedRuntimeDiagnostics',
        3000,
        () =>
          buildConstrainedDashedRuntimeDiagnostics([
            {
              sourceId: 'profile:star',
              networkId: 'profile:network',
              candidatePacketCount: renderPackets.length,
              ...classifyConstrainedDashedRuntimeStatus({
                points: starTopology.normalizedPoints,
                closed: starTopology.closed,
                topology: starTopology,
                candidatePackets: renderPackets
              })
            }
          ]).acceptedCount
      ),
      measure('set/clear constrained dashed diagnostics', 3000, () => {
        setConstrainedDashedRuntimeDiagnostics(graphicsHost, [
          {
            sourceId: 'profile:star',
            networkId: 'profile:network',
            candidatePacketCount: renderPackets.length,
            ...classifyConstrainedDashedRuntimeStatus({
              points: starTopology.normalizedPoints,
              closed: starTopology.closed,
              topology: starTopology,
              candidatePackets: renderPackets
            })
          }
        ])
        clearConstrainedDashedRuntimeDiagnostics(graphicsHost)
        return 1
      }),
      measure(
        'buildConstrainedSolidLegalityDomain(star)',
        1500,
        () =>
          buildConstrainedSolidLegalityDomain(
            starTopology.normalizedPoints,
            starTopology.closed,
            'inside'
          )?.boundaryPolygon.length ?? 0
      ),
      measure('isPointInConstrainedSolidLegalityDomain(star)', 3000, () =>
        legalityDomain &&
        isPointInConstrainedSolidLegalityDomain(legalityDomain, {
          x: 90,
          y: 90
        })
          ? 1
          : 0
      ),
      measure(
        'buildConstrainedSolidLegalityClippingResult(star)',
        200,
        () =>
          buildConstrainedSolidLegalityClippingResult(
            [
              {
                points: starTopology.normalizedPoints,
                closed: starTopology.closed
              }
            ],
            [insideSolidStroke],
            constrainedSolidPackets
          ).packets.length
      ),
      measure(
        'createEmptyConstrainedSolidOwnershipDiagnostics',
        3000,
        () =>
          createEmptyConstrainedSolidOwnershipDiagnostics().candidates.length
      ),
      measure(
        'buildConstrainedSolidOwnershipDiagnostics(star)',
        300,
        () =>
          buildConstrainedSolidOwnershipDiagnostics(constrainedSolidPackets)
            .ownedRegions.length
      ),
      measure(
        'buildConstrainedSolidRuntimeDiagnostics',
        3000,
        () =>
          buildConstrainedSolidRuntimeDiagnostics([
            {
              sourceId: 'profile:star',
              networkId: 'profile:network',
              status: 'accepted',
              reason: 'accepted',
              candidatePacketCount: constrainedSolidPackets.length,
              topologyFamily: starTopology.topologyFamily,
              closed: starTopology.closed
            }
          ]).acceptedCount
      ),
      measure('set/clear constrained solid diagnostics', 3000, () => {
        setConstrainedSolidRuntimeDiagnostics(graphicsHost, [
          {
            sourceId: 'profile:star',
            networkId: 'profile:network',
            status: 'accepted',
            reason: 'accepted',
            candidatePacketCount: constrainedSolidPackets.length,
            topologyFamily: starTopology.topologyFamily,
            closed: starTopology.closed
          }
        ])
        clearConstrainedSolidRuntimeDiagnostics(graphicsHost)
        return 1
      }),
      measure(
        'center dashed overlap candidates',
        1000,
        () =>
          buildCenterDashedOverlapCandidatesFromResolvedPackets(
            centerDashedPackets
          ).length
      ),
      measure('polygonsHavePositiveAreaOverlap(first pair)', 3000, () =>
        centerDashedPackets.length >= 2 &&
        polygonsHavePositiveAreaOverlap(
          centerDashedPackets[0].geometry.polygons[0],
          centerDashedPackets[1].geometry.polygons[0]
        )
          ? 1
          : 0
      ),
      measure(
        'buildCenterDashedOverlapGraph(star)',
        500,
        () => buildCenterDashedOverlapGraph(overlapCandidates).edges.length
      ),
      measure(
        'extractCenterDashedOverlapComponents(star)',
        1000,
        () => extractCenterDashedOverlapComponents(overlapGraph).length
      ),
      measure(
        'resolveCenterDashedOwnershipForComponent(single)',
        1000,
        () =>
          resolveCenterDashedOwnershipForComponent({
            componentId: 'profile:component',
            regions: [
              {
                regionId: 'profile:region',
                polygon: centerDashedPackets[0]?.geometry.polygons[0] ?? [],
                candidates: [
                  {
                    candidateId: 'profile:candidate',
                    intervalId: 'profile:interval',
                    strokeId: 'stroke:0',
                    ownerKey: 'profile:owner',
                    primitiveKind: 'body',
                    normalDistanceToSource: 0,
                    startDistance: 0,
                    authoredVisibleIntervalIndex: 0,
                    stableIntervalId: 'profile:interval',
                    polygons: centerDashedPackets[0]?.geometry.polygons ?? [],
                    continuityPreserving: true,
                    regionInsideTerminalEnvelope: true
                  }
                ]
              }
            ]
          }).ownedRegions.length
      ),
      measure(
        'buildCenterDashedOverlapDiagnostics(star)',
        300,
        () =>
          buildCenterDashedOverlapDiagnosticsFromResolvedPackets(
            centerDashedPackets
          ).components.length
      ),
      measure(
        'normalizeResolvedStrokePacketGeometry',
        3000,
        () => normalizeResolvedStrokePacketGeometry(solidCenterPackets).length
      ),
      measure(
        'attachStrokePacketDebugMeta',
        3000,
        () =>
          attachStrokePacketDebugMeta(solidCenterPackets, {
            runtimeStatus: 'accepted',
            runtimeReason: 'single-owner'
          }).length
      ),
      measure(
        'buildSolidCenterStrokeHitTestPackets',
        3000,
        () => buildSolidCenterStrokeHitTestPackets(solidCenterPackets).length
      ),
      measure(
        'buildSolidCenterStrokeExportPackets',
        3000,
        () => buildSolidCenterStrokeExportPackets(solidCenterPackets).length
      ),
      measure(
        'toSolidCenterStrokeRenderEntries',
        3000,
        () => toSolidCenterStrokeRenderEntries(solidCenterPackets).length
      ),
      measure('applySolidCenterStrokeExportPackets', 3000, () => {
        applySolidCenterStrokeExportPackets(graphicsHost, solidCenterPackets)
        return 1
      }),
      measure('createSolidCenterStrokeHitArea.contains', 3000, () =>
        createSolidCenterStrokeHitArea(solidCenterPackets)?.contains(90, 90)
          ? 1
          : 0
      ),
      measure(
        'renderSolidCenterStrokeEntries(cached second pass)',
        1500,
        () => {
          renderSolidCenterStrokeEntries(renderHost, renderEntries)
          return (
            (
              renderHost as typeof renderHost & {
                __asyraStrokeMeshCache?: Map<string, unknown>
              }
            ).__asyraStrokeMeshCache?.size ?? 0
          )
        }
      ),
      measure(
        'buildStrokeRuntimeRevisionSet',
        3000,
        () =>
          buildStrokeRuntimeRevisionSet({
            points: starTopology.normalizedPoints,
            closed: starTopology.closed,
            stroke: getRenderableStrokes([insideDashedStroke])[0],
            geometryFamily: 'constrained-dashed',
            resolutionStatus: 'exact-constrained',
            runtimeStatus: 'candidate',
            ownerKey: 'profile:owner',
            networkId: 'profile:network',
            strokeId: 'stroke:0',
            intervalSignature: 'profile:intervals',
            sourceTopology: starTopology.topologyFamily,
            intervalTopology: 'single-edge'
          }).sourcePathRevision.toString().length
      ),
      measure(
        'computeStrokeDirtyKeys(paint only)',
        3000,
        () =>
          computeStrokeDirtyKeys(baseRevisionSet, paintRevisionSet).dirtyKeys
            .length
      ),
      measure(
        'updateStrokeRuntimeRevisionSetFromMetadata',
        3000,
        () =>
          updateStrokeRuntimeRevisionSetFromMetadata(baseRevisionSet, {
            ownerKey: 'profile:owner',
            networkId: 'profile:network',
            strokeId: 'stroke:0',
            geometryFamily: 'constrained-dashed',
            resolutionStatus: 'exact-constrained',
            runtimeStatus: 'accepted',
            runtimeReason: 'single-owner',
            sourceTopology: starTopology.topologyFamily,
            intervalTopology: 'single-edge',
            ownershipStatus: 'accepted',
            ownerCount: 1
          })?.ownershipRevision.toString().length ?? 0
      )
    ]

    printProfileResults(results)

    expect(results.every((result) => result.totalMs >= 0)).toBe(true)
    expect(
      results.reduce((sum, result) => sum + result.resultCount, 0)
    ).toBeGreaterThan(0)
  })
})
