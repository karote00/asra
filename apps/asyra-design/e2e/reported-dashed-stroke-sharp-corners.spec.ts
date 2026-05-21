import { expect, test, type Page } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import {
  getActiveTool,
  getCanvasPosition,
  getElementCount,
  getPropertiesPanel,
  getToolbar,
  waitForAppReady,
  resetCanvas
} from './test-utils'

interface WorkspacePoint {
  x: number
  y: number
}

interface ReportedPoint {
  id: string
  x: number
  y: number
  anchorType: 'sharp' | 'smooth'
  inHandle?: WorkspacePoint | null
  outHandle?: WorkspacePoint | null
}

interface SelectedVectorSnapshot {
  elementId: string
  pointCount: number
  segmentCount: number
  closed: boolean
}

interface ReportedSegment {
  id: string
  startId: string
  endId: string
  outControlId: string | null
  inControlId: string | null
}

interface CornerJoinOracle {
  anchorId: string
  anchor: WorkspacePoint
  previousArmEnd: WorkspacePoint
  nextArmEnd: WorkspacePoint
  analysisRadius: number
  strokeRadius: number
}

interface CornerClipOracle {
  anchorId: string
  previousArmCovered: WorkspacePoint[]
  nextArmCovered: WorkspacePoint[]
  coreCovered: WorkspacePoint[]
  expectedEmpty: WorkspacePoint[]
}

interface CornerVisualStats {
  previousArmProbeCount: number
  previousArmHits: number
  nextArmProbeCount: number
  nextArmHits: number
  coreProbeCount: number
  coreHits: number
  expectedEmptyProbeCount: number
  emptyProbeLeaks: number
  previousArmProbeRatios: number[]
  nextArmProbeRatios: number[]
  coreProbeRatios: number[]
  emptyProbeRatios: number[]
}

interface SmoothEndingCornerClipOracle {
  anchorId: 'tp-52'
  anchor: WorkspacePoint
  bodyCovered: WorkspacePoint[]
  seamCovered: WorkspacePoint[]
  expectedEmpty: WorkspacePoint[]
}

interface SmoothEndingCornerVisualStats {
  bodyProbeCount: number
  bodyHits: number
  seamProbeCount: number
  seamHits: number
  seamCenterHits: number
  expectedEmptyProbeCount: number
  emptyProbeLeaks: number
  connectedTerminalLabelCount: number
  connectedTerminalLabels: number[]
  connectedTerminalProbeLabels: number[]
  radialCrackRayCount: number
  radialCrackRayAngles: number[]
  internalCrackPixelCount: number
  internalCrackPixelSamples?: WorkspacePoint[]
  fillSideStrokePixelCount: number
  fillSideStrokePixelSamples?: WorkspacePoint[]
  bodyProbeRatios: number[]
  seamProbeRatios: number[]
  emptyProbeRatios: number[]
}

interface LeakageProbeOracle {
  exteriorEmpty: WorkspacePoint[]
  sourceSamples: {
    point: WorkspacePoint
    exteriorNormal: WorkspacePoint
  }[]
}

interface LeakageProbeStats {
  exteriorProbeCount: number
  exteriorLeaks: number
  exteriorProbeRatios: number[]
  exteriorRedPixelCount: number
  totalRedPixelCount: number
  maxExteriorDistance: number
}

const DRAW_ORIGIN = {
  x: 96,
  y: 32
} as const

const LOCAL_CORNER_CLIP_RADIUS = 320
const LOCAL_LEAKAGE_CLIP_RADIUS = 360
const ZOOM_PERCENT = 260
const ORIGINAL_VECTOR6_GLOBAL_ZOOM_PERCENT = 260
const ORIGINAL_VECTOR6_LOCAL_ZOOM_PERCENT = 1200
const DASH_LENGTH = 27
const GAP_LENGTH = 20
let wasmConsoleMessages: string[] = []

const REPORTED_POINTS: ReportedPoint[] = [
  {
    id: 'tp-48',
    x: 288.3579534349085,
    y: 0,
    anchorType: 'sharp',
    outHandle: {
      x: 252.3230173491993,
      y: 178.32291234662443
    }
  },
  {
    id: 'tp-49',
    x: 45.11723080954357,
    y: 545.3300071762217,
    anchorType: 'smooth',
    inHandle: {
      x: -41.19399334784407,
      y: 542.1914172068621
    },
    outHandle: {
      x: 153.006261006278,
      y: 549.2532446379212
    }
  },
  {
    id: 'tp-50',
    x: 460.98040174968355,
    y: 258.9336724721627,
    anchorType: 'sharp'
  },
  {
    id: 'tp-51',
    x: 0,
    y: 121.62036131268246,
    anchorType: 'sharp',
    outHandle: {
      x: 0,
      y: 121.62036131268246
    }
  },
  {
    id: 'tp-52',
    x: 388.9024498660667,
    y: 524.4701633765546,
    anchorType: 'smooth',
    inHandle: {
      x: 347.70845651822265,
      y: 540.1631132233522
    },
    outHandle: {
      x: 430.0964432139108,
      y: 508.7772135297571
    }
  }
]

const REPORTED_SEGMENTS: readonly ReportedSegment[] = [
  {
    id: 'ts-81',
    startId: 'tp-48',
    endId: 'tp-49',
    outControlId: 'tp-48:out',
    inControlId: 'tp-49:in'
  },
  {
    id: 'ts-82',
    startId: 'tp-49',
    endId: 'tp-50',
    outControlId: 'tp-49:out',
    inControlId: null
  },
  {
    id: 'ts-83',
    startId: 'tp-50',
    endId: 'tp-51',
    outControlId: null,
    inControlId: null
  },
  {
    id: 'ts-84',
    startId: 'tp-51',
    endId: 'tp-52',
    outControlId: 'tp-51:out',
    inControlId: 'tp-52:in'
  },
  {
    id: 'ts-85',
    startId: 'tp-52',
    endId: 'tp-48',
    outControlId: 'tp-52:out',
    inControlId: null
  }
] as const

const ORIGINAL_VECTOR6_POINTS: ReportedPoint[] = [
  {
    id: 'tp-12',
    x: 192.42083700791653,
    y: 0,
    anchorType: 'sharp',
    outHandle: { x: 170.10536493824844, y: 119.07041481724248 }
  },
  {
    id: 'tp-13',
    x: 11.358174406717296,
    y: 364.1297089212308,
    anchorType: 'smooth',
    inHandle: { x: -42.09205809548172, y: 343.2841182453731 },
    outHandle: { x: 78.17096503446606, y: 390.18669726605293 }
  },
  {
    id: 'tp-14',
    x: 360.120941483566,
    y: 144.31562775593738,
    anchorType: 'sharp'
  },
  {
    id: 'tp-15',
    x: 0,
    y: 14.030686031827244,
    anchorType: 'sharp',
    outHandle: { x: 0, y: 14.030686031827244 }
  },
  {
    id: 'tp-16',
    x: 270.59180204238254,
    y: 345.42212754546125,
    anchorType: 'smooth',
    inHandle: { x: 263.9105229796076, y: 362.79345310867603 },
    outHandle: { x: 277.2730811051575, y: 328.05080198224647 }
  }
]

const ORIGINAL_VECTOR6_SEGMENTS: readonly ReportedSegment[] = [
  {
    id: 'ts-23',
    startId: 'tp-12',
    endId: 'tp-13',
    outControlId: 'tp-12:out',
    inControlId: 'tp-13:in'
  },
  {
    id: 'ts-24',
    startId: 'tp-13',
    endId: 'tp-14',
    outControlId: 'tp-13:out',
    inControlId: null
  },
  {
    id: 'ts-25',
    startId: 'tp-14',
    endId: 'tp-15',
    outControlId: null,
    inControlId: null
  },
  {
    id: 'ts-26',
    startId: 'tp-15',
    endId: 'tp-16',
    outControlId: 'tp-15:out',
    inControlId: 'tp-16:in'
  },
  {
    id: 'ts-27',
    startId: 'tp-16',
    endId: 'tp-12',
    outControlId: 'tp-16:out',
    inControlId: null
  }
] as const

const CORNER_ANCHOR_IDS = ['tp-48', 'tp-50', 'tp-51'] as const
const STROKE_WIDTH = 10
const STROKE_RADIUS = STROKE_WIDTH / 2
const LOCAL_JOIN_ARM_LENGTH = STROKE_WIDTH * 2.2
const LOCAL_JOIN_ARM_PROBE_FRACTIONS = [0.4, 0.8, 1.2, 1.6, 2.0, 2.4] as const
const LOCAL_JOIN_CORE_PROBE_FRACTIONS = [0.05, 0.1, 0.16] as const
const LOCAL_JOIN_EMPTY_PROBE_NEAR_DISTANCE = STROKE_WIDTH * 0.45
const LOCAL_JOIN_EMPTY_PROBE_FAR_DISTANCE = STROKE_WIDTH * 0.8
const LOCAL_JOIN_PROBE_RADIUS = 4
const SMOOTH_ENDING_ANCHOR_ID = 'tp-52' as const
const SMOOTH_ENDING_BODY_PROBE_FRACTIONS = [0.35, 0.7, 1.1] as const
const SMOOTH_ENDING_SEAM_PROBE_FRACTIONS = [0.35, 0.65, 0.95] as const
const SMOOTH_ENDING_EMPTY_PROBE_FRACTIONS = [0.45, 0.8] as const

const toWorkspace = (point: WorkspacePoint): WorkspacePoint => ({
  x: DRAW_ORIGIN.x + point.x,
  y: DRAW_ORIGIN.y + point.y
})

const subtractPoints = (
  left: WorkspacePoint,
  right: WorkspacePoint
): WorkspacePoint => ({
  x: left.x - right.x,
  y: left.y - right.y
})

const addPoints = (
  left: WorkspacePoint,
  right: WorkspacePoint
): WorkspacePoint => ({
  x: left.x + right.x,
  y: left.y + right.y
})

const scalePoint = (point: WorkspacePoint, scalar: number): WorkspacePoint => ({
  x: point.x * scalar,
  y: point.y * scalar
})

const distancePoints = (left: WorkspacePoint, right: WorkspacePoint) =>
  Math.hypot(left.x - right.x, left.y - right.y)

const normalizeVector = (vector: WorkspacePoint) => {
  const length = Math.hypot(vector.x, vector.y)
  if (length <= 1e-6) {
    return { x: 1, y: 0 }
  }
  return {
    x: vector.x / length,
    y: vector.y / length
  }
}

const lerpPoint = (
  start: WorkspacePoint,
  end: WorkspacePoint,
  t: number
): WorkspacePoint => ({
  x: start.x + (end.x - start.x) * t,
  y: start.y + (end.y - start.y) * t
})

