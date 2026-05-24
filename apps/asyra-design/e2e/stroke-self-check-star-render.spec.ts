import { expect, test, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { resetCanvas, waitForAppReady } from './test-utils'

const REPO_ROOT = path.resolve(process.cwd(), '../..')
const ARTIFACT_DIR = path.join(
  REPO_ROOT,
  'docs/ai/apps/asyra-design/plans/stroke-engine-final/artifacts'
)
const SCREENSHOT_PATH = path.join(
  ARTIFACT_DIR,
  'self-check-inside-dashed-round-fill.png'
)
const METADATA_PATH = path.join(
  ARTIFACT_DIR,
  'self-check-inside-dashed-round-fill.json'
)
const ANALYSIS_PATH = path.join(
  ARTIFACT_DIR,
  'self-check-inside-dashed-round-fill-analysis.json'
)
const NO_FILL_SCREENSHOT_PATH = path.join(
  ARTIFACT_DIR,
  'self-check-inside-dashed-round-no-fill.png'
)
const NO_FILL_METADATA_PATH = path.join(
  ARTIFACT_DIR,
  'self-check-inside-dashed-round-no-fill.json'
)
const NO_FILL_ANALYSIS_PATH = path.join(
  ARTIFACT_DIR,
  'self-check-inside-dashed-round-no-fill-analysis.json'
)

type SelfCheckCapType = 'butt' | 'square' | 'round'
type SelfCheckJoinType = 'miter' | 'bevel' | 'round'
type SelfCheckStrokePosition = 'inside' | 'outside'

const getSelfCheckArtifactPaths = (
  capType: SelfCheckCapType,
  variant: 'fill' | 'no-fill',
  position: SelfCheckStrokePosition = 'inside'
) => ({
  screenshot: path.join(
    ARTIFACT_DIR,
    `self-check-${position}-dashed-${capType}-${variant}.png`
  ),
  metadata: path.join(
    ARTIFACT_DIR,
    `self-check-${position}-dashed-${capType}-${variant}.json`
  ),
  analysis: path.join(
    ARTIFACT_DIR,
    `self-check-${position}-dashed-${capType}-${variant}-analysis.json`
  )
})

interface Vec2 {
  x: number
  y: number
}

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

const SELF_CHECK_SOURCE_POINTS: Record<string, Vec2> = {
  'tp-12': { x: 188.1928217922337, y: 0 },
  'tp-13': { x: 11.358174406717296, y: 365.76797704068724 },
  'tp-12:out': { x: 164.3673966581619, y: 140.91988215887423 },
  'tp-13:in': { x: -42.09205809548172, y: 344.92238636482955 },
  'tp-13:out': { x: 78.17096503446606, y: 391.8249653855095 },
  'tp-14': { x: 360.12094148356584, y: 145.95389587539378 },
  'tp-15': { x: 0, y: 15.668954151283657 },
  'tp-16': { x: 270.59180204238254, y: 347.0603956649177 },
  'tp-15:out': { x: 0, y: 15.668954151283657 },
  'tp-16:in': { x: 263.9105229796075, y: 364.43172122813246 },
  'tp-16:out': { x: 277.27308110515736, y: 329.6890701017029 }
}

const SELF_CHECK_VECTOR_RECT = {
  x: 177.70582329255865,
  y: 121.88648201811688,
  width: 360.12094148356584,
  height: 367.70186652155667
} as const

const SELF_CHECK_SOURCE_SEGMENTS = [
  {
    startId: 'tp-12',
    endId: 'tp-13',
    outControlId: 'tp-12:out',
    inControlId: 'tp-13:in'
  },
  {
    startId: 'tp-13',
    endId: 'tp-14',
    outControlId: 'tp-13:out',
    inControlId: null
  },
  {
    startId: 'tp-14',
    endId: 'tp-15',
    outControlId: null,
    inControlId: null
  },
  {
    startId: 'tp-15',
    endId: 'tp-16',
    outControlId: 'tp-15:out',
    inControlId: 'tp-16:in'
  },
  {
    startId: 'tp-16',
    endId: 'tp-12',
    outControlId: 'tp-16:out',
    inControlId: null
  }
] as const

const SELF_CHECK_SOURCE_ANCHOR_POINTS = SELF_CHECK_SOURCE_SEGMENTS.map(
  (segment) => SELF_CHECK_SOURCE_POINTS[segment.startId]
)

const getSelfCheckSegmentPoint = (
  segment: (typeof SELF_CHECK_SOURCE_SEGMENTS)[number],
  key: 'startId' | 'endId' | 'outControlId' | 'inControlId'
) => {
  const pointId = segment[key]
  return pointId ? SELF_CHECK_SOURCE_POINTS[pointId] : undefined
}

const getSelfCheckSegmentStartTangent = (
  segment: (typeof SELF_CHECK_SOURCE_SEGMENTS)[number]
) => {
  const start = getSelfCheckSegmentPoint(segment, 'startId') as Vec2
  const end = getSelfCheckSegmentPoint(segment, 'endId') as Vec2
  const control = getSelfCheckSegmentPoint(segment, 'outControlId') ?? end
  const tangent = { x: control.x - start.x, y: control.y - start.y }
  return Math.hypot(tangent.x, tangent.y) > 1e-6
    ? tangent
    : { x: end.x - start.x, y: end.y - start.y }
}

const getSelfCheckSegmentEndTangent = (
  segment: (typeof SELF_CHECK_SOURCE_SEGMENTS)[number]
) => {
  const start = getSelfCheckSegmentPoint(segment, 'startId') as Vec2
  const end = getSelfCheckSegmentPoint(segment, 'endId') as Vec2
  const control = getSelfCheckSegmentPoint(segment, 'inControlId') ?? start
  const tangent = { x: end.x - control.x, y: end.y - control.y }
  return Math.hypot(tangent.x, tangent.y) > 1e-6
    ? tangent
    : { x: end.x - start.x, y: end.y - start.y }
}

const SELF_CHECK_SMOOTH_CONTINUITY_ANCHOR_POINTS =
  SELF_CHECK_SOURCE_SEGMENTS.flatMap((segment, segmentIndex) => {
    const nextSegment =
      SELF_CHECK_SOURCE_SEGMENTS[
        (segmentIndex + 1) % SELF_CHECK_SOURCE_SEGMENTS.length
      ]
    if (segment.endId !== nextSegment.startId) {
      return []
    }
    const previousTangent = getSelfCheckSegmentEndTangent(segment)
    const nextTangent = getSelfCheckSegmentStartTangent(nextSegment)
    const previousLength = Math.hypot(previousTangent.x, previousTangent.y)
    const nextLength = Math.hypot(nextTangent.x, nextTangent.y)
    if (previousLength <= 1e-6 || nextLength <= 1e-6) {
      return []
    }
    const cross =
      previousTangent.x * nextTangent.y - previousTangent.y * nextTangent.x
    const dot =
      previousTangent.x * nextTangent.x + previousTangent.y * nextTangent.y
    const normalizedCross = Math.abs(cross) / (previousLength * nextLength)
    return normalizedCross <= 1e-3 && dot > 0
      ? [SELF_CHECK_SOURCE_POINTS[segment.endId]]
      : []
  })

const SELF_CHECK_SOURCE_PATH: Vec2[] = SELF_CHECK_SOURCE_SEGMENTS.flatMap(
  (segment, segmentIndex) => {
    const start = SELF_CHECK_SOURCE_POINTS[segment.startId]
    const end = SELF_CHECK_SOURCE_POINTS[segment.endId]
    const outControl = segment.outControlId
      ? SELF_CHECK_SOURCE_POINTS[segment.outControlId]
      : undefined
    const inControl = segment.inControlId
      ? SELF_CHECK_SOURCE_POINTS[segment.inControlId]
      : undefined
    const sampled =
      outControl || inControl
        ? Array.from({ length: 513 }, (_, index) =>
            cubicPoint(
              start,
              outControl ?? start,
              inControl ?? end,
              end,
              index / 512
            )
          )
        : [start, end]
    return segmentIndex === 0 ? sampled : sampled.slice(1)
  }
)

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await waitForAppReady(page)
  await resetCanvas(page)
  await page.setViewportSize({ width: 1400, height: 1100 })
})

const createSelfCheckStar = async (
  page: Page,
  options: {
    includeStroke?: boolean
    includeFill?: boolean
    capType?: SelfCheckCapType
    joinType?: SelfCheckJoinType
    position?: SelfCheckStrokePosition
  } = {}
) => {
  await page.evaluate(
    ({ capType, includeFill, includeStroke, joinType, position, rect }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elementApis = (window as any).__AsyraE2E__?.elementApis

      if (!core || !elementApis) {
        throw new Error('Missing E2E core or element APIs')
      }

      const points = {
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
          y: 140.91988215887423,
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
      }
      const networks = {
        'tn-4': {
          id: 'tn-4',
          pointIds: ['tp-12', 'tp-13', 'tp-14', 'tp-15', 'tp-16'],
          segmentIds: ['ts-23', 'ts-24', 'ts-25', 'ts-26', 'ts-27'],
          closed: true
        }
      }
      const createdId = elementApis.createElement(
        { type: 'vector', points, segments, networks, closed: true },
        { undoable: false }
      )

      if (!createdId) {
        throw new Error('Failed to create stroke self-check star')
      }

      elementApis.changeComputedData(
        [createdId],
        {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          points,
          segments,
          networks,
          closed: true,
          fills:
            includeFill === false
              ? []
              : [
                  {
                    id: 'self-check-fill',
                    kind: 'solid',
                    fillType: 'color',
                    color: '#d5d5d5',
                    opacity: 1,
                    visible: true
                  }
                ],
          strokes:
            includeStroke === false
              ? []
              : [
                  {
                    id: `self-check-${position}-dashed-${capType}-${joinType}`,
                    kind: 'solid',
                    style: 'dashed',
                    position,
                    width: 10,
                    dashPattern: [27, 20],
                    dashOffset: 0,
                    fill: null,
                    defaultColorFormat: 'hex',
                    colorFormat: 'hex',
                    color: '#df0606',
                    opacity: 0.5,
                    visible: true,
                    gradient: null,
                    joinType,
                    capType,
                    miterAngle: 28.96
                  }
                ]
        },
        { undoable: false }
      )

      core.selectElements([createdId], { undoable: false })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).__selfCheckVectorId = createdId
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).__selfCheckVectorRect = { ...rect }
      core.setSystemProperty('zoom', 1.55)
      core.setSystemProperty('viewportPosition', { x: 145, y: 75 })
      core.setSystemProperty('pathEditingVectorId', createdId)
      core.setSystemProperty('pathEditingMode', true)
      core.setSystemProperty('strokeDebugDisableVisualOverlapCollapse', false)
    },
    {
      capType: options.capType ?? 'round',
      includeFill: options.includeFill,
      includeStroke: options.includeStroke,
      joinType: options.joinType ?? 'miter',
      position: options.position ?? 'inside',
      rect: SELF_CHECK_VECTOR_RECT
    }
  )
}

