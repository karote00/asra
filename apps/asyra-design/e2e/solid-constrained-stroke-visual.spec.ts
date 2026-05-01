import { expect, test, type Page } from '@playwright/test'
import {
  createOval,
  createRectangle,
  createVectorPath,
  getCanvasPosition,
  getPropertiesPanel,
  getSelectedElementRect,
  resetCanvas,
  waitForAppReady
} from './test-utils'

interface SelectedElementSnapshot {
  rect: {
    x: number
    y: number
    width: number
    height: number
  }
  zoom: number
  viewport: {
    x: number
    y: number
  }
}

interface RasterCapture {
  base64: string
  width: number
  height: number
  elementWidth: number
  elementHeight: number
  strokeWidthPx: number
  padding: number
}

const PADDING = 24
const STROKE_WIDTH = 10
const MIN_SUPPORTED_COVERAGE = 0.6
const MAX_UNSUPPORTED_COVERAGE = 0.03
const MAX_EXTERIOR_LEAK = 0.12
const MAX_CAP_VARIANCE = 0.12
const STROKE_COLOR = '00FF00'

const getSelectedElementSnapshot = async (
  page: Page
): Promise<SelectedElementSnapshot> => {
  const rect = await getSelectedElementRect(page)
  if (!rect) {
    throw new Error('No selected element snapshot available')
  }

  const viewportState = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    return {
      zoom: core?.getSystemProperty?.('zoom') ?? 1,
      viewport: core?.getSystemProperty?.('viewportPosition') ?? { x: 0, y: 0 }
    }
  })

  return {
    rect: {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height
    },
    zoom: viewportState.zoom,
    viewport: viewportState.viewport
  }
}

const captureSelectedElementRaster = async (
  page: Page,
  strokeWidth: number,
  padding = PADDING
): Promise<RasterCapture> => {
  const snapshot = await getSelectedElementSnapshot(page)
  const clip = {
    x: Math.max(
      0,
      Math.floor(
        snapshot.rect.x * snapshot.zoom + snapshot.viewport.x - padding
      )
    ),
    y: Math.max(
      0,
      Math.floor(
        snapshot.rect.y * snapshot.zoom + snapshot.viewport.y - padding
      )
    ),
    width: Math.max(
      1,
      Math.ceil(snapshot.rect.width * snapshot.zoom + padding * 2)
    ),
    height: Math.max(
      1,
      Math.ceil(snapshot.rect.height * snapshot.zoom + padding * 2)
    )
  }
  const screenshot = await page.screenshot({ clip })

  return {
    base64: screenshot.toString('base64'),
    width: clip.width,
    height: clip.height,
    elementWidth: Math.ceil(snapshot.rect.width * snapshot.zoom),
    elementHeight: Math.ceil(snapshot.rect.height * snapshot.zoom),
    strokeWidthPx: Math.max(1, Math.round(strokeWidth * snapshot.zoom)),
    padding
  }
}