const evaluateReportedSegmentPoint = (
  segment: ReportedSegment,
  t: number,
  points: readonly ReportedPoint[] = REPORTED_POINTS
): WorkspacePoint => {
  const startAnchor = points.find((point) => point.id === segment.startId)
  const endAnchor = points.find((point) => point.id === segment.endId)
  if (!startAnchor || !endAnchor) {
    throw new Error(`Missing reported segment anchors for ${segment.id}`)
  }

  const start = toWorkspace(startAnchor)
  const end = toWorkspace(endAnchor)

  const outHandle =
    segment.outControlId != null
      ? toWorkspace(
          points.flatMap((point) => {
            const entries: WorkspacePoint[] = []
            if (point.outHandle && `${point.id}:out` === segment.outControlId) {
              entries.push(point.outHandle)
            }
            return entries
          })[0] ?? start
        )
      : start
  const inHandle =
    segment.inControlId != null
      ? toWorkspace(
          points.flatMap((point) => {
            const entries: WorkspacePoint[] = []
            if (point.inHandle && `${point.id}:in` === segment.inControlId) {
              entries.push(point.inHandle)
            }
            return entries
          })[0] ?? end
        )
      : end

  const hasControls =
    segment.outControlId != null || segment.inControlId != null
  if (!hasControls) {
    return lerpPoint(start, end, t)
  }

  const oneMinusT = 1 - t
  return {
    x:
      oneMinusT ** 3 * start.x +
      3 * oneMinusT ** 2 * t * outHandle.x +
      3 * oneMinusT * t ** 2 * inHandle.x +
      t ** 3 * end.x,
    y:
      oneMinusT ** 3 * start.y +
      3 * oneMinusT ** 2 * t * outHandle.y +
      3 * oneMinusT * t ** 2 * inHandle.y +
      t ** 3 * end.y
  }
}

const evaluateReportedSegmentTangent = (
  segment: ReportedSegment,
  t: number,
  points: readonly ReportedPoint[] = REPORTED_POINTS
): WorkspacePoint => {
  const startAnchor = points.find((point) => point.id === segment.startId)
  const endAnchor = points.find((point) => point.id === segment.endId)
  if (!startAnchor || !endAnchor) {
    throw new Error(`Missing reported segment anchors for ${segment.id}`)
  }

  const start = toWorkspace(startAnchor)
  const end = toWorkspace(endAnchor)
  const outHandle =
    segment.outControlId != null
      ? toWorkspace(
          points.flatMap((point) => {
            const entries: WorkspacePoint[] = []
            if (point.outHandle && `${point.id}:out` === segment.outControlId) {
              entries.push(point.outHandle)
            }
            return entries
          })[0] ?? start
        )
      : start
  const inHandle =
    segment.inControlId != null
      ? toWorkspace(
          points.flatMap((point) => {
            const entries: WorkspacePoint[] = []
            if (point.inHandle && `${point.id}:in` === segment.inControlId) {
              entries.push(point.inHandle)
            }
            return entries
          })[0] ?? end
        )
      : end

  const hasControls =
    segment.outControlId != null || segment.inControlId != null
  if (!hasControls) {
    return subtractPoints(end, start)
  }

  const oneMinusT = 1 - t
  return {
    x:
      3 * oneMinusT ** 2 * (outHandle.x - start.x) +
      6 * oneMinusT * t * (inHandle.x - outHandle.x) +
      3 * t ** 2 * (end.x - inHandle.x),
    y:
      3 * oneMinusT ** 2 * (outHandle.y - start.y) +
      6 * oneMinusT * t * (inHandle.y - outHandle.y) +
      3 * t ** 2 * (end.y - inHandle.y)
  }
}

const approximateReportedSegmentLength = (
  segment: ReportedSegment,
  points: readonly ReportedPoint[] = REPORTED_POINTS
) => {
  let length = 0
  let previous = evaluateReportedSegmentPoint(segment, 0, points)
  for (let index = 1; index <= 96; index += 1) {
    const next = evaluateReportedSegmentPoint(segment, index / 96, points)
    length += distancePoints(previous, next)
    previous = next
  }
  return length
}

const buildReportedSegmentStartDistanceMap = () => {
  const starts = new Map<string, number>()
  let cursor = 0
  for (const segment of REPORTED_SEGMENTS) {
    starts.set(segment.id, cursor)
    cursor += approximateReportedSegmentLength(segment)
  }
  return {
    starts,
    totalLength: cursor
  }
}

const normalizeLoopDistance = (distance: number, totalLength: number) => {
  if (totalLength <= 0) {
    return 0
  }
  const normalized = distance % totalLength
  return normalized >= 0 ? normalized : normalized + totalLength
}

const isVisibleDashDistance = (distance: number, totalLength: number) => {
  const cycleLength = DASH_LENGTH + GAP_LENGTH
  const loopDistance = normalizeLoopDistance(distance, totalLength)
  const cycleDistance = loopDistance % cycleLength
  return cycleDistance < DASH_LENGTH - 0.5
}

const getAnchorSourceDistance = (
  anchorId: string,
  segmentStarts: Map<string, number>,
  totalLength: number
) => {
  const startingSegment = REPORTED_SEGMENTS.find(
    (segment) => segment.startId === anchorId
  )
  if (startingSegment) {
    return segmentStarts.get(startingSegment.id) ?? 0
  }

  const endingSegment = REPORTED_SEGMENTS.find(
    (segment) => segment.endId === anchorId
  )
  if (!endingSegment) {
    return 0
  }

  return normalizeLoopDistance(
    (segmentStarts.get(endingSegment.id) ?? 0) +
      approximateReportedSegmentLength(endingSegment),
    totalLength
  )
}

const buildCornerJoinOracle = (
  anchorId: (typeof CORNER_ANCHOR_IDS)[number]
) => {
  const anchorPoint = REPORTED_POINTS.find((point) => point.id === anchorId)
  if (!anchorPoint) {
    throw new Error(`Missing reported anchor ${anchorId}`)
  }

  const previousSegment = [...REPORTED_SEGMENTS]
    .reverse()
    .find((segment) => segment.endId === anchorId)
  const nextSegment = REPORTED_SEGMENTS.find(
    (segment) => segment.startId === anchorId
  )

  if (!previousSegment || !nextSegment) {
    throw new Error(`Missing incident segments for ${anchorId}`)
  }

  const anchor = toWorkspace(anchorPoint)
  const previousSample = evaluateReportedSegmentPoint(previousSegment, 0.965)
  const nextSample = evaluateReportedSegmentPoint(nextSegment, 0.035)
  const previousDirection = normalizeVector(
    subtractPoints(previousSample, anchor)
  )
  const nextDirection = normalizeVector(subtractPoints(nextSample, anchor))

  return {
    anchorId,
    anchor,
    previousArmEnd: addPoints(
      anchor,
      scalePoint(previousDirection, LOCAL_JOIN_ARM_LENGTH)
    ),
    nextArmEnd: addPoints(
      anchor,
      scalePoint(nextDirection, LOCAL_JOIN_ARM_LENGTH)
    ),
    analysisRadius: LOCAL_JOIN_ARM_LENGTH,
    strokeRadius: STROKE_RADIUS
  } satisfies CornerJoinOracle
}

const getViewportState = async (page: Page) =>
  page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    return {
      zoom: core?.getSystemProperty?.('zoom') ?? 1,
      viewport: core?.getSystemProperty?.('viewportPosition') ?? {
        x: 0,
        y: 0
      }
    }
  })

const workspaceToClient = async (page: Page, point: WorkspacePoint) => {
  const { zoom, viewport } = await getViewportState(page)
  return {
    x: point.x * zoom + viewport.x,
    y: point.y * zoom + viewport.y
  }
}

const clickWorkspace = async (page: Page, point: WorkspacePoint) => {
  const client = await workspaceToClient(page, point)
  await page.mouse.move(client.x, client.y, { steps: 5 })
  await page.waitForTimeout(30)
  await page.mouse.down()
  await page.mouse.up()
  await page.waitForTimeout(30)
}

const activatePenTool = async (page: Page) => {
  const toolbar = getToolbar(page)
  await toolbar.click({ position: { x: 8, y: 8 } })
  await page.keyboard.press('p')

  try {
    await expect.poll(() => getActiveTool(page), { timeout: 1200 }).toBe('pen')
  } catch {
    await page.getByTestId('tool-pen').click()
    await expect.poll(() => getActiveTool(page), { timeout: 1200 }).toBe('pen')
  }
}

const clickWorkspaceUntilElementCount = async (
  page: Page,
  point: WorkspacePoint,
  expectedCount: number
) => {
  await clickWorkspace(page, point)
  await expect
    .poll(async () => getElementCount(page), { timeout: 1500 })
    .toBe(expectedCount)
}

const clickWorkspaceUntilPointCount = async (
  page: Page,
  point: WorkspacePoint,
  expectedPointCount: number
) => {
  await clickWorkspace(page, point)
  await expect
    .poll(
      async () => (await getSelectedVectorSnapshot(page))?.pointCount ?? null,
      { timeout: 1500 }
    )
    .toBe(expectedPointCount)
}

const closeWorkspacePathUntilClosed = async (
  page: Page,
  point: WorkspacePoint,
  expectedPointCount: number,
  expectedSegmentCount: number
) => {
  await clickWorkspace(page, point)
  await expect
    .poll(async () => getSelectedVectorSnapshot(page), { timeout: 1500 })
    .toMatchObject({
      pointCount: expectedPointCount,
      segmentCount: expectedSegmentCount,
      closed: true
    })
}

const getSelectedVectorSnapshot = async (
  page: Page
): Promise<SelectedVectorSnapshot | null> =>
  page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId = core?.deps?.selection?.getElementSelectionIds?.()?.[0]
    if (!selectedId) {
      return null
    }

    const element = core?.deps?.sceneTree?.getElementById?.(selectedId)
    const computed = element?.getAllComputedData?.() ?? {}
    const primaryNetwork = Object.values(computed.networks ?? {})[0] as
      | { pointIds?: string[]; segmentIds?: string[]; closed?: boolean }
      | undefined

    if (!primaryNetwork) {
      return null
    }

    return {
      elementId: selectedId,
      pointCount: (primaryNetwork.pointIds ?? []).length,
      segmentCount: (primaryNetwork.segmentIds ?? []).length,
      closed: computed.closed ?? primaryNetwork.closed ?? false
    }
  })

const getStrokeExportPacketDiagnostics = async (
  page: Page,
  elementId: string,
  focus: WorkspacePoint
) =>
  page.evaluate(
    ({ targetElementId, focusPoint }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const renderElement = core?.deps?.render?.getElementById?.(
        targetElementId
      ) as
        | {
            __asyraSolidCenterStrokeExportPackets?: {
              bounds?: {
                minX: number
                minY: number
                maxX: number
                maxY: number
              }
              polygons?: { x: number; y: number }[][]
              debugMeta?: Record<string, unknown>
              intervalIds?: string[]
              sourceSpanIds?: string[]
              sourceContourIds?: string[]
              legalDomainIds?: string[]
            }[]
          }
        | undefined
      const packets = renderElement?.__asyraSolidCenterStrokeExportPackets ?? []
      const polygonBounds = (polygon: { x: number; y: number }[]) => {
        if (polygon.length === 0) {
          return null
        }
        return polygon.reduce(
          (bounds, point) => ({
            minX: Math.min(bounds.minX, point.x),
            minY: Math.min(bounds.minY, point.y),
            maxX: Math.max(bounds.maxX, point.x),
            maxY: Math.max(bounds.maxY, point.y)
          }),
          {
            minX: Number.POSITIVE_INFINITY,
            minY: Number.POSITIVE_INFINITY,
            maxX: Number.NEGATIVE_INFINITY,
            maxY: Number.NEGATIVE_INFINITY
          }
        )
      }
      const intersectsFocus = (bounds?: {
        minX: number
        minY: number
        maxX: number
        maxY: number
      }) =>
        bounds
          ? focusPoint.x >= bounds.minX - 40 &&
            focusPoint.x <= bounds.maxX + 40 &&
            focusPoint.y >= bounds.minY - 40 &&
            focusPoint.y <= bounds.maxY + 40
          : false

      return packets
        .map((packet, index) => ({
          index,
          bounds: packet.bounds ?? null,
          polygonCount: packet.polygons?.length ?? 0,
          pointCounts: (packet.polygons ?? []).map((polygon) => polygon.length),
          focusPolygons: (packet.polygons ?? [])
            .map((polygon, polygonIndex) => ({
              polygonIndex,
              bounds: polygonBounds(polygon),
              points: polygon
            }))
            .filter((polygon) => intersectsFocus(polygon.bounds ?? undefined)),
          intervalIds: packet.intervalIds ?? [],
          sourceSpanIds: packet.sourceSpanIds ?? [],
          sourceContourIds: packet.sourceContourIds ?? [],
          legalDomainIds: packet.legalDomainIds ?? [],
          nearFocus: intersectsFocus(packet.bounds),
          debugMeta: packet.debugMeta ?? {}
        }))
        .filter((packet) => {
          const debugMeta = packet.debugMeta as Record<string, unknown>
          return (
            packet.nearFocus ||
            debugMeta.strokePosition === 'outside' ||
            debugMeta.finalCoverageBuilderStatus === 'product-final'
          )
        })
    },
    { targetElementId: elementId, focusPoint: focus }
  )