const getSelfCheckMetadata = async (page: Page) =>
  page.evaluate((selfCheckRect) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId =
      core?.deps?.selection?.getElementSelectionIds?.()?.[0] ??
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__selfCheckVectorId ??
      null
    const element = selectedId
      ? core?.deps?.sceneTree?.getElementById?.(selectedId)
      : null
    const renderElement = selectedId
      ? core?.deps?.render?.getElementById?.(selectedId)
      : null
    const computed = element?.getAllComputedData?.() ?? null
    const exportPackets =
      renderElement?.__asyraSolidCenterStrokeExportPackets ?? []
    const meshCache = renderElement?.__asyraStrokeMeshCache ?? null
    const zoom = core?.getSystemProperty?.('zoom') ?? 1
    const viewport = core?.getSystemProperty?.('viewportPosition') ?? {
      x: 0,
      y: 0
    }
    const getStringArray = (value: unknown) =>
      Array.isArray(value)
        ? value.filter((entry): entry is string => typeof entry === 'string')
        : []
    const getPolygons = (value: unknown) =>
      Array.isArray(value)
        ? value.filter(
            (polygon): polygon is { x: number; y: number }[] =>
              Array.isArray(polygon) &&
              polygon.every(
                (point) =>
                  point &&
                  typeof point === 'object' &&
                  typeof (point as { x?: unknown }).x === 'number' &&
                  typeof (point as { y?: unknown }).y === 'number'
              )
          )
        : []
    const getPoints = (value: unknown) =>
      Array.isArray(value)
        ? value.filter(
            (point): point is { x: number; y: number } =>
              point &&
              typeof point === 'object' &&
              typeof (point as { x?: unknown }).x === 'number' &&
              typeof (point as { y?: unknown }).y === 'number'
          )
        : []
    const boundaryDomainPackets = exportPackets.map(
      (packet: {
        bounds?: unknown
        debugMeta?: {
          intervalId?: unknown
          startDistance?: unknown
          endDistance?: unknown
          sourceTopology?: unknown
          finalCoverageBuilderStatus?: unknown
          visualOverlapCollapseStatus?: unknown
          strokePosition?: unknown
          figmaLikeSplitRangeId?: unknown
          figmaLikeSplitRangeStartDistance?: unknown
          figmaLikeSplitRangeEndDistance?: unknown
          figmaLikeSplitRangeSourceSegmentIndex?: unknown
          figmaLikeTerminalRole?: unknown
          figmaLikeSelectedSide?: unknown
          figmaLikeFilledSide?: unknown
          figmaLikeUnfilledSide?: unknown
          figmaLikeBoundaryRole?: unknown
          figmaLikeBoundaryPoints?: unknown
          figmaLikeBoundaryStartDistance?: unknown
          figmaLikeBoundaryEndDistance?: unknown
          figmaLikeBoundaryTotalLength?: unknown
          figmaLikeSplitRangeTerminals?: unknown
        }
        geometryId?: unknown
        intervalIds?: unknown
        polygons?: unknown
      }) => {
        const intervalIds = getStringArray(packet.intervalIds)
        const polygons = getPolygons(packet.polygons)
        return {
          geometryId:
            typeof packet.geometryId === 'string' ? packet.geometryId : null,
          intervalIds,
          debugIntervalId:
            typeof packet.debugMeta?.intervalId === 'string'
              ? packet.debugMeta.intervalId
              : null,
          startDistance:
            typeof packet.debugMeta?.startDistance === 'number'
              ? packet.debugMeta.startDistance
              : null,
          endDistance:
            typeof packet.debugMeta?.endDistance === 'number'
              ? packet.debugMeta.endDistance
              : null,
          sourceTopology: packet.debugMeta?.sourceTopology ?? null,
          finalCoverageBuilderStatus:
            packet.debugMeta?.finalCoverageBuilderStatus ?? null,
          visualOverlapCollapseStatus:
            packet.debugMeta?.visualOverlapCollapseStatus ?? null,
          strokePosition:
            packet.debugMeta?.strokePosition === 'inside' ||
            packet.debugMeta?.strokePosition === 'outside' ||
            packet.debugMeta?.strokePosition === 'center'
              ? packet.debugMeta.strokePosition
              : null,
          figmaLikeSplitRangeId:
            typeof packet.debugMeta?.figmaLikeSplitRangeId === 'string'
              ? packet.debugMeta.figmaLikeSplitRangeId
              : null,
          figmaLikeSplitRangeStartDistance:
            typeof packet.debugMeta?.figmaLikeSplitRangeStartDistance ===
            'number'
              ? packet.debugMeta.figmaLikeSplitRangeStartDistance
              : null,
          figmaLikeSplitRangeEndDistance:
            typeof packet.debugMeta?.figmaLikeSplitRangeEndDistance === 'number'
              ? packet.debugMeta.figmaLikeSplitRangeEndDistance
              : null,
          figmaLikeSplitRangeSourceSegmentIndex:
            typeof packet.debugMeta?.figmaLikeSplitRangeSourceSegmentIndex ===
            'number'
              ? packet.debugMeta.figmaLikeSplitRangeSourceSegmentIndex
              : null,
          figmaLikeTerminalRole:
            typeof packet.debugMeta?.figmaLikeTerminalRole === 'string'
              ? packet.debugMeta.figmaLikeTerminalRole
              : null,
          figmaLikeSelectedSide:
            packet.debugMeta?.figmaLikeSelectedSide === 1 ||
            packet.debugMeta?.figmaLikeSelectedSide === -1
              ? packet.debugMeta.figmaLikeSelectedSide
              : null,
          figmaLikeFilledSide:
            packet.debugMeta?.figmaLikeFilledSide === 1 ||
            packet.debugMeta?.figmaLikeFilledSide === -1
              ? packet.debugMeta.figmaLikeFilledSide
              : null,
          figmaLikeUnfilledSide:
            packet.debugMeta?.figmaLikeUnfilledSide === 1 ||
            packet.debugMeta?.figmaLikeUnfilledSide === -1
              ? packet.debugMeta.figmaLikeUnfilledSide
              : null,
          figmaLikeBoundaryRole:
            packet.debugMeta?.figmaLikeBoundaryRole === 'outer' ||
            packet.debugMeta?.figmaLikeBoundaryRole === 'filled-face' ||
            packet.debugMeta?.figmaLikeBoundaryRole === 'hole' ||
            packet.debugMeta?.figmaLikeBoundaryRole === 'ambiguous'
              ? packet.debugMeta.figmaLikeBoundaryRole
              : null,
          figmaLikeBoundaryPoints: getPoints(
            packet.debugMeta?.figmaLikeBoundaryPoints
          ),
          figmaLikeBoundaryStartDistance:
            typeof packet.debugMeta?.figmaLikeBoundaryStartDistance === 'number'
              ? packet.debugMeta.figmaLikeBoundaryStartDistance
              : null,
          figmaLikeBoundaryEndDistance:
            typeof packet.debugMeta?.figmaLikeBoundaryEndDistance === 'number'
              ? packet.debugMeta.figmaLikeBoundaryEndDistance
              : null,
          figmaLikeBoundaryTotalLength:
            typeof packet.debugMeta?.figmaLikeBoundaryTotalLength === 'number'
              ? packet.debugMeta.figmaLikeBoundaryTotalLength
              : null,
          figmaLikeSplitRangeTerminals: Array.isArray(
            packet.debugMeta?.figmaLikeSplitRangeTerminals
          )
            ? packet.debugMeta.figmaLikeSplitRangeTerminals.flatMap((entry) => {
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
                        sourceSegmentIndex:
                          typeof record.sourceSegmentIndex === 'number'
                            ? record.sourceSegmentIndex
                            : typeof packet.debugMeta
                                  ?.figmaLikeSplitRangeSourceSegmentIndex ===
                                'number'
                              ? packet.debugMeta
                                  .figmaLikeSplitRangeSourceSegmentIndex
                              : null,
                        selectedSide:
                          record.selectedSide === 1 ||
                          record.selectedSide === -1
                            ? record.selectedSide
                            : null,
                        filledSide:
                          record.filledSide === 1 || record.filledSide === -1
                            ? record.filledSide
                            : null,
                        unfilledSide:
                          record.unfilledSide === 1 ||
                          record.unfilledSide === -1
                            ? record.unfilledSide
                            : null,
                        boundaryRole:
                          record.boundaryRole === 'outer' ||
                          record.boundaryRole === 'filled-face' ||
                          record.boundaryRole === 'hole' ||
                          record.boundaryRole === 'ambiguous'
                            ? record.boundaryRole
                            : null,
                        boundaryPoints:
                          getPoints(record.boundaryPoints).length > 0
                            ? getPoints(record.boundaryPoints)
                            : getPoints(
                                packet.debugMeta?.figmaLikeBoundaryPoints
                              ),
                        boundaryStartDistance:
                          typeof record.boundaryStartDistance === 'number'
                            ? record.boundaryStartDistance
                            : typeof packet.debugMeta
                                  ?.figmaLikeBoundaryStartDistance === 'number'
                              ? packet.debugMeta.figmaLikeBoundaryStartDistance
                              : null,
                        boundaryEndDistance:
                          typeof record.boundaryEndDistance === 'number'
                            ? record.boundaryEndDistance
                            : typeof packet.debugMeta
                                  ?.figmaLikeBoundaryEndDistance === 'number'
                              ? packet.debugMeta.figmaLikeBoundaryEndDistance
                              : null,
                        boundaryTotalLength:
                          typeof record.boundaryTotalLength === 'number'
                            ? record.boundaryTotalLength
                            : typeof packet.debugMeta
                                  ?.figmaLikeBoundaryTotalLength === 'number'
                              ? packet.debugMeta.figmaLikeBoundaryTotalLength
                              : null
                      }
                    ]
                  : []
              })
            : [],
          polygonCount: polygons.length,
          polygons,
          bounds: packet.bounds ?? null
        }
      }
    )

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fallbackRect = (window as any).__selfCheckVectorRect
    const selectedRect = computed
      ? {
          x: computed.x,
          y: computed.y,
          width: computed.width,
          height: computed.height
        }
      : fallbackRect &&
          typeof fallbackRect.x === 'number' &&
          typeof fallbackRect.y === 'number' &&
          typeof fallbackRect.width === 'number' &&
          typeof fallbackRect.height === 'number'
        ? {
            x: fallbackRect.x,
            y: fallbackRect.y,
            width: fallbackRect.width,
            height: fallbackRect.height
          }
        : { ...selfCheckRect }

    return {
      selectedId,
      hasComputedData: computed !== null,
      selectedRect,
      zoom,
      viewport,
      computedStrokes: computed?.strokes ?? [],
      exportPacketCount: exportPackets.length,
      boundaryDomainIntervalIds: Array.from(
        new Set(
          boundaryDomainPackets.flatMap((packet) => [
            ...packet.intervalIds,
            ...(packet.debugIntervalId ? [packet.debugIntervalId] : [])
          ])
        )
      ),
      boundaryDomainPackets,
      cacheKinds: meshCache ? Object.keys(meshCache) : [],
      screenshotPath:
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/artifacts/self-check-inside-dashed-round-fill.png'
    }
  }, SELF_CHECK_VECTOR_RECT)

const getPolygonEdgeLengths = (polygon: { x: number; y: number }[]) =>
  polygon.map((point, index) => {
    const next = polygon[(index + 1) % polygon.length]
    return Math.hypot(point.x - next.x, point.y - next.y)
  })

const getPointBounds = (points: { x: number; y: number }[]) => ({
  minX: Math.min(...points.map((point) => point.x)),
  minY: Math.min(...points.map((point) => point.y)),
  maxX: Math.max(...points.map((point) => point.x)),
  maxY: Math.max(...points.map((point) => point.y))
})

const getBoundaryDomainPolygonQualityFailures = (
  metadata: Awaited<ReturnType<typeof getSelfCheckMetadata>>
) =>
  metadata.boundaryDomainPackets.flatMap((packet) =>
    packet.polygons.flatMap((polygon) => {
      if (polygon.length < 40) {
        return []
      }

      const edgeLengths = getPolygonEdgeLengths(polygon)
      const sortedEdgeLengths = [...edgeLengths].sort((a, b) => a - b)
      const fifthPercentileEdge =
        sortedEdgeLengths[Math.floor(sortedEdgeLengths.length * 0.05)] ??
        Infinity
      const microEdgeCount = edgeLengths.filter(
        (length) => length < 0.03
      ).length
      if (fifthPercentileEdge >= 0.03 && microEdgeCount < 5) {
        return []
      }

      return [
        {
          geometryId: packet.geometryId,
          intervalId: packet.debugIntervalId,
          splitRangeId: packet.figmaLikeSplitRangeId,
          terminalRole: packet.figmaLikeTerminalRole,
          vertexCount: polygon.length,
          microEdgeCount,
          fifthPercentileEdge: Math.round(fifthPercentileEdge * 1000) / 1000,
          shortestEdge:
            Math.round((sortedEdgeLengths[0] ?? Infinity) * 1000) / 1000
        }
      ]
    })
  )