const getGreenCoverage = async (
  page: Page,
  raster: RasterCapture,
  region: { x: number; y: number; width: number; height: number }
) =>
  page.evaluate(
    async ({
      base64,
      region: targetRegion
    }: {
      base64: string
      region: { x: number; y: number; width: number; height: number }
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
      const startX = Math.max(0, Math.floor(targetRegion.x))
      const startY = Math.max(0, Math.floor(targetRegion.y))
      const endX = Math.min(
        canvas.width,
        Math.ceil(targetRegion.x + targetRegion.width)
      )
      const endY = Math.min(
        canvas.height,
        Math.ceil(targetRegion.y + targetRegion.height)
      )

      let total = 0
      let green = 0
      for (let y = startY; y < endY; y += 1) {
        for (let x = startX; x < endX; x += 1) {
          const [r, g, b, a] = context.getImageData(x, y, 1, 1).data
          total += 1
          if (
            a > 180 &&
            g > 170 &&
            r < 120 &&
            b < 120 &&
            g - r > 70 &&
            g - b > 70
          ) {
            green += 1
          }
        }
      }

      return total > 0 ? green / total : 0
    },
    {
      base64: raster.base64,
      region: targetRegion(region, raster)
    }
  )

const targetRegion = (
  region: { x: number; y: number; width: number; height: number },
  raster: RasterCapture
) => ({
  x: Math.max(0, region.x),
  y: Math.max(0, region.y),
  width: Math.min(region.width, raster.width - region.x),
  height: Math.min(region.height, raster.height - region.y)
})

const getRectProbeRegions = (raster: RasterCapture) => {
  const centerColumn = raster.padding + raster.elementWidth / 2 - 2
  const centerRow = raster.padding + raster.elementHeight / 2 - 2
  const bandWidth = 4
  const bandHeight = Math.max(2, raster.strokeWidthPx - 2)

  return {
    topInside: {
      x: centerColumn,
      y: raster.padding + 1,
      width: bandWidth,
      height: bandHeight
    },
    topOutside: {
      x: centerColumn,
      y: raster.padding - raster.strokeWidthPx + 1,
      width: bandWidth,
      height: bandHeight
    },
    leftInside: {
      x: raster.padding + 1,
      y: centerRow,
      width: bandHeight,
      height: bandWidth
    },
    leftOutside: {
      x: raster.padding - raster.strokeWidthPx + 1,
      y: centerRow,
      width: bandHeight,
      height: bandWidth
    },
    center: {
      x: raster.padding + raster.elementWidth / 2 - 4,
      y: raster.padding + raster.elementHeight / 2 - 4,
      width: 8,
      height: 8
    }
  }
}

const getOpenPolylineProbeRegions = (raster: RasterCapture) => {
  const bandWidth = 4
  const bandHeight = Math.max(2, raster.strokeWidthPx - 2)

  return {
    topLine: {
      x: raster.padding + raster.elementWidth / 2 - bandWidth / 2,
      y: raster.padding - bandHeight / 2,
      width: bandWidth,
      height: bandHeight
    },
    rightLine: {
      x: raster.padding + raster.elementWidth - bandHeight / 2,
      y: raster.padding + raster.elementHeight / 2 - bandWidth / 2,
      width: bandHeight,
      height: bandWidth
    },
    centerGap: {
      x: raster.padding + raster.elementWidth / 2 - 4,
      y: raster.padding + raster.elementHeight / 2 - 4,
      width: 8,
      height: 8
    }
  }
}

const getOpenDiagonalProbeRegions = (raster: RasterCapture) => ({
  strokeEnvelope: {
    x: raster.padding,
    y: raster.padding,
    width: raster.elementWidth,
    height: raster.elementHeight
  }
})

const getOvalProbeRegions = (raster: RasterCapture) => {
  const centerColumn = raster.padding + raster.elementWidth / 2 - 2
  const centerRow = raster.padding + raster.elementHeight / 2 - 2
  const bandWidth = 4
  const bandHeight = Math.max(2, raster.strokeWidthPx - 2)

  return {
    topInside: {
      x: centerColumn,
      y: raster.padding + 2,
      width: bandWidth,
      height: bandHeight
    },
    topOutside: {
      x: centerColumn,
      y: raster.padding - raster.strokeWidthPx + 2,
      width: bandWidth,
      height: bandHeight
    },
    leftInside: {
      x: raster.padding + 2,
      y: centerRow,
      width: bandHeight,
      height: bandWidth
    },
    leftOutside: {
      x: raster.padding - raster.strokeWidthPx + 2,
      y: centerRow,
      width: bandHeight,
      height: bandWidth
    },
    center: {
      x: raster.padding + raster.elementWidth / 2 - 4,
      y: raster.padding + raster.elementHeight / 2 - 4,
      width: 8,
      height: 8
    }
  }
}

const ensureSelectedStrokeRow = async (page: Page) => {
  const propertiesPanel = getPropertiesPanel(page)
  if (await propertiesPanel.getByTestId('prop-strokes-empty').isVisible()) {
    await propertiesPanel.getByTestId('prop-stroke-add').click()
  }

  await expect(propertiesPanel.getByTestId('prop-stroke-0')).toBeVisible()
}

const configureSelectedStroke = async (
  page: Page,
  config: {
    elementType?: 'rect' | 'oval' | 'vector'
    position: 'center' | 'inside' | 'outside'
    join: 'miter' | 'bevel' | 'round'
    cap: 'butt' | 'square' | 'round'
    width?: number
    color?: string
  }
) => {
  await ensureElementSelected(page, config.elementType)
  const propertiesPanel = getPropertiesPanel(page)
  await ensureSelectedStrokeRow(page)

  const width = String(config.width ?? STROKE_WIDTH)
  const color = config.color ?? STROKE_COLOR

  await propertiesPanel.getByTestId('prop-stroke-style-0').selectOption('solid')
  await propertiesPanel
    .getByTestId('prop-stroke-position-0')
    .selectOption(config.position)
  await propertiesPanel
    .getByTestId('prop-stroke-join-0')
    .selectOption(config.join)
  await propertiesPanel
    .getByTestId('prop-stroke-cap-0')
    .selectOption(config.cap)
  await propertiesPanel.getByTestId('prop-stroke-width-0').fill(width)
  await propertiesPanel.getByTestId('prop-stroke-width-0').press('Enter')
  await propertiesPanel.getByTestId('prop-stroke-color-0').fill(color)
  await propertiesPanel.getByTestId('prop-stroke-color-0').press('Enter')
  await page.waitForTimeout(180)
}

const createTwoPointVectorPath = async (page: Page) => {
  const first = await getCanvasPosition(page, 0.3, 0.3)
  const second = await getCanvasPosition(page, 0.42, 0.38)

  await page.keyboard.press('p')
  await page.waitForTimeout(100)
  await page.mouse.click(first.x, first.y)
  await page.waitForTimeout(120)
  await page.mouse.click(second.x, second.y)
  await page.waitForTimeout(240)
  await page.keyboard.press('v')
  await page.waitForTimeout(120)
}

const getSelectedStrokeRowSnapshot = async (page: Page, strokeIndex: number) =>
  page.evaluate((index) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId = core?.deps?.selection?.getElementSelectionIds?.()?.[0]
    if (!selectedId) {
      throw new Error('No selected element for stroke snapshot')
    }

    const element = core?.deps?.sceneTree?.getElementById?.(selectedId)
    const computed = element?.getAllComputedData?.() ?? {}
    const stroke = Array.isArray(computed.strokes)
      ? computed.strokes[index]
      : undefined

    if (!stroke) {
      throw new Error(`Missing selected stroke row ${index}`)
    }

    return {
      style: stroke.style,
      position: stroke.position,
      width: stroke.width,
      joinType: stroke.joinType,
      capType: stroke.capType
    }
  }, strokeIndex)

