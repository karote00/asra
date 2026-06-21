import { writeFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import {
  getSelectedElementRect,
  resetCanvas,
  waitForAppReady
} from './test-utils'

interface Vec2 {
  x: number
  y: number
}

interface VectorTopologyPoint extends Vec2 {
  id: string
  kind: 'anchor' | 'control'
  anchorType?: 'sharp' | 'smooth'
  controlForId?: string
  controlRole?: 'in' | 'out'
}

interface VectorTopologySegment {
  id: string
  startId: string
  endId: string
  outControlId: string | null
  inControlId: string | null
}

interface RuleDrivenVectorFixture {
  points: Record<string, VectorTopologyPoint>
  segments: Record<string, VectorTopologySegment>
  network: {
    id: string
    pointIds: string[]
    segmentIds: string[]
    closed: true
  }
  sourcePath: Vec2[]
  width: number
  height: number
}

interface RasterCapture {
  base64: string
  width: number
  height: number
  elementWidth: number
  elementHeight: number
  padding: number
  offsetX?: number
  offsetY?: number
}

const STROKE_WIDTH = 10
const STROKE_COLOR = '00FF00'
const STROKE_OPACITY = 0.5
const DASH_PATTERN = [27, 20] as const
const PADDING = 32

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await waitForAppReady(page)
  await resetCanvas(page)
  await page.evaluate(() => {
    ;(
      window as typeof window & {
        __ASYRA_STROKE_DIAGNOSTICS_MODE__?: 'full'
      }
    ).__ASYRA_STROKE_DIAGNOSTICS_MODE__ = 'full'
  })
})

const lerpPoint = (a: Vec2, b: Vec2, t: number): Vec2 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t
})

const cubicPoint = (p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number) => {
  const ab = lerpPoint(p0, p1, t)
  const bc = lerpPoint(p1, p2, t)
  const cd = lerpPoint(p2, p3, t)
  const abc = lerpPoint(ab, bc, t)
  const bcd = lerpPoint(bc, cd, t)
  return lerpPoint(abc, bcd, t)
}

const sampleCubic = (p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, steps = 80) => {
  const points: Vec2[] = []
  for (let index = 0; index <= steps; index += 1) {
    points.push(cubicPoint(p0, p1, p2, p3, index / steps))
  }
  return points
}

const buildSourcePath = (
  points: RuleDrivenVectorFixture['points'],
  segments: RuleDrivenVectorFixture['segments'],
  segmentIds: string[]
) => {
  const sourcePath: Vec2[] = []
  segmentIds.forEach((segmentId) => {
    const segment = segments[segmentId]
    const start = points[segment.startId]
    const end = points[segment.endId]
    const outControl = segment.outControlId
      ? points[segment.outControlId]
      : undefined
    const inControl = segment.inControlId
      ? points[segment.inControlId]
      : undefined
    const sampled =
      outControl || inControl
        ? sampleCubic(start, outControl ?? start, inControl ?? end, end)
        : [start, end]
    sampled.forEach((point, index) => {
      if (sourcePath.length === 0 || index > 0) {
        sourcePath.push(point)
      }
    })
  })
  return sourcePath
}

const buildSelfIntersectingMixedCurveFixture = (): RuleDrivenVectorFixture => {
  const points: Record<string, VectorTopologyPoint> = {
    top: {
      id: 'top',
      kind: 'anchor',
      x: 360.12094148356584,
      y: 0,
      anchorType: 'sharp'
    },
    lowerLeft: {
      id: 'lowerLeft',
      kind: 'anchor',
      x: 0,
      y: 344.92238636482955,
      anchorType: 'smooth'
    },
    lowerLeftIn: {
      id: 'lowerLeftIn',
      kind: 'control',
      x: 0,
      y: 344.92238636482955,
      controlForId: 'lowerLeft',
      controlRole: 'in'
    },
    lowerLeftOut: {
      id: 'lowerLeftOut',
      kind: 'control',
      x: 78.17096503446606,
      y: 391.8249653855095,
      controlForId: 'lowerLeft',
      controlRole: 'out'
    },
    right: {
      id: 'right',
      kind: 'anchor',
      x: 360.12094148356584,
      y: 145.95389587539378,
      anchorType: 'sharp'
    },
    left: {
      id: 'left',
      kind: 'anchor',
      x: 0,
      y: 15.668954151283657,
      anchorType: 'sharp'
    },
    lowerRight: {
      id: 'lowerRight',
      kind: 'anchor',
      x: 270.59180204238254,
      y: 347.0603956649177,
      anchorType: 'smooth'
    },
    lowerRightIn: {
      id: 'lowerRightIn',
      kind: 'control',
      x: 263.9105229796075,
      y: 364.43172122813246,
      controlForId: 'lowerRight',
      controlRole: 'in'
    },
    lowerRightOut: {
      id: 'lowerRightOut',
      kind: 'control',
      x: 277.27308110515736,
      y: 329.6890701017029,
      controlForId: 'lowerRight',
      controlRole: 'out'
    }
  }
  const segments: Record<string, VectorTopologySegment> = {
    topToLowerLeft: {
      id: 'topToLowerLeft',
      startId: 'top',
      endId: 'lowerLeft',
      outControlId: null,
      inControlId: 'lowerLeftIn'
    },
    lowerLeftToRight: {
      id: 'lowerLeftToRight',
      startId: 'lowerLeft',
      endId: 'right',
      outControlId: 'lowerLeftOut',
      inControlId: null
    },
    rightToLeft: {
      id: 'rightToLeft',
      startId: 'right',
      endId: 'left',
      outControlId: null,
      inControlId: null
    },
    leftToLowerRight: {
      id: 'leftToLowerRight',
      startId: 'left',
      endId: 'lowerRight',
      outControlId: null,
      inControlId: 'lowerRightIn'
    },
    lowerRightToTop: {
      id: 'lowerRightToTop',
      startId: 'lowerRight',
      endId: 'top',
      outControlId: 'lowerRightOut',
      inControlId: null
    }
  }
  const segmentIds = [
    'topToLowerLeft',
    'lowerLeftToRight',
    'rightToLeft',
    'leftToLowerRight',
    'lowerRightToTop'
  ]

  return {
    points,
    segments,
    network: {
      id: 'rule-driven-self-intersecting-network',
      pointIds: ['top', 'lowerLeft', 'right', 'left', 'lowerRight'],
      segmentIds,
      closed: true
    },
    sourcePath: buildSourcePath(points, segments, segmentIds),
    width: 360.12094148356584,
    height: 367.70186652155667
  }
}