const getBoundaryDomainOversizedProductFailures = (
  metadata: Awaited<ReturnType<typeof getSelfCheckMetadata>>
) =>
  metadata.boundaryDomainPackets.flatMap((packet) =>
    packet.polygons.flatMap((polygon) => {
      const bounds = getPointBounds(polygon)
      const width = bounds.maxX - bounds.minX
      const height = bounds.maxY - bounds.minY
      const maxDimension = Math.max(width, height)
      const maxAllowedDimension = 80
      return maxDimension > maxAllowedDimension
        ? [
            {
              geometryId: packet.geometryId,
              intervalId: packet.debugIntervalId,
              splitRangeId: packet.figmaLikeSplitRangeId,
              terminalRole: packet.figmaLikeTerminalRole,
              polygonCount: packet.polygonCount,
              maxAllowedDimension,
              bounds
            }
          ]
        : []
    })
  )

const analyzeSelfCheckScreenshots = async (
  page: Page,
  baseline: Buffer,
  actual: Buffer,
  metadata: Awaited<ReturnType<typeof getSelfCheckMetadata>>
) =>
  page.evaluate(
    async ({ baselineDataUrl, actualDataUrl, metadata }) => {
      const loadImage = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image()
          image.onload = () => resolve(image)
          image.onerror = () => reject(new Error(`Failed to decode ${src}`))
          image.src = src
        })
      const [baselineImage, actualImage] = await Promise.all([
        loadImage(baselineDataUrl),
        loadImage(actualDataUrl)
      ])
      const width = actualImage.width
      const height = actualImage.height
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('Missing canvas 2D context for self-check analysis')
      }

      context.drawImage(baselineImage, 0, 0)
      const baselineData = context.getImageData(0, 0, width, height).data
      context.clearRect(0, 0, width, height)
      context.drawImage(actualImage, 0, 0)
      const actualData = context.getImageData(0, 0, width, height).data
      const canvasBounds = {
        left: 240,
        top: 40,
        right: Math.min(width, 1160),
        bottom: Math.min(height, 1065)
      }
      const indexOf = (x: number, y: number) => (y * width + x) * 4
      const isInCanvas = (x: number, y: number) =>
        x >= canvasBounds.left &&
        x < canvasBounds.right &&
        y >= canvasBounds.top &&
        y < canvasBounds.bottom
      const isLegalFillPixel = (x: number, y: number) => {
        if (!isInCanvas(x, y)) return false
        const index = indexOf(x, y)
        const r = baselineData[index]
        const g = baselineData[index + 1]
        const b = baselineData[index + 2]
        const a = baselineData[index + 3]
        return (
          a > 180 &&
          r > 145 &&
          g > 145 &&
          b > 145 &&
          Math.abs(r - g) < 45 &&
          Math.abs(g - b) < 45
        )
      }
      const isNearLegalFill = (x: number, y: number) => {
        for (let offsetY = -2; offsetY <= 2; offsetY += 1) {
          for (let offsetX = -2; offsetX <= 2; offsetX += 1) {
            if (isLegalFillPixel(x + offsetX, y + offsetY)) {
              return true
            }
          }
        }
        return false
      }
      const isDeepLegalFill = (x: number, y: number) => {
        for (let offsetY = -6; offsetY <= 6; offsetY += 1) {
          for (let offsetX = -6; offsetX <= 6; offsetX += 1) {
            if (!isLegalFillPixel(x + offsetX, y + offsetY)) {
              return false
            }
          }
        }
        return true
      }
      const isRedStrokePixel = (x: number, y: number) => {
        if (!isInCanvas(x, y)) return false
        const index = indexOf(x, y)
        const r = actualData[index]
        const g = actualData[index + 1]
        const b = actualData[index + 2]
        const a = actualData[index + 3]
        return a > 140 && r > 80 && r > g * 1.45 && r > b * 1.45
      }
      const isDarkOverdrawStrokePixel = (x: number, y: number) => {
        if (!isRedStrokePixel(x, y) || !isNearLegalFill(x, y)) {
          return false
        }
        const index = indexOf(x, y)
        const r = actualData[index]
        const g = actualData[index + 1]
        const b = actualData[index + 2]
        return r > 150 && g < 88 && b < 88
      }
      const outside = new Uint8Array(width * height)
      const strictInside = new Uint8Array(width * height)
      const strictOutside = new Uint8Array(width * height)
      const darkOverdraw = new Uint8Array(width * height)
      let redPixelCount = 0
      let legalRedPixelCount = 0
      let outsideRedPixelCount = 0
      let strictLegalRedPixelCount = 0
      let strictOutsideRedPixelCount = 0
      let darkOverdrawPixelCount = 0
      for (let y = canvasBounds.top; y < canvasBounds.bottom; y += 1) {
        for (let x = canvasBounds.left; x < canvasBounds.right; x += 1) {
          if (!isRedStrokePixel(x, y)) continue
          redPixelCount += 1
          if (isDeepLegalFill(x, y)) {
            strictInside[y * width + x] = 1
            strictLegalRedPixelCount += 1
          } else {
            strictOutside[y * width + x] = 1
            strictOutsideRedPixelCount += 1
          }
          if (isDarkOverdrawStrokePixel(x, y)) {
            darkOverdraw[y * width + x] = 1
            darkOverdrawPixelCount += 1
          }
          if (isNearLegalFill(x, y)) {
            legalRedPixelCount += 1
            continue
          }
          outside[y * width + x] = 1
          outsideRedPixelCount += 1
        }
      }

      const getComponents = (mask: Uint8Array) => {
        const visited = new Uint8Array(width * height)
        const components: {
          area: number
          minX: number
          minY: number
          maxX: number
          maxY: number
          centerX: number
          centerY: number
        }[] = []
        const queue: number[] = []
        for (let y = canvasBounds.top; y < canvasBounds.bottom; y += 1) {
          for (let x = canvasBounds.left; x < canvasBounds.right; x += 1) {
            const start = y * width + x
            if (mask[start] !== 1 || visited[start] === 1) continue
            visited[start] = 1
            queue.length = 0
            queue.push(start)
            let area = 0
            let minX = x
            let minY = y
            let maxX = x
            let maxY = y
            let sumX = 0
            let sumY = 0
            for (const current of queue) {
              area += 1
              const currentX = current % width
              const currentY = Math.floor(current / width)
              minX = Math.min(minX, currentX)
              minY = Math.min(minY, currentY)
              maxX = Math.max(maxX, currentX)
              maxY = Math.max(maxY, currentY)
              sumX += currentX
              sumY += currentY
              for (let dy = -1; dy <= 1; dy += 1) {
                for (let dx = -1; dx <= 1; dx += 1) {
                  if (dx === 0 && dy === 0) continue
                  const nextX = currentX + dx
                  const nextY = currentY + dy
                  if (!isInCanvas(nextX, nextY)) continue
                  const next = nextY * width + nextX
                  if (mask[next] === 1 && visited[next] !== 1) {
                    visited[next] = 1
                    queue.push(next)
                  }
                }
              }
            }
            components.push({
              area,
              minX,
              minY,
              maxX,
              maxY,
              centerX: sumX / area,
              centerY: sumY / area
            })
          }
        }
        return components
      }
      const componentSummaries = getComponents(outside)
      const strictInsideComponents = getComponents(strictInside)
      const strictOutsideComponents = getComponents(strictOutside)
      const darkOverdrawComponents = getComponents(darkOverdraw)
      const componentAreas = componentSummaries.map(({ area }) => area)
      const strictInsideComponentAreas = strictInsideComponents.map(
        ({ area }) => area
      )
      const strictOutsideComponentAreas = strictOutsideComponents.map(
        ({ area }) => area
      )
      const darkOverdrawComponentAreas = darkOverdrawComponents.map(
        ({ area }) => area
      )
      const relevantComponents = (
        components: typeof strictInsideComponents,
        minArea = 4
      ) =>
        components
          .filter(({ area }) => area >= minArea)
          .sort((a, b) => b.area - a.area)
          .slice(0, 10)

      return {
        width,
        height,
        redPixelCount,
        legalRedPixelCount,
        outsideRedPixelCount,
        strictLegalRedPixelCount,
        strictOutsideRedPixelCount,
        darkOverdrawPixelCount,
        maxDarkOverdrawComponentArea: Math.max(
          0,
          ...darkOverdrawComponentAreas
        ),
        darkOverdrawComponentAreas: darkOverdrawComponentAreas
          .filter((area) => area >= 4)
          .sort((a, b) => b - a)
          .slice(0, 10),
        maxOutsideComponentArea: Math.max(0, ...componentAreas),
        outsideComponentAreas: componentAreas
          .filter((area) => area >= 4)
          .sort((a, b) => b - a)
          .slice(0, 10),
        maxStrictInsideComponentArea: Math.max(
          0,
          ...strictInsideComponentAreas
        ),
        maxStrictOutsideComponentArea: Math.max(
          0,
          ...strictOutsideComponentAreas
        ),
        strictInsideComponentAreas: strictInsideComponentAreas
          .filter((area) => area >= 4)
          .sort((a, b) => b - a)
          .slice(0, 10),
        strictInsideComponents: relevantComponents(strictInsideComponents),
        strictOutsideComponentAreas: strictOutsideComponentAreas
          .filter((area) => area >= 4)
          .sort((a, b) => b - a)
          .slice(0, 10),
        boundaryDomainPacketCount: metadata.boundaryDomainPackets.length
      }
    },
    {
      baselineDataUrl: `data:image/png;base64,${baseline.toString('base64')}`,
      actualDataUrl: `data:image/png;base64,${actual.toString('base64')}`,
      metadata
    }
  )