const patchSelectedVectorToClosedRectangle = async (page: Page) => {
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
      a: { id: 'a', kind: 'anchor', x: 0, y: 0, anchorType: 'sharp' },
      b: { id: 'b', kind: 'anchor', x: 80, y: 0, anchorType: 'sharp' },
      c: { id: 'c', kind: 'anchor', x: 80, y: 40, anchorType: 'sharp' },
      d: { id: 'd', kind: 'anchor', x: 0, y: 40, anchorType: 'sharp' }
    }

    const nextSegments = {
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
      da: {
        id: 'da',
        startId: 'd',
        endId: 'a',
        outControlId: null,
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
            pointIds: ['a', 'b', 'c', 'd'],
            segmentIds: ['ab', 'bc', 'cd', 'da'],
            closed: true
          }
        },
        closed: true,
        width: 80,
        height: 40
      },
      { undoable: false }
    )
  })

  await page.waitForTimeout(180)
}

const patchSelectedVectorToOpenPolyline = async (page: Page) => {
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
      a: { id: 'a', kind: 'anchor', x: 0, y: 0, anchorType: 'sharp' },
      b: { id: 'b', kind: 'anchor', x: 80, y: 0, anchorType: 'sharp' },
      c: { id: 'c', kind: 'anchor', x: 80, y: 40, anchorType: 'sharp' }
    }

    const nextSegments = {
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
            pointIds: ['a', 'b', 'c'],
            segmentIds: ['ab', 'bc'],
            closed: false
          }
        },
        closed: false,
        width: 80,
        height: 40
      },
      { undoable: false }
    )
  })

  await page.waitForTimeout(180)
}

