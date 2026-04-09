import { expect, test, type Page } from '@playwright/test'
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
  bodyCovered: WorkspacePoint[]
  seamCovered: WorkspacePoint[]
  expectedEmpty: WorkspacePoint[]
}

interface SmoothEndingCornerVisualStats {
  bodyProbeCount: number
  bodyHits: number
  seamProbeCount: number
  seamHits: number
  expectedEmptyProbeCount: number
  emptyProbeLeaks: number
  bodyProbeRatios: number[]
  seamProbeRatios: number[]
  emptyProbeRatios: number[]
}

const DRAW_ORIGIN = {
  x: 96,
  y: 32
} as const

const LOCAL_CORNER_CLIP_RADIUS = 92
const ZOOM_PERCENT = 260
const DASH_LENGTH = 20
const GAP_LENGTH = 20

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

const CORNER_ANCHOR_IDS = ['tp-48', 'tp-50', 'tp-51'] as const
const CORNER_EXPECTATIONS = {
  'tp-48': {
    minPreviousArmHits: 4,
    minNextArmHits: 4,
    minCoreHits: 0
  },
  'tp-50': {
    minPreviousArmHits: 0,
    minNextArmHits: 0,
    minCoreHits: 0
  },
  'tp-51': {
    minPreviousArmHits: 0,
    minNextArmHits: 0,
    minCoreHits: 0
  }
} as const
const STROKE_WIDTH = 10
const STROKE_RADIUS = STROKE_WIDTH / 2
const LOCAL_JOIN_ARM_LENGTH = STROKE_WIDTH * 2.2
const LOCAL_JOIN_ARM_PROBE_FRACTIONS = [
  0.08, 0.16, 0.28, 0.44, 0.64, 0.88
] as const
const LOCAL_JOIN_CORE_PROBE_FRACTIONS = [0.05, 0.1, 0.16] as const
const LOCAL_JOIN_EMPTY_PROBE_NEAR_DISTANCE = STROKE_WIDTH * 0.45
const LOCAL_JOIN_EMPTY_PROBE_FAR_DISTANCE = STROKE_WIDTH * 0.8
const LOCAL_JOIN_PROBE_RADIUS = 4
const SMOOTH_ENDING_ANCHOR_ID = 'tp-52' as const
const SMOOTH_ENDING_BODY_PROBE_FRACTIONS = [0.35, 0.7, 1.1] as const
const SMOOTH_ENDING_SEAM_PROBE_FRACTIONS = [1.1, 1.45, 1.75] as const
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
  t: number
): WorkspacePoint => {
  const startAnchor = REPORTED_POINTS.find(
    (point) => point.id === segment.startId
  )
  const endAnchor = REPORTED_POINTS.find((point) => point.id === segment.endId)
  if (!startAnchor || !endAnchor) {
    throw new Error(`Missing reported segment anchors for ${segment.id}`)
  }

  const start = toWorkspace(startAnchor)
  const end = toWorkspace(endAnchor)

  const outHandle =
    segment.outControlId != null
      ? toWorkspace(
          REPORTED_POINTS.flatMap((point) => {
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
          REPORTED_POINTS.flatMap((point) => {
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

const patchReportedVectorGeometry = async (page: Page, elementId: string) => {
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
      points: REPORTED_POINTS,
      segments: REPORTED_SEGMENTS
    }
  )
}

const configureReportedStroke = async (page: Page) => {
  const propertiesPanel = getPropertiesPanel(page)
  const strokeWidthInput = propertiesPanel.getByTestId('prop-stroke-width-0')
  const strokeStyleSelect = propertiesPanel.getByTestId('prop-stroke-style-0')
  const strokeDashInput = propertiesPanel.getByTestId('prop-stroke-dash-0')
  const strokeGapInput = propertiesPanel.getByTestId('prop-stroke-gap-0')
  const strokePositionSelect = propertiesPanel.getByTestId(
    'prop-stroke-position-0'
  )
  const strokeJoinSelect = propertiesPanel.getByTestId('prop-stroke-join-0')
  const strokeColorInput = propertiesPanel.getByTestId('prop-stroke-color-0')
  const strokeOpacityInput = propertiesPanel.getByTestId(
    'prop-stroke-opacity-0'
  )

  await strokeStyleSelect.selectOption('dashed')
  await expect(strokeDashInput).toBeVisible()
  await expect(strokeGapInput).toBeVisible()

  await strokeWidthInput.fill('10')
  await strokeWidthInput.press('Enter')
  await strokeDashInput.fill(String(DASH_LENGTH))
  await strokeDashInput.press('Enter')
  await strokeGapInput.fill(String(GAP_LENGTH))
  await strokeGapInput.press('Enter')
  await strokePositionSelect.selectOption('inside')
  await strokeJoinSelect.selectOption('round')
  await strokeColorInput.fill('E10C0C')
  await strokeColorInput.press('Enter')
  await strokeOpacityInput.fill('50')
  await strokeOpacityInput.press('Enter')
}

const clearSelectedVectorPoint = async (page: Page) => {
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('prop-vector-point-x')).not.toBeVisible()
}

const clearElementSelectionByClick = async (page: Page) => {
  await page.keyboard.press('v')
  const blankCanvasPoint = await getCanvasPosition(page, 0.08, 0.08)
  await page.mouse.click(blankCanvasPoint.x, blankCanvasPoint.y)
  await page.waitForTimeout(150)
}

const clearVectorOverlayState = async (page: Page) => {
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    core?.setSystemProperty?.('pathEditingVectorId', null)
    core?.setSystemProperty?.('pathEditingMode', false)
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
  const bisector = normalizeVector(addPoints(previousDirection, nextDirection))
  const toClipPoint = async (point: WorkspacePoint) => {
    const clientPoint = await workspaceToClient(page, point)
    return {
      x: clientPoint.x - clip.x,
      y: clientPoint.y - clip.y
    }
  }
  const previousArmWorkspacePoints = LOCAL_JOIN_ARM_PROBE_FRACTIONS.map(
    (fraction) =>
      addPoints(
        workspaceOracle.anchor,
        scalePoint(previousDirection, STROKE_WIDTH * fraction)
      )
  )
  const nextArmWorkspacePoints = LOCAL_JOIN_ARM_PROBE_FRACTIONS.map(
    (fraction) =>
      addPoints(
        workspaceOracle.anchor,
        scalePoint(nextDirection, STROKE_WIDTH * fraction)
      )
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
  }
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
      addPoints(anchor, scalePoint(seamBisector, STROKE_WIDTH * fraction))
  )
  const expectedEmptyWorkspacePoints = SMOOTH_ENDING_EMPTY_PROBE_FRACTIONS.map(
    (fraction) =>
      addPoints(anchor, scalePoint(emptyDirection, STROKE_WIDTH * fraction))
  )

  const [bodyCovered, seamCovered, expectedEmpty] = await Promise.all([
    Promise.all(bodyWorkspacePoints.map((point) => toClipPoint(point))),
    Promise.all(seamWorkspacePoints.map((point) => toClipPoint(point))),
    Promise.all(expectedEmptyWorkspacePoints.map((point) => toClipPoint(point)))
  ])

  return {
    anchorId: SMOOTH_ENDING_ANCHOR_ID,
    bodyCovered,
    seamCovered,
    expectedEmpty
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
          expectedEmptyProbeCount: 0,
          emptyProbeLeaks: 0,
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

      const bodyProbeRatios = expectedEndingOracle.bodyCovered.map((point) =>
        sampleProbeCoverageRatio(point)
      )
      const seamProbeRatios = expectedEndingOracle.seamCovered.map((point) =>
        sampleProbeCoverageRatio(point)
      )
      const emptyProbeRatios = expectedEndingOracle.expectedEmpty.map((point) =>
        sampleProbeCoverageRatio(point)
      )

      return {
        bodyProbeCount: bodyProbeRatios.length,
        bodyHits: bodyProbeRatios.filter((ratio) => ratio >= 0.2).length,
        seamProbeCount: seamProbeRatios.length,
        seamHits: seamProbeRatios.filter((ratio) => ratio >= 0.2).length,
        expectedEmptyProbeCount: emptyProbeRatios.length,
        emptyProbeLeaks: emptyProbeRatios.filter((ratio) => ratio >= 0.12)
          .length,
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

test.describe('Reported Dashed Stroke Sharp Corners', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await resetCanvas(page)
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

    for (const anchorId of CORNER_ANCHOR_IDS) {
      const expectations = CORNER_EXPECTATIONS[anchorId]
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
        stats.previousArmProbeCount,
        `${anchorId} should define previous-arm probes`
      ).toBeGreaterThanOrEqual(4)
      expect(
        stats.previousArmHits,
        `${anchorId} should satisfy phase2 previous-arm local coverage`
      ).toBeGreaterThanOrEqual(expectations.minPreviousArmHits)
      expect(
        stats.nextArmHits,
        `${anchorId} should satisfy phase2 next-arm local coverage`
      ).toBeGreaterThanOrEqual(expectations.minNextArmHits)
      expect(
        stats.coreHits,
        `${anchorId} should satisfy phase2 core local coverage`
      ).toBeGreaterThanOrEqual(expectations.minCoreHits)
      expect(
        Math.max(stats.previousArmHits, stats.nextArmHits, stats.coreHits),
        `${anchorId} should keep some local stroke coverage in the clip`
      ).toBeGreaterThanOrEqual(1)
      expect(
        stats.emptyProbeLeaks,
        `${anchorId} should keep authored empty probes free of red leakage`
      ).toBe(0)
    }
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
      stats.bodyHits,
      'tp-52 should keep local body coverage before the ending seam'
    ).toBeGreaterThanOrEqual(2)
    expect(
      stats.seamHits,
      'tp-52 should keep the ending seam area filled without a visible notch'
    ).toBeGreaterThanOrEqual(3)
    expect(
      stats.emptyProbeLeaks,
      'tp-52 should keep the local exterior of the ending seam free of red leakage'
    ).toBe(0)
  })
})
