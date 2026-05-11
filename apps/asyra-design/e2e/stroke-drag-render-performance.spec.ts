import { expect, test, type Page } from '@playwright/test'
import {
  createVectorPath,
  getPropertiesPanel,
  getSelectedElementRect,
  resetCanvas,
  waitForAppReady
} from './test-utils'

type DragTarget = 'anchor' | 'in-control' | 'out-control'
type StrokeCase =
  | { label: string; style: 'solid'; position: 'center'; cap: 'round' }
  | {
      label: string
      style: 'dashed'
      position: 'inside'
      cap: 'butt' | 'square' | 'round'
    }

interface ClientPoint {
  x: number
  y: number
}

interface DragMetrics {
  label: string
  frameCount: number
  averageMs: number
  p95Ms: number
  maxMs: number
  droppedFrameCount: number
}

const FRAME_BUDGET_120FPS_MS = 8.33
const DRAG_STEP_COUNT = Number(process.env.ASYRA_STROKE_DRAG_E2E_STEPS ?? 24)
const SHOULD_ENFORCE_120FPS =
  process.env.ASYRA_STROKE_DRAG_E2E_ENFORCE_120FPS === '1'
const STROKE_OPACITY_PERCENT = '50'
const STROKE_WIDTH = 10

const STROKE_CASES: StrokeCase[] = [
  {
    label: 'inside-dashed-butt',
    style: 'dashed',
    position: 'inside',
    cap: 'butt'
  },
  {
    label: 'inside-dashed-square',
    style: 'dashed',
    position: 'inside',
    cap: 'square'
  },
  {
    label: 'inside-dashed-round',
    style: 'dashed',
    position: 'inside',
    cap: 'round'
  },
  {
    label: 'center-solid-round',
    style: 'solid',
    position: 'center',
    cap: 'round'
  }
]

const DRAG_TARGETS: DragTarget[] = ['anchor', 'in-control', 'out-control']

const getPercentile = (values: number[], percentile: number) => {
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * percentile) - 1)
  )
  return sorted[index] ?? 0
}

const waitForPaintFrame = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve(performance.now()))
        })
      })
  )

const patchSelectedVectorToReportedClosedStar = async (page: Page) => {
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId = core?.deps?.selection?.getElementSelectionIds?.()?.[0]
    if (!selectedId) {
      throw new Error('No selected vector to patch')
    }

    const element = core?.deps?.sceneTree?.getElementById?.(selectedId)
    const computed = element?.getAllComputedData?.()
    const primaryNetwork = Object.values(computed?.networks ?? {})[0] as
      | { id: string }
      | undefined

    if (!computed || !primaryNetwork) {
      throw new Error('Missing vector topology')
    }

    const nextPoints = {
      'tp-56': {
        id: 'tp-56',
        kind: 'anchor',
        anchorType: 'sharp',
        x: 246.91886685202462,
        y: 0
      },
      'tp-57': {
        id: 'tp-57',
        kind: 'anchor',
        anchorType: 'smooth',
        x: 75.04396933738008,
        y: 457.5261356375752
      },
      'tp-56:out': {
        id: 'tp-56:out',
        kind: 'control',
        controlRole: 'out',
        x: 195.9809570843745,
        y: 149.61104635348715
      },
      'tp-57:in': {
        id: 'tp-57:in',
        kind: 'control',
        controlRole: 'in',
        x: -46.963000165973426,
        y: 476.8923212730281
      },
      'tp-57:out': {
        id: 'tp-57:out',
        kind: 'control',
        controlRole: 'out',
        x: 227.55268121657173,
        y: 433.3184035932593
      },
      'tp-58': {
        id: 'tp-58',
        kind: 'anchor',
        anchorType: 'sharp',
        x: 423.6353107755326,
        y: 198.5034027633924
      },
      'tp-59': {
        id: 'tp-59',
        kind: 'anchor',
        anchorType: 'sharp',
        x: 0,
        y: 91.98938176840147
      },
      'tp-60': {
        id: 'tp-60',
        kind: 'anchor',
        anchorType: 'smooth',
        x: 307.43819696281525,
        y: 428.4768571843963
      },
      'tp-59:out': {
        id: 'tp-59:out',
        kind: 'control',
        controlRole: 'out',
        x: 0,
        y: 91.98938176840147
      },
      'tp-60:in': {
        id: 'tp-60:in',
        kind: 'control',
        controlRole: 'in',
        x: 275.9681453052044,
        y: 498.6792801129134
      },
      'tp-60:out': {
        id: 'tp-60:out',
        kind: 'control',
        controlRole: 'out',
        x: 338.9082486204261,
        y: 358.2744342558792
      }
    }

    const nextSegments = {
      'seg-56-57': {
        id: 'seg-56-57',
        startId: 'tp-56',
        endId: 'tp-57',
        outControlId: 'tp-56:out',
        inControlId: 'tp-57:in'
      },
      'seg-57-58': {
        id: 'seg-57-58',
        startId: 'tp-57',
        endId: 'tp-58',
        outControlId: 'tp-57:out',
        inControlId: null
      },
      'seg-58-59': {
        id: 'seg-58-59',
        startId: 'tp-58',
        endId: 'tp-59',
        outControlId: null,
        inControlId: null
      },
      'seg-59-60': {
        id: 'seg-59-60',
        startId: 'tp-59',
        endId: 'tp-60',
        outControlId: 'tp-59:out',
        inControlId: 'tp-60:in'
      },
      'seg-60-56': {
        id: 'seg-60-56',
        startId: 'tp-60',
        endId: 'tp-56',
        outControlId: 'tp-60:out',
        inControlId: null
      }
    }

    core?.changeComputedData?.(
      [selectedId],
      {
        points: nextPoints,
        segments: nextSegments,
        networks: {
          [primaryNetwork.id]: {
            id: primaryNetwork.id,
            pointIds: ['tp-56', 'tp-57', 'tp-58', 'tp-59', 'tp-60'],
            segmentIds: [
              'seg-56-57',
              'seg-57-58',
              'seg-58-59',
              'seg-59-60',
              'seg-60-56'
            ],
            closed: true
          }
        },
        closed: true,
        width: 423.6353107755326,
        height: 457.5261356375752
      },
      { undoable: false }
    )
  })
  await page.waitForTimeout(180)
}

