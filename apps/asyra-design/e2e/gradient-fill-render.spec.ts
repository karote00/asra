import { expect, test, type Page } from '@playwright/test'
import { createRectangle, resetCanvas, waitForAppReady } from './test-utils'

interface GradientHandle {
  x: number
  y: number
}

interface GradientStop {
  position: number
  color: string
  opacity: number
}

interface SelectedGradientSnapshot {
  elementId: string
  fillId: string
  kind: string | null
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
  gradient: {
    gradientType: string
    gradientHandles: GradientHandle[]
    gradientStops: GradientStop[]
  } | null
}

interface SampledColor {
  r: number
  g: number
  b: number
  a: number
}

const getSelectedGradientSnapshot = async (
  page: Page
): Promise<SelectedGradientSnapshot | null> =>
  page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId = core?.deps?.selection?.getElementSelectionIds?.()?.[0]
    if (!selectedId) {
      return null
    }

    const element = core?.deps?.sceneTree?.getElementById?.(selectedId)
    const computed = element?.getAllComputedData?.() ?? {}
    const firstFill = computed?.fills?.[0]
    if (!firstFill?.id) {
      return null
    }

    return {
      elementId: selectedId,
      fillId: firstFill.id,
      kind: firstFill.kind ?? null,
      rect: {
        x: computed.x,
        y: computed.y,
        width: computed.width,
        height: computed.height
      },
      zoom: core.getSystemProperty?.('zoom') ?? 1,
      viewport: core.getSystemProperty?.('viewportPosition') ?? { x: 0, y: 0 },
      gradient: firstFill.gradient
    }
  })

const openGradientFillEditor = async (page: Page) => {
  const trigger = page.getByTestId('prop-fill-color-picker-0-trigger')
  await trigger.click()
  await page.getByTestId('prop-fill-mode-gradient-0').click()
  await expect(page.getByTestId('prop-fill-gradient-editor-0')).toBeVisible()
}

const setSelectedGradient = async (
  page: Page,
  gradient: SelectedGradientSnapshot['gradient']
) => {
  await page.evaluate((nextGradient) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId = core?.deps?.selection?.getElementSelectionIds?.()?.[0]
    if (!selectedId) {
      return
    }

    const element = core?.deps?.sceneTree?.getElementById?.(selectedId)
    const computed = element?.getAllComputedData?.() ?? {}
    const fillId = computed?.fills?.[0]?.id
    if (!fillId || !nextGradient) {
      return
    }

    core.updatePropertyById(
      fillId,
      'gradient',
      nextGradient,
      {
        ownerElementId: selectedId,
        ownerPropertyName: 'fills'
      },
      { undoable: false }
    )
    core.commitPropertyChanges({ undoable: false })
  }, gradient)
}

const getGradientHandleClientPosition = async (
  page: Page,
  handleIndex: number
) => {
  const snapshot = await getSelectedGradientSnapshot(page)
  const handle = snapshot?.gradient?.gradientHandles?.[handleIndex]
  if (!snapshot || !handle) {
    throw new Error(`Missing gradient handle ${handleIndex}`)
  }

  return {
    x:
      (snapshot.rect.x + handle.x * snapshot.rect.width) * snapshot.zoom +
      snapshot.viewport.x,
    y:
      (snapshot.rect.y + handle.y * snapshot.rect.height) * snapshot.zoom +
      snapshot.viewport.y
  }
}

const sampleSelectedElementColors = async (
  page: Page,
  samplePoints: { x: number; y: number }[]
): Promise<SampledColor[]> => {
  const snapshot = await getSelectedGradientSnapshot(page)
  if (!snapshot) {
    throw new Error('Missing selected gradient snapshot')
  }

  const clip = {
    x: Math.max(
      0,
      Math.floor(snapshot.rect.x * snapshot.zoom + snapshot.viewport.x)
    ),
    y: Math.max(
      0,
      Math.floor(snapshot.rect.y * snapshot.zoom + snapshot.viewport.y)
    ),
    width: Math.max(1, Math.ceil(snapshot.rect.width * snapshot.zoom)),
    height: Math.max(1, Math.ceil(snapshot.rect.height * snapshot.zoom))
  }
  const imageBuffer = await page.screenshot({ clip })
  const imageBase64 = imageBuffer.toString('base64')

  return page.evaluate(
    async ({
      base64,
      points
    }: {
      base64: string
      points: { x: number; y: number }[]
    }) => {
      const response = await fetch(`data:image/png;base64,${base64}`)
      const blob = await response.blob()
      const bitmap = await createImageBitmap(blob)
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const context = canvas.getContext('2d')
      if (!context) {
        return []
      }

      context.drawImage(bitmap, 0, 0)

      return points.map((point) => {
        const x = Math.max(
          0,
          Math.min(canvas.width - 1, Math.round(point.x * (canvas.width - 1)))
        )
        const y = Math.max(
          0,
          Math.min(canvas.height - 1, Math.round(point.y * (canvas.height - 1)))
        )
        const [r, g, b, a] = context.getImageData(x, y, 1, 1).data

        return { r, g, b, a }
      })
    },
    {
      base64: imageBase64,
      points: samplePoints
    }
  )
}