const buildTerminalSplitRangeFixture = (): RuleDrivenVectorFixture => {
  const point = (id: string, x: number, y: number): VectorTopologyPoint => ({
    id,
    kind: 'anchor',
    x,
    y,
    anchorType: 'sharp'
  })
  const points: Record<string, VectorTopologyPoint> = {
    a: point('a', 20, 100),
    b: point('b', 340, 100),
    c: point('c', 120, 20),
    d: point('d', 120, 180),
    e: point('e', 240, 20),
    f: point('f', 240, 180)
  }
  const segments: Record<string, VectorTopologySegment> = {
    ab: {
      id: 'ab',
      startId: 'a',
      endId: 'b',
      outControlId: null,
      inControlId: null
    },
    bc: {
      id: 'bc',
      startId: 'b',
      endId: 'c',
      outControlId: null,
      inControlId: null
    },
    cd: {
      id: 'cd',
      startId: 'c',
      endId: 'd',
      outControlId: null,
      inControlId: null
    },
    de: {
      id: 'de',
      startId: 'd',
      endId: 'e',
      outControlId: null,
      inControlId: null
    },
    ef: {
      id: 'ef',
      startId: 'e',
      endId: 'f',
      outControlId: null,
      inControlId: null
    },
    fa: {
      id: 'fa',
      startId: 'f',
      endId: 'a',
      outControlId: null,
      inControlId: null
    }
  }
  const segmentIds = ['ab', 'bc', 'cd', 'de', 'ef', 'fa']

  return {
    points,
    segments,
    network: {
      id: 'terminal-split-range-network',
      pointIds: ['a', 'b', 'c', 'd', 'e', 'f'],
      segmentIds,
      closed: true
    },
    sourcePath: buildSourcePath(points, segments, segmentIds),
    width: 360,
    height: 200
  }
}

const createRuleDrivenVector = async (
  page: Page,
  fixture: RuleDrivenVectorFixture,
  cap: 'butt' | 'square' | 'round',
  options: { includeFill?: boolean } = {}
) => {
  await page.evaluate(
    ({
      cap,
      color,
      dashPattern,
      fixture,
      includeFill,
      opacity,
      strokeWidth
    }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elementApis = (window as any).__AsyraE2E__?.elementApis
      const createdId = elementApis?.createElement?.(
        {
          type: 'vector',
          points: fixture.points,
          segments: fixture.segments,
          networks: {
            [fixture.network.id]: fixture.network
          },
          closed: true
        },
        { undoable: false }
      )
      if (!createdId) {
        throw new Error('Failed to create rule-driven vector fixture')
      }

      elementApis?.changeComputedData?.(
        [createdId],
        {
          x: 220,
          y: 120,
          width: fixture.width,
          height: fixture.height,
          points: fixture.points,
          segments: fixture.segments,
          networks: {
            [fixture.network.id]: fixture.network
          },
          closed: true,
          fills: includeFill
            ? [
                {
                  id: 'rule-driven-fill',
                  kind: 'solid',
                  fillType: 'color',
                  color: '#d5d5d5',
                  opacity: 1,
                  visible: true
                }
              ]
            : [],
          strokes: [
            {
              id: 'rule-driven-inside-dashed-stroke',
              kind: 'solid',
              style: 'dashed',
              position: 'inside',
              width: strokeWidth,
              dashPattern,
              dashOffset: 0,
              fill: null,
              defaultColorFormat: 'hex',
              colorFormat: 'hex',
              color: `#${color}`,
              opacity,
              visible: true,
              gradient: null,
              joinType: 'miter',
              capType: cap,
              miterAngle: 28.96
            }
          ]
        },
        { undoable: false }
      )
      core?.selectElements?.([createdId], { undoable: false })
    },
    {
      cap,
      color: STROKE_COLOR,
      dashPattern: [...DASH_PATTERN],
      fixture,
      includeFill: options.includeFill === true,
      opacity: STROKE_OPACITY,
      strokeWidth: STROKE_WIDTH
    }
  )
  await page.waitForTimeout(240)
}

const captureRuleDrivenRaster = async (
  page: Page,
  fixture: RuleDrivenVectorFixture,
  extraLocalPoints: Vec2[] = []
): Promise<RasterCapture> => {
  const rect = await getSelectedElementRect(page)
  if (!rect) {
    throw new Error('No selected element for raster capture')
  }
  const viewportState = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    return {
      zoom: core?.getSystemProperty?.('zoom') ?? 1,
      viewport: core?.getSystemProperty?.('viewportPosition') ?? { x: 0, y: 0 }
    }
  })
  const extraBounds = extraLocalPoints.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxX: Math.max(bounds.maxX, point.x),
      maxY: Math.max(bounds.maxY, point.y)
    }),
    {
      minX: 0,
      minY: 0,
      maxX: fixture.width,
      maxY: fixture.height
    }
  )
  const offsetX = Math.max(PADDING, Math.ceil(-extraBounds.minX) + PADDING)
  const offsetY = Math.max(PADDING, Math.ceil(-extraBounds.minY) + PADDING)
  const rightExtent = Math.max(fixture.width, extraBounds.maxX) + PADDING
  const bottomExtent = Math.max(fixture.height, extraBounds.maxY) + PADDING
  const clip = {
    x: Math.max(
      0,
      Math.floor(
        rect.x * viewportState.zoom + viewportState.viewport.x - offsetX
      )
    ),
    y: Math.max(
      0,
      Math.floor(
        rect.y * viewportState.zoom + viewportState.viewport.y - offsetY
      )
    ),
    width: Math.max(1, Math.ceil((offsetX + rightExtent) * viewportState.zoom)),
    height: Math.max(
      1,
      Math.ceil((offsetY + bottomExtent) * viewportState.zoom)
    )
  }
  const screenshot = await page.screenshot({ clip })

  return {
    base64: screenshot.toString('base64'),
    width: clip.width,
    height: clip.height,
    elementWidth: Math.ceil(fixture.width * viewportState.zoom),
    elementHeight: Math.ceil(fixture.height * viewportState.zoom),
    padding: PADDING,
    offsetX,
    offsetY
  }
}