const configureStroke = async (page: Page, strokeCase: StrokeCase) => {
  const propertiesPanel = getPropertiesPanel(page)
  if (await propertiesPanel.getByTestId('prop-strokes-empty').isVisible()) {
    await propertiesPanel.getByTestId('prop-stroke-add').click()
  }
  await expect(propertiesPanel.getByTestId('prop-stroke-0')).toBeVisible()

  await propertiesPanel
    .getByTestId('prop-stroke-style-0')
    .selectOption(strokeCase.style)
  await propertiesPanel
    .getByTestId('prop-stroke-position-0')
    .selectOption(strokeCase.position)
  await propertiesPanel.getByTestId('prop-stroke-join-0').selectOption('miter')
  await propertiesPanel
    .getByTestId('prop-stroke-cap-0')
    .selectOption(strokeCase.cap)
  await propertiesPanel
    .getByTestId('prop-stroke-width-0')
    .fill(String(STROKE_WIDTH))
  await propertiesPanel.getByTestId('prop-stroke-width-0').press('Enter')
  await propertiesPanel
    .getByTestId('prop-stroke-opacity-0')
    .fill(STROKE_OPACITY_PERCENT)
  await propertiesPanel.getByTestId('prop-stroke-opacity-0').press('Enter')

  if (strokeCase.style === 'dashed') {
    await propertiesPanel.getByTestId('prop-stroke-pattern-0').fill('20, 20')
    await propertiesPanel.getByTestId('prop-stroke-pattern-0').press('Enter')
    await propertiesPanel.getByTestId('prop-stroke-offset-0').fill('0')
    await propertiesPanel.getByTestId('prop-stroke-offset-0').press('Enter')
  }
  await page.waitForTimeout(180)
}

const enterPathEditing = async (page: Page) => {
  await page.keyboard.press('Enter')
  await expect
    .poll(() =>
      page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const core = (window as any).__Core__
        return core?.getSystemProperty?.('pathEditingMode') ?? false
      })
    )
    .toBe(true)
}