const patchReportedVectorGeometry = async (
  page: Page,
  elementId: string,
  points: ReportedPoint[] = REPORTED_POINTS,
  segments: readonly ReportedSegment[] = REPORTED_SEGMENTS
) => {
  await page.evaluate(
    ({ targetElementId, points, segments }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const element = core?.deps?.sceneTree?.getElementById?.(targetElementId)
      const computed = element?.getAllComputedData?.()
      const primaryNetwork = Object.values(computed?.networks ?? {})[0] as
        | { id: string; pointIds?: string[]; segmentIds?: string[] }
        | undefined

      if (!computed || !primaryNetwork) {
        throw new Error('Missing vector topology for reported sample patch')
      }

      const nextPoints = Object.fromEntries(
        points.flatMap((point) => {
          const entries: [string, Record<string, unknown>][] = [
            [
              point.id,
              {
                id: point.id,
                kind: 'anchor',
                x: point.x,
                y: point.y,
                anchorType: point.anchorType
              }
            ]
          ]

          if (point.inHandle) {
            entries.push([
              `${point.id}:in`,
              {
                id: `${point.id}:in`,
                kind: 'control',
                controlForId: point.id,
                controlRole: 'in',
                x: point.inHandle.x,
                y: point.inHandle.y
              }
            ])
          }

          if (point.outHandle) {
            entries.push([
              `${point.id}:out`,
              {
                id: `${point.id}:out`,
                kind: 'control',
                controlForId: point.id,
                controlRole: 'out',
                x: point.outHandle.x,
                y: point.outHandle.y
              }
            ])
          }

          return entries
        })
      )

      const nextSegments = Object.fromEntries(
        segments.map((segment) => [
          segment.id,
          {
            id: segment.id,
            startId: segment.startId,
            endId: segment.endId,
            outControlId: segment.outControlId,
            inControlId: segment.inControlId
          }
        ])
      )

      core?.changeComputedData?.(
        [targetElementId],
        {
          points: nextPoints,
          segments: nextSegments,
          networks: {
            [primaryNetwork.id]: {
              id: primaryNetwork.id,
              pointIds: points.map((point) => point.id),
              segmentIds: segments.map((segment) => segment.id),
              closed: true
            }
          },
          closed: true
        },
        { undoable: false }
      )
    },
    {
      targetElementId: elementId,
      points,
      segments
    }
  )
}

const configureReportedStroke = async (
  page: Page,
  join: 'round' | 'miter' = 'round',
  position: 'inside' | 'outside' = 'inside'
) => {
  const propertiesPanel = getPropertiesPanel(page)
  const strokeWidthInput = propertiesPanel.getByTestId('prop-stroke-width-0')
  const strokeStyleSelect = propertiesPanel.getByTestId('prop-stroke-style-0')
  const strokePatternInput = propertiesPanel.getByTestId(
    'prop-stroke-pattern-0'
  )
  const strokeOffsetInput = propertiesPanel.getByTestId('prop-stroke-offset-0')
  const strokePositionSelect = propertiesPanel.getByTestId(
    'prop-stroke-position-0'
  )
  const strokeJoinSelect = propertiesPanel.getByTestId('prop-stroke-join-0')
  const strokeColorInput = propertiesPanel.getByTestId('prop-stroke-color-0')
  const strokeOpacityInput = propertiesPanel.getByTestId(
    'prop-stroke-opacity-0'
  )

  await strokeStyleSelect.selectOption('dashed')
  await expect(strokePatternInput).toBeVisible()
  await expect(strokeOffsetInput).toBeVisible()

  await strokeWidthInput.fill('10')
  await strokeWidthInput.press('Enter')
  await strokePatternInput.fill(`${DASH_LENGTH}, ${GAP_LENGTH}`)
  await strokePatternInput.press('Enter')
  await strokeOffsetInput.fill('0')
  await strokeOffsetInput.press('Enter')
  await strokePositionSelect.selectOption(position)
  await strokeJoinSelect.selectOption(join)
  await strokeColorInput.fill('E10C0C')
  await strokeColorInput.press('Enter')
  await strokeOpacityInput.fill('50')
  await strokeOpacityInput.press('Enter')
}

const addReportedFill = async (page: Page, elementId: string) => {
  await page.evaluate((targetElementId) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    core?.changeComputedData?.(
      [targetElementId],
      {
        fills: [
          {
            id: 'reported-high-curvature-fill',
            kind: 'solid',
            fillType: 'color',
            color: '#d5d5d5',
            opacity: 1,
            visible: true
          }
        ]
      },
      { undoable: false }
    )
  }, elementId)
}

const clearSelectedVectorPoint = async (page: Page) => {
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('prop-vector-point-x')).not.toBeVisible()
}

const clearElementSelectionByClick = async (page: Page) => {
  await page.keyboard.press('v')
  const blankCanvasPoint = await getCanvasPosition(page, 0.08, 0.08)
  await page.mouse.click(blankCanvasPoint.x, blankCanvasPoint.y)
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    core?.deps?.selection?.clearAllSelections?.()
    for (const selectionType of ['element', 'vectorPoint', 'vectorSegment']) {
      const selection =
        core?.deps?.selection?.get?.(selectionType) ??
        core?.getSelection?.(selectionType)
      selection?.clear?.()
      selection?.select?.([])
    }
  })
  await expect
    .poll(async () =>
      page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const core = (window as any).__Core__
        return core?.deps?.selection?.getElementSelectionIds?.()?.length ?? 0
      })
    )
    .toBe(0)
  await page.waitForTimeout(150)
}

const clearVectorOverlayState = async (page: Page) => {
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    core?.setSystemProperty?.('pathEditingVectorId', null)
    core?.setSystemProperty?.('pathEditingMode', false)
    core?.setSystemProperty?.('hoveredElementId', null)
    core?.setSystemProperty?.('areaSelection', null)
    core?.setSystemProperty?.('selectedVectorPoint', null)
    core?.setSystemProperty?.('hoveredVectorPoint', null)
    core?.setSystemProperty?.('selectedVectorSegment', null)
    core?.setSystemProperty?.('hoveredVectorSegment', null)
    core?.setSystemProperty?.('hoveredVectorSegmentInsertPoint', null)
  })
}

const centerVectorInViewport = async (page: Page, elementId: string) => {
  await page.evaluate((targetElementId) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const element = core?.deps?.sceneTree?.getElementById?.(targetElementId)
    const computed = element?.getAllComputedData?.()
    const viewportAnchor = document.getElementById('viewport-anchor')
    const zoom = core?.getSystemProperty?.('zoom') ?? 1
    if (!computed || !viewportAnchor) {
      return
    }

    const bounds = viewportAnchor.getBoundingClientRect()
    const nextViewport = {
      x:
        bounds.left +
        bounds.width / 2 -
        (computed.x + computed.width / 2) * zoom,
      y:
        bounds.top +
        bounds.height / 2 -
        (computed.y + computed.height / 2) * zoom
    }

    core?.setSystemProperty?.('viewportPosition', nextViewport)
  }, elementId)

  await page.waitForTimeout(120)
}

const centerWorkspacePointInViewport = async (
  page: Page,
  workspacePoint: WorkspacePoint
) => {
  await page.evaluate((targetPoint) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const viewportAnchor = document.getElementById('viewport-anchor')
    const zoom = core?.getSystemProperty?.('zoom') ?? 1
    if (!viewportAnchor) {
      return
    }

    const bounds = viewportAnchor.getBoundingClientRect()
    core?.setSystemProperty?.('viewportPosition', {
      x: bounds.left + bounds.width / 2 - targetPoint.x * zoom,
      y: bounds.top + bounds.height / 2 - targetPoint.y * zoom
    })
  }, workspacePoint)

  await page.waitForTimeout(120)
}

const setZoomPercent = async (page: Page, percent: number) => {
  await page.evaluate((targetZoom) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    core?.setSystemProperty?.('zoom', targetZoom / 100)
  }, percent)
  await page.waitForTimeout(120)
}

const captureCornerClip = async (
  page: Page,
  workspacePoint: WorkspacePoint
) => {
  const clientPoint = await workspaceToClient(page, workspacePoint)
  const viewportSize = page.viewportSize()
  if (!viewportSize) {
    throw new Error('Viewport size unavailable')
  }

  const clip = {
    x: Math.max(0, Math.floor(clientPoint.x - LOCAL_CORNER_CLIP_RADIUS)),
    y: Math.max(0, Math.floor(clientPoint.y - LOCAL_CORNER_CLIP_RADIUS)),
    width: Math.max(
      1,
      Math.min(viewportSize.width, LOCAL_CORNER_CLIP_RADIUS * 2)
    ),
    height: Math.max(
      1,
      Math.min(viewportSize.height, LOCAL_CORNER_CLIP_RADIUS * 2)
    )
  }

  const buffer = await page.screenshot({ clip })
  return {
    buffer,
    clip
  }
}

const captureWorkspaceClip = async (
  page: Page,
  workspacePoint: WorkspacePoint,
  radius: number
) => {
  const clientPoint = await workspaceToClient(page, workspacePoint)
  const viewportSize = page.viewportSize()
  if (!viewportSize) {
    throw new Error('Viewport size unavailable')
  }

  const clip = {
    x: Math.max(0, Math.floor(clientPoint.x - radius)),
    y: Math.max(0, Math.floor(clientPoint.y - radius)),
    width: Math.max(1, Math.min(viewportSize.width, radius * 2)),
    height: Math.max(1, Math.min(viewportSize.height, radius * 2))
  }

  const buffer = await page.screenshot({ clip })
  return {
    buffer,
    clip
  }
}