const getRuleDrivenPacketSummary = async (page: Page) =>
  page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId =
      core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
    const renderElement = selectedId
      ? core?.deps?.render?.getElementById?.(selectedId)
      : null
    const exportPackets =
      renderElement?.__asyraSolidCenterStrokeExportPackets ?? []
    const getPoints = (value: unknown) =>
      Array.isArray(value)
        ? value.filter(
            (point): point is { x: number; y: number } =>
              Boolean(point) &&
              typeof point === 'object' &&
              typeof (point as { x?: unknown }).x === 'number' &&
              typeof (point as { y?: unknown }).y === 'number'
          )
        : []
    const constrainedPackets = exportPackets.flatMap(
      (packet: {
        debugMeta?: Record<string, unknown>
        geometryId?: unknown
        intervalIds?: unknown
        polygons?: unknown
      }) => {
        const debugMeta = packet.debugMeta ?? {}
        if (
          typeof debugMeta.productSignature !== 'string' ||
          !debugMeta.productSignature.startsWith('constrained-dashed:')
        ) {
          return []
        }
        const intervalIds = Array.isArray(packet.intervalIds)
          ? packet.intervalIds.filter(
              (entry): entry is string => typeof entry === 'string'
            )
          : []
        const polygons = Array.isArray(packet.polygons)
          ? packet.polygons.filter((entry) => Array.isArray(entry))
          : []
        const domainPlanSplitRangeTerminals = Array.isArray(
          debugMeta.domainPlanSplitRangeTerminals
        )
          ? debugMeta.domainPlanSplitRangeTerminals.flatMap((entry) => {
              if (!entry || typeof entry !== 'object') {
                return []
              }
              const record = entry as Record<string, unknown>
              return typeof record.intervalId === 'string' &&
                typeof record.splitRangeId === 'string' &&
                typeof record.splitRangeStartDistance === 'number' &&
                typeof record.splitRangeEndDistance === 'number' &&
                typeof record.terminalRole === 'string' &&
                typeof record.startDistance === 'number' &&
                typeof record.endDistance === 'number'
                ? [
                    {
                      intervalId: record.intervalId,
                      splitRangeId: record.splitRangeId,
                      splitRangeStartDistance: record.splitRangeStartDistance,
                      splitRangeEndDistance: record.splitRangeEndDistance,
                      terminalRole: record.terminalRole,
                      startDistance: record.startDistance,
                      endDistance: record.endDistance,
                      selectedSide:
                        record.selectedSide === 1 || record.selectedSide === -1
                          ? record.selectedSide
                          : debugMeta.domainPlanSelectedSide === 1 ||
                              debugMeta.domainPlanSelectedSide === -1
                            ? debugMeta.domainPlanSelectedSide
                            : null,
                      boundaryPoints: getPoints(record.boundaryPoints).length
                        ? getPoints(record.boundaryPoints)
                        : getPoints(debugMeta.domainPlanBoundaryPoints),
                      boundaryStartDistance:
                        typeof record.boundaryStartDistance === 'number'
                          ? record.boundaryStartDistance
                          : typeof debugMeta.domainPlanBoundaryStartDistance ===
                              'number'
                            ? debugMeta.domainPlanBoundaryStartDistance
                            : null,
                      boundaryEndDistance:
                        typeof record.boundaryEndDistance === 'number'
                          ? record.boundaryEndDistance
                          : typeof debugMeta.domainPlanBoundaryEndDistance ===
                              'number'
                            ? debugMeta.domainPlanBoundaryEndDistance
                            : null,
                      boundaryTotalLength:
                        typeof record.boundaryTotalLength === 'number'
                          ? record.boundaryTotalLength
                          : typeof debugMeta.domainPlanBoundaryTotalLength ===
                              'number'
                            ? debugMeta.domainPlanBoundaryTotalLength
                            : null
                    }
                  ]
                : []
            })
          : []
        return [
          {
            geometryId:
              typeof packet.geometryId === 'string' ? packet.geometryId : null,
            intervalId:
              typeof debugMeta.intervalId === 'string'
                ? debugMeta.intervalId
                : null,
            intervalIds,
            startDistance:
              typeof debugMeta.startDistance === 'number'
                ? debugMeta.startDistance
                : null,
            endDistance:
              typeof debugMeta.endDistance === 'number'
                ? debugMeta.endDistance
                : null,
            domainPlanSplitRangeId:
              typeof debugMeta.domainPlanSplitRangeId === 'string'
                ? debugMeta.domainPlanSplitRangeId
                : null,
            domainPlanSplitRangeStartDistance:
              typeof debugMeta.domainPlanSplitRangeStartDistance === 'number'
                ? debugMeta.domainPlanSplitRangeStartDistance
                : null,
            domainPlanSplitRangeEndDistance:
              typeof debugMeta.domainPlanSplitRangeEndDistance === 'number'
                ? debugMeta.domainPlanSplitRangeEndDistance
                : null,
            domainPlanTerminalRole:
              typeof debugMeta.domainPlanTerminalRole === 'string'
                ? debugMeta.domainPlanTerminalRole
                : null,
            domainPlanSelectedSide:
              debugMeta.domainPlanSelectedSide === 1 ||
              debugMeta.domainPlanSelectedSide === -1
                ? debugMeta.domainPlanSelectedSide
                : null,
            domainPlanBoundaryPoints: getPoints(
              debugMeta.domainPlanBoundaryPoints
            ),
            domainPlanBoundaryStartDistance:
              typeof debugMeta.domainPlanBoundaryStartDistance === 'number'
                ? debugMeta.domainPlanBoundaryStartDistance
                : null,
            domainPlanBoundaryEndDistance:
              typeof debugMeta.domainPlanBoundaryEndDistance === 'number'
                ? debugMeta.domainPlanBoundaryEndDistance
                : null,
            domainPlanBoundaryTotalLength:
              typeof debugMeta.domainPlanBoundaryTotalLength === 'number'
                ? debugMeta.domainPlanBoundaryTotalLength
                : null,
            domainPlanSplitRangeTerminals,
            productFinal: debugMeta.topologyFamily === 'self-intersecting',
            topologyFamily:
              typeof debugMeta.topologyFamily === 'string'
                ? debugMeta.topologyFamily
                : null,
            visualOverlapCollapseStatus:
              typeof debugMeta.visualOverlapCollapseStatus === 'string'
                ? debugMeta.visualOverlapCollapseStatus
                : null,
            productSignature:
              typeof debugMeta.productSignature === 'string'
                ? debugMeta.productSignature
                : null,
            boundaryEvidence: [
              packet.geometryId,
              debugMeta.geometryId,
              debugMeta.sourceContourId,
              debugMeta.sourceContourIds,
              debugMeta.contourId,
              debugMeta.legalDomainId
            ].some((entry) =>
              String(entry ?? '')
                .toLowerCase()
                .match(/boundary|contour-dash|hole-dash/)
            ),
            polygons: polygons.map((polygon) =>
              polygon
                .filter(
                  (point): point is { x: number; y: number } =>
                    Boolean(point) &&
                    typeof point.x === 'number' &&
                    typeof point.y === 'number'
                )
                .map((point) => ({ x: point.x, y: point.y }))
            ),
            polygonCount: polygons.length
          }
        ]
      }
    )
    const intervalIds = [
      ...new Set(
        constrainedPackets.flatMap((packet) => [
          packet.intervalId,
          ...packet.intervalIds
        ])
      )
    ].filter((entry): entry is string => typeof entry === 'string')
    return {
      constrainedPacketCount: constrainedPackets.length,
      intervalIds,
      constrainedPackets
    }
  })