const getPointClientPosition = async (
  page: Page,
  pointId: string
): Promise<ClientPoint> =>
  page.evaluate((targetPointId) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const vectorId = core?.getSystemProperty?.('pathEditingVectorId')
    const element = vectorId
      ? core?.deps?.sceneTree?.getElementById?.(vectorId)
      : undefined
    const computed = element?.getAllComputedData?.() ?? {}
    const point = computed.points?.[targetPointId]
    if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') {
      throw new Error(`Missing point ${targetPointId}`)
    }

    const zoom = core?.getSystemProperty?.('zoom') ?? 1
    const viewport = core?.getSystemProperty?.('viewportPosition') ?? {
      x: 0,
      y: 0
    }
    const offsetX = typeof computed.x === 'number' ? computed.x : 0
    const offsetY = typeof computed.y === 'number' ? computed.y : 0

    return {
      x: (offsetX + point.x) * zoom + viewport.x,
      y: (offsetY + point.y) * zoom + viewport.y
    }
  }, pointId)

const getDragStartPoint = async (
  page: Page,
  target: DragTarget
): Promise<ClientPoint> => {
  if (target === 'anchor') {
    return getPointClientPosition(page, 'tp-56')
  }
  if (target === 'in-control') {
    return getPointClientPosition(page, 'tp-60:out')
  }
  return getPointClientPosition(page, 'tp-56:out')
}

const getDragDelta = (target: DragTarget): ClientPoint => {
  if (target === 'anchor') {
    return { x: 32, y: 18 }
  }
  if (target === 'in-control') {
    return { x: -28, y: 22 }
  }
  return { x: 26, y: -24 }
}

const analyzeGreenRaster = async (
  page: Page,
  screenshotBase64: string
): Promise<{
  strokeCoverage: number
  doubleAlphaCoverage: number
}> =>
  page.evaluate(async (base64) => {
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
    const image = context.getImageData(0, 0, canvas.width, canvas.height).data
    let strokePixels = 0
    let doubleAlphaPixels = 0
    const totalPixels = canvas.width * canvas.height
    for (let index = 0; index < image.length; index += 4) {
      const red = image[index]
      const green = image[index + 1]
      const blue = image[index + 2]
      const strongestStrokeChannel = Math.max(red, green, blue)
      if (
        strongestStrokeChannel > 80 &&
        !(blue > red + 35 && blue > green + 35)
      ) {
        strokePixels += 1
      }
      if (
        strongestStrokeChannel > 165 &&
        !(blue > red + 35 && blue > green + 35)
      ) {
        doubleAlphaPixels += 1
      }
    }

    return {
      strokeCoverage: strokePixels / totalPixels,
      doubleAlphaCoverage: doubleAlphaPixels / totalPixels
    }
  }, screenshotBase64)

const captureSelectedElementStrokeStats = async (page: Page) => {
  const rect = await getSelectedElementRect(page)
  if (!rect) {
    throw new Error('No selected element rect available')
  }
  const viewportState = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    return {
      zoom: core?.getSystemProperty?.('zoom') ?? 1,
      viewport: core?.getSystemProperty?.('viewportPosition') ?? { x: 0, y: 0 }
    }
  })
  const padding = 48
  const viewportSize = page.viewportSize() ?? { width: 1280, height: 900 }
  const clipX = Math.max(
    0,
    Math.floor(rect.x * viewportState.zoom + viewportState.viewport.x - padding)
  )
  const clipY = Math.max(
    0,
    Math.floor(rect.y * viewportState.zoom + viewportState.viewport.y - padding)
  )
  const screenshot = await page.screenshot({
    clip: {
      x: clipX,
      y: clipY,
      width: Math.max(
        1,
        Math.min(
          viewportSize.width - clipX,
          Math.ceil(rect.width * viewportState.zoom + padding * 2)
        )
      ),
      height: Math.max(
        1,
        Math.min(
          viewportSize.height - clipY,
          Math.ceil(rect.height * viewportState.zoom + padding * 2)
        )
      )
    }
  })
  return analyzeGreenRaster(page, screenshot.toString('base64'))
}

const centerSelectedVectorInViewport = async (page: Page) => {
  const rect = await getSelectedElementRect(page)
  if (!rect) {
    throw new Error('No selected vector rect available')
  }
  const viewportSize = page.viewportSize() ?? { width: 1280, height: 900 }
  const zoom = 1.15
  await page.evaluate(
    ({ rect, zoom, viewportSize }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      core?.setSystemProperty?.('zoom', zoom)
      core?.setSystemProperty?.('viewportPosition', {
        x: viewportSize.width / 2 - (rect.x + rect.width / 2) * zoom,
        y: viewportSize.height / 2 - (rect.y + rect.height / 2) * zoom
      })
    },
    { rect, zoom, viewportSize }
  )
  await page.waitForTimeout(120)
}