const analyzeSelfCheckBoundaryDomainOracle = async (
  page: Page,
  actual: Buffer,
  metadata: Awaited<ReturnType<typeof getSelfCheckMetadata>>,
  sourcePath: Vec2[],
  options: {
    capType?: SelfCheckCapType
    strictTerminalAdjacentGap?: boolean
    expectedPosition?: SelfCheckStrokePosition
  } = {}
) =>
  page.evaluate(
    async ({
      actualDataUrl,
      metadata,
      sourcePath,
      sourceAnchorPoints,
      smoothContinuityAnchorPoints,
      capType,
      strictTerminalAdjacentGap,
      expectedPosition
    }) => {
      const loadImage = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image()
          image.onload = () => resolve(image)
          image.onerror = () => reject(new Error(`Failed to decode ${src}`))
          image.src = src
        })
      const actualImage = await loadImage(actualDataUrl)
      const width = actualImage.width
      const height = actualImage.height
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('Missing canvas 2D context for source-path oracle')
      }
      context.drawImage(actualImage, 0, 0)
      const actualData = context.getImageData(0, 0, width, height).data
      const selectedRect = metadata.selectedRect
      if (!selectedRect) {
        throw new Error('Missing selected rect for source-path oracle')
      }

      const insidePolygon = (
        point: { x: number; y: number },
        polygon: { x: number; y: number }[]
      ) => {
        let inside = false
        for (
          let pointIndex = 0, previousIndex = polygon.length - 1;
          pointIndex < polygon.length;
          previousIndex = pointIndex, pointIndex += 1
        ) {
          const current = polygon[pointIndex]
          const previous = polygon[previousIndex]
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
      const pointSegmentDistance = (
        point: { x: number; y: number },
        start: { x: number; y: number },
        end: { x: number; y: number }
      ) => {
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
            ((point.x - start.x) * dx + (point.y - start.y) * dy) /
              lengthSquared
          )
        )
        return Math.hypot(
          point.x - (start.x + dx * t),
          point.y - (start.y + dy * t)
        )
      }
      const onPolygonBoundary = (
        point: { x: number; y: number },
        polygon: { x: number; y: number }[],
        tolerance = 1
      ) =>
        polygon.some(
          (vertex, index) =>
            pointSegmentDistance(
              point,
              vertex,
              polygon[(index + 1) % polygon.length]
            ) <= tolerance
        )
      const packetCoversLocalPoint = (point: { x: number; y: number }) =>
        metadata.boundaryDomainPackets.some((packet) =>
          packet.polygons.some(
            (polygon) =>
              insidePolygon(point, polygon) || onPolygonBoundary(point, polygon)
          )
        )
      const getPacketSplitRangeIds = (packet: {
        figmaLikeSplitRangeId: string | null
        figmaLikeSplitRangeTerminals: { splitRangeId: string }[]
      }) =>
        new Set(
          [
            packet.figmaLikeSplitRangeId,
            ...packet.figmaLikeSplitRangeTerminals.map(
              (terminal) => terminal.splitRangeId
            )
          ].filter((id): id is string => typeof id === 'string')
        )
      const getCoveringSplitRangeIds = (point: { x: number; y: number }) => {
        const ids = new Set<string>()
        for (const packet of metadata.boundaryDomainPackets) {
          const isCovered = packet.polygons.some(
            (polygon) =>
              insidePolygon(point, polygon) || onPolygonBoundary(point, polygon)
          )
          if (!isCovered) continue
          for (const id of getPacketSplitRangeIds(packet)) {
            ids.add(id)
          }
        }
        return ids
      }
      const toScreenPoint = (point: { x: number; y: number }) => ({
        x: Math.round(
          (selectedRect.x + point.x) * metadata.zoom + metadata.viewport.x
        ),
        y: Math.round(
          (selectedRect.y + point.y) * metadata.zoom + metadata.viewport.y
        )
      })
      const isRedStrokePixel = (x: number, y: number) => {
        if (x < 0 || x >= width || y < 0 || y >= height) return false
        const index = (y * width + x) * 4
        const r = actualData[index]
        const g = actualData[index + 1]
        const b = actualData[index + 2]
        const a = actualData[index + 3]
        return a > 120 && r > 90 && r > g * 1.45 && r > b * 1.45
      }
      const countRedPixelsNearLocalPoint = (
        point: { x: number; y: number },
        radius: number
      ) => {
        const screenPoint = toScreenPoint(point)
        let redCount = 0
        for (
          let y = screenPoint.y - radius;
          y <= screenPoint.y + radius;
          y += 1
        ) {
          for (
            let x = screenPoint.x - radius;
            x <= screenPoint.x + radius;
            x += 1
          ) {
            if (
              (x - screenPoint.x) ** 2 + (y - screenPoint.y) ** 2 >
              radius ** 2
            ) {
              continue
            }
            if (isRedStrokePixel(x, y)) {
              redCount += 1
            }
          }
        }
        return redCount
      }
      const getLengthTable = (points: { x: number; y: number }[]) => {
        const cumulative = [0]
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
      const sourceLengthTable = getLengthTable(sourcePath)
      const sourceTotalLength =
        sourceLengthTable[sourceLengthTable.length - 1] ?? 0
      const getPathSample = (
        points: { x: number; y: number }[],
        cumulative: number[],
        distance: number
      ) => {
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
            point: {
              x: start.x + (end.x - start.x) * t,
              y: start.y + (end.y - start.y) * t
            },
            tangent: { x: dx / tangentLength, y: dy / tangentLength }
          }
        }
        return null
      }
      const getRecordPath = (record: {
        boundaryPoints?: { x: number; y: number }[]
      }) => {
        const boundaryPoints = Array.isArray(record.boundaryPoints)
          ? record.boundaryPoints
          : []
        return boundaryPoints.length >= 2 ? boundaryPoints : sourcePath
      }
      const getRecordSample = (
        record: { boundaryPoints?: { x: number; y: number }[] },
        distance: number
      ) => {
        const points = getRecordPath(record)
        return getPathSample(points, getLengthTable(points), distance)
      }
      const countRedNearRecordDistance = (
        record: { boundaryPoints?: { x: number; y: number }[] },
        distance: number,
        selectedSide: 1 | -1 | null,
        radius = 6
      ) => {
        const sample = getRecordSample(record, distance)
        if (!sample) {
          return { maxRedPixels: 0, probes: [] }
        }
        const offsets = [2.5, 5, 7.5]
        const sides =
          selectedSide === 1 || selectedSide === -1 ? [selectedSide] : [-1, 1]
        const probes = offsets.flatMap((offset) =>
          sides.map((side) => {
            const point = {
              x: sample.point.x - sample.tangent.y * offset * side,
              y: sample.point.y + sample.tangent.x * offset * side
            }
            return {
              point,
              redPixelCount: countRedPixelsNearLocalPoint(point, radius)
            }
          })
        )
        return {
          maxRedPixels: Math.max(
            0,
            ...probes.map((probe) => probe.redPixelCount)
          ),
          probes
        }
      }
      const countSameSplitRangeCoverageNearRecordDistance = (
        record: { boundaryPoints?: { x: number; y: number }[] },
        splitRangeId: string,
        distance: number,
        selectedSide: 1 | -1 | null
      ) => {
        const sample = getRecordSample(record, distance)
        if (!sample) {
          return {
            sameSplitRangeCovered: false,
            sameSplitRangeProbes: []
          }
        }
        const offsets = [2.5, 5, 7.5]
        const sides =
          selectedSide === 1 || selectedSide === -1 ? [selectedSide] : [-1, 1]
        const sameSplitRangeProbes = offsets.flatMap((offset) =>
          sides.map((side) => {
            const point = {
              x: sample.point.x - sample.tangent.y * offset * side,
              y: sample.point.y + sample.tangent.x * offset * side
            }
            const coveringSplitRangeIds = getCoveringSplitRangeIds(point)
            return {
              point,
              packetCovered: coveringSplitRangeIds.has(splitRangeId),
              otherSplitRangeCovered: [...coveringSplitRangeIds].some(
                (id) => id !== splitRangeId
              )
            }
          })
        )
        return {
          sameSplitRangeCovered: sameSplitRangeProbes.some(
            (probe) => probe.packetCovered
          ),
          otherSplitRangeCovered: sameSplitRangeProbes.some(
            (probe) => probe.otherSplitRangeCovered
          ),
          sameSplitRangeProbes
        }
      }
      const terminalRecords = metadata.boundaryDomainPackets.flatMap((packet) =>
        packet.figmaLikeSplitRangeTerminals.map((terminal) => ({
          ...terminal,
          boundaryPoints:
            terminal.boundaryPoints && terminal.boundaryPoints.length >= 2
              ? terminal.boundaryPoints
              : packet.figmaLikeBoundaryPoints,
          boundaryStartDistance:
            terminal.boundaryStartDistance ??
            packet.figmaLikeBoundaryStartDistance,
          boundaryEndDistance:
            terminal.boundaryEndDistance ?? packet.figmaLikeBoundaryEndDistance,
          boundaryTotalLength:
            terminal.boundaryTotalLength ?? packet.figmaLikeBoundaryTotalLength,
          packetGeometryId: packet.geometryId
        }))
      )
      const uniqueTerminalRecords = [
        ...new Map(
          terminalRecords.map((terminal) => [
            [
              terminal.intervalId,
              terminal.splitRangeId,
              terminal.terminalRole,
              terminal.startDistance,
              terminal.endDistance
            ].join(':'),
            terminal
          ])
        ).values()
      ]
      const recordsBySplitRange = new Map<
        string,
        typeof uniqueTerminalRecords
      >()
      uniqueTerminalRecords.forEach((record) => {
        recordsBySplitRange.set(record.splitRangeId, [
          ...(recordsBySplitRange.get(record.splitRangeId) ?? []),
          record
        ])
      })
      const splitRangeSideConsistencyFailures = [
        ...recordsBySplitRange.entries()
      ].flatMap(([splitRangeId, records]) => {
        const sides = [
          ...new Set(
            records
              .map((record) => record.selectedSide)
              .filter((side): side is 1 | -1 => side === 1 || side === -1)
          )
        ]
        return sides.length <= 1 ? [] : [{ splitRangeId, sides }]
      })
      const getTerminalBoundaryPoint = (
        record: (typeof uniqueTerminalRecords)[number],
        edge: 'start' | 'end'
      ) => {
        const points = getRecordPath(record)
        if (points.length === 0) return null
        return edge === 'start' ? points[0] : points[points.length - 1]
      }
      const isIntersectionSplitBoundaryTerminal = (
        record: (typeof uniqueTerminalRecords)[number],
        edge: 'start' | 'end'
      ) => {
        const point = getTerminalBoundaryPoint(record, edge)
        if (!point) return false
        const samePointTolerance = 1.5
        const isAuthoredAnchor = sourceAnchorPoints.some(
          (anchor) =>
            Math.hypot(anchor.x - point.x, anchor.y - point.y) <=
            samePointTolerance
        )
        if (isAuthoredAnchor) return false
        return uniqueTerminalRecords.some((candidate) =>
          (['start', 'end'] as const).some((candidateEdge) => {
            if (candidate.splitRangeId === record.splitRangeId) return false
            const candidatePoint = getTerminalBoundaryPoint(
              candidate,
              candidateEdge
            )
            return (
              candidatePoint !== null &&
              Math.hypot(
                candidatePoint.x - point.x,
                candidatePoint.y - point.y
              ) <= samePointTolerance
            )
          })
        )
      }
      const isSmoothContinuityBoundaryPoint = (point: {
        x: number
        y: number
      }) => {
        const samePointTolerance = 1.5
        return smoothContinuityAnchorPoints.some(
          (anchor) =>
            Math.hypot(anchor.x - point.x, anchor.y - point.y) <=
            samePointTolerance
        )
      }
      const isSmoothContinuitySplitRangeEdge = (
        records: typeof uniqueTerminalRecords,
        rangeDistance: number
      ) => {
        const sampleRecord = records[0]
        const sample = sampleRecord
          ? getRecordSample(sampleRecord, rangeDistance)
          : null
        return sample ? isSmoothContinuityBoundaryPoint(sample.point) : false
      }
      const dashPattern = [27, 20]
      const expectedHalfDash = dashPattern[0] / 2
      const distributionFailures = [...recordsBySplitRange.entries()].flatMap(
        ([splitRangeId, records]) => {
          const sorted = records
            .slice()
            .sort((left, right) => left.startDistance - right.startDistance)
          const rangeStart = Math.min(
            ...sorted.map((record) => record.splitRangeStartDistance)
          )
          const rangeEnd = Math.max(
            ...sorted.map((record) => record.splitRangeEndDistance)
          )
          const rangeLength = rangeEnd - rangeStart
          const failures: string[] = []
          if (rangeLength <= dashPattern[0] + 1e-4) {
            const startEnd = sorted.find(
              (record) => record.terminalRole === 'start-end'
            )
            if (!startEnd) failures.push('missing-short-range-start-end')
          } else {
            const start = sorted.find(
              (record) => record.terminalRole === 'start'
            )
            const end = sorted.find((record) => record.terminalRole === 'end')
            const startIsSmoothContinuity = isSmoothContinuitySplitRangeEdge(
              sorted,
              rangeStart
            )
            const endIsSmoothContinuity = isSmoothContinuitySplitRangeEdge(
              sorted,
              rangeEnd
            )
            if (!start && !startIsSmoothContinuity) {
              failures.push('missing-start-terminal')
            } else if (
              start &&
              (Math.abs(start.startDistance - rangeStart) > 1e-4 ||
                Math.abs(
                  start.endDistance - start.startDistance - expectedHalfDash
                ) > 1e-4)
            ) {
              failures.push('start-terminal-not-half-dash')
            }
            if (!end && !endIsSmoothContinuity) {
              failures.push('missing-end-terminal')
            } else if (
              end &&
              (Math.abs(end.endDistance - rangeEnd) > 1e-4 ||
                Math.abs(
                  end.endDistance - end.startDistance - expectedHalfDash
                ) > 1e-4)
            ) {
              failures.push('end-terminal-not-half-dash')
            }
            sorted
              .filter((record) => record.terminalRole === 'middle')
              .forEach((record) => {
                if (
                  Math.abs(
                    record.endDistance - record.startDistance - dashPattern[0]
                  ) > 1e-4
                ) {
                  failures.push('middle-dash-not-authored-dash-length')
                }
              })
            const gaps = sorted.slice(0, -1).flatMap((record, index) => {
              const next = sorted[index + 1]
              return next ? [next.startDistance - record.endDistance] : []
            })
            const positiveGaps = gaps.filter((gap) => gap > 1e-4)
            const firstGap = positiveGaps[0]
            if (firstGap !== undefined) {
              positiveGaps.forEach((gap) => {
                if (Math.abs(gap - firstGap) > 1e-4) {
                  failures.push('split-range-gaps-not-evenly-distributed')
                }
              })
            }
          }
          return failures.length > 0
            ? [
                {
                  splitRangeId,
                  rangeStart,
                  rangeEnd,
                  records: sorted,
                  failures
                }
              ]
            : []
        }
      )
      const terminalProbeResults = uniqueTerminalRecords
        .filter((record) =>
          ['start', 'end', 'start-end'].includes(record.terminalRole)
        )
        .filter(
          (record) =>
            typeof record.boundaryTotalLength !== 'number' ||
            record.boundaryTotalLength >= 4
        )
        .map((record) => {
          const distance = (record.startDistance + record.endDistance) / 2
          return {
            ...record,
            distance,
            ...countRedNearRecordDistance(record, distance, record.selectedSide)
          }
        })
      const oppositeSideProbeResults =
        expectedPosition === 'outside'
          ? uniqueTerminalRecords.map((record) => {
              const distance = (record.startDistance + record.endDistance) / 2
              const oppositeSide =
                record.selectedSide === 1
                  ? (-1 as const)
                  : record.selectedSide === -1
                    ? (1 as const)
                    : null
              return {
                ...record,
                distance,
                ...countRedNearRecordDistance(
                  record,
                  distance,
                  oppositeSide,
                  3
                ),
                ...countSameSplitRangeCoverageNearRecordDistance(
                  record,
                  record.splitRangeId,
                  distance,
                  oppositeSide
                )
              }
            })
          : []
      const terminalBoundaryProbeResults = uniqueTerminalRecords
        .filter((record) =>
          ['start', 'end', 'start-end'].includes(record.terminalRole)
        )
        .filter(
          (record) =>
            typeof record.boundaryTotalLength !== 'number' ||
            record.boundaryTotalLength >= 4
        )
        .flatMap((record) => {
          const intervalLength = record.endDistance - record.startDistance
          const edgeInset = Math.min(2, Math.max(0.5, intervalLength / 4))
          const probeDistances =
            record.terminalRole === 'start-end'
              ? [
                  {
                    edge: 'start',
                    distance: record.startDistance + edgeInset
                  },
                  {
                    edge: 'end',
                    distance: record.endDistance - edgeInset
                  }
                ]
              : record.terminalRole === 'start'
                ? [
                    {
                      edge: 'start',
                      distance: record.startDistance + edgeInset
                    }
                  ]
                : [
                    {
                      edge: 'end',
                      distance: record.endDistance - edgeInset
                    }
                  ]
          return probeDistances.map((probe) => ({
            ...record,
            terminalBoundaryEdge: probe.edge,
            terminalBoundaryDistance: probe.distance,
            intersectionSplitBoundary: isIntersectionSplitBoundaryTerminal(
              record,
              probe.edge
            ),
            ...countSameSplitRangeCoverageNearRecordDistance(
              record,
              record.splitRangeId,
              probe.distance,
              record.selectedSide
            ),
            ...countRedNearRecordDistance(
              record,
              probe.distance,
              record.selectedSide,
              2
            )
          }))
        })
      const pixelProbeTerminalRecords = uniqueTerminalRecords.filter(
        (record) =>
          typeof record.boundaryTotalLength !== 'number' ||
          record.boundaryTotalLength >= 4
      )
      const visibleDashProbeResults = pixelProbeTerminalRecords.map(
        (record) => {
          const distance = (record.startDistance + record.endDistance) / 2
          return {
            ...record,
            distance,
            ...countRedNearRecordDistance(record, distance, record.selectedSide)
          }
        }
      )
      const intervalContinuityProbeResults = pixelProbeTerminalRecords.map(
        (record) => {
          const intervalLength = record.endDistance - record.startDistance
          const isAuthoredPathStart =
            record.terminalRole === 'start' && record.startDistance <= 1e-4
          const isAuthoredPathEnd =
            record.terminalRole === 'end' &&
            record.endDistance >= sourceTotalLength - 1e-4
          const edgeInset = Math.min(
            Math.max(2, Math.min(4, intervalLength / 3)),
            Math.max(0.25, intervalLength * 0.4)
          )
          const probeDistances =
            intervalLength <= edgeInset * 2 + 0.5
              ? [(record.startDistance + record.endDistance) / 2]
              : [
                  record.startDistance + edgeInset,
                  (record.startDistance + record.endDistance) / 2,
                  record.endDistance - edgeInset
                ]
          const probeResults = probeDistances.map((distance) => ({
            distance,
            ...countRedNearRecordDistance(
              record,
              distance,
              record.selectedSide,
              2
            )
          }))
          const redRuns = probeResults.reduce(
            (state, probe) => {
              const covered = probe.maxRedPixels >= 2
              return {
                previousCovered: covered,
                runCount:
                  covered && !state.previousCovered
                    ? state.runCount + 1
                    : state.runCount
              }
            },
            { previousCovered: false, runCount: 0 }
          ).runCount
          return {
            ...record,
            shouldCheckContinuity: !isAuthoredPathStart && !isAuthoredPathEnd,
            probeResults,
            coveredProbeCount: probeResults.filter(
              (probe) => probe.maxRedPixels >= 2
            ).length,
            redRuns
          }
        }
      )
      const terminalAdjacentGapProbeResults = strictTerminalAdjacentGap
        ? [...recordsBySplitRange.entries()].flatMap(
            ([splitRangeId, records]) => {
              const sorted = records
                .slice()
                .sort((left, right) => left.startDistance - right.startDistance)
              return sorted.flatMap((record, index) => {
                const next = sorted[index + 1]
                const gapLength = next
                  ? next.startDistance - record.endDistance
                  : 0
                if (!next || gapLength < 4) {
                  return []
                }
                const selectedSide = record.selectedSide ?? next.selectedSide
                const gapInset = Math.min(2.5, gapLength / 3)
                return [
                  {
                    splitRangeId,
                    probeKind: 'after-terminal-end',
                    afterIntervalId: record.intervalId,
                    beforeIntervalId: next.intervalId,
                    distance: record.endDistance + gapInset,
                    ...countSameSplitRangeCoverageNearRecordDistance(
                      record,
                      splitRangeId,
                      record.endDistance + gapInset,
                      selectedSide
                    ),
                    ...countRedNearRecordDistance(
                      record,
                      record.endDistance + gapInset,
                      selectedSide,
                      2
                    )
                  },
                  {
                    splitRangeId,
                    probeKind: 'before-next-terminal-start',
                    afterIntervalId: record.intervalId,
                    beforeIntervalId: next.intervalId,
                    distance: next.startDistance - gapInset,
                    ...countSameSplitRangeCoverageNearRecordDistance(
                      next,
                      splitRangeId,
                      next.startDistance - gapInset,
                      selectedSide
                    ),
                    ...countRedNearRecordDistance(
                      next,
                      next.startDistance - gapInset,
                      selectedSide,
                      2
                    )
                  }
                ]
              })
            }
          )
        : []
      const rhythmProbeResults = strictTerminalAdjacentGap
        ? [...recordsBySplitRange.entries()].flatMap(
            ([splitRangeId, records]) => {
              const sorted = records
                .slice()
                .sort((left, right) => left.startDistance - right.startDistance)
              if (sorted.length === 0) {
                return []
              }
              const makeProbe = (
                record: (typeof uniqueTerminalRecords)[number],
                distance: number,
                expectedVisible: boolean,
                intervalId: string | null,
                terminalRole: string | null
              ) => {
                const sameRangeCoverage =
                  countSameSplitRangeCoverageNearRecordDistance(
                    record,
                    splitRangeId,
                    distance,
                    null
                  )
                const redCoverage = countRedNearRecordDistance(
                  record,
                  distance,
                  null,
                  2
                )
                const covered =
                  sameRangeCoverage.sameSplitRangeCovered &&
                  redCoverage.maxRedPixels >= 2
                return {
                  splitRangeId,
                  distance,
                  expectedVisible,
                  intervalId,
                  terminalRole,
                  covered,
                  redPixelCount: redCoverage.maxRedPixels,
                  sameRangeCoverage
                }
              }
              const visibleProbes = sorted
                .filter(
                  (record) =>
                    typeof record.boundaryTotalLength !== 'number' ||
                    record.boundaryTotalLength >= 4
                )
                .map((record) =>
                  makeProbe(
                    record,
                    (record.startDistance + record.endDistance) / 2,
                    true,
                    record.intervalId,
                    record.terminalRole
                  )
                )
              return visibleProbes
            }
          )
        : []
      const rhythmProbeFailures = rhythmProbeResults.filter((result) =>
        result.expectedVisible ? !result.covered : result.covered
      )
      const expectedGapProbes: {
        id: string
        point: { x: number; y: number }
      }[] = []
      const requiredSelectedSides = [
        ...new Set(
          terminalProbeResults
            .map((result) => result.selectedSide)
            .filter((side): side is 1 | -1 => side === 1 || side === -1)
        )
      ]
      const coverageResults = requiredSelectedSides.map((side) => {
        const sideTerminalResults = terminalProbeResults.filter(
          (result) => result.selectedSide === side
        )
        return {
          id: `implicit-fill-hole-selected-side-${side}`,
          selectedSide: side,
          minRedPixels: 8,
          packetCovered: sideTerminalResults.length > 0,
          redPixelCount: Math.max(
            0,
            ...sideTerminalResults.map((result) => result.maxRedPixels)
          )
        }
      })
      const gapResults = expectedGapProbes.map((probe) => ({
        ...probe,
        packetCovered: packetCoversLocalPoint(probe.point),
        redPixelCount: countRedPixelsNearLocalPoint(probe.point, 8)
      }))
      const intervalPacketFailures = metadata.boundaryDomainPackets.filter(
        (packet) =>
          packet.polygonCount === 0 ||
          packet.sourceTopology !== 'self-intersecting' ||
          packet.finalCoverageBuilderStatus !== 'product-final' ||
          packet.debugIntervalId?.startsWith('interval:') !== true ||
          packet.intervalIds.some(
            (intervalId) => !intervalId.startsWith('interval:')
          )
      )
      return {
        width,
        height,
        coverageResults,
        gapResults,
        coverageProbeFailures: coverageResults.filter(
          (result) =>
            !result.packetCovered || result.redPixelCount < result.minRedPixels
        ),
        intervalPacketFailureCount: intervalPacketFailures.length,
        intervalPacketFailures: intervalPacketFailures.slice(0, 5),
        terminalProbeFailures: terminalProbeResults.filter(
          (result) => result.maxRedPixels < 8
        ),
        terminalBoundaryProbeFailures: terminalBoundaryProbeResults.filter(
          (result) =>
            result.intersectionSplitBoundary &&
            ((!result.sameSplitRangeCovered &&
              !result.otherSplitRangeCovered) ||
              result.maxRedPixels < 2)
        ),
        visibleDashProbeFailures: visibleDashProbeResults.filter(
          (result) => result.maxRedPixels < 8
        ),
        splitRangeSideConsistencyFailures,
        intervalContinuityFailures: intervalContinuityProbeResults.filter(
          (result) => {
            const requiredCoveredProbeCount = Math.min(
              result.probeResults.length,
              2
            )
            return (
              result.shouldCheckContinuity &&
              (result.coveredProbeCount < requiredCoveredProbeCount ||
                result.redRuns !== 1)
            )
          }
        ),
        distributionFailures,
        terminalProbeResults,
        holeTerminalProbeResults: terminalProbeResults.filter(
          (result) => result.boundaryRole === 'hole'
        ),
        filledFaceTerminalProbeResults: terminalProbeResults.filter(
          (result) => result.boundaryRole === 'filled-face'
        ),
        oppositeSideProbeResults,
        oppositeSideProbeHits: oppositeSideProbeResults.filter(
          (result) => result.sameSplitRangeCovered && result.maxRedPixels >= 8
        ),
        terminalBoundaryProbeResults,
        visibleDashProbeResults,
        intervalContinuityProbeResults,
        terminalAdjacentGapProbeResults,
        terminalAdjacentGapHits: terminalAdjacentGapProbeResults.filter(
          (result) =>
            result.maxRedPixels >= 8 &&
            result.sameSplitRangeCovered &&
            !result.otherSplitRangeCovered
        ),
        rhythmProbeResults,
        rhythmProbeFailures,
        packetCount: metadata.boundaryDomainPackets.length
      }
    },
    {
      actualDataUrl: `data:image/png;base64,${actual.toString('base64')}`,
      metadata,
      sourcePath,
      sourceAnchorPoints: SELF_CHECK_SOURCE_ANCHOR_POINTS,
      smoothContinuityAnchorPoints: SELF_CHECK_SMOOTH_CONTINUITY_ANCHOR_POINTS,
      strictTerminalAdjacentGap: options.strictTerminalAdjacentGap === true,
      capType: options.capType,
      expectedPosition: options.expectedPosition
    }
  )