const buildCornerClipOracle = async (
  page: Page,
  anchorId: (typeof CORNER_ANCHOR_IDS)[number],
  clip: {
    x: number
    y: number
    width: number
    height: number
  }
): Promise<CornerClipOracle> => {
  const workspaceOracle = buildCornerJoinOracle(anchorId)

  const previousDirection = normalizeVector(
    subtractPoints(workspaceOracle.previousArmEnd, workspaceOracle.anchor)
  )
  const nextDirection = normalizeVector(
    subtractPoints(workspaceOracle.nextArmEnd, workspaceOracle.anchor)
  )
  const previousNormal = {
    x: previousDirection.y,
    y: -previousDirection.x
  }
  const nextNormal = {
    x: -nextDirection.y,
    y: nextDirection.x
  }
  const bandProbeOffsets = [
    -STROKE_WIDTH * 0.45,
    -STROKE_WIDTH * 0.25,
    STROKE_WIDTH * 0.25,
    STROKE_WIDTH * 0.45
  ] as const
  const bisector = normalizeVector(addPoints(previousDirection, nextDirection))
  const { starts: segmentStarts, totalLength } =
    buildReportedSegmentStartDistanceMap()
  const anchorDistance = getAnchorSourceDistance(
    anchorId,
    segmentStarts,
    totalLength
  )
  const toClipPoint = async (point: WorkspacePoint) => {
    const clientPoint = await workspaceToClient(page, point)
    return {
      x: clientPoint.x - clip.x,
      y: clientPoint.y - clip.y
    }
  }
  const previousArmWorkspacePoints = LOCAL_JOIN_ARM_PROBE_FRACTIONS.flatMap(
    (fraction) => {
      const probeDistance = STROKE_WIDTH * fraction
      if (!isVisibleDashDistance(anchorDistance - probeDistance, totalLength)) {
        return []
      }

      const sourcePoint = addPoints(
        workspaceOracle.anchor,
        scalePoint(previousDirection, probeDistance)
      )
      return bandProbeOffsets.map((offset) =>
        addPoints(sourcePoint, scalePoint(previousNormal, offset))
      )
    }
  )
  const nextArmWorkspacePoints = LOCAL_JOIN_ARM_PROBE_FRACTIONS.flatMap(
    (fraction) => {
      const probeDistance = STROKE_WIDTH * fraction
      if (!isVisibleDashDistance(anchorDistance + probeDistance, totalLength)) {
        return []
      }

      const sourcePoint = addPoints(
        workspaceOracle.anchor,
        scalePoint(nextDirection, probeDistance)
      )
      return bandProbeOffsets.map((offset) =>
        addPoints(sourcePoint, scalePoint(nextNormal, offset))
      )
    }
  )
  const coreWorkspacePoints = LOCAL_JOIN_CORE_PROBE_FRACTIONS.map((fraction) =>
    addPoints(
      workspaceOracle.anchor,
      scalePoint(bisector, STROKE_WIDTH * fraction)
    )
  )
  const expectedEmptyWorkspacePoints = [
    addPoints(
      workspaceOracle.anchor,
      scalePoint(bisector, -LOCAL_JOIN_EMPTY_PROBE_NEAR_DISTANCE)
    ),
    addPoints(
      workspaceOracle.anchor,
      scalePoint(bisector, -LOCAL_JOIN_EMPTY_PROBE_FAR_DISTANCE)
    )
  ]
  const [previousArmCovered, nextArmCovered, coreCovered, expectedEmpty] =
    await Promise.all([
      Promise.all(
        previousArmWorkspacePoints.map((point) => toClipPoint(point))
      ),
      Promise.all(nextArmWorkspacePoints.map((point) => toClipPoint(point))),
      Promise.all(coreWorkspacePoints.map((point) => toClipPoint(point))),
      Promise.all(
        expectedEmptyWorkspacePoints.map((point) => toClipPoint(point))
      )
    ])

  return {
    anchorId,
    previousArmCovered,
    nextArmCovered,
    coreCovered,
    expectedEmpty
  }
}

const buildSmoothEndingCornerClipOracle = async (
  page: Page,
  clip: {
    x: number
    y: number
    width: number
    height: number
  },
  options: { position?: 'inside' | 'outside' } = {}
): Promise<SmoothEndingCornerClipOracle> => {
  const anchorPoint = REPORTED_POINTS.find(
    (point) => point.id === SMOOTH_ENDING_ANCHOR_ID
  )
  if (!anchorPoint) {
    throw new Error(`Missing reported anchor ${SMOOTH_ENDING_ANCHOR_ID}`)
  }

  const previousSegment = [...REPORTED_SEGMENTS]
    .reverse()
    .find((segment) => segment.endId === SMOOTH_ENDING_ANCHOR_ID)
  const nextSegment = REPORTED_SEGMENTS.find(
    (segment) => segment.startId === SMOOTH_ENDING_ANCHOR_ID
  )

  if (!previousSegment || !nextSegment) {
    throw new Error(`Missing incident segments for ${SMOOTH_ENDING_ANCHOR_ID}`)
  }

  const anchor = toWorkspace(anchorPoint)
  const previousSample = evaluateReportedSegmentPoint(previousSegment, 0.965)
  const nextSample = evaluateReportedSegmentPoint(nextSegment, 0.035)
  const previousDirection = normalizeVector(
    subtractPoints(previousSample, anchor)
  )
  const nextDirection = normalizeVector(subtractPoints(nextSample, anchor))
  const seamBisector = normalizeVector(
    addPoints(previousDirection, nextDirection)
  )
  const emptyDirection = scalePoint(seamBisector, -1)
  const coveredSeamDirection =
    options.position === 'outside' ? emptyDirection : seamBisector
  const expectedEmptyDirection =
    options.position === 'outside' ? seamBisector : emptyDirection

  const toClipPoint = async (point: WorkspacePoint) => {
    const clientPoint = await workspaceToClient(page, point)
    return {
      x: clientPoint.x - clip.x,
      y: clientPoint.y - clip.y
    }
  }

  const bodyWorkspacePoints = SMOOTH_ENDING_BODY_PROBE_FRACTIONS.map(
    (fraction) =>
      addPoints(anchor, scalePoint(previousDirection, STROKE_WIDTH * fraction))
  )
  const seamWorkspacePoints = SMOOTH_ENDING_SEAM_PROBE_FRACTIONS.map(
    (fraction) =>
      addPoints(
        anchor,
        scalePoint(coveredSeamDirection, STROKE_WIDTH * fraction)
      )
  )
  const expectedEmptyWorkspacePoints = SMOOTH_ENDING_EMPTY_PROBE_FRACTIONS.map(
    (fraction) =>
      addPoints(
        anchor,
        scalePoint(expectedEmptyDirection, STROKE_WIDTH * fraction)
      )
  )

  const [bodyCovered, seamCovered, expectedEmpty] = await Promise.all([
    Promise.all(bodyWorkspacePoints.map((point) => toClipPoint(point))),
    Promise.all(seamWorkspacePoints.map((point) => toClipPoint(point))),
    Promise.all(expectedEmptyWorkspacePoints.map((point) => toClipPoint(point)))
  ])

  return {
    anchorId: SMOOTH_ENDING_ANCHOR_ID,
    anchor: await toClipPoint(anchor),
    bodyCovered,
    seamCovered,
    expectedEmpty
  }
}

const buildOriginalVector6LocalLeakageOracle = async (
  page: Page,
  clip: {
    x: number
    y: number
    width: number
    height: number
  }
): Promise<LeakageProbeOracle> => {
  const sourceSegment = ORIGINAL_VECTOR6_SEGMENTS[3]
  const toClipPoint = async (point: WorkspacePoint) => {
    const clientPoint = await workspaceToClient(page, point)
    return {
      x: clientPoint.x - clip.x,
      y: clientPoint.y - clip.y
    }
  }

  const exteriorWorkspacePoints = (
    [0.54, 0.58, 0.62, 0.66, 0.7, 0.74, 0.78, 0.82, 0.86, 0.9] as const
  ).flatMap((t) => {
    const point = evaluateReportedSegmentPoint(
      sourceSegment,
      t,
      ORIGINAL_VECTOR6_POINTS
    )
    const tangent = normalizeVector(
      evaluateReportedSegmentTangent(sourceSegment, t, ORIGINAL_VECTOR6_POINTS)
    )
    const exteriorNormal = {
      x: -tangent.y,
      y: tangent.x
    }

    return ([0.45, 0.8, 1.2, 1.7, 2.3] as const).map((distance) =>
      addPoints(point, scalePoint(exteriorNormal, distance))
    )
  })
  const sourceSampleWorkspace = Array.from({ length: 57 }, (_, index) => {
    const t = 0.44 + index * 0.01
    const point = evaluateReportedSegmentPoint(
      sourceSegment,
      t,
      ORIGINAL_VECTOR6_POINTS
    )
    const tangent = normalizeVector(
      evaluateReportedSegmentTangent(sourceSegment, t, ORIGINAL_VECTOR6_POINTS)
    )
    return {
      point,
      exteriorNormal: {
        x: -tangent.y,
        y: tangent.x
      }
    }
  })

  return {
    exteriorEmpty: await Promise.all(
      exteriorWorkspacePoints.map((point) => toClipPoint(point))
    ),
    sourceSamples: await Promise.all(
      sourceSampleWorkspace.map(async (sample) => ({
        point: await toClipPoint(sample.point),
        exteriorNormal: sample.exteriorNormal
      }))
    )
  }
}

const analyzeCornerClip = async (
  page: Page,
  imageBase64: string,
  clip: {
    clip: {
      x: number
      y: number
      width: number
      height: number
    }
  },
  oracle: CornerClipOracle
): Promise<CornerVisualStats> =>
  page.evaluate(
    async ({ base64, screenshotClip, expectedJoinOracle, probeRadius }) => {
      const response = await fetch(`data:image/png;base64,${base64}`)
      const blob = await response.blob()
      const bitmap = await createImageBitmap(blob)
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const context = canvas.getContext('2d')
      if (!context) {
        return {
          previousArmProbeCount: 0,
          previousArmHits: 0,
          nextArmProbeCount: 0,
          nextArmHits: 0,
          coreProbeCount: 0,
          coreHits: 0,
          expectedEmptyProbeCount: 0,
          emptyProbeLeaks: 0,
          previousArmProbeRatios: [],
          nextArmProbeRatios: [],
          coreProbeRatios: [],
          emptyProbeRatios: []
        }
      }

      context.drawImage(bitmap, 0, 0)
      const imageData = context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      ).data
      const width = canvas.width
      const _height = canvas.height
      const isStrokePixel = (r: number, g: number, b: number, a: number) =>
        a >= 32 && r >= 70 && r - g >= 25 && r - b >= 25

      const rasterScaleX = canvas.width / Math.max(1, screenshotClip.clip.width)
      const rasterScaleY =
        canvas.height / Math.max(1, screenshotClip.clip.height)

      const sampleProbeCoverageRatio = (point: WorkspacePoint) => {
        const centerX = point.x * rasterScaleX
        const centerY = point.y * rasterScaleY
        let redPixels = 0
        let totalPixels = 0

        for (let offsetY = -probeRadius; offsetY <= probeRadius; offsetY += 1) {
          for (
            let offsetX = -probeRadius;
            offsetX <= probeRadius;
            offsetX += 1
          ) {
            if (offsetX ** 2 + offsetY ** 2 > probeRadius ** 2) {
              continue
            }

            const sampleX = Math.round(centerX + offsetX)
            const sampleY = Math.round(centerY + offsetY)
            if (
              sampleX < 0 ||
              sampleY < 0 ||
              sampleX >= canvas.width ||
              sampleY >= canvas.height
            ) {
              continue
            }

            const pixelIndex = (sampleY * width + sampleX) * 4
            const r = imageData[pixelIndex]
            const g = imageData[pixelIndex + 1]
            const b = imageData[pixelIndex + 2]
            const a = imageData[pixelIndex + 3]
            totalPixels += 1
            if (isStrokePixel(r, g, b, a)) {
              redPixels += 1
            }
          }
        }

        return totalPixels === 0 ? 0 : redPixels / totalPixels
      }

      const previousArmProbeRatios = expectedJoinOracle.previousArmCovered.map(
        (point) => sampleProbeCoverageRatio(point)
      )
      const nextArmProbeRatios = expectedJoinOracle.nextArmCovered.map(
        (point) => sampleProbeCoverageRatio(point)
      )
      const coreProbeRatios = expectedJoinOracle.coreCovered.map((point) =>
        sampleProbeCoverageRatio(point)
      )
      const emptyProbeRatios = expectedJoinOracle.expectedEmpty.map((point) =>
        sampleProbeCoverageRatio(point)
      )

      return {
        previousArmProbeCount: previousArmProbeRatios.length,
        previousArmHits: previousArmProbeRatios.filter((ratio) => ratio >= 0.2)
          .length,
        nextArmProbeCount: nextArmProbeRatios.length,
        nextArmHits: nextArmProbeRatios.filter((ratio) => ratio >= 0.2).length,
        coreProbeCount: coreProbeRatios.length,
        coreHits: coreProbeRatios.filter((ratio) => ratio >= 0.2).length,
        expectedEmptyProbeCount: emptyProbeRatios.length,
        emptyProbeLeaks: emptyProbeRatios.filter((ratio) => ratio >= 0.12)
          .length,
        previousArmProbeRatios,
        nextArmProbeRatios,
        coreProbeRatios,
        emptyProbeRatios
      }
    },
    {
      base64: imageBase64,
      screenshotClip: clip,
      expectedJoinOracle: oracle,
      probeRadius: LOCAL_JOIN_PROBE_RADIUS
    }
  )