const getPolygonCentroidProbe = (polygon: Vec2[]) => {
  const centroid =
    polygon.length > 0
      ? polygon.reduce(
          (total, point) => ({
            x: total.x + point.x,
            y: total.y + point.y
          }),
          { x: 0, y: 0 }
        )
      : { x: 0, y: 0 }
  return {
    x: centroid.x / Math.max(1, polygon.length),
    y: centroid.y / Math.max(1, polygon.length)
  }
}

const getPointSegmentDistance = (point: Vec2, start: Vec2, end: Vec2) => {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared <= 1e-6) {
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

const isPointOnPolygonBoundary = (
  point: Vec2,
  polygon: Vec2[],
  tolerance = 0.75
) =>
  polygon.some((vertex, index) => {
    const next = polygon[(index + 1) % polygon.length]
    return Boolean(
      next && getPointSegmentDistance(point, vertex, next) <= tolerance
    )
  })

const isPointInsidePolygon = (point: Vec2, polygon: Vec2[]) => {
  let inside = false
  for (
    let pointIndex = 0, previousIndex = polygon.length - 1;
    pointIndex < polygon.length;
    previousIndex = pointIndex, pointIndex += 1
  ) {
    const current = polygon[pointIndex]
    const previous = polygon[previousIndex]
    if (!current || !previous) continue
    const intersects =
      current.y > point.y !== previous.y > point.y &&
      point.x <
        ((previous.x - current.x) * (point.y - current.y)) /
          (previous.y - current.y) +
          current.x
    if (intersects) inside = !inside
  }
  return inside
}

const buildProductPacketProbes = (
  packetSummary: Awaited<ReturnType<typeof getRuleDrivenPacketSummary>>
) =>
  packetSummary.constrainedPackets
    .flatMap((packet) => packet.polygons)
    .filter((polygon) => polygon.length >= 3)
    .slice(0, 12)
    .map(getPolygonCentroidProbe)

const getSplitBoundaryDomainFailures = (
  packetSummary: Awaited<ReturnType<typeof getRuleDrivenPacketSummary>>,
  splitBoundaryAdjacencyProbes: ReturnType<
    typeof buildSplitBoundaryAdjacencyProbes
  >
) =>
  splitBoundaryAdjacencyProbes.flatMap((probe) =>
    packetSummary.constrainedPackets.flatMap((packet) => {
      if (packet.domainPlanSplitRangeTerminals.length > 0) {
        return []
      }
      const intervalIds = new Set(
        [packet.intervalId, ...packet.intervalIds].filter(
          (entry): entry is string => typeof entry === 'string'
        )
      )
      const ownsBothAdjacentTerminals =
        intervalIds.has(probe.leftIntervalId) &&
        intervalIds.has(probe.rightIntervalId)
      return ownsBothAdjacentTerminals
        ? [
            {
              ...probe,
              geometryId: packet.geometryId,
              intervalIds: [...intervalIds]
            }
          ]
        : []
    })
  )

const getSameSplitRangeGapGeometryHits = (
  packetSummary: Awaited<ReturnType<typeof getRuleDrivenPacketSummary>>,
  fixture: RuleDrivenVectorFixture,
  gapProbes: ReturnType<typeof buildSplitRangeDashDistributionProbes>
) =>
  gapProbes.flatMap((probe) => {
    if (probe.kind !== 'gap') {
      return []
    }
    const candidates = buildStrokeProbesForBoundaryRecord(
      fixture,
      probe,
      probe.distance
    )
    return packetSummary.constrainedPackets.flatMap((packet) => {
      if (packet.domainPlanSplitRangeId !== probe.splitRangeId) {
        return []
      }
      const coveredCandidates = candidates.filter((candidate) =>
        packet.polygons.some(
          (polygon) =>
            isPointInsidePolygon(candidate, polygon) ||
            isPointOnPolygonBoundary(candidate, polygon)
        )
      )
      return coveredCandidates.length > 0
        ? [
            {
              ...probe,
              packetIntervalId: packet.intervalId,
              coveredCandidates
            }
          ]
        : []
    })
  })

const getPolylineLengthTable = (points: Vec2[]) => {
  const cumulative: number[] = [0]
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const current = points[index]
    cumulative.push(
      cumulative[index - 1] +
        Math.hypot(current.x - previous.x, current.y - previous.y)
    )
  }
  return cumulative
}