const patchSelectedVectorToSelfIntersectingBowtie = async (page: Page) => {
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
      a: { id: 'a', kind: 'anchor', x: 0, y: 0, anchorType: 'sharp' },
      b: { id: 'b', kind: 'anchor', x: 80, y: 40, anchorType: 'sharp' },
      c: { id: 'c', kind: 'anchor', x: 0, y: 40, anchorType: 'sharp' },
      d: { id: 'd', kind: 'anchor', x: 80, y: 0, anchorType: 'sharp' }
    }

    const nextSegments = {
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
      da: {
        id: 'da',
        startId: 'd',
        endId: 'a',
        outControlId: null,
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
            pointIds: ['a', 'b', 'c', 'd'],
            segmentIds: ['ab', 'bc', 'cd', 'da'],
            closed: true
          }
        },
        closed: true,
        width: 80,
        height: 40
      },
      { undoable: false }
    )
  })

  await page.waitForTimeout(180)
}

const ensureElementSelected = async (
  page: Page,
  expectedType?: 'rect' | 'oval' | 'vector'
) => {
  await page.evaluate(
    ({ expectedType }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const selectedIds =
        core?.deps?.selection?.getElementSelectionIds?.() ?? []
      if (selectedIds.length > 0) {
        return
      }

      const elements = core?.deps?.sceneTree?.getAllElements?.()
      if (!(elements instanceof Map) || elements.size === 0) {
        throw new Error('No element available to select')
      }

      const ordered = Array.from(elements.entries()).reverse()
      const targetEntry = ordered.find(([id, element]) => {
        if (id === 'workspace') {
          return false
        }

        if (!expectedType) {
          return true
        }

        const computed = element?.getAllComputedData?.() ?? {}
        const elementType =
          computed.type ?? element?.type ?? element?.getType?.() ?? null

        return expectedType ? elementType === expectedType : true
      })

      const targetId = targetEntry?.[0] ?? null
      if (!targetId) {
        throw new Error(
          expectedType
            ? `No element available to select for type ${expectedType}`
            : 'No element available to select'
        )
      }

      core?.selectElements?.([targetId], { undoable: false })
    },
    { expectedType }
  )

  await page.waitForTimeout(150)
  await expect(
    getPropertiesPanel(page).getByTestId('prop-strokes-section')
  ).toBeVisible()
}

const clearVectorOverlayState = async (page: Page) => {
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    core?.setSystemProperty?.('selectedVectorPoint', null)
    core?.setSystemProperty?.('pathEditingVectorId', null)
    core?.setSystemProperty?.('pathEditingMode', false)
  })

  await page.waitForTimeout(120)
}