const analyzeSmoothEndingCornerClip = async (
  page: Page,
  imageBase64: string,
  clip: {
    clip: {
      x: number
      y: number
      width: number
      height: number
    }
  },
  oracle: SmoothEndingCornerClipOracle
): Promise<SmoothEndingCornerVisualStats> =>
  page.evaluate(
    async ({ base64, screenshotClip, expectedEndingOracle, probeRadius }) => {
      const response = await fetch(`data:image/png;base64,${base64}`)
      const blob = await response.blob()
      const bitmap = await createImageBitmap(blob)
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const context = canvas.getContext('2d')
      if (!context) {
        return {
          bodyProbeCount: 0,
          bodyHits: 0,
          seamProbeCount: 0,
          seamHits: 0,
          seamCenterHits: 0,
          expectedEmptyProbeCount: 0,
          emptyProbeLeaks: 0,
          connectedTerminalLabelCount: 0,
          connectedTerminalLabels: [],
          connectedTerminalProbeLabels: [],
          radialCrackRayCount: 0,
          radialCrackRayAngles: [],
          internalCrackPixelCount: 0,
          fillSideStrokePixelCount: 0,
          bodyProbeRatios: [],
          seamProbeRatios: [],
          emptyProbeRatios: []
        }
      }

      context.drawImage(bitmap, 0, 0)
      const imageData = context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      ).data
      const width = canvas.width
      const isStrokePixel = (r: number, g: number, b: number, a: number) =>
        a >= 32 && r >= 70 && r - g >= 25 && r - b >= 25
      const rasterScaleX = canvas.width / Math.max(1, screenshotClip.clip.width)
      const rasterScaleY =
        canvas.height / Math.max(1, screenshotClip.clip.height)

      const sampleProbeCoverageRatio = (point: WorkspacePoint) => {
        const centerX = point.x * rasterScaleX
        const centerY = point.y * rasterScaleY
        let redPixels = 0
        let totalPixels = 0

        for (let offsetY = -probeRadius; offsetY <= probeRadius; offsetY += 1) {
          for (
            let offsetX = -probeRadius;
            offsetX <= probeRadius;
            offsetX += 1
          ) {
            if (offsetX ** 2 + offsetY ** 2 > probeRadius ** 2) {
              continue
            }

            const sampleX = Math.round(centerX + offsetX)
            const sampleY = Math.round(centerY + offsetY)
            if (
              sampleX < 0 ||
              sampleY < 0 ||
              sampleX >= canvas.width ||
              sampleY >= canvas.height
            ) {
              continue
            }

            const pixelIndex = (sampleY * width + sampleX) * 4
            const r = imageData[pixelIndex]
            const g = imageData[pixelIndex + 1]
            const b = imageData[pixelIndex + 2]
            const a = imageData[pixelIndex + 3]
            totalPixels += 1
            if (isStrokePixel(r, g, b, a)) {
              redPixels += 1
            }
          }
        }

        return totalPixels === 0 ? 0 : redPixels / totalPixels
      }
      const sampleCenterStrokeHit = (point: WorkspacePoint) => {
        const centerX = Math.round(point.x * rasterScaleX)
        const centerY = Math.round(point.y * rasterScaleY)
        for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
          for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
            const sampleX = centerX + offsetX
            const sampleY = centerY + offsetY
            if (
              sampleX < 0 ||
              sampleY < 0 ||
              sampleX >= width ||
              sampleY >= canvas.height
            ) {
              continue
            }
            const pixelIndex = (sampleY * width + sampleX) * 4
            if (
              isStrokePixel(
                imageData[pixelIndex],
                imageData[pixelIndex + 1],
                imageData[pixelIndex + 2],
                imageData[pixelIndex + 3]
              )
            ) {
              return true
            }
          }
        }
        return false
      }

      const bodyProbeRatios = expectedEndingOracle.bodyCovered.map((point) =>
        sampleProbeCoverageRatio(point)
      )
      const seamProbeRatios = expectedEndingOracle.seamCovered.map((point) =>
        sampleProbeCoverageRatio(point)
      )
      const seamCenterHitCount = expectedEndingOracle.seamCovered.filter(
        (point) => sampleCenterStrokeHit(point)
      ).length
      const emptyProbeRatios = expectedEndingOracle.expectedEmpty.map((point) =>
        sampleProbeCoverageRatio(point)
      )
      const redLabels = new Int32Array(width * canvas.height).fill(-1)
      const redComponentSizes: number[] = []
      const stack: number[] = []
      let nextLabel = 0
      for (let y = 0; y < canvas.height; y += 1) {
        for (let x = 0; x < canvas.width; x += 1) {
          const index = y * width + x
          if (redLabels[index] !== -1) {
            continue
          }
          const pixelIndex = index * 4
          if (
            !isStrokePixel(
              imageData[pixelIndex],
              imageData[pixelIndex + 1],
              imageData[pixelIndex + 2],
              imageData[pixelIndex + 3]
            )
          ) {
            continue
          }

          const label = nextLabel
          nextLabel += 1
          redLabels[index] = label
          stack.push(index)
          let size = 0
          while (stack.length > 0) {
            const current = stack.pop() ?? 0
            size += 1
            const currentX = current % width
            const currentY = Math.floor(current / width)
            for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
              for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
                if (offsetX === 0 && offsetY === 0) {
                  continue
                }
                const nextX = currentX + offsetX
                const nextY = currentY + offsetY
                if (
                  nextX < 0 ||
                  nextY < 0 ||
                  nextX >= width ||
                  nextY >= canvas.height
                ) {
                  continue
                }
                const nextIndex = nextY * width + nextX
                if (redLabels[nextIndex] !== -1) {
                  continue
                }
                const nextPixelIndex = nextIndex * 4
                if (
                  !isStrokePixel(
                    imageData[nextPixelIndex],
                    imageData[nextPixelIndex + 1],
                    imageData[nextPixelIndex + 2],
                    imageData[nextPixelIndex + 3]
                  )
                ) {
                  continue
                }
                redLabels[nextIndex] = label
                stack.push(nextIndex)
              }
            }
          }
          redComponentSizes[label] = size
        }
      }

      const getProbeLabels = (point: WorkspacePoint) => {
        const centerX = point.x * rasterScaleX
        const centerY = point.y * rasterScaleY
        const labels = new Set<number>()
        for (let offsetY = -probeRadius; offsetY <= probeRadius; offsetY += 1) {
          for (
            let offsetX = -probeRadius;
            offsetX <= probeRadius;
            offsetX += 1
          ) {
            if (offsetX ** 2 + offsetY ** 2 > probeRadius ** 2) {
              continue
            }
            const sampleX = Math.round(centerX + offsetX)
            const sampleY = Math.round(centerY + offsetY)
            if (
              sampleX < 0 ||
              sampleY < 0 ||
              sampleX >= width ||
              sampleY >= canvas.height
            ) {
              continue
            }
            const label = redLabels[sampleY * width + sampleX]
            if (label >= 0 && (redComponentSizes[label] ?? 0) >= 24) {
              labels.add(label)
            }
          }
        }
        return [...labels]
      }

      const connectedTerminalProbeLabels = [
        ...expectedEndingOracle.bodyCovered.flatMap((point) =>
          getProbeLabels(point)
        ),
        ...expectedEndingOracle.seamCovered.flatMap((point) =>
          getProbeLabels(point)
        )
      ]
      const connectedTerminalLabels = [...new Set(connectedTerminalProbeLabels)]
      const anchorX = expectedEndingOracle.anchor.x * rasterScaleX
      const anchorY = expectedEndingOracle.anchor.y * rasterScaleY
      const angleCount = 144
      const minRadius = Math.max(4, probeRadius * 2)
      const maxRadius = Math.max(minRadius + 4, probeRadius * 13)
      const rayCoverages = Array.from({ length: angleCount }, (_, index) => {
        const angle = (index / angleCount) * Math.PI * 2
        let redSamples = 0
        let totalSamples = 0
        for (let radius = minRadius; radius <= maxRadius; radius += 1.5) {
          const sampleX = Math.round(anchorX + Math.cos(angle) * radius)
          const sampleY = Math.round(anchorY + Math.sin(angle) * radius)
          if (
            sampleX < 0 ||
            sampleY < 0 ||
            sampleX >= width ||
            sampleY >= canvas.height
          ) {
            continue
          }
          const pixelIndex = (sampleY * width + sampleX) * 4
          totalSamples += 1
          if (
            isStrokePixel(
              imageData[pixelIndex],
              imageData[pixelIndex + 1],
              imageData[pixelIndex + 2],
              imageData[pixelIndex + 3]
            )
          ) {
            redSamples += 1
          }
        }
        return totalSamples === 0 ? 0 : redSamples / totalSamples
      })
      const radialCrackRayAngles = rayCoverages.flatMap((coverage, index) => {
        if (coverage >= 0.08) {
          return []
        }
        const leftWindow = [1, 2, 3, 4, 5].map(
          (offset) => rayCoverages[(index - offset + angleCount) % angleCount]
        )
        const rightWindow = [1, 2, 3, 4, 5].map(
          (offset) => rayCoverages[(index + offset) % angleCount]
        )
        const hasRedOnBothSides =
          Math.max(...leftWindow) >= 0.55 && Math.max(...rightWindow) >= 0.55
        return hasRedOnBothSides ? [index] : []
      })
      const isDarkPixel = (x: number, y: number) => {
        const pixelIndex = (y * width + x) * 4
        const r = imageData[pixelIndex]
        const g = imageData[pixelIndex + 1]
        const b = imageData[pixelIndex + 2]
        const a = imageData[pixelIndex + 3]
        return a >= 32 && r <= 35 && g <= 35 && b <= 35
      }
      const hasNearbyRed = (x: number, y: number, dx: number, dy: number) => {
        for (let distance = 2; distance <= 7; distance += 1) {
          const sampleX = Math.round(x + dx * distance)
          const sampleY = Math.round(y + dy * distance)
          if (
            sampleX < 0 ||
            sampleY < 0 ||
            sampleX >= width ||
            sampleY >= canvas.height
          ) {
            continue
          }
          const pixelIndex = (sampleY * width + sampleX) * 4
          if (
            isStrokePixel(
              imageData[pixelIndex],
              imageData[pixelIndex + 1],
              imageData[pixelIndex + 2],
              imageData[pixelIndex + 3]
            )
          ) {
            return true
          }
        }
        return false
      }
      const crackScanRadius = maxRadius
      const seamAxis = (() => {
        const referencePoint =
          expectedEndingOracle.seamCovered[
            Math.floor(expectedEndingOracle.seamCovered.length / 2)
          ] ?? expectedEndingOracle.seamCovered[0]
        if (!referencePoint) {
          return { x: 1, y: 0 }
        }
        const dx = referencePoint.x * rasterScaleX - anchorX
        const dy = referencePoint.y * rasterScaleY - anchorY
        const length = Math.hypot(dx, dy)
        return length <= 0 ? { x: 1, y: 0 } : { x: dx / length, y: dy / length }
      })()
      const isInEndpointSeamCorridor = (x: number, y: number) => {
        const dx = x - anchorX
        const dy = y - anchorY
        const projected = dx * seamAxis.x + dy * seamAxis.y
        const perpendicular = Math.abs(dx * seamAxis.y - dy * seamAxis.x)
        return (
          projected >= minRadius * 0.35 &&
          projected <= maxRadius &&
          perpendicular <= Math.max(2, probeRadius * 0.9)
        )
      }
      const crackDirections = [
        [1, 0],
        [0, 1],
        [1, 1],
        [1, -1],
        [2, 1],
        [2, -1],
        [1, 2],
        [1, -2]
      ].map(([x, y]) => {
        const length = Math.hypot(x, y)
        return [x / length, y / length] as const
      })
      let internalCrackPixelCount = 0
      const internalCrackPixelSamples: { x: number; y: number }[] = []
      let fillSideStrokePixelCount = 0
      const fillSideStrokePixelSamples: { x: number; y: number }[] = []
      for (
        let y = Math.max(0, Math.floor(anchorY - crackScanRadius));
        y <= Math.min(canvas.height - 1, Math.ceil(anchorY + crackScanRadius));
        y += 1
      ) {
        for (
          let x = Math.max(0, Math.floor(anchorX - crackScanRadius));
          x <= Math.min(width - 1, Math.ceil(anchorX + crackScanRadius));
          x += 1
        ) {
          if (
            Math.hypot(x - anchorX, y - anchorY) > crackScanRadius ||
            !isInEndpointSeamCorridor(x, y) ||
            !isDarkPixel(x, y)
          ) {
            continue
          }
          if (
            crackDirections.some(
              ([dx, dy]) =>
                hasNearbyRed(x, y, dx, dy) && hasNearbyRed(x, y, -dx, -dy)
            )
          ) {
            internalCrackPixelCount += 1
            if (internalCrackPixelSamples.length < 64) {
              internalCrackPixelSamples.push({ x, y })
            }
          }

          const pixelIndex = (y * width + x) * 4
          const r = imageData[pixelIndex]
          const g = imageData[pixelIndex + 1]
          const b = imageData[pixelIndex + 2]
          const a = imageData[pixelIndex + 3]
          if (isStrokePixel(r, g, b, a) && g >= 36 && b >= 36 && a >= 128) {
            fillSideStrokePixelCount += 1
            if (fillSideStrokePixelSamples.length < 64) {
              fillSideStrokePixelSamples.push({ x, y })
            }
          }
        }
      }

      return {
        bodyProbeCount: bodyProbeRatios.length,
        bodyHits: bodyProbeRatios.filter((ratio) => ratio >= 0.2).length,
        seamProbeCount: seamProbeRatios.length,
        seamHits: seamProbeRatios.filter((ratio) => ratio >= 0.2).length,
        seamCenterHits: seamCenterHitCount,
        expectedEmptyProbeCount: emptyProbeRatios.length,
        emptyProbeLeaks: emptyProbeRatios.filter((ratio) => ratio >= 0.12)
          .length,
        connectedTerminalLabelCount: connectedTerminalLabels.length,
        connectedTerminalLabels,
        connectedTerminalProbeLabels,
        radialCrackRayCount: radialCrackRayAngles.length,
        radialCrackRayAngles,
        internalCrackPixelCount,
        internalCrackPixelSamples,
        fillSideStrokePixelCount,
        fillSideStrokePixelSamples,
        bodyProbeRatios,
        seamProbeRatios,
        emptyProbeRatios
      }
    },
    {
      base64: imageBase64,
      screenshotClip: clip,
      expectedEndingOracle: oracle,
      probeRadius: LOCAL_JOIN_PROBE_RADIUS
    }
  )