const clearVectorEditingState = async (page: Page) => {
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    core?.setSystemProperty?.('pathEditingVectorId', null)
    core?.setSystemProperty?.('pathEditingMode', false)
    core?.setSystemProperty?.('mouseDragging', false)
    core?.setSystemProperty?.('mouseDown', false)
    core?.setSystemProperty?.('selectedVectorPoint', null)
    core?.setSystemProperty?.('hoveredVectorPoint', null)
    core?.setSystemProperty?.('selectedVectorSegment', null)
    core?.setSystemProperty?.('hoveredVectorSegment', null)
    core?.setUIProperty?.('vectorPointSelection', new Set())
    core?.setUIProperty?.('vectorSegmentSelection', new Set())
  })
  await page.waitForTimeout(80)
}

const setupReportedStar = async (page: Page, strokeCase: StrokeCase) => {
  await resetCanvas(page)
  await createVectorPath(page, 0.32, 0.28, 0.16, 0.12)
  await clearVectorEditingState(page)
  await patchSelectedVectorToReportedClosedStar(page)
  await centerSelectedVectorInViewport(page)
  await configureStroke(page, strokeCase)
  await enterPathEditing(page)
}

const measureDrag = async (
  page: Page,
  label: string,
  target: DragTarget
): Promise<DragMetrics> => {
  const startPoint = await getDragStartPoint(page, target)
  const delta = getDragDelta(target)
  const frameTimes: number[] = []
  let droppedFrameCount = 0

  await page.mouse.move(startPoint.x, startPoint.y)
  await page.mouse.down()
  for (let step = 1; step <= DRAG_STEP_COUNT; step += 1) {
    const progress = step / DRAG_STEP_COUNT
    const nextPoint = {
      x: startPoint.x + delta.x * progress,
      y: startPoint.y + delta.y * progress
    }
    const browserStart = await page.evaluate(() => performance.now())
    await page.mouse.move(nextPoint.x, nextPoint.y)
    const browserPaint = await waitForPaintFrame(page)
    const frameMs = browserPaint - browserStart
    frameTimes.push(frameMs)
    if (frameMs > FRAME_BUDGET_120FPS_MS) {
      droppedFrameCount += 1
    }

    if (step === Math.ceil(DRAG_STEP_COUNT / 2)) {
      const stats = await captureSelectedElementStrokeStats(page)
      expect(
        stats.strokeCoverage,
        `${label}:${target} should keep stroke coverage during drag`
      ).toBeGreaterThan(0.0005)
      expect(
        stats.doubleAlphaCoverage,
        `${label}:${target} should not show product double-alpha overlap during drag`
      ).toBeLessThan(0.08)
    }
  }
  await page.mouse.up()
  await waitForPaintFrame(page)

  return {
    label: `${label}:${target}`,
    frameCount: frameTimes.length,
    averageMs:
      frameTimes.reduce((total, value) => total + value, 0) / frameTimes.length,
    p95Ms: getPercentile(frameTimes, 0.95),
    maxMs: Math.max(...frameTimes),
    droppedFrameCount
  }
}

test.describe('stroke drag render performance UX gate', () => {
  test.setTimeout(120000)

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
  })

  test('measures real browser point and handle drag rendering with product visual probes', async ({
    page
  }) => {
    const metrics: DragMetrics[] = []

    for (const strokeCase of STROKE_CASES) {
      for (const target of DRAG_TARGETS) {
        await setupReportedStar(page, strokeCase)
        metrics.push(await measureDrag(page, strokeCase.label, target))
      }
    }

    const maxP95Ms = Math.max(...metrics.map((metric) => metric.p95Ms))
    const totalDroppedFrameCount = metrics.reduce(
      (total, metric) => total + metric.droppedFrameCount,
      0
    )
    console.log(
      `STROKE_DRAG_E2E_METRICS ${JSON.stringify({
        measurementScope: 'browser-ux',
        rendererCoverage: 'real',
        frameBudgetMs: FRAME_BUDGET_120FPS_MS,
        enforce120fps: SHOULD_ENFORCE_120FPS,
        maxP95Ms,
        totalDroppedFrameCount,
        metrics
      })}`
    )

    expect(maxP95Ms).toBeGreaterThan(0)
    if (SHOULD_ENFORCE_120FPS) {
      expect(maxP95Ms).toBeLessThan(FRAME_BUDGET_120FPS_MS)
    }
  })
})