const expectColorNear = (
  actual: SampledColor,
  expected: { r: number; g: number; b: number },
  tolerance = 24
) => {
  expect(actual.r).toBeGreaterThanOrEqual(expected.r - tolerance)
  expect(actual.r).toBeLessThanOrEqual(expected.r + tolerance)
  expect(actual.g).toBeGreaterThanOrEqual(expected.g - tolerance)
  expect(actual.g).toBeLessThanOrEqual(expected.g + tolerance)
  expect(actual.b).toBeGreaterThanOrEqual(expected.b - tolerance)
  expect(actual.b).toBeLessThanOrEqual(expected.b + tolerance)
  expect(actual.a).toBeGreaterThan(200)
}

const getBrightness = (color: SampledColor) => color.r + color.g + color.b

const DEFAULT_TEST_GRADIENT = {
  gradientType: 'linear',
  gradientStops: [
    { position: 0, color: '#ffffff', opacity: 1 },
    { position: 0.5, color: '#ff0000', opacity: 1 },
    { position: 1, color: '#000000', opacity: 1 }
  ],
  metadata: {}
} as const

test.describe('Gradient Fill Render', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await resetCanvas(page)
  })

  test('renders the default vertical gradient with a brighter top than bottom', async ({
    page
  }) => {
    await createRectangle(page, 0.3, 0.3)
    await openGradientFillEditor(page)

    await setSelectedGradient(page, {
      ...DEFAULT_TEST_GRADIENT,
      gradientHandles: [
        { x: 0.5, y: 0 },
        { x: 0.5, y: 1 }
      ]
    })
    await page.waitForTimeout(200)

    const [top, bottom] = await sampleSelectedElementColors(page, [
      { x: 0.25, y: 0.1 },
      { x: 0.25, y: 0.9 }
    ])

    expect(top.r).toBeGreaterThan(bottom.r)
    expect(top.g).toBeGreaterThan(bottom.g)
    expect(top.b).toBeGreaterThan(bottom.b)
    expect(getBrightness(top)).toBeGreaterThan(getBrightness(bottom) + 120)
  })

  test('keeps stop colors visually stable while dragging the start handle downward', async ({
    page
  }) => {
    test.fail(
      true,
      'Known bug: slow canvas drag can still invert gradient stop colors during handle movement'
    )

    await createRectangle(page, 0.3, 0.3)
    await openGradientFillEditor(page)

    await setSelectedGradient(page, {
      ...DEFAULT_TEST_GRADIENT,
      gradientHandles: [
        { x: 0.5, y: 0 },
        { x: 0.5, y: 1 }
      ]
    })
    await page.waitForTimeout(200)

    const startHandle = await getGradientHandleClientPosition(page, 0)
    const before = await getSelectedGradientSnapshot(page)
    const clientDeltaY = (before?.rect.height ?? 0) * (before?.zoom ?? 1) * 0.9

    await page.mouse.move(startHandle.x, startHandle.y)
    await page.mouse.down()

    for (let step = 1; step <= 90; step += 1) {
      const currentY = startHandle.y + (clientDeltaY * step) / 90
      await page.mouse.move(startHandle.x, currentY, { steps: 1 })
      await page.waitForTimeout(8)

      const [top, bottom] = await sampleSelectedElementColors(page, [
        { x: 0.25, y: 0.1 },
        { x: 0.25, y: 0.9 }
      ])

      expect(top.r).toBeGreaterThan(220)
      expect(top.g).toBeGreaterThan(180)
      expect(top.b).toBeGreaterThan(180)
      expect(bottom.g).toBeLessThan(60)
      expect(bottom.b).toBeLessThan(60)
      expect(getBrightness(top)).toBeGreaterThan(getBrightness(bottom) + 320)
    }

    await page.mouse.up()
    await page.waitForTimeout(160)
  })

  test('renders reversed vertical handles as black-to-white from top to bottom', async ({
    page
  }) => {
    test.fail(
      true,
      'Known bug: reversed gradient handles still render incorrectly on canvas'
    )

    await createRectangle(page, 0.3, 0.3)
    await openGradientFillEditor(page)

    await setSelectedGradient(page, {
      ...DEFAULT_TEST_GRADIENT,
      gradientHandles: [
        { x: 0.5, y: 1 },
        { x: 0.5, y: 0 }
      ]
    })
    await page.waitForTimeout(200)

    const [top, middle, bottom] = await sampleSelectedElementColors(page, [
      { x: 0.25, y: 0.1 },
      { x: 0.25, y: 0.5 },
      { x: 0.25, y: 0.9 }
    ])

    expectColorNear(top, { r: 0, g: 0, b: 0 }, 28)
    expectColorNear(middle, { r: 255, g: 0, b: 0 }, 36)
    expectColorNear(bottom, { r: 255, g: 255, b: 255 }, 28)
  })

  test('renders interpolated boundary colors when the start handle begins above the shape', async ({
    page
  }) => {
    test.fail(
      true,
      'Known bug: out-of-bounds gradient handles still collapse stop colors on canvas'
    )

    await createRectangle(page, 0.3, 0.3)
    await openGradientFillEditor(page)

    await setSelectedGradient(page, {
      ...DEFAULT_TEST_GRADIENT,
      gradientHandles: [
        { x: 0.5, y: -0.25 },
        { x: 0.5, y: 1 }
      ]
    })
    await page.waitForTimeout(200)

    const [top, middle, bottom] = await sampleSelectedElementColors(page, [
      { x: 0.25, y: 0.1 },
      { x: 0.25, y: 0.5 },
      { x: 0.25, y: 0.9 }
    ])

    expectColorNear(top, { r: 255, g: 153, b: 153 }, 34)
    expectColorNear(middle, { r: 204, g: 0, b: 0 }, 36)
    expectColorNear(bottom, { r: 0, g: 0, b: 0 }, 28)
  })

  test('keeps stop colors stable while dragging the start handle upward beyond the shape', async ({
    page
  }) => {
    test.fail(
      true,
      'Known bug: dragging the top handle further upward can still invert gradient stop colors'
    )

    await createRectangle(page, 0.3, 0.3)
    await openGradientFillEditor(page)

    await setSelectedGradient(page, {
      ...DEFAULT_TEST_GRADIENT,
      gradientHandles: [
        { x: 0.5, y: 0 },
        { x: 0.5, y: 1 }
      ]
    })
    await page.waitForTimeout(200)

    const startHandle = await getGradientHandleClientPosition(page, 0)
    const before = await getSelectedGradientSnapshot(page)
    const clientDeltaY = (before?.rect.height ?? 0) * (before?.zoom ?? 1) * 0.9

    await page.mouse.move(startHandle.x, startHandle.y)
    await page.mouse.down()

    for (let step = 1; step <= 90; step += 1) {
      const currentY = startHandle.y - (clientDeltaY * step) / 90
      await page.mouse.move(startHandle.x, currentY, { steps: 1 })
      await page.waitForTimeout(8)

      const [top, bottom] = await sampleSelectedElementColors(page, [
        { x: 0.25, y: 0.1 },
        { x: 0.25, y: 0.9 }
      ])

      expect(top.r).toBeGreaterThan(220)
      expect(top.g).toBeGreaterThan(180)
      expect(top.b).toBeGreaterThan(180)
      expect(bottom.g).toBeLessThan(60)
      expect(bottom.b).toBeLessThan(60)
      expect(getBrightness(top)).toBeGreaterThan(getBrightness(bottom) + 320)
    }

    await page.mouse.up()
    await page.waitForTimeout(160)
  })

  test('keeps stop colors stable while dragging the end handle downward beyond the shape', async ({
    page
  }) => {
    test.fail(
      true,
      'Known bug: dragging the bottom handle further downward can still invert gradient stop colors'
    )

    await createRectangle(page, 0.3, 0.3)
    await openGradientFillEditor(page)

    await setSelectedGradient(page, {
      ...DEFAULT_TEST_GRADIENT,
      gradientHandles: [
        { x: 0.5, y: 0 },
        { x: 0.5, y: 1 }
      ]
    })
    await page.waitForTimeout(200)

    const endHandle = await getGradientHandleClientPosition(page, 1)
    const before = await getSelectedGradientSnapshot(page)
    const clientDeltaY = (before?.rect.height ?? 0) * (before?.zoom ?? 1) * 0.9

    await page.mouse.move(endHandle.x, endHandle.y)
    await page.mouse.down()

    for (let step = 1; step <= 90; step += 1) {
      const currentY = endHandle.y + (clientDeltaY * step) / 90
      await page.mouse.move(endHandle.x, currentY, { steps: 1 })
      await page.waitForTimeout(8)

      const [top, bottom] = await sampleSelectedElementColors(page, [
        { x: 0.25, y: 0.1 },
        { x: 0.25, y: 0.9 }
      ])

      expect(top.r).toBeGreaterThan(220)
      expect(top.g).toBeGreaterThan(180)
      expect(top.b).toBeGreaterThan(180)
      expect(bottom.g).toBeLessThan(60)
      expect(bottom.b).toBeLessThan(60)
      expect(getBrightness(top)).toBeGreaterThan(getBrightness(bottom) + 320)
    }

    await page.mouse.up()
    await page.waitForTimeout(160)
  })
})