const analyzeLeakageProbeClip = async (
  page: Page,
  imageBase64: string,
  clip: {
    clip: {
      x: number
      y: number
      width: number
      height: number
    }
  },
  oracle: LeakageProbeOracle
): Promise<LeakageProbeStats> =>
  page.evaluate(
    async ({ base64, screenshotClip, leakageOracle, probeRadius }) => {
      const response = await fetch(`data:image/png;base64,${base64}`)
      const blob = await response.blob()
      const bitmap = await createImageBitmap(blob)
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const context = canvas.getContext('2d')
      if (!context) {
        return {
          exteriorProbeCount: 0,
          exteriorLeaks: 0,
          exteriorProbeRatios: [],
          exteriorRedPixelCount: 0,
          totalRedPixelCount: 0,
          maxExteriorDistance: 0
        }
      }

      context.drawImage(bitmap, 0, 0)
      const imageData = context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      ).data
      const width = canvas.width
      const isStrokePixel = (r: number, g: number, b: number, a: number) =>
        a >= 32 && r >= 70 && r - g >= 25 && r - b >= 25
      const rasterScaleX = canvas.width / Math.max(1, screenshotClip.clip.width)
      const rasterScaleY =
        canvas.height / Math.max(1, screenshotClip.clip.height)

      const sampleProbeCoverageRatio = (point: WorkspacePoint) => {
        const centerX = point.x * rasterScaleX
        const centerY = point.y * rasterScaleY
        let redPixels = 0
        let totalPixels = 0

        for (let offsetY = -probeRadius; offsetY <= probeRadius; offsetY += 1) {
          for (
            let offsetX = -probeRadius;
            offsetX <= probeRadius;
            offsetX += 1
          ) {
            if (offsetX ** 2 + offsetY ** 2 > probeRadius ** 2) {
              continue
            }

            const sampleX = Math.round(centerX + offsetX)
            const sampleY = Math.round(centerY + offsetY)
            if (
              sampleX < 0 ||
              sampleY < 0 ||
              sampleX >= canvas.width ||
              sampleY >= canvas.height
            ) {
              continue
            }

            const pixelIndex = (sampleY * width + sampleX) * 4
            const r = imageData[pixelIndex]
            const g = imageData[pixelIndex + 1]
            const b = imageData[pixelIndex + 2]
            const a = imageData[pixelIndex + 3]
            totalPixels += 1
            if (isStrokePixel(r, g, b, a)) {
              redPixels += 1
            }
          }
        }

        return totalPixels === 0 ? 0 : redPixels / totalPixels
      }

      const exteriorProbeRatios = leakageOracle.exteriorEmpty.map((point) =>
        sampleProbeCoverageRatio(point)
      )
      let exteriorRedPixelCount = 0
      let totalRedPixelCount = 0
      let maxExteriorDistance = 0
      const maxNearSourceDistancePx = 72
      const minExteriorDistancePx = 3

      for (let y = 0; y < canvas.height; y += 1) {
        for (let x = 0; x < canvas.width; x += 1) {
          const pixelIndex = (y * width + x) * 4
          const r = imageData[pixelIndex]
          const g = imageData[pixelIndex + 1]
          const b = imageData[pixelIndex + 2]
          const a = imageData[pixelIndex + 3]
          if (!isStrokePixel(r, g, b, a)) {
            continue
          }
          totalRedPixelCount += 1

          let nearest: {
            distanceSquared: number
            exteriorDistance: number
          } | null = null

          for (const sample of leakageOracle.sourceSamples) {
            const dx = x - sample.point.x * rasterScaleX
            const dy = y - sample.point.y * rasterScaleY
            const distanceSquared = dx * dx + dy * dy
            if (distanceSquared > maxNearSourceDistancePx ** 2) {
              continue
            }

            const exteriorDistance =
              dx * sample.exteriorNormal.x + dy * sample.exteriorNormal.y
            if (!nearest || distanceSquared < nearest.distanceSquared) {
              nearest = {
                distanceSquared,
                exteriorDistance
              }
            }
          }

          if (nearest && nearest.exteriorDistance > minExteriorDistancePx) {
            exteriorRedPixelCount += 1
            maxExteriorDistance = Math.max(
              maxExteriorDistance,
              nearest.exteriorDistance
            )
          }
        }
      }

      return {
        exteriorProbeCount: exteriorProbeRatios.length,
        exteriorLeaks: exteriorProbeRatios.filter((ratio) => ratio >= 0.08)
          .length,
        exteriorProbeRatios,
        exteriorRedPixelCount,
        totalRedPixelCount,
        maxExteriorDistance
      }
    },
    {
      base64: imageBase64,
      screenshotClip: clip,
      leakageOracle: oracle,
      probeRadius: 3
    }
  )

const createOriginalVector6Fixture = async (
  page: Page,
  options: { position?: 'inside' | 'outside'; join?: 'round' | 'miter' } = {}
) => {
  const initialCount = await getElementCount(page)
  await activatePenTool(page)

  await clickWorkspaceUntilElementCount(
    page,
    toWorkspace(ORIGINAL_VECTOR6_POINTS[0]),
    initialCount + 1
  )
  await clickWorkspaceUntilPointCount(
    page,
    toWorkspace(ORIGINAL_VECTOR6_POINTS[1]),
    2
  )
  await clickWorkspaceUntilPointCount(
    page,
    toWorkspace(ORIGINAL_VECTOR6_POINTS[2]),
    3
  )
  await clickWorkspaceUntilPointCount(
    page,
    toWorkspace(ORIGINAL_VECTOR6_POINTS[3]),
    4
  )
  await clickWorkspaceUntilPointCount(
    page,
    toWorkspace(ORIGINAL_VECTOR6_POINTS[4]),
    5
  )
  await closeWorkspacePathUntilClosed(
    page,
    toWorkspace(ORIGINAL_VECTOR6_POINTS[0]),
    5,
    5
  )

  const snapshot = await getSelectedVectorSnapshot(page)
  expect(snapshot).not.toBeNull()
  if (!snapshot) {
    throw new Error('Missing original vector-6 fixture snapshot')
  }

  await patchReportedVectorGeometry(
    page,
    snapshot.elementId,
    ORIGINAL_VECTOR6_POINTS,
    ORIGINAL_VECTOR6_SEGMENTS
  )
  await addReportedFill(page, snapshot.elementId)
  await clearSelectedVectorPoint(page)
  await configureReportedStroke(
    page,
    options.join ?? 'miter',
    options.position ?? 'inside'
  )

  return snapshot
}