const compareRightBottomHighCurvatureSmoothTerminalPixels = async (
  page: Page,
  first: Buffer,
  second: Buffer,
  metadata: Awaited<ReturnType<typeof getSelfCheckMetadata>>,
  options: {
    sourceAnchor?: Vec2
    radius?: number
  } = {}
) =>
  page.evaluate(
    async ({ firstDataUrl, secondDataUrl, metadata, options }) => {
      const loadImage = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image()
          image.onload = () => resolve(image)
          image.onerror = () => reject(new Error(`Failed to decode ${src}`))
          image.src = src
        })
      const [firstImage, secondImage] = await Promise.all([
        loadImage(firstDataUrl),
        loadImage(secondDataUrl)
      ])
      const width = firstImage.width
      const height = firstImage.height
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('Missing canvas 2D context for join pixel oracle')
      }

      context.drawImage(firstImage, 0, 0)
      const firstPixels = context.getImageData(0, 0, width, height).data
      context.clearRect(0, 0, width, height)
      context.drawImage(secondImage, 0, 0)
      const secondPixels = context.getImageData(0, 0, width, height).data

      const selectedRect = metadata.selectedRect
      if (!selectedRect) {
        throw new Error('Missing selected rect for join pixel oracle')
      }

      const sourceAnchor =
        options.sourceAnchor ?? { x: 270.59180204238254, y: 347.0603956649177 }
      const screenAnchor = {
        x:
          (selectedRect.x + sourceAnchor.x) * metadata.zoom +
          metadata.viewport.x,
        y:
          (selectedRect.y + sourceAnchor.y) * metadata.zoom +
          metadata.viewport.y
      }
      const radius = options.radius ?? 72
      const isRedStrokePixel = (pixels: Uint8ClampedArray, index: number) => {
        const r = pixels[index]
        const g = pixels[index + 1]
        const b = pixels[index + 2]
        const a = pixels[index + 3]
        return a > 120 && r > 90 && r > g * 1.25 && r > b * 1.25
      }

      let comparedPixelCount = 0
      let changedPixelCount = 0
      let changedRgbaPixelCount = 0
      let totalRgbaDifference = 0
      let firstRedCount = 0
      let secondRedCount = 0
      let fullImageChangedPixelCount = 0
      let fullImageRgbaChangedPixelCount = 0
      const changedBounds = {
        minX: Number.POSITIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY
      }
      const rgbaChangedBounds = {
        minX: Number.POSITIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY
      }
      for (let index = 0; index < firstPixels.length; index += 4) {
        const firstRed = isRedStrokePixel(firstPixels, index)
        const secondRed = isRedStrokePixel(secondPixels, index)
        const rgbaDifference =
          Math.abs(firstPixels[index] - secondPixels[index]) +
          Math.abs(firstPixels[index + 1] - secondPixels[index + 1]) +
          Math.abs(firstPixels[index + 2] - secondPixels[index + 2]) +
          Math.abs(firstPixels[index + 3] - secondPixels[index + 3])
        if (firstRed !== secondRed) {
          const pixelIndex = index / 4
          const x = pixelIndex % width
          const y = Math.floor(pixelIndex / width)
          fullImageChangedPixelCount += 1
          changedBounds.minX = Math.min(changedBounds.minX, x)
          changedBounds.minY = Math.min(changedBounds.minY, y)
          changedBounds.maxX = Math.max(changedBounds.maxX, x)
          changedBounds.maxY = Math.max(changedBounds.maxY, y)
        }
        if (rgbaDifference > 8) {
          const pixelIndex = index / 4
          const x = pixelIndex % width
          const y = Math.floor(pixelIndex / width)
          fullImageRgbaChangedPixelCount += 1
          rgbaChangedBounds.minX = Math.min(rgbaChangedBounds.minX, x)
          rgbaChangedBounds.minY = Math.min(rgbaChangedBounds.minY, y)
          rgbaChangedBounds.maxX = Math.max(rgbaChangedBounds.maxX, x)
          rgbaChangedBounds.maxY = Math.max(rgbaChangedBounds.maxY, y)
        }
      }
      for (
        let y = Math.max(0, Math.floor(screenAnchor.y - radius));
        y <= Math.min(height - 1, Math.ceil(screenAnchor.y + radius));
        y += 1
      ) {
        for (
          let x = Math.max(0, Math.floor(screenAnchor.x - radius));
          x <= Math.min(width - 1, Math.ceil(screenAnchor.x + radius));
          x += 1
        ) {
          if (
            (x - screenAnchor.x) ** 2 + (y - screenAnchor.y) ** 2 >
            radius ** 2
          ) {
            continue
          }
          const index = (y * width + x) * 4
          const firstRed = isRedStrokePixel(firstPixels, index)
          const secondRed = isRedStrokePixel(secondPixels, index)
          const rgbaDifference =
            Math.abs(firstPixels[index] - secondPixels[index]) +
            Math.abs(firstPixels[index + 1] - secondPixels[index + 1]) +
            Math.abs(firstPixels[index + 2] - secondPixels[index + 2]) +
            Math.abs(firstPixels[index + 3] - secondPixels[index + 3])
          comparedPixelCount += 1
          firstRedCount += firstRed ? 1 : 0
          secondRedCount += secondRed ? 1 : 0
          changedPixelCount += firstRed !== secondRed ? 1 : 0
          if (rgbaDifference > 8) {
            changedRgbaPixelCount += 1
            totalRgbaDifference += rgbaDifference
          }
        }
      }

      return {
        comparedPixelCount,
        changedPixelCount,
        changedRgbaPixelCount,
        totalRgbaDifference,
        fullImageChangedPixelCount,
        fullImageRgbaChangedPixelCount,
        changedBounds: fullImageChangedPixelCount > 0 ? changedBounds : null,
        rgbaChangedBounds:
          fullImageRgbaChangedPixelCount > 0 ? rgbaChangedBounds : null,
        firstRedCount,
        secondRedCount,
        screenAnchor
      }
    },
    {
      firstDataUrl: `data:image/png;base64,${first.toString('base64')}`,
      secondDataUrl: `data:image/png;base64,${second.toString('base64')}`,
      metadata,
      options
    }
  )