const getSourcePointAndTangentAtDistance = (
  points: Vec2[],
  distance: number
) => {
  const cumulative = getPolylineLengthTable(points)
  const totalLength = cumulative[cumulative.length - 1] ?? 0
  const clampedDistance = Math.max(0, Math.min(totalLength, distance))
  for (let index = 1; index < points.length; index += 1) {
    const startDistance = cumulative[index - 1]
    const endDistance = cumulative[index]
    if (clampedDistance > endDistance && index < points.length - 1) {
      continue
    }
    const start = points[index - 1]
    const end = points[index]
    const length = Math.max(1e-6, endDistance - startDistance)
    const t = (clampedDistance - startDistance) / length
    const dx = end.x - start.x
    const dy = end.y - start.y
    const tangentLength = Math.max(1e-6, Math.hypot(dx, dy))
    return {
      point: lerpPoint(start, end, t),
      tangent: { x: dx / tangentLength, y: dy / tangentLength }
    }
  }
  return null
}

const buildStrokeProbesForBoundaryRecord = (
  fixture: RuleDrivenVectorFixture,
  record: {
    boundaryPoints?: Vec2[]
    selectedSide?: 1 | -1 | null
  },
  distance: number
) => {
  const path =
    record.boundaryPoints && record.boundaryPoints.length >= 2
      ? record.boundaryPoints
      : fixture.sourcePath
  const sample = getSourcePointAndTangentAtDistance(path, distance)
  if (!sample) {
    return []
  }
  const offsets = [
    Math.max(1, STROKE_WIDTH * 0.25),
    Math.max(1, STROKE_WIDTH * 0.5),
    Math.max(1, STROKE_WIDTH * 0.75)
  ]
  const sides =
    record.selectedSide === 1 || record.selectedSide === -1
      ? [record.selectedSide]
      : [-1, 1]
  return offsets.flatMap((offset) =>
    sides.map((side) => ({
      x: sample.point.x - sample.tangent.y * offset * side,
      y: sample.point.y + sample.tangent.x * offset * side
    }))
  )
}

const buildSplitRangeDashDistributionProbes = (
  packetSummary: Awaited<ReturnType<typeof getRuleDrivenPacketSummary>>
) => {
  const grouped = new Map<
    string,
    {
      intervalId: string
      splitRangeId: string
      terminalRole: string
      startDistance: number
      endDistance: number
      selectedSide: 1 | -1 | null
      boundaryPoints: Vec2[]
    }[]
  >()
  for (const packet of packetSummary.constrainedPackets) {
    for (const terminal of packet.domainPlanSplitRangeTerminals) {
      grouped.set(terminal.splitRangeId, [
        ...(grouped.get(terminal.splitRangeId) ?? []),
        {
          intervalId: terminal.intervalId,
          splitRangeId: terminal.splitRangeId,
          terminalRole: terminal.terminalRole,
          startDistance: terminal.startDistance,
          endDistance: terminal.endDistance,
          selectedSide: terminal.selectedSide,
          boundaryPoints: terminal.boundaryPoints
        }
      ])
    }
  }

  return [...grouped.entries()].flatMap(([splitRangeId, packets]) => {
    const sorted = packets
      .slice()
      .sort((a, b) => (a.startDistance ?? 0) - (b.startDistance ?? 0))
    if (sorted.length < 2) {
      return []
    }

    const dashProbes = sorted.map((packet) => ({
      kind:
        packet.terminalRole === 'middle'
          ? ('middle' as const)
          : ('terminal' as const),
      splitRangeId,
      role: packet.terminalRole,
      distance: (packet.startDistance + packet.endDistance) / 2,
      selectedSide: packet.selectedSide,
      boundaryPoints: packet.boundaryPoints
    }))
    const gapProbes = sorted.slice(0, -1).flatMap((packet, index) => {
      const next = sorted[index + 1]
      const gapLength = next ? next.startDistance - packet.endDistance : 0
      if (!next || gapLength <= 2) {
        return []
      }
      const edgeInset = Math.min(2.5, gapLength / 3)
      return [
        {
          kind: 'gap' as const,
          splitRangeId,
          role: `${packet.terminalRole}-to-${next.terminalRole}`,
          distance: (packet.endDistance + next.startDistance) / 2,
          selectedSide: packet.selectedSide,
          boundaryPoints: packet.boundaryPoints
        },
        {
          kind: 'gap' as const,
          splitRangeId,
          role: `${packet.terminalRole}-to-${next.terminalRole}:after-left-terminal`,
          distance: packet.endDistance + edgeInset,
          selectedSide: packet.selectedSide,
          boundaryPoints: packet.boundaryPoints
        },
        {
          kind: 'gap' as const,
          splitRangeId,
          role: `${packet.terminalRole}-to-${next.terminalRole}:before-right-terminal`,
          distance: next.startDistance - edgeInset,
          selectedSide: next.selectedSide,
          boundaryPoints: next.boundaryPoints
        }
      ]
    })

    return [...dashProbes, ...gapProbes]
  })
}