test.describe('Reported Dashed Stroke Sharp Corners', () => {
  test.beforeEach(async ({ page }) => {
    wasmConsoleMessages = []
    page.on('console', (message) => {
      const text = message.text()
      if (/wasm|WebAssembly|Aborted\(CompileError/.test(text)) {
        wasmConsoleMessages.push(text)
      }
    })
    await page.goto('/')
    await waitForAppReady(page)
    await resetCanvas(page)
  })

  test.afterEach(() => {
    expect(wasmConsoleMessages).toEqual([])
  })

  test('keeps each reported sharp corner visually connected as one local dash join', async ({
    page
  }, testInfo) => {
    const initialCount = await getElementCount(page)
    await activatePenTool(page)

    await clickWorkspaceUntilElementCount(
      page,
      toWorkspace(REPORTED_POINTS[0]),
      initialCount + 1
    )
    await clickWorkspaceUntilPointCount(
      page,
      toWorkspace(REPORTED_POINTS[1]),
      2
    )
    await clickWorkspaceUntilPointCount(
      page,
      toWorkspace(REPORTED_POINTS[2]),
      3
    )
    await clickWorkspaceUntilPointCount(
      page,
      toWorkspace(REPORTED_POINTS[3]),
      4
    )
    await clickWorkspaceUntilPointCount(
      page,
      toWorkspace(REPORTED_POINTS[4]),
      5
    )
    await closeWorkspacePathUntilClosed(
      page,
      toWorkspace(REPORTED_POINTS[0]),
      5,
      5
    )

    const snapshot = await getSelectedVectorSnapshot(page)
    expect(snapshot).not.toBeNull()
    if (!snapshot) {
      return
    }

    await patchReportedVectorGeometry(page, snapshot.elementId)
    await clearSelectedVectorPoint(page)
    await configureReportedStroke(page, 'miter')
    await clearElementSelectionByClick(page)
    await clearVectorOverlayState(page)
    await centerVectorInViewport(page, snapshot.elementId)
    await setZoomPercent(page, ZOOM_PERCENT)
    await centerVectorInViewport(page, snapshot.elementId)
    await page.mouse.move(
      (await getCanvasPosition(page, 0.1, 0.1)).x,
      (await getCanvasPosition(page, 0.1, 0.1)).y
    )
    await page.waitForTimeout(150)

    for (const anchorId of CORNER_ANCHOR_IDS) {
      const anchor = REPORTED_POINTS.find((point) => point.id === anchorId)
      expect(anchor).toBeDefined()
      if (!anchor) {
        continue
      }

      await centerWorkspacePointInViewport(page, toWorkspace(anchor))
      const raster = await captureCornerClip(page, toWorkspace(anchor))
      const oracle = await buildCornerClipOracle(page, anchorId, raster.clip)
      const attachmentPath = testInfo.outputPath(
        `reported-dashed-stroke-${anchorId}-corner.png`
      )
      await page.screenshot({ path: attachmentPath, clip: raster.clip })
      await testInfo.attach(`reported-dashed-stroke-${anchorId}-corner`, {
        path: attachmentPath,
        contentType: 'image/png'
      })

      const stats = await analyzeCornerClip(
        page,
        raster.buffer.toString('base64'),
        {
          clip: raster.clip
        },
        oracle
      )
      await testInfo.attach(`reported-dashed-stroke-${anchorId}-corner-stats`, {
        body: JSON.stringify(stats, null, 2),
        contentType: 'application/json'
      })

      expect(
        Math.max(stats.previousArmHits, stats.nextArmHits, stats.coreHits),
        `${anchorId} should preserve visible final dashed coverage near the reported corner`
      ).toBeGreaterThanOrEqual(1)
      expect(
        stats.emptyProbeLeaks,
        `${anchorId} should keep the old authored empty probes free of red leakage`
      ).toBe(0)
    }

    const stableAnchor = REPORTED_POINTS.find((point) => point.id === 'tp-48')
    expect(stableAnchor).toBeDefined()
    if (!stableAnchor) {
      return
    }

    await centerWorkspacePointInViewport(page, toWorkspace(stableAnchor))
    const beforeStableRaster = await captureCornerClip(
      page,
      toWorkspace(stableAnchor)
    )
    const beforeStableOracle = await buildCornerClipOracle(
      page,
      stableAnchor.id,
      beforeStableRaster.clip
    )
    const beforeStableStats = await analyzeCornerClip(
      page,
      beforeStableRaster.buffer.toString('base64'),
      { clip: beforeStableRaster.clip },
      beforeStableOracle
    )
    await page.waitForTimeout(1300)
    const afterStableRaster = await captureCornerClip(
      page,
      toWorkspace(stableAnchor)
    )
    const afterStableStats = await analyzeCornerClip(
      page,
      afterStableRaster.buffer.toString('base64'),
      { clip: afterStableRaster.clip },
      beforeStableOracle
    )

    expect(
      Math.max(
        beforeStableStats.previousArmHits,
        beforeStableStats.nextArmHits,
        beforeStableStats.coreHits
      ),
      'tp-48 should have visible constrained dashed coverage before stability wait'
    ).toBeGreaterThanOrEqual(1)
    expect(
      Math.max(
        afterStableStats.previousArmHits,
        afterStableStats.nextArmHits,
        afterStableStats.coreHits
      ),
      'tp-48 constrained dashed coverage must not disappear after backend bootstrap window'
    ).toBeGreaterThanOrEqual(1)
    expect(afterStableStats.emptyProbeLeaks).toBe(0)
  })

  test('keeps the reported smooth high-curvature ending corner visually notch-free', async ({
    page
  }, testInfo) => {
    const initialCount = await getElementCount(page)
    await activatePenTool(page)

    await clickWorkspaceUntilElementCount(
      page,
      toWorkspace(REPORTED_POINTS[0]),
      initialCount + 1
    )
    await clickWorkspaceUntilPointCount(
      page,
      toWorkspace(REPORTED_POINTS[1]),
      2
    )
    await clickWorkspaceUntilPointCount(
      page,
      toWorkspace(REPORTED_POINTS[2]),
      3
    )
    await clickWorkspaceUntilPointCount(
      page,
      toWorkspace(REPORTED_POINTS[3]),
      4
    )
    await clickWorkspaceUntilPointCount(
      page,
      toWorkspace(REPORTED_POINTS[4]),
      5
    )
    await closeWorkspacePathUntilClosed(
      page,
      toWorkspace(REPORTED_POINTS[0]),
      5,
      5
    )

    const snapshot = await getSelectedVectorSnapshot(page)
    expect(snapshot).not.toBeNull()
    if (!snapshot) {
      return
    }

    await patchReportedVectorGeometry(page, snapshot.elementId)
    await clearSelectedVectorPoint(page)
    await configureReportedStroke(page)
    await clearElementSelectionByClick(page)
    await clearVectorOverlayState(page)
    await centerVectorInViewport(page, snapshot.elementId)
    await setZoomPercent(page, ZOOM_PERCENT)
    await centerVectorInViewport(page, snapshot.elementId)
    await page.mouse.move(
      (await getCanvasPosition(page, 0.1, 0.1)).x,
      (await getCanvasPosition(page, 0.1, 0.1)).y
    )
    await page.waitForTimeout(150)

    const anchor = REPORTED_POINTS.find(
      (point) => point.id === SMOOTH_ENDING_ANCHOR_ID
    )
    expect(anchor).toBeDefined()
    if (!anchor) {
      return
    }

    await centerWorkspacePointInViewport(page, toWorkspace(anchor))
    await clearElementSelectionByClick(page)
    await clearVectorOverlayState(page)
    const canvasLayerSummary = await page.evaluate(() =>
      Array.from(document.querySelectorAll('canvas')).map((canvas, index) => {
        const element = canvas as HTMLElement
        const computed = window.getComputedStyle(element)
        const parent = element.parentElement as HTMLElement | null
        const parentComputed = parent ? window.getComputedStyle(parent) : null
        return {
          index,
          className: element.className,
          id: element.id,
          style: element.getAttribute('style'),
          zIndex: computed.zIndex,
          pointerEvents: computed.pointerEvents,
          parentClassName: parent?.className ?? '',
          parentId: parent?.id ?? '',
          parentStyle: parent?.getAttribute('style'),
          parentZIndex: parentComputed?.zIndex ?? ''
        }
      })
    )
    await testInfo.attach('canvas-layer-summary', {
      body: JSON.stringify(canvasLayerSummary, null, 2),
      contentType: 'application/json'
    })
    const raster = await captureCornerClip(page, toWorkspace(anchor))
    const oracle = await buildSmoothEndingCornerClipOracle(page, raster.clip)
    const attachmentPath = testInfo.outputPath(
      'reported-dashed-stroke-tp-52-smooth-ending-corner.png'
    )
    await page.screenshot({ path: attachmentPath, clip: raster.clip })
    await testInfo.attach('reported-dashed-stroke-tp-52-smooth-ending-corner', {
      path: attachmentPath,
      contentType: 'image/png'
    })

    const stats = await analyzeSmoothEndingCornerClip(
      page,
      raster.buffer.toString('base64'),
      {
        clip: raster.clip
      },
      oracle
    )
    await testInfo.attach(
      'reported-dashed-stroke-tp-52-smooth-ending-corner-stats',
      {
        body: JSON.stringify(stats, null, 2),
        contentType: 'application/json'
      }
    )

    expect(stats.bodyProbeCount).toBeGreaterThanOrEqual(3)
    expect(
      stats.emptyProbeLeaks,
      'tp-52 should keep the local exterior of the ending seam free of red leakage'
    ).toBe(0)
  })

  test('keeps the reported smooth high-curvature outside ending corner connected and boundary-hugging', async ({
    page
  }, testInfo) => {
    const initialCount = await getElementCount(page)
    await activatePenTool(page)

    await clickWorkspaceUntilElementCount(
      page,
      toWorkspace(REPORTED_POINTS[0]),
      initialCount + 1
    )
    await clickWorkspaceUntilPointCount(
      page,
      toWorkspace(REPORTED_POINTS[1]),
      2
    )
    await clickWorkspaceUntilPointCount(
      page,
      toWorkspace(REPORTED_POINTS[2]),
      3
    )
    await clickWorkspaceUntilPointCount(
      page,
      toWorkspace(REPORTED_POINTS[3]),
      4
    )
    await clickWorkspaceUntilPointCount(
      page,
      toWorkspace(REPORTED_POINTS[4]),
      5
    )
    await closeWorkspacePathUntilClosed(
      page,
      toWorkspace(REPORTED_POINTS[0]),
      5,
      5
    )

    const snapshot = await getSelectedVectorSnapshot(page)
    expect(snapshot).not.toBeNull()
    if (!snapshot) {
      return
    }

    await patchReportedVectorGeometry(page, snapshot.elementId)
    await addReportedFill(page, snapshot.elementId)
    await clearSelectedVectorPoint(page)
    await configureReportedStroke(page, 'round', 'outside')
    await clearElementSelectionByClick(page)
    await clearVectorOverlayState(page)
    await centerVectorInViewport(page, snapshot.elementId)
    await setZoomPercent(page, ZOOM_PERCENT)
    await centerVectorInViewport(page, snapshot.elementId)
    await page.mouse.move(
      (await getCanvasPosition(page, 0.1, 0.1)).x,
      (await getCanvasPosition(page, 0.1, 0.1)).y
    )
    await page.waitForTimeout(150)

    const anchor = REPORTED_POINTS.find(
      (point) => point.id === SMOOTH_ENDING_ANCHOR_ID
    )
    expect(anchor).toBeDefined()
    if (!anchor) {
      return
    }

    await centerWorkspacePointInViewport(page, toWorkspace(anchor))
    await clearElementSelectionByClick(page)
    await clearVectorOverlayState(page)
    const packetDiagnostics = await getStrokeExportPacketDiagnostics(
      page,
      snapshot.elementId,
      anchor
    )
    const packetDiagnosticsPath = testInfo.outputPath(
      'reported-dashed-stroke-tp-52-outside-packet-diagnostics.json'
    )
    await writeFile(
      packetDiagnosticsPath,
      `${JSON.stringify(packetDiagnostics, null, 2)}\n`
    )
    await testInfo.attach(
      'reported-dashed-stroke-tp-52-outside-packet-diagnostics',
      {
        path: packetDiagnosticsPath,
        contentType: 'application/json'
      }
    )
    const raster = await captureCornerClip(page, toWorkspace(anchor))
    const oracle = await buildSmoothEndingCornerClipOracle(page, raster.clip, {
      position: 'outside'
    })
    const attachmentPath = testInfo.outputPath(
      'reported-dashed-stroke-tp-52-outside-smooth-ending-corner.png'
    )
    await page.screenshot({ path: attachmentPath, clip: raster.clip })
    await testInfo.attach(
      'reported-dashed-stroke-tp-52-outside-smooth-ending-corner',
      {
        path: attachmentPath,
        contentType: 'image/png'
      }
    )

    const stats = await analyzeSmoothEndingCornerClip(
      page,
      raster.buffer.toString('base64'),
      {
        clip: raster.clip
      },
      oracle
    )
    await testInfo.attach(
      'reported-dashed-stroke-tp-52-outside-smooth-ending-corner-stats',
      {
        body: JSON.stringify(stats, null, 2),
        contentType: 'application/json'
      }
    )

    expect(stats.bodyProbeCount).toBeGreaterThanOrEqual(3)
    expect(
      stats.bodyHits,
      `tp-52 outside stroke must keep red coverage hugging the high-curvature source boundary\n${JSON.stringify(stats, null, 2)}`
    ).toBeGreaterThanOrEqual(stats.bodyProbeCount)
    expect(stats.seamProbeCount).toBeGreaterThanOrEqual(3)
    expect(
      stats.seamHits,
      `tp-52 outside stroke must keep the high-curvature endpoint seam connected\n${JSON.stringify(stats, null, 2)}`
    ).toBeGreaterThanOrEqual(stats.seamProbeCount)
    expect(
      stats.seamCenterHits,
      `tp-52 outside stroke seam centerline must not contain a black crack\n${JSON.stringify(stats, null, 2)}`
    ).toBeGreaterThanOrEqual(stats.seamProbeCount)
    expect(
      stats.connectedTerminalLabelCount,
      `tp-52 outside endpoint body and seam probes must belong to one continuous red component, not be split by a black crack\n${JSON.stringify(stats, null, 2)}`
    ).toBe(1)
    expect(
      stats.radialCrackRayCount,
      `tp-52 outside endpoint must not contain a black radial crack through the local red terminal fan\n${JSON.stringify(stats, null, 2)}`
    ).toBe(0)
    expect(
      stats.internalCrackPixelCount,
      `tp-52 outside endpoint must not contain dark pixels with red stroke on both sides\n${JSON.stringify(stats, null, 2)}`
    ).toBe(0)
    expect(
      stats.fillSideStrokePixelCount,
      `tp-52 outside endpoint must not draw red stroke over the gray fill-side; outside projection bridges must stay outside the source boundary\n${JSON.stringify(stats, null, 2)}`
    ).toBeLessThanOrEqual(8)
    expect(
      stats.emptyProbeLeaks,
      `tp-52 outside stroke should keep the far side of the ending seam free of red leakage\n${JSON.stringify(stats, null, 2)}`
    ).toBe(0)
  })

  test('captures the reported smooth high-curvature outside ending corner with native app zoom', async ({
    page
  }, testInfo) => {
    const initialCount = await getElementCount(page)
    await activatePenTool(page)

    await clickWorkspaceUntilElementCount(
      page,
      toWorkspace(REPORTED_POINTS[0]),
      initialCount + 1
    )
    await clickWorkspaceUntilPointCount(
      page,
      toWorkspace(REPORTED_POINTS[1]),
      2
    )
    await clickWorkspaceUntilPointCount(
      page,
      toWorkspace(REPORTED_POINTS[2]),
      3
    )
    await clickWorkspaceUntilPointCount(
      page,
      toWorkspace(REPORTED_POINTS[3]),
      4
    )
    await clickWorkspaceUntilPointCount(
      page,
      toWorkspace(REPORTED_POINTS[4]),
      5
    )
    await closeWorkspacePathUntilClosed(
      page,
      toWorkspace(REPORTED_POINTS[0]),
      5,
      5
    )

    const snapshot = await getSelectedVectorSnapshot(page)
    expect(snapshot).not.toBeNull()
    if (!snapshot) {
      return
    }

    await patchReportedVectorGeometry(page, snapshot.elementId)
    await addReportedFill(page, snapshot.elementId)
    await clearSelectedVectorPoint(page)
    await configureReportedStroke(page, 'round', 'outside')
    await clearElementSelectionByClick(page)
    await clearVectorOverlayState(page)
    await setZoomPercent(page, ORIGINAL_VECTOR6_LOCAL_ZOOM_PERCENT)

    const anchor = REPORTED_POINTS.find(
      (point) => point.id === SMOOTH_ENDING_ANCHOR_ID
    )
    expect(anchor).toBeDefined()
    if (!anchor) {
      return
    }

    await centerWorkspacePointInViewport(page, toWorkspace(anchor))
    await clearElementSelectionByClick(page)
    await clearVectorOverlayState(page)
    await page.waitForTimeout(150)

    const raster = await captureWorkspaceClip(
      page,
      toWorkspace(anchor),
      LOCAL_CORNER_CLIP_RADIUS
    )
    const attachmentPath = testInfo.outputPath(
      'reported-dashed-stroke-tp-52-outside-native-app-zoom-corner.png'
    )
    await page.screenshot({ path: attachmentPath, clip: raster.clip })
    await testInfo.attach(
      'reported-dashed-stroke-tp-52-outside-native-app-zoom-corner',
      {
        path: attachmentPath,
        contentType: 'image/png'
      }
    )

    expect(snapshot.elementId).toBeTruthy()
  })

  test('renders the original vector-6 full fixture for global regression review', async ({
    page
  }, testInfo) => {
    const snapshot = await createOriginalVector6Fixture(page)
    await centerVectorInViewport(page, snapshot.elementId)
    await setZoomPercent(page, ORIGINAL_VECTOR6_GLOBAL_ZOOM_PERCENT)
    await centerVectorInViewport(page, snapshot.elementId)
    await page.waitForTimeout(150)

    const attachmentPath = testInfo.outputPath(
      'original-vector-6-global-fixture.png'
    )
    await page.screenshot({ path: attachmentPath })
    await testInfo.attach('original-vector-6-global-fixture', {
      path: attachmentPath,
      contentType: 'image/png'
    })

    expect(snapshot.elementId).toBeTruthy()
  })

  test('renders the original vector-6 tp-16 local final dashed crop with visible coverage', async ({
    page
  }, testInfo) => {
    await createOriginalVector6Fixture(page)
    await setZoomPercent(page, ORIGINAL_VECTOR6_LOCAL_ZOOM_PERCENT)

    const anchor = ORIGINAL_VECTOR6_POINTS.find((point) => point.id === 'tp-16')
    expect(anchor).toBeDefined()
    if (!anchor) {
      return
    }

    const inspectedPoint = evaluateReportedSegmentPoint(
      ORIGINAL_VECTOR6_SEGMENTS[3],
      0.86,
      ORIGINAL_VECTOR6_POINTS
    )

    await centerWorkspacePointInViewport(page, inspectedPoint)
    const raster = await captureWorkspaceClip(
      page,
      inspectedPoint,
      LOCAL_LEAKAGE_CLIP_RADIUS
    )
    const attachmentPath = testInfo.outputPath(
      'original-vector-6-tp-16-local-leakage-crop.png'
    )
    await page.screenshot({ path: attachmentPath, clip: raster.clip })
    await testInfo.attach('original-vector-6-tp-16-local-leakage-crop', {
      path: attachmentPath,
      contentType: 'image/png'
    })

    const oracle = await buildOriginalVector6LocalLeakageOracle(
      page,
      raster.clip
    )
    const stats = await analyzeLeakageProbeClip(
      page,
      raster.buffer.toString('base64'),
      { clip: raster.clip },
      oracle
    )
    await testInfo.attach('original-vector-6-tp-16-local-leakage-stats', {
      body: JSON.stringify(stats, null, 2),
      contentType: 'application/json'
    })

    expect(stats.exteriorProbeCount).toBeGreaterThanOrEqual(40)
    expect(
      stats.totalRedPixelCount,
      'inside dashed stroke must keep visible final raster coverage in the high-zoom tp-16 local crop'
    ).toBeGreaterThan(0)
  })

  test('captures the original vector-6 tp-16 outside super high-curvature crop with native app zoom', async ({
    page
  }, testInfo) => {
    const snapshot = await createOriginalVector6Fixture(page, {
      join: 'miter',
      position: 'outside'
    })
    await setZoomPercent(page, ORIGINAL_VECTOR6_LOCAL_ZOOM_PERCENT)

    const inspectedPoint = evaluateReportedSegmentPoint(
      ORIGINAL_VECTOR6_SEGMENTS[3],
      0.86,
      ORIGINAL_VECTOR6_POINTS
    )

    await centerWorkspacePointInViewport(page, inspectedPoint)
    await clearElementSelectionByClick(page)
    await clearVectorOverlayState(page)
    await page.waitForTimeout(150)

    const packetDiagnostics = await getStrokeExportPacketDiagnostics(
      page,
      snapshot.elementId,
      inspectedPoint
    )
    const packetDiagnosticsPath = testInfo.outputPath(
      'original-vector-6-tp-16-outside-super-high-curvature-packet-diagnostics.json'
    )
    await writeFile(
      packetDiagnosticsPath,
      `${JSON.stringify(packetDiagnostics, null, 2)}\n`
    )
    await testInfo.attach(
      'original-vector-6-tp-16-outside-super-high-curvature-packet-diagnostics',
      {
        path: packetDiagnosticsPath,
        contentType: 'application/json'
      }
    )

    const raster = await captureWorkspaceClip(
      page,
      inspectedPoint,
      LOCAL_LEAKAGE_CLIP_RADIUS
    )
    const attachmentPath = testInfo.outputPath(
      'original-vector-6-tp-16-outside-super-high-curvature-crop.png'
    )
    await page.screenshot({ path: attachmentPath, clip: raster.clip })
    await testInfo.attach(
      'original-vector-6-tp-16-outside-super-high-curvature-crop',
      {
        path: attachmentPath,
        contentType: 'image/png'
      }
    )

    expect(raster.buffer.byteLength).toBeGreaterThan(0)
  })
})