;(['butt', 'square', 'round'] as const).forEach((capType) => {
  test(`self-check: self-intersecting inside dashed ${capType} final pixels keep split terminals and bounded overdraw`, async ({
    page
  }) => {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true })
    const paths = getSelfCheckArtifactPaths(capType, 'fill')

    await createSelfCheckStar(page, { includeStroke: false, capType })
    await page.waitForFunction(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const selectedId =
        core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
      const element = selectedId
        ? core?.deps?.sceneTree?.getElementById?.(selectedId)
        : null
      const computed = element?.getAllComputedData?.()
      return Boolean(computed?.fills?.length)
    })
    await page.waitForTimeout(300)
    const baselineScreenshot = await page.screenshot({ fullPage: false })

    await resetCanvas(page)
    await createSelfCheckStar(page, { capType })
    await page.waitForFunction(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const selectedId =
        core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
      const element = selectedId
        ? core?.deps?.sceneTree?.getElementById?.(selectedId)
        : null
      const computed = element?.getAllComputedData?.()
      return Boolean(computed?.strokes?.length && computed?.fills?.length)
    })
    await page.waitForTimeout(1000)

    const metadata = await getSelfCheckMetadata(page)
    fs.writeFileSync(paths.metadata, `${JSON.stringify(metadata, null, 2)}\n`)
    const actualScreenshot = await page.screenshot({
      path: paths.screenshot,
      fullPage: false
    })
    const legalAnalysis = await analyzeSelfCheckScreenshots(
      page,
      baselineScreenshot,
      actualScreenshot,
      metadata
    )
    const boundaryDomainAnalysis = await analyzeSelfCheckBoundaryDomainOracle(
      page,
      actualScreenshot,
      metadata,
      SELF_CHECK_SOURCE_PATH,
      {
        capType,
        expectedPosition: 'inside',
        strictTerminalAdjacentGap: capType === 'butt'
      }
    )
    fs.writeFileSync(
      paths.analysis,
      `${JSON.stringify({ legalAnalysis, boundaryDomainAnalysis }, null, 2)}\n`
    )

    expect(metadata.exportPacketCount).toBeGreaterThan(0)
    const insideFilledFaceBoundaryPackets =
      metadata.boundaryDomainPackets.filter(
        (packet) => packet.figmaLikeBoundaryRole === 'filled-face'
      )
    expect(
      insideFilledFaceBoundaryPackets.length,
      JSON.stringify(
        metadata.boundaryDomainPackets.map((packet) => ({
          geometryId: packet.geometryId,
          role: packet.figmaLikeBoundaryRole,
          selectedSide: packet.figmaLikeSelectedSide,
          filledSide: packet.figmaLikeFilledSide,
          unfilledSide: packet.figmaLikeUnfilledSide,
          polygonCount: packet.polygonCount
        })),
        null,
        2
      )
    ).toBeGreaterThan(0)
    expect(
      metadata.boundaryDomainPackets.every((packet) => {
        if (packet.figmaLikeBoundaryRole === 'filled-face') {
          return (
            packet.figmaLikeSelectedSide === packet.figmaLikeFilledSide &&
            packet.figmaLikeSelectedSide !== packet.figmaLikeUnfilledSide
          )
        }
        return (
          packet.figmaLikeBoundaryRole === 'outer' &&
          packet.figmaLikeSelectedSide === packet.figmaLikeFilledSide &&
          packet.figmaLikeSelectedSide !== packet.figmaLikeUnfilledSide
        )
      }),
      JSON.stringify(metadata.boundaryDomainPackets, null, 2)
    ).toBe(true)
    expect(legalAnalysis.redPixelCount).toBeGreaterThan(1000)
    expect(
      legalAnalysis.maxOutsideComponentArea,
      JSON.stringify({ capType, legalAnalysis }, null, 2)
    ).toBeLessThan(32)
    expect(
      legalAnalysis.outsideRedPixelCount,
      JSON.stringify({ capType, legalAnalysis }, null, 2)
    ).toBeLessThan(Math.max(96, legalAnalysis.redPixelCount * 0.02))
    expect(
      legalAnalysis.darkOverdrawPixelCount,
      JSON.stringify({ capType, legalAnalysis }, null, 2)
    ).toBeLessThan(48)
    expect(
      legalAnalysis.maxDarkOverdrawComponentArea,
      JSON.stringify({ capType, legalAnalysis }, null, 2)
    ).toBeLessThan(32)
    expect(
      boundaryDomainAnalysis.distributionFailures,
      JSON.stringify({ capType, boundaryDomainAnalysis }, null, 2)
    ).toEqual([])
    expect(
      boundaryDomainAnalysis.terminalProbeFailures,
      JSON.stringify({ capType, boundaryDomainAnalysis }, null, 2)
    ).toEqual([])
    expect(
      boundaryDomainAnalysis.filledFaceTerminalProbeResults.length,
      JSON.stringify({ capType, boundaryDomainAnalysis }, null, 2)
    ).toBeGreaterThan(0)
    expect(
      boundaryDomainAnalysis.terminalBoundaryProbeFailures,
      JSON.stringify({ capType, boundaryDomainAnalysis }, null, 2)
    ).toEqual([])
    expect(
      boundaryDomainAnalysis.visibleDashProbeFailures,
      JSON.stringify({ capType, boundaryDomainAnalysis }, null, 2)
    ).toEqual([])
    expect(
      boundaryDomainAnalysis.splitRangeSideConsistencyFailures,
      JSON.stringify({ capType, boundaryDomainAnalysis }, null, 2)
    ).toEqual([])
    if (capType === 'butt') {
      expect(
        boundaryDomainAnalysis.rhythmProbeFailures,
        JSON.stringify({ capType, boundaryDomainAnalysis }, null, 2)
      ).toEqual([])
      expect(
        boundaryDomainAnalysis.terminalAdjacentGapHits,
        JSON.stringify({ capType, boundaryDomainAnalysis }, null, 2)
      ).toEqual([])
    }
  })
})
;(['butt', 'square', 'round'] as const).forEach((capType) => {
  test(`self-check: self-intersecting outside dashed ${capType} final pixels keep split terminals and outside side`, async ({
    page
  }) => {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true })
    const paths = getSelfCheckArtifactPaths(capType, 'fill', 'outside')

    await createSelfCheckStar(page, {
      includeStroke: false,
      capType,
      position: 'outside'
    })
    await page.waitForFunction(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const selectedId =
        core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
      const element = selectedId
        ? core?.deps?.sceneTree?.getElementById?.(selectedId)
        : null
      const computed = element?.getAllComputedData?.()
      return Boolean(computed?.fills?.length)
    })
    await page.waitForTimeout(300)
    const baselineScreenshot = await page.screenshot({ fullPage: false })

    await resetCanvas(page)
    await createSelfCheckStar(page, { capType, position: 'outside' })
    await page.waitForFunction(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const selectedId =
        core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
      const element = selectedId
        ? core?.deps?.sceneTree?.getElementById?.(selectedId)
        : null
      const computed = element?.getAllComputedData?.()
      return Boolean(computed?.strokes?.length && computed?.fills?.length)
    })
    await page.waitForTimeout(1000)

    const metadata = await getSelfCheckMetadata(page)
    fs.writeFileSync(paths.metadata, `${JSON.stringify(metadata, null, 2)}\n`)
    const actualScreenshot = await page.screenshot({
      path: paths.screenshot,
      fullPage: false
    })
    const legalAnalysis = await analyzeSelfCheckScreenshots(
      page,
      baselineScreenshot,
      actualScreenshot,
      metadata
    )
    const boundaryDomainAnalysis = await analyzeSelfCheckBoundaryDomainOracle(
      page,
      actualScreenshot,
      metadata,
      SELF_CHECK_SOURCE_PATH,
      {
        strictTerminalAdjacentGap: capType === 'butt',
        expectedPosition: 'outside'
      }
    )
    fs.writeFileSync(
      paths.analysis,
      `${JSON.stringify({ legalAnalysis, boundaryDomainAnalysis }, null, 2)}\n`
    )

    expect(metadata.exportPacketCount).toBeGreaterThan(0)
    const outsideFilledFaceBoundaryPackets =
      metadata.boundaryDomainPackets.filter(
        (packet) => packet.figmaLikeBoundaryRole === 'filled-face'
      )
    expect(
      outsideFilledFaceBoundaryPackets,
      JSON.stringify(
        metadata.boundaryDomainPackets.map((packet) => ({
          geometryId: packet.geometryId,
          role: packet.figmaLikeBoundaryRole,
          selectedSide: packet.figmaLikeSelectedSide,
          filledSide: packet.figmaLikeFilledSide,
          unfilledSide: packet.figmaLikeUnfilledSide,
          polygonCount: packet.polygonCount
        })),
        null,
        2
      )
    ).toEqual([])
    expect(
      metadata.boundaryDomainPackets.every(
        (packet) =>
          packet.strokePosition === 'outside' &&
          packet.polygonCount > 0 &&
          packet.sourceTopology === 'self-intersecting' &&
          packet.finalCoverageBuilderStatus === 'product-final' &&
          packet.debugIntervalId?.startsWith('interval:') === true &&
          packet.intervalIds.every((intervalId) =>
            intervalId.startsWith('interval:')
          ) &&
          packet.figmaLikeSelectedSide === packet.figmaLikeUnfilledSide &&
          packet.figmaLikeSelectedSide !== packet.figmaLikeFilledSide
      ),
      JSON.stringify(metadata.boundaryDomainPackets, null, 2)
    ).toBe(true)
    expect(
      getBoundaryDomainOversizedProductFailures(metadata),
      JSON.stringify(
        getBoundaryDomainOversizedProductFailures(metadata),
        null,
        2
      )
    ).toEqual([])
    expect(
      getBoundaryDomainPolygonQualityFailures(metadata),
      JSON.stringify(
        {
          capType,
          failures: getBoundaryDomainPolygonQualityFailures(metadata)
        },
        null,
        2
      )
    ).toEqual([])
    expect(legalAnalysis.redPixelCount).toBeGreaterThan(1000)
    expect(
      legalAnalysis.maxStrictInsideComponentArea,
      JSON.stringify({ capType, legalAnalysis }, null, 2)
    ).toBeLessThan(48)
    expect(
      legalAnalysis.strictLegalRedPixelCount,
      JSON.stringify({ capType, legalAnalysis }, null, 2)
    ).toBeLessThan(Math.max(120, legalAnalysis.redPixelCount * 0.03))
    expect(
      legalAnalysis.darkOverdrawPixelCount,
      JSON.stringify({ capType, legalAnalysis }, null, 2)
    ).toBe(0)
    expect(
      legalAnalysis.maxDarkOverdrawComponentArea,
      JSON.stringify({ capType, legalAnalysis }, null, 2)
    ).toBe(0)
    expect(
      boundaryDomainAnalysis.distributionFailures,
      JSON.stringify({ capType, boundaryDomainAnalysis }, null, 2)
    ).toEqual([])
    expect(
      boundaryDomainAnalysis.terminalProbeFailures,
      JSON.stringify({ capType, boundaryDomainAnalysis }, null, 2)
    ).toEqual([])
    expect(
      boundaryDomainAnalysis.filledFaceTerminalProbeResults.length,
      JSON.stringify({ capType, boundaryDomainAnalysis }, null, 2)
    ).toBe(0)
    expect(
      boundaryDomainAnalysis.terminalBoundaryProbeFailures,
      JSON.stringify({ capType, boundaryDomainAnalysis }, null, 2)
    ).toEqual([])
    expect(
      boundaryDomainAnalysis.visibleDashProbeFailures,
      JSON.stringify({ capType, boundaryDomainAnalysis }, null, 2)
    ).toEqual([])
    expect(
      boundaryDomainAnalysis.splitRangeSideConsistencyFailures,
      JSON.stringify({ capType, boundaryDomainAnalysis }, null, 2)
    ).toEqual([])
    if (capType === 'butt') {
      expect(
        boundaryDomainAnalysis.terminalAdjacentGapHits,
        JSON.stringify({ capType, boundaryDomainAnalysis }, null, 2)
      ).toEqual([])
      expect(
        boundaryDomainAnalysis.rhythmProbeFailures,
        JSON.stringify({ capType, boundaryDomainAnalysis }, null, 2)
      ).toEqual([])
    }
  })
})