const buildSplitBoundaryAdjacencyProbes = (
  packetSummary: Awaited<ReturnType<typeof getRuleDrivenPacketSummary>>
) => {
  const terminalEdges = packetSummary.constrainedPackets.flatMap((packet) =>
    packet.domainPlanSplitRangeTerminals.flatMap((terminal) => {
      const points = terminal.boundaryPoints
      if (!points || points.length < 2) {
        return []
      }
      const records: {
        edge: 'start' | 'end'
        intervalId: string
        splitRangeId: string
        point: Vec2
      }[] = []
      if (
        terminal.terminalRole === 'start' ||
        terminal.terminalRole === 'start-end'
      ) {
        records.push({
          edge: 'start',
          intervalId: terminal.intervalId,
          splitRangeId: terminal.splitRangeId,
          point: points[0]
        })
      }
      if (
        terminal.terminalRole === 'end' ||
        terminal.terminalRole === 'start-end'
      ) {
        records.push({
          edge: 'end',
          intervalId: terminal.intervalId,
          splitRangeId: terminal.splitRangeId,
          point: points[points.length - 1]
        })
      }
      return records
    })
  )

  return terminalEdges.flatMap((left) => {
    if (left.edge !== 'end') {
      return []
    }
    return terminalEdges.flatMap((right) => {
      if (right.edge !== 'start' || left.splitRangeId === right.splitRangeId) {
        return []
      }
      const endpointDistance = Math.hypot(
        left.point.x - right.point.x,
        left.point.y - right.point.y
      )
      return endpointDistance <= 1.5
        ? [
            {
              leftIntervalId: left.intervalId,
              rightIntervalId: right.intervalId,
              leftSplitRangeId: left.splitRangeId,
              rightSplitRangeId: right.splitRangeId,
              endpointDistance,
              point: left.point
            }
          ]
        : []
    })
  })
}

const getSplitRangeTerminalContractFailures = (
  packetSummary: Awaited<ReturnType<typeof getRuleDrivenPacketSummary>>
) => {
  const expectedHalfDash = DASH_PATTERN[0] / 2
  const grouped = new Map<
    string,
    {
      terminalRole: string
      startDistance: number
      endDistance: number
      splitRangeStartDistance: number
      splitRangeEndDistance: number
    }[]
  >()
  for (const packet of packetSummary.constrainedPackets) {
    const directRecords =
      packet.domainPlanSplitRangeId &&
      typeof packet.domainPlanSplitRangeStartDistance === 'number' &&
      typeof packet.domainPlanSplitRangeEndDistance === 'number' &&
      typeof packet.startDistance === 'number' &&
      typeof packet.endDistance === 'number' &&
      typeof packet.domainPlanTerminalRole === 'string'
        ? [
            {
              terminalRole: packet.domainPlanTerminalRole,
              startDistance: packet.startDistance,
              endDistance: packet.endDistance,
              splitRangeStartDistance: packet.domainPlanSplitRangeStartDistance,
              splitRangeEndDistance: packet.domainPlanSplitRangeEndDistance
            }
          ]
        : []
    const terminalRecords = packet.domainPlanSplitRangeTerminals.map(
      (terminal) => ({
        splitRangeId: terminal.splitRangeId,
        terminalRole: terminal.terminalRole,
        startDistance: terminal.startDistance,
        endDistance: terminal.endDistance,
        splitRangeStartDistance: terminal.splitRangeStartDistance,
        splitRangeEndDistance: terminal.splitRangeEndDistance
      })
    )
    for (const record of [
      ...directRecords.map((record) => ({
        splitRangeId: packet.domainPlanSplitRangeId ?? '',
        ...record
      })),
      ...terminalRecords
    ]) {
      if (!record.splitRangeId) {
        continue
      }
      grouped.set(record.splitRangeId, [
        ...(grouped.get(record.splitRangeId) ?? []),
        record
      ])
    }
  }

  return [...grouped.entries()].flatMap(([splitRangeId, records]) => {
    const rangeStart = Math.min(
      ...records.map((record) => record.splitRangeStartDistance)
    )
    const rangeEnd = Math.max(
      ...records.map((record) => record.splitRangeEndDistance)
    )
    const rangeLength = rangeEnd - rangeStart
    const uniqueRecords = [
      ...new Map(
        records.map((record) => [
          [
            record.terminalRole,
            record.startDistance,
            record.endDistance,
            record.splitRangeStartDistance,
            record.splitRangeEndDistance
          ].join(':'),
          record
        ])
      ).values()
    ]
    const startTerminal = uniqueRecords.find(
      (record) => record.terminalRole === 'start'
    )
    const endTerminal = uniqueRecords.find(
      (record) => record.terminalRole === 'end'
    )
    const startEndTerminal = uniqueRecords.find(
      (record) => record.terminalRole === 'start-end'
    )
    const failures: string[] = []

    if (startEndTerminal) {
      if (Math.abs(startEndTerminal.startDistance - rangeStart) > 1e-4) {
        failures.push('start-end-terminal-start-mismatch')
      }
      if (Math.abs(startEndTerminal.endDistance - rangeEnd) > 1e-4) {
        failures.push('start-end-terminal-end-mismatch')
      }
    } else {
      if (!startTerminal) {
        failures.push('missing-start-terminal')
      } else {
        if (Math.abs(startTerminal.startDistance - rangeStart) > 1e-4) {
          failures.push('start-terminal-start-mismatch')
        }
        if (
          Math.abs(
            startTerminal.endDistance -
              startTerminal.startDistance -
              expectedHalfDash
          ) > 1e-4
        ) {
          failures.push('start-terminal-not-half-dash')
        }
      }
      if (!endTerminal) {
        failures.push('missing-end-terminal')
      } else {
        if (Math.abs(endTerminal.endDistance - rangeEnd) > 1e-4) {
          failures.push('end-terminal-end-mismatch')
        }
        if (
          Math.abs(
            endTerminal.endDistance -
              endTerminal.startDistance -
              expectedHalfDash
          ) > 1e-4
        ) {
          failures.push('end-terminal-not-half-dash')
        }
      }

      const middleRecords = uniqueRecords.filter(
        (record) => record.terminalRole === 'middle'
      )
      for (const middle of middleRecords) {
        if (
          Math.abs(
            middle.endDistance - middle.startDistance - DASH_PATTERN[0]
          ) > 1e-4
        ) {
          failures.push('middle-dash-not-authored-dash-length')
        }
      }

      const sortedVisible = uniqueRecords
        .slice()
        .sort((left, right) => left.startDistance - right.startDistance)
      const gaps = sortedVisible.slice(0, -1).flatMap((record, index) => {
        const next = sortedVisible[index + 1]
        return next ? [next.startDistance - record.endDistance] : []
      })
      for (const gap of gaps) {
        if (gap < -1e-4) {
          failures.push('visible-intervals-overlap-within-split-range')
        }
      }
      const positiveGaps = gaps.filter((gap) => gap > 1e-4)
      const firstGap = positiveGaps[0]
      if (firstGap !== undefined) {
        for (const gap of positiveGaps) {
          if (Math.abs(gap - firstGap) > 1e-4) {
            failures.push('split-range-gaps-not-evenly-distributed')
            break
          }
        }
      }
    }

    return failures.length > 0
      ? [
          {
            splitRangeId,
            rangeStart,
            rangeEnd,
            rangeLength,
            records: uniqueRecords,
            failures
          }
        ]
      : []
  })
}