test.describe('Constrained Solid Stroke Visual Benchmarks', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await resetCanvas(page)
  })

  test('benchmark: rectangle inside bevel keeps full supported band coverage', async ({
    page
  }) => {
    await createRectangle(page, 0.3, 0.3)
    await configureSelectedStroke(page, {
      elementType: 'rect',
      position: 'inside',
      join: 'bevel',
      cap: 'butt'
    })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const probes = getRectProbeRegions(raster)

    const [topInside, topOutside, leftInside, center] = await Promise.all([
      getGreenCoverage(page, raster, probes.topInside),
      getGreenCoverage(page, raster, probes.topOutside),
      getGreenCoverage(page, raster, probes.leftInside),
      getGreenCoverage(page, raster, probes.center)
    ])

    expect(topInside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(leftInside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(topOutside).toBeLessThan(MAX_EXTERIOR_LEAK)
    expect(center).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
  })

  test('benchmark: rectangle outside bevel keeps full supported outer band coverage', async ({
    page
  }) => {
    await createRectangle(page, 0.3, 0.3)
    await configureSelectedStroke(page, {
      elementType: 'rect',
      position: 'outside',
      join: 'bevel',
      cap: 'butt'
    })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const probes = getRectProbeRegions(raster)

    const [topOutside, topInside, leftOutside, center] = await Promise.all([
      getGreenCoverage(page, raster, probes.topOutside),
      getGreenCoverage(page, raster, probes.topInside),
      getGreenCoverage(page, raster, probes.leftOutside),
      getGreenCoverage(page, raster, probes.center)
    ])

    expect(topOutside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(leftOutside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(topInside).toBeLessThan(MAX_EXTERIOR_LEAK)
    expect(center).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
  })

  test('benchmark: rectangle inside miter keeps full supported band coverage', async ({
    page
  }) => {
    await createRectangle(page, 0.3, 0.3)
    await configureSelectedStroke(page, {
      elementType: 'rect',
      position: 'inside',
      join: 'miter',
      cap: 'butt'
    })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const probes = getRectProbeRegions(raster)

    const [topInside, topOutside, leftInside, center] = await Promise.all([
      getGreenCoverage(page, raster, probes.topInside),
      getGreenCoverage(page, raster, probes.topOutside),
      getGreenCoverage(page, raster, probes.leftInside),
      getGreenCoverage(page, raster, probes.center)
    ])

    expect(topInside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(leftInside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(topOutside).toBeLessThan(MAX_EXTERIOR_LEAK)
    expect(center).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
  })

  test('benchmark: rectangle outside miter keeps full supported outer band coverage', async ({
    page
  }) => {
    await createRectangle(page, 0.3, 0.3)
    await configureSelectedStroke(page, {
      elementType: 'rect',
      position: 'outside',
      join: 'miter',
      cap: 'butt'
    })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const probes = getRectProbeRegions(raster)

    const [topOutside, topInside, leftOutside, center] = await Promise.all([
      getGreenCoverage(page, raster, probes.topOutside),
      getGreenCoverage(page, raster, probes.topInside),
      getGreenCoverage(page, raster, probes.leftOutside),
      getGreenCoverage(page, raster, probes.center)
    ])

    expect(topOutside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(leftOutside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(topInside).toBeLessThan(MAX_EXTERIOR_LEAK)
    expect(center).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
  })

  test('benchmark: oval inside bevel stays visually smooth enough to keep the sampled inside band covered', async ({
    page
  }) => {
    await createOval(page, 0.35, 0.35)
    await configureSelectedStroke(page, {
      elementType: 'oval',
      position: 'inside',
      join: 'bevel',
      cap: 'butt',
      width: 8
    })

    const raster = await captureSelectedElementRaster(page, 8)
    const probes = getOvalProbeRegions(raster)

    const [topInside, topOutside, leftInside, leftOutside] = await Promise.all([
      getGreenCoverage(page, raster, probes.topInside),
      getGreenCoverage(page, raster, probes.topOutside),
      getGreenCoverage(page, raster, probes.leftInside),
      getGreenCoverage(page, raster, probes.leftOutside)
    ])

    expect(topInside).toBeGreaterThan(0.45)
    expect(leftInside).toBeGreaterThan(0.45)
    expect(topOutside).toBeLessThan(MAX_EXTERIOR_LEAK)
    expect(leftOutside).toBeLessThan(MAX_EXTERIOR_LEAK)
  })

  test('benchmark: oval inside miter keeps the sampled inside band covered', async ({
    page
  }) => {
    await createOval(page, 0.35, 0.35)
    await configureSelectedStroke(page, {
      elementType: 'oval',
      position: 'inside',
      join: 'miter',
      cap: 'butt',
      width: 8
    })

    const raster = await captureSelectedElementRaster(page, 8)
    const probes = getOvalProbeRegions(raster)

    const [topInside, topOutside, leftInside, leftOutside] = await Promise.all([
      getGreenCoverage(page, raster, probes.topInside),
      getGreenCoverage(page, raster, probes.topOutside),
      getGreenCoverage(page, raster, probes.leftInside),
      getGreenCoverage(page, raster, probes.leftOutside)
    ])

    expect(topInside).toBeGreaterThan(0.45)
    expect(leftInside).toBeGreaterThan(0.45)
    expect(topOutside).toBeLessThan(MAX_EXTERIOR_LEAK)
    expect(leftOutside).toBeLessThan(MAX_EXTERIOR_LEAK)
  })

  test('benchmark: oval outside bevel keeps the sampled outside band covered', async ({
    page
  }) => {
    await createOval(page, 0.35, 0.35)
    await configureSelectedStroke(page, {
      elementType: 'oval',
      position: 'outside',
      join: 'bevel',
      cap: 'butt',
      width: 8
    })

    const raster = await captureSelectedElementRaster(page, 8)
    const probes = getOvalProbeRegions(raster)

    const [topOutside, topInside, leftOutside, leftInside] = await Promise.all([
      getGreenCoverage(page, raster, probes.topOutside),
      getGreenCoverage(page, raster, probes.topInside),
      getGreenCoverage(page, raster, probes.leftOutside),
      getGreenCoverage(page, raster, probes.leftInside)
    ])

    expect(topOutside).toBeGreaterThan(0.45)
    expect(leftOutside).toBeGreaterThan(0.45)
    expect(topInside).toBeLessThan(MAX_EXTERIOR_LEAK)
    expect(leftInside).toBeLessThan(MAX_EXTERIOR_LEAK)
  })

  test('benchmark: oval outside miter keeps the sampled outside band covered', async ({
    page
  }) => {
    await createOval(page, 0.35, 0.35)
    await configureSelectedStroke(page, {
      elementType: 'oval',
      position: 'outside',
      join: 'miter',
      cap: 'butt',
      width: 8
    })

    const raster = await captureSelectedElementRaster(page, 8)
    const probes = getOvalProbeRegions(raster)

    const [topOutside, topInside, leftOutside, leftInside] = await Promise.all([
      getGreenCoverage(page, raster, probes.topOutside),
      getGreenCoverage(page, raster, probes.topInside),
      getGreenCoverage(page, raster, probes.leftOutside),
      getGreenCoverage(page, raster, probes.leftInside)
    ])

    expect(topOutside).toBeGreaterThan(0.45)
    expect(leftOutside).toBeGreaterThan(0.45)
    expect(topInside).toBeLessThan(MAX_EXTERIOR_LEAK)
    expect(leftInside).toBeLessThan(MAX_EXTERIOR_LEAK)
  })

  test('benchmark: closed constrained shapes keep butt and square caps visually equivalent', async ({
    page
  }) => {
    await createRectangle(page, 0.3, 0.3)
    await configureSelectedStroke(page, {
      elementType: 'rect',
      position: 'outside',
      join: 'bevel',
      cap: 'butt'
    })

    const buttRaster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const buttTopOutside = await getGreenCoverage(
      page,
      buttRaster,
      getRectProbeRegions(buttRaster).topOutside
    )

    await configureSelectedStroke(page, {
      elementType: 'rect',
      position: 'outside',
      join: 'bevel',
      cap: 'square'
    })

    const squareRaster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const squareTopOutside = await getGreenCoverage(
      page,
      squareRaster,
      getRectProbeRegions(squareRaster).topOutside
    )

    expect(Math.abs(buttTopOutside - squareTopOutside)).toBeLessThan(
      MAX_CAP_VARIANCE
    )
  })

  test('benchmark: closed constrained solid round join renders on inside slices', async ({
    page
  }) => {
    await createRectangle(page, 0.3, 0.3)
    await configureSelectedStroke(page, {
      elementType: 'rect',
      position: 'inside',
      join: 'round',
      cap: 'butt'
    })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const probes = getRectProbeRegions(raster)
    const [insideCoverage, outsideCoverage] = await Promise.all([
      getGreenCoverage(page, raster, probes.topInside),
      getGreenCoverage(page, raster, probes.topOutside)
    ])

    expect(insideCoverage).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(outsideCoverage).toBeLessThan(MAX_EXTERIOR_LEAK)
  })

  test('benchmark: closed constrained solid round cap stays visually equivalent to butt caps', async ({
    page
  }) => {
    await createRectangle(page, 0.3, 0.3)
    await configureSelectedStroke(page, {
      elementType: 'rect',
      position: 'outside',
      join: 'bevel',
      cap: 'round'
    })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const probes = getRectProbeRegions(raster)
    const [topOutside, leftOutside] = await Promise.all([
      getGreenCoverage(page, raster, probes.topOutside),
      getGreenCoverage(page, raster, probes.leftOutside)
    ])

    expect(topOutside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(leftOutside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
  })

  test('benchmark: closed vector inside stroke renders through the constrained solid visual path', async ({
    page
  }) => {
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await clearVectorOverlayState(page)
    await ensureElementSelected(page, 'vector')
    await patchSelectedVectorToClosedRectangle(page)
    await ensureElementSelected(page, 'vector')
    await configureSelectedStroke(page, {
      elementType: 'vector',
      position: 'inside',
      join: 'bevel',
      cap: 'butt',
      width: 8
    })

    const raster = await captureSelectedElementRaster(page, 8)
    const probes = getRectProbeRegions(raster)

    const [topInside, topOutside, center] = await Promise.all([
      getGreenCoverage(page, raster, probes.topInside),
      getGreenCoverage(page, raster, probes.topOutside),
      getGreenCoverage(page, raster, probes.center)
    ])

    expect(topInside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(topOutside).toBeLessThan(MAX_EXTERIOR_LEAK)
    expect(center).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
  })

  test('benchmark: closed vector outside miter stroke renders through the constrained solid visual path', async ({
    page
  }) => {
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await clearVectorOverlayState(page)
    await ensureElementSelected(page, 'vector')
    await patchSelectedVectorToClosedRectangle(page)
    await ensureElementSelected(page, 'vector')
    await configureSelectedStroke(page, {
      elementType: 'vector',
      position: 'outside',
      join: 'miter',
      cap: 'butt',
      width: 8
    })

    const raster = await captureSelectedElementRaster(page, 8)
    const probes = getRectProbeRegions(raster)

    const [topOutside, topInside, center] = await Promise.all([
      getGreenCoverage(page, raster, probes.topOutside),
      getGreenCoverage(page, raster, probes.topInside),
      getGreenCoverage(page, raster, probes.center)
    ])

    expect(topOutside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(topInside).toBeLessThan(MAX_EXTERIOR_LEAK)
    expect(center).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
  })

  test('benchmark: closed vector inside miter stroke renders through the constrained solid visual path', async ({
    page
  }) => {
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await clearVectorOverlayState(page)
    await ensureElementSelected(page, 'vector')
    await patchSelectedVectorToClosedRectangle(page)
    await ensureElementSelected(page, 'vector')
    await configureSelectedStroke(page, {
      elementType: 'vector',
      position: 'inside',
      join: 'miter',
      cap: 'butt',
      width: 8
    })

    const raster = await captureSelectedElementRaster(page, 8)
    const probes = getRectProbeRegions(raster)

    const [topInside, topOutside, center] = await Promise.all([
      getGreenCoverage(page, raster, probes.topInside),
      getGreenCoverage(page, raster, probes.topOutside),
      getGreenCoverage(page, raster, probes.center)
    ])

    expect(topInside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(topOutside).toBeLessThan(MAX_EXTERIOR_LEAK)
    expect(center).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
  })

  test('benchmark: closed vector outside bevel stroke renders through the constrained solid visual path', async ({
    page
  }) => {
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await clearVectorOverlayState(page)
    await ensureElementSelected(page, 'vector')
    await patchSelectedVectorToClosedRectangle(page)
    await ensureElementSelected(page, 'vector')
    await configureSelectedStroke(page, {
      elementType: 'vector',
      position: 'outside',
      join: 'bevel',
      cap: 'butt',
      width: 8
    })

    const raster = await captureSelectedElementRaster(page, 8)
    const probes = getRectProbeRegions(raster)

    const [topOutside, topInside, center] = await Promise.all([
      getGreenCoverage(page, raster, probes.topOutside),
      getGreenCoverage(page, raster, probes.topInside),
      getGreenCoverage(page, raster, probes.center)
    ])

    expect(topOutside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(topInside).toBeLessThan(MAX_EXTERIOR_LEAK)
    expect(center).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
  })
  ;(['inside', 'outside'] as const).forEach((position) => {
    test(`benchmark: open constrained vector ${position} stroke renders through exact one-sided geometry`, async ({
      page
    }) => {
      await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
      await clearVectorOverlayState(page)
      await ensureElementSelected(page, 'vector')
      await patchSelectedVectorToOpenPolyline(page)
      await ensureElementSelected(page, 'vector')
      await configureSelectedStroke(page, {
        elementType: 'vector',
        position,
        join: 'bevel',
        cap: 'butt',
        width: 8
      })

      const authoredStroke = await getSelectedStrokeRowSnapshot(page, 0)
      expect(authoredStroke).toMatchObject({
        style: 'solid',
        position,
        width: 8,
        joinType: 'bevel',
        capType: 'butt'
      })

      const raster = await captureSelectedElementRaster(page, 8)
      const probes = getOpenPolylineProbeRegions(raster)

      const [topLine, rightLine, centerGap] = await Promise.all([
        getGreenCoverage(page, raster, probes.topLine),
        getGreenCoverage(page, raster, probes.rightLine),
        getGreenCoverage(page, raster, probes.centerGap)
      ])

      expect(topLine).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
      expect(rightLine).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
      expect(centerGap).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
    })
  })
  ;(['inside', 'outside'] as const).forEach((position) => {
    test(`benchmark: real-created two-point open vector ${position} stroke remains visible through exact one-sided geometry`, async ({
      page
    }) => {
      await createTwoPointVectorPath(page)
      await clearVectorOverlayState(page)
      await ensureElementSelected(page, 'vector')
      await configureSelectedStroke(page, {
        elementType: 'vector',
        position,
        join: 'bevel',
        cap: 'butt',
        width: 8
      })

      const authoredStroke = await getSelectedStrokeRowSnapshot(page, 0)
      expect(authoredStroke).toMatchObject({
        style: 'solid',
        position,
        width: 8,
        joinType: 'bevel',
        capType: 'butt'
      })

      const raster = await captureSelectedElementRaster(page, 8)
      const probes = getOpenDiagonalProbeRegions(raster)
      const strokeEnvelope = await getGreenCoverage(
        page,
        raster,
        probes.strokeEnvelope
      )

      expect(strokeEnvelope).toBeGreaterThan(0.08)
    })
  })

  test('benchmark: self-intersecting constrained vector stroke remains visible as local-side geometry', async ({
    page
  }) => {
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await clearVectorOverlayState(page)
    await ensureElementSelected(page, 'vector')
    await patchSelectedVectorToSelfIntersectingBowtie(page)
    await ensureElementSelected(page, 'vector')
    await configureSelectedStroke(page, {
      elementType: 'vector',
      position: 'outside',
      join: 'bevel',
      cap: 'butt',
      width: 8
    })

    const raster = await captureSelectedElementRaster(page, 8)
    const probes = getRectProbeRegions(raster)

    const [topOutside, leftOutside, topInside, leftInside] = await Promise.all([
      getGreenCoverage(page, raster, probes.topOutside),
      getGreenCoverage(page, raster, probes.leftOutside),
      getGreenCoverage(page, raster, probes.topInside),
      getGreenCoverage(page, raster, probes.leftInside)
    ])

    expect(
      Math.max(topOutside, leftOutside, topInside, leftInside)
    ).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
  })
})