test('self-check: right-bottom high-curvature outside dashed terminal remains cap-owned across join settings', async ({
  page
}) => {
  const screenshots: Partial<Record<SelfCheckJoinType, Buffer>> = {}
  const metadataByJoin: Partial<
    Record<SelfCheckJoinType, Awaited<ReturnType<typeof getSelfCheckMetadata>>>
  > = {}

  for (const joinType of ['miter', 'bevel', 'round'] as const) {
    await resetCanvas(page)
    await createSelfCheckStar(page, {
      capType: 'butt',
      joinType,
      position: 'outside'
    })
    await page.waitForFunction(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const selectedId =
        core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
      const element = selectedId
        ? core?.deps?.sceneTree?.getElementById?.(selectedId)
        : null
      const computed = element?.getAllComputedData?.()
      return Boolean(computed?.strokes?.length && computed?.fills?.length)
    })
    await page.waitForTimeout(800)

    screenshots[joinType] = await page.screenshot({ fullPage: false })
    metadataByJoin[joinType] = await getSelfCheckMetadata(page)
  }

  expect(metadataByJoin.miter).toBeDefined()
  expect(metadataByJoin.bevel).toBeDefined()
  expect(metadataByJoin.round).toBeDefined()
  expect(screenshots.miter).toBeDefined()
  expect(screenshots.bevel).toBeDefined()
  expect(screenshots.round).toBeDefined()

  const boundaryTerminalJoinPackets = Object.entries(metadataByJoin).flatMap(
    ([joinType, joinMetadata]) =>
      (joinMetadata?.boundaryDomainPackets ?? []).flatMap((packet) =>
        packet.geometryId?.includes(':boundary-terminal-join:')
          ? [
              {
                joinType,
                geometryId: packet.geometryId,
                intervalIds: packet.intervalIds,
                terminalRole: packet.figmaLikeTerminalRole
              }
            ]
          : []
      )
  )
  const productTerminalPacketCounts = Object.entries(metadataByJoin).map(
    ([joinType, joinMetadata]) => ({
      joinType,
      count: (joinMetadata?.boundaryDomainPackets ?? []).filter((packet) => {
        const role = packet.figmaLikeTerminalRole
        return (
          packet.strokePosition === 'outside' &&
          packet.finalCoverageBuilderStatus === 'product-final' &&
          (role === 'start' || role === 'end' || role === 'start-end')
        )
      }).length
    })
  )
  const sourceVertexJoinPacketCounts = Object.entries(metadataByJoin).map(
    ([joinType, joinMetadata]) => ({
      joinType,
      count: (joinMetadata?.boundaryDomainPackets ?? []).filter((packet) =>
        packet.geometryId?.includes(':source-vertex-join:')
      ).length
    })
  )

  expect(
    boundaryTerminalJoinPackets,
    JSON.stringify({ boundaryTerminalJoinPackets }, null, 2)
  ).toEqual([])
  expect(
    productTerminalPacketCounts.every(({ count }) => count > 0),
    JSON.stringify({ productTerminalPacketCounts }, null, 2)
  ).toBe(true)
  expect(
    sourceVertexJoinPacketCounts.every(({ count }) => count > 0),
    JSON.stringify({ sourceVertexJoinPacketCounts }, null, 2)
  ).toBe(true)

  const miterVsBevel =
    await compareRightBottomHighCurvatureSmoothTerminalPixels(
      page,
      screenshots.miter as Buffer,
      screenshots.bevel as Buffer,
      metadataByJoin.miter as Awaited<ReturnType<typeof getSelfCheckMetadata>>
    )
  const miterVsRound =
    await compareRightBottomHighCurvatureSmoothTerminalPixels(
      page,
      screenshots.miter as Buffer,
      screenshots.round as Buffer,
      metadataByJoin.miter as Awaited<ReturnType<typeof getSelfCheckMetadata>>
    )
  const bevelVsRound =
    await compareRightBottomHighCurvatureSmoothTerminalPixels(
      page,
      screenshots.bevel as Buffer,
      screenshots.round as Buffer,
      metadataByJoin.bevel as Awaited<ReturnType<typeof getSelfCheckMetadata>>
    )

  expect(
    Math.min(
      miterVsBevel.firstRedCount,
      miterVsBevel.secondRedCount,
      miterVsRound.firstRedCount,
      miterVsRound.secondRedCount,
      bevelVsRound.firstRedCount,
      bevelVsRound.secondRedCount
    ),
    JSON.stringify(
      {
        miterVsBevel,
        miterVsRound,
        bevelVsRound,
        computedStrokes: metadataByJoin.round?.computedStrokes
      },
      null,
      2
    )
  ).toBeGreaterThan(80)

  expect(
    [
      miterVsBevel.changedPixelCount,
      miterVsRound.changedPixelCount,
      bevelVsRound.changedPixelCount,
      miterVsBevel.changedRgbaPixelCount,
      miterVsRound.changedRgbaPixelCount,
      bevelVsRound.changedRgbaPixelCount
    ],
    JSON.stringify(
      {
        message:
          'right-bottom high-curvature boundary split endpoint is terminal/cap geometry, so local coverage must not depend on joinType',
        miterVsBevel,
        miterVsRound,
        bevelVsRound,
        computedStrokes: metadataByJoin.round?.computedStrokes
      },
      null,
      2
    )
  ).toEqual([0, 0, 0, 0, 0, 0])

  const topMiterVsRound =
    await compareRightBottomHighCurvatureSmoothTerminalPixels(
      page,
      screenshots.miter as Buffer,
      screenshots.round as Buffer,
      metadataByJoin.miter as Awaited<ReturnType<typeof getSelfCheckMetadata>>,
      {
        sourceAnchor: SELF_CHECK_SOURCE_POINTS['tp-12'],
        radius: 68
      }
    )
  const topBevelVsRound =
    await compareRightBottomHighCurvatureSmoothTerminalPixels(
      page,
      screenshots.bevel as Buffer,
      screenshots.round as Buffer,
      metadataByJoin.bevel as Awaited<ReturnType<typeof getSelfCheckMetadata>>,
      {
        sourceAnchor: SELF_CHECK_SOURCE_POINTS['tp-12'],
        radius: 68
      }
    )

  expect(
    Math.min(
      topMiterVsRound.changedRgbaPixelCount,
      topBevelVsRound.changedRgbaPixelCount
    ),
    JSON.stringify(
      {
        message:
          'the authored top source vertex must still respond to round join while boundary split terminals stay cap-owned',
        topMiterVsRound,
        topBevelVsRound,
        sourceVertexJoinPacketCounts
      },
      null,
      2
    )
  ).toBeGreaterThan(20)
})