const getProbeCoverage = async (
  page: Page,
  raster: RasterCapture,
  probe: Vec2,
  size = 9
) =>
  page.evaluate(
    async ({
      base64,
      probe,
      raster,
      size
    }: {
      base64: string
      probe: Vec2
      raster: RasterCapture
      size: number
    }) => {
      const response = await fetch(`data:image/png;base64,${base64}`)
      const blob = await response.blob()
      const bitmap = await createImageBitmap(blob)
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('Canvas 2D context unavailable')
      }
      context.drawImage(bitmap, 0, 0)
      const startX = Math.max(
        0,
        Math.floor((raster.offsetX ?? raster.padding) + probe.x - size / 2)
      )
      const startY = Math.max(
        0,
        Math.floor((raster.offsetY ?? raster.padding) + probe.y - size / 2)
      )
      const endX = Math.min(canvas.width, Math.ceil(startX + size))
      const endY = Math.min(canvas.height, Math.ceil(startY + size))
      const image = context.getImageData(0, 0, canvas.width, canvas.height).data
      let total = 0
      let green = 0
      for (let y = startY; y < endY; y += 1) {
        for (let x = startX; x < endX; x += 1) {
          const offset = (y * canvas.width + x) * 4
          const r = image[offset]
          const g = image[offset + 1]
          const b = image[offset + 2]
          const a = image[offset + 3]
          total += 1
          if (a > 150 && g > 120 && g > r + 40 && g > b + 40) {
            green += 1
          }
        }
      }
      return total > 0 ? green / total : 0
    },
    {
      base64: raster.base64,
      probe,
      raster,
      size
    }
  )

;(['butt', 'square', 'round'] as const).forEach((cap) => {
  test(`rule: self-intersecting inside dashed ${cap} follows split-range product packets`, async ({
    page
  }) => {
    const fixture = buildSelfIntersectingMixedCurveFixture()
    await createRuleDrivenVector(page, fixture, cap)

    const packetSummary = await getRuleDrivenPacketSummary(page)
    expect(
      packetSummary.constrainedPacketCount,
      JSON.stringify(packetSummary)
    ).toBeGreaterThan(0)
    expect(
      packetSummary.constrainedPackets.every(
        (packet) =>
          packet.productFinal &&
          packet.polygonCount > 0 &&
          !packet.boundaryEvidence &&
          packet.productSignature?.startsWith('constrained-dashed:') === true &&
          packet.intervalId?.startsWith('interval:') === true &&
          packet.domainPlanSplitRangeTerminals.length > 0 &&
          packet.domainPlanSplitRangeTerminals.every(
            (terminal) =>
              terminal.intervalId.startsWith('interval:') &&
              terminal.splitRangeId.startsWith('split-range:') &&
              typeof terminal.startDistance === 'number' &&
              typeof terminal.endDistance === 'number' &&
              terminal.terminalRole !== null
          ) &&
          packet.intervalIds.every((intervalId) =>
            intervalId.startsWith('interval:')
          )
      ),
      JSON.stringify(packetSummary)
    ).toBe(true)
    expect(
      packetSummary.intervalIds.length,
      JSON.stringify(packetSummary)
    ).toBeGreaterThanOrEqual(6)

    const productProbes = buildProductPacketProbes(packetSummary)
    expect(productProbes.length).toBeGreaterThanOrEqual(6)
    const raster = await captureRuleDrivenRaster(page, fixture, productProbes)

    const productCoverages = await Promise.all(
      productProbes.map((probe) => getProbeCoverage(page, raster, probe))
    )

    expect(
      productCoverages.filter((coverage) => coverage >= 0.08).length,
      JSON.stringify({ cap, productProbes, productCoverages })
    ).toBeGreaterThanOrEqual(6)

    const terminalContractFailures =
      getSplitRangeTerminalContractFailures(packetSummary)
    expect(
      terminalContractFailures,
      JSON.stringify({ cap, terminalContractFailures, packetSummary })
    ).toEqual([])

    const dashDistributionProbes =
      buildSplitRangeDashDistributionProbes(packetSummary)
    const terminalProbes = dashDistributionProbes.filter(
      (probe) => probe.kind === 'terminal'
    )
    const visibleDashProbes = dashDistributionProbes.filter(
      (probe) => probe.kind === 'terminal' || probe.kind === 'middle'
    )
    const gapProbes = dashDistributionProbes.filter(
      (probe) => probe.kind === 'gap'
    )
    expect(
      terminalProbes.length,
      JSON.stringify({ cap, dashDistributionProbes, packetSummary })
    ).toBeGreaterThanOrEqual(4)
    expect(
      gapProbes.length,
      JSON.stringify({ cap, dashDistributionProbes, packetSummary })
    ).toBeGreaterThanOrEqual(4)

    const terminalCoverages = await Promise.all(
      visibleDashProbes.map(async (probe) => {
        const candidates = buildStrokeProbesForBoundaryRecord(
          fixture,
          probe,
          probe.distance
        )
        const coverages = await Promise.all(
          candidates.map((candidate) =>
            getProbeCoverage(page, raster, candidate)
          )
        )
        return {
          ...probe,
          coverages,
          maxCoverage: Math.max(0, ...coverages)
        }
      })
    )
    expect(
      terminalCoverages.length,
      JSON.stringify({ cap, visibleDashProbes, terminalCoverages })
    ).toBe(visibleDashProbes.length)
  })
})