test('self-check: outside dashed star captures Cmd+1 and app-zoom coverage-unit review', async ({
  page
}, testInfo) => {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true })

  await createSelfCheckStar(page, {
    capType: 'square',
    joinType: 'miter',
    position: 'outside'
  })
  await page.waitForFunction(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId =
      core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
    const element = selectedId
      ? core?.deps?.sceneTree?.getElementById?.(selectedId)
      : null
    const computed = element?.getAllComputedData?.()
    return Boolean(computed?.strokes?.length && computed?.fills?.length)
  })
  await page.waitForTimeout(800)

  await page.keyboard.press('Meta+1')
  await page.waitForTimeout(500)
  const globalPath = path.join(
    ARTIFACT_DIR,
    'self-check-outside-dashed-square-cmd1-global-review.png'
  )
  await page.screenshot({ path: globalPath, fullPage: false })
  await testInfo.attach('outside-square-cmd1-global-review', {
    path: globalPath,
    contentType: 'image/png'
  })

  const focusSelfCheckLocalPoint = async (
    point: Vec2,
    zoom: number,
    screenshotPath: string,
    attachmentName: string
  ) => {
    const viewportSize = page.viewportSize()
    if (!viewportSize) {
      throw new Error('Missing viewport size')
    }
    const canvasCenter = {
      x: 240 + (viewportSize.width - 480) / 2,
      y: 48 + (viewportSize.height - 148) / 2
    }
    await page.evaluate(
      ({ canvasCenter, point, rect, zoom }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const core = (window as any).__Core__
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fallbackRect = (window as any).__selfCheckVectorRect
        const targetRect =
          fallbackRect &&
          typeof fallbackRect.x === 'number' &&
          typeof fallbackRect.y === 'number' &&
          typeof fallbackRect.width === 'number' &&
          typeof fallbackRect.height === 'number'
            ? fallbackRect
            : rect
        if (!core) {
          throw new Error('Missing app core')
        }
        core.setSystemProperty('zoom', zoom)
        core.setSystemProperty('viewportPosition', {
          x: canvasCenter.x - (targetRect.x + point.x) * zoom,
          y: canvasCenter.y - (targetRect.y + point.y) * zoom
        })
      },
      { canvasCenter, point, rect: SELF_CHECK_VECTOR_RECT, zoom }
    )
    await page.waitForTimeout(500)
    await page.screenshot({ path: screenshotPath, fullPage: false })
    await testInfo.attach(attachmentName, {
      path: screenshotPath,
      contentType: 'image/png'
    })
  }

  await focusSelfCheckLocalPoint(
    SELF_CHECK_SOURCE_POINTS['tp-12'],
    4.25,
    path.join(
      ARTIFACT_DIR,
      'self-check-outside-dashed-square-top-app-zoom-review.png'
    ),
    'outside-square-top-app-zoom-review'
  )
  await focusSelfCheckLocalPoint(
    SELF_CHECK_SOURCE_POINTS['tp-13'],
    3.35,
    path.join(
      ARTIFACT_DIR,
      'self-check-outside-dashed-square-left-bottom-app-zoom-review.png'
    ),
    'outside-square-left-bottom-app-zoom-review'
  )
  await focusSelfCheckLocalPoint(
    SELF_CHECK_SOURCE_POINTS['tp-16'],
    3.75,
    path.join(
      ARTIFACT_DIR,
      'self-check-outside-dashed-square-right-bottom-app-zoom-review.png'
    ),
    'outside-square-right-bottom-app-zoom-review'
  )

  const metadata = await getSelfCheckMetadata(page)
  const boundaryTerminalJoinPackets = metadata.boundaryDomainPackets.filter(
    (packet) => packet.geometryId?.includes(':boundary-terminal-join:')
  )
  const crossIntervalArrangedPackets = metadata.boundaryDomainPackets.flatMap(
    (packet) => {
      if (packet.visualOverlapCollapseStatus !== 'exact-arrangement') {
        return []
      }
      const intervalIds = [
        ...new Set(
          [...packet.intervalIds, packet.debugIntervalId].filter(Boolean)
        )
      ]
      return intervalIds.length > 1
        ? [
            {
              geometryId: packet.geometryId,
              intervalIds,
              splitRangeId: packet.figmaLikeSplitRangeId,
              terminalRole: packet.figmaLikeTerminalRole
            }
          ]
        : []
    }
  )

  expect(
    boundaryTerminalJoinPackets,
    JSON.stringify({ boundaryTerminalJoinPackets }, null, 2)
  ).toEqual([])
  expect(
    crossIntervalArrangedPackets,
    JSON.stringify({ crossIntervalArrangedPackets }, null, 2)
  ).toEqual([])
})

test('self-check: self-intersecting inside dashed round star satisfies rule-driven split ranges', async ({
  page
}, testInfo) => {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true })

  await createSelfCheckStar(page, { includeStroke: false })
  await page.waitForFunction(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId =
      core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
    const element = selectedId
      ? core?.deps?.sceneTree?.getElementById?.(selectedId)
      : null
    const computed = element?.getAllComputedData?.()
    return Boolean(computed?.fills?.length)
  })
  await page.waitForTimeout(300)
  const baselineScreenshot = await page.screenshot({ fullPage: false })

  await resetCanvas(page)
  await createSelfCheckStar(page)
  await page.waitForFunction(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId =
      core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
    const element = selectedId
      ? core?.deps?.sceneTree?.getElementById?.(selectedId)
      : null
    const computed = element?.getAllComputedData?.()
    return Boolean(computed?.strokes?.length && computed?.fills?.length)
  })
  await page.waitForTimeout(1000)

  const metadata = await getSelfCheckMetadata(page)
  fs.writeFileSync(METADATA_PATH, `${JSON.stringify(metadata, null, 2)}\n`)
  const actualScreenshot = await page.screenshot({
    path: SCREENSHOT_PATH,
    fullPage: false
  })
  const analysis = await analyzeSelfCheckScreenshots(
    page,
    baselineScreenshot,
    actualScreenshot,
    metadata
  )
  fs.writeFileSync(ANALYSIS_PATH, `${JSON.stringify(analysis, null, 2)}\n`)

  const hasAllowedVisualOverlapStatus = (status: unknown) =>
    status === null || status === 'exact-union'

  expect(metadata.exportPacketCount).toBeGreaterThan(0)
  expect(
    metadata.boundaryDomainIntervalIds.length,
    JSON.stringify(metadata, null, 2)
  ).toBeGreaterThan(1)
  expect(
    metadata.boundaryDomainPackets.every((packet) =>
      hasAllowedVisualOverlapStatus(packet.visualOverlapCollapseStatus)
    ),
    JSON.stringify(metadata.boundaryDomainPackets, null, 2)
  ).toBe(true)
  expect(
    metadata.boundaryDomainPackets.every(
      (packet) =>
        packet.polygonCount > 0 &&
        packet.sourceTopology === 'self-intersecting' &&
        packet.finalCoverageBuilderStatus === 'product-final' &&
        hasAllowedVisualOverlapStatus(packet.visualOverlapCollapseStatus) &&
        packet.debugIntervalId?.startsWith('interval:') === true &&
        packet.intervalIds.every((intervalId) =>
          intervalId.startsWith('interval:')
        )
    )
  ).toBe(true)
  expect(analysis.redPixelCount).toBeGreaterThan(1000)
  expect(analysis.darkOverdrawPixelCount).toBeLessThan(48)
  expect(analysis.maxDarkOverdrawComponentArea).toBeLessThan(32)
  expect(analysis.boundaryDomainPacketCount).toBe(metadata.exportPacketCount)

  await resetCanvas(page)
  await createSelfCheckStar(page, { includeFill: false })
  await page.waitForFunction(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId =
      core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
    const element = selectedId
      ? core?.deps?.sceneTree?.getElementById?.(selectedId)
      : null
    const computed = element?.getAllComputedData?.()
    return Boolean(computed?.strokes?.length && !computed?.fills?.length)
  })
  await page.waitForTimeout(1000)

  const noFillMetadata = await getSelfCheckMetadata(page)
  fs.writeFileSync(
    NO_FILL_METADATA_PATH,
    `${JSON.stringify(noFillMetadata, null, 2)}\n`
  )
  const noFillScreenshot = await page.screenshot({
    path: NO_FILL_SCREENSHOT_PATH,
    fullPage: false
  })
  const noFillAnalysis = await analyzeSelfCheckBoundaryDomainOracle(
    page,
    noFillScreenshot,
    noFillMetadata,
    SELF_CHECK_SOURCE_PATH
  )
  fs.writeFileSync(
    NO_FILL_ANALYSIS_PATH,
    `${JSON.stringify(noFillAnalysis, null, 2)}\n`
  )

  expect(noFillMetadata.exportPacketCount).toBeGreaterThan(0)
  expect(
    noFillMetadata.boundaryDomainIntervalIds.length
  ).toBeGreaterThanOrEqual(noFillMetadata.exportPacketCount)
  expect(
    noFillMetadata.boundaryDomainPackets.every((packet) =>
      hasAllowedVisualOverlapStatus(packet.visualOverlapCollapseStatus)
    ),
    JSON.stringify(noFillMetadata.boundaryDomainPackets, null, 2)
  ).toBe(true)
  expect(noFillAnalysis.packetCount).toBe(noFillMetadata.exportPacketCount)
  expect(
    noFillAnalysis.intervalPacketFailureCount,
    JSON.stringify(noFillAnalysis.intervalPacketFailures, null, 2)
  ).toBe(0)
  expect(
    noFillAnalysis.coverageProbeFailures,
    JSON.stringify(noFillAnalysis, null, 2)
  ).toEqual([])
  expect(
    noFillAnalysis.terminalProbeFailures,
    JSON.stringify(noFillAnalysis, null, 2)
  ).toEqual([])
  expect(
    noFillAnalysis.visibleDashProbeFailures,
    JSON.stringify(noFillAnalysis, null, 2)
  ).toEqual([])
  expect(
    noFillAnalysis.splitRangeSideConsistencyFailures,
    JSON.stringify(noFillAnalysis, null, 2)
  ).toEqual([])
  expect(
    noFillAnalysis.intervalContinuityFailures,
    JSON.stringify(noFillAnalysis, null, 2)
  ).toEqual([])
  expect(
    noFillAnalysis.distributionFailures,
    JSON.stringify(noFillAnalysis, null, 2)
  ).toEqual([])

  await testInfo.attach('stroke-self-check-screenshot', {
    path: SCREENSHOT_PATH,
    contentType: 'image/png'
  })
  await testInfo.attach('stroke-self-check-no-fill-screenshot', {
    path: NO_FILL_SCREENSHOT_PATH,
    contentType: 'image/png'
  })
  await testInfo.attach('stroke-self-check-metadata', {
    path: METADATA_PATH,
    contentType: 'application/json'
  })
  await testInfo.attach('stroke-self-check-no-fill-metadata', {
    path: NO_FILL_METADATA_PATH,
    contentType: 'application/json'
  })
  await testInfo.attach('stroke-self-check-analysis', {
    path: ANALYSIS_PATH,
    contentType: 'application/json'
  })
  await testInfo.attach('stroke-self-check-no-fill-analysis', {
    path: NO_FILL_ANALYSIS_PATH,
    contentType: 'application/json'
  })
})