test('rule: focused split segment renders terminal half-dashes and adjacent gaps', async ({
  page
}) => {
  const fixture = buildTerminalSplitRangeFixture()
  await createRuleDrivenVector(page, fixture, 'butt', { includeFill: true })

  const packetSummary = await getRuleDrivenPacketSummary(page)
  const raster = await captureRuleDrivenRaster(page, fixture)
  const rasterPath = test.info().outputPath('focused-split-terminal-raster.png')
  await writeFile(rasterPath, Buffer.from(raster.base64, 'base64'))
  await test.info().attach('focused-split-terminal-raster', {
    path: rasterPath,
    contentType: 'image/png'
  })
  const dashDistributionProbes =
    buildSplitRangeDashDistributionProbes(packetSummary)
  const terminalContractFailures =
    getSplitRangeTerminalContractFailures(packetSummary)
  expect(
    terminalContractFailures,
    JSON.stringify({ terminalContractFailures, packetSummary })
  ).toEqual([])
  const firstSegmentProbes = dashDistributionProbes.filter(
    (probe) =>
      probe.splitRangeId === 'split-range:0' ||
      probe.splitRangeId === 'split-range:1' ||
      probe.splitRangeId === 'split-range:2'
  )
  const terminalProbes = firstSegmentProbes.filter(
    (probe) => probe.kind === 'terminal'
  )
  const visibleDashProbes = firstSegmentProbes.filter(
    (probe) => probe.kind === 'terminal' || probe.kind === 'middle'
  )
  const gapProbes = firstSegmentProbes.filter((probe) => probe.kind === 'gap')
  const splitBoundaryAdjacencyProbes =
    buildSplitBoundaryAdjacencyProbes(packetSummary)
  expect(
    terminalProbes.length,
    JSON.stringify({ dashDistributionProbes, packetSummary })
  ).toBeGreaterThanOrEqual(4)
  expect(
    gapProbes.length,
    JSON.stringify({ dashDistributionProbes, packetSummary })
  ).toBeGreaterThanOrEqual(4)
  expect(
    splitBoundaryAdjacencyProbes.length,
    JSON.stringify({ splitBoundaryAdjacencyProbes, packetSummary })
  ).toBeGreaterThanOrEqual(2)

  const terminalCoverages = await Promise.all(
    visibleDashProbes.map(async (probe) => {
      const candidates = buildStrokeProbesForBoundaryRecord(
        fixture,
        probe,
        probe.distance
      )
      const coverages = await Promise.all(
        candidates.map((candidate) => getProbeCoverage(page, raster, candidate))
      )
      return {
        ...probe,
        maxCoverage: Math.max(0, ...coverages),
        coverages,
        candidates
      }
    })
  )
  const splitBoundaryDomainFailures = getSplitBoundaryDomainFailures(
    packetSummary,
    splitBoundaryAdjacencyProbes
  )
  const sameSplitRangeGapGeometryHits = getSameSplitRangeGapGeometryHits(
    packetSummary,
    fixture,
    gapProbes
  )
  const gapCoverages = await Promise.all(
    gapProbes
      .filter((probe) => !probe.role.includes(':'))
      .map(async (probe) => {
        const candidates = buildStrokeProbesForBoundaryRecord(
          fixture,
          probe,
          probe.distance
        )
        const coverages = await Promise.all(
          candidates.map((candidate) =>
            getProbeCoverage(page, raster, candidate)
          )
        )
        return {
          ...probe,
          maxCoverage: Math.max(0, ...coverages),
          coverages
        }
      })
  )
  expect(
    terminalCoverages.length,
    JSON.stringify({
      terminalCoverages,
      visibleDashProbes,
      splitRange2Packets: packetSummary.constrainedPackets.filter((packet) =>
        packet.domainPlanSplitRangeTerminals.some(
          (terminal) =>
            terminal.splitRangeId === 'split-range:2' &&
            terminal.terminalRole === 'end'
        )
      )
    })
  ).toBe(visibleDashProbes.length)
  expect(
    splitBoundaryDomainFailures,
    JSON.stringify({ splitBoundaryDomainFailures })
  ).toEqual([])
  expect(
    sameSplitRangeGapGeometryHits,
    JSON.stringify({ sameSplitRangeGapGeometryHits })
  ).toEqual([])
  expect(gapCoverages.length, JSON.stringify({ gapCoverages })).toBe(
    gapProbes.filter((probe) => !probe.role.includes(':')).length
  )
})
