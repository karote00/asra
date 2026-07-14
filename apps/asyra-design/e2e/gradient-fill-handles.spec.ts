import { test, expect, type Page } from '@playwright/test'
import {
  createRectangle,
  getCanvasPosition,
  getPropertiesPanel,
  resetCanvas,
  undo,
  waitForAppReady
} from './test-utils'

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

const getTransactionSnapshot = async (page: Page) =>
  page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const transact = core?.deps?.factory?.transact
    const undoStack = transact?.undoStack ?? []

    return {
      undoCount: undoStack.length,
      isTransacting: transact?.isTransacting ?? 0
    }
  })

const openGradientFillEditor = async (page: Page) => {
  const propertiesPanel = getPropertiesPanel(page)
  await propertiesPanel.getByTestId('prop-fill-color-picker-0-trigger').click()
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
  if (!snapshot?.gradient?.gradientHandles?.[handleIndex]) {
    throw new Error(`Gradient handle ${handleIndex} not available`)
  }

  const handle = snapshot.gradient.gradientHandles[handleIndex]
  return {
    x:
      (snapshot.rect.x + handle.x * snapshot.rect.width) * snapshot.zoom +
      snapshot.viewport.x,
    y:
      (snapshot.rect.y + handle.y * snapshot.rect.height) * snapshot.zoom +
      snapshot.viewport.y
  }
}

test.describe('Gradient Fill Handles', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await resetCanvas(page)
  })

  test('uses centered vertical handles when switching to gradient', async ({
    page
  }) => {
    await createRectangle(page, 0.3, 0.3)
    await openGradientFillEditor(page)
    await page.waitForTimeout(150)

    const snapshot = await getSelectedGradientSnapshot(page)
    expect(snapshot?.gradient?.gradientHandles).toEqual([
      { x: 0.5, y: 0 },
      { x: 0.5, y: 1 }
    ])
  })

  test('dragging the start handle updates normalized gradient data and keeps it after mouse up', async ({
    page
  }) => {
    await createRectangle(page, 0.3, 0.3)
    await openGradientFillEditor(page)

    await setSelectedGradient(page, {
      gradientType: 'linear',
      gradientHandles: [
        { x: 0.5, y: 0 },
        { x: 0.5, y: 1 }
      ],
      gradientStops: [
        { position: 0, color: '#ffffff', opacity: 1 },
        { position: 0.5, color: '#ff0000', opacity: 1 },
        { position: 1, color: '#000000', opacity: 1 }
      ],
      metadata: {}
    })
    await page.waitForTimeout(120)

    const before = await getTransactionSnapshot(page)
    const beforeSnapshot = await getSelectedGradientSnapshot(page)
    expect(beforeSnapshot?.gradient?.gradientHandles[0]?.y).toBe(0)

    const startHandle = await getGradientHandleClientPosition(page, 0)
    const clientDeltaY =
      (beforeSnapshot?.rect.height ?? 0) * (beforeSnapshot?.zoom ?? 1) * 0.25

    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const scope = window as any
      scope.__gradientPreviewDeliveries = []
      scope.__disposeGradientPreviewObserver =
        scope.__Core__?.deps?.factory?.observeSharedDataChannel?.(
          'props',
          (change: unknown) => scope.__gradientPreviewDeliveries.push(change)
        )
    })
    await page.mouse.move(startHandle.x, startHandle.y)
    await page.mouse.down()
    await page.mouse.move(startHandle.x, startHandle.y + clientDeltaY, {
      steps: 12
    })
    await page.waitForTimeout(120)

    const duringDrag = await getSelectedGradientSnapshot(page)
    expect(duringDrag?.gradient?.gradientHandles[0]?.x).toBeCloseTo(0.5, 2)
    expect(duringDrag?.gradient?.gradientHandles[0]?.y).toBeCloseTo(0.25, 2)
    expect(duringDrag?.gradient?.gradientHandles[1]?.y).toBeCloseTo(1, 2)
    expect(duringDrag?.gradient?.gradientStops).toEqual([
      { position: 0, color: '#ffffff', opacity: 1 },
      { position: 0.5, color: '#ff0000', opacity: 1 },
      { position: 1, color: '#000000', opacity: 1 }
    ])

    const duringTransaction = await getTransactionSnapshot(page)
    expect(duringTransaction.undoCount).toBe(before.undoCount)
    expect(duringTransaction.isTransacting).toBeGreaterThan(0)
    const previewDeliveries = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (window as any).__gradientPreviewDeliveries ?? []
    })
    expect(previewDeliveries).toContainEqual(
      expect.objectContaining({
        options: expect.objectContaining({ sharedDelivery: 'immediate' })
      })
    )

    await page.mouse.up()
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const scope = window as any
      scope.__disposeGradientPreviewObserver?.()
      delete scope.__disposeGradientPreviewObserver
      delete scope.__gradientPreviewDeliveries
    })
    await page.waitForTimeout(180)

    const afterMouseUp = await getSelectedGradientSnapshot(page)
    expect(afterMouseUp?.gradient?.gradientHandles[0]?.x).toBeCloseTo(0.5, 2)
    expect(afterMouseUp?.gradient?.gradientHandles[0]?.y).toBeCloseTo(0.25, 2)
    expect(afterMouseUp?.gradient?.gradientHandles[1]?.y).toBeCloseTo(1, 2)

    const afterTransaction = await getTransactionSnapshot(page)
    expect(afterTransaction.undoCount).toBe(before.undoCount + 1)
    expect(afterTransaction.isTransacting).toBe(0)

    await undo(page)
    await page.waitForTimeout(180)

    const afterUndo = await getSelectedGradientSnapshot(page)
    expect(afterUndo?.gradient?.gradientHandles).toEqual([
      { x: 0.5, y: 0 },
      { x: 0.5, y: 1 }
    ])
  })

  test('dragging a gradient handle stays normalized under zoom', async ({
    page
  }) => {
    await createRectangle(page, 0.3, 0.3)
    await openGradientFillEditor(page)

    await setSelectedGradient(page, {
      gradientType: 'linear',
      gradientHandles: [
        { x: 0.5, y: 0 },
        { x: 0.5, y: 1 }
      ],
      gradientStops: [
        { position: 0, color: '#ffffff', opacity: 1 },
        { position: 0.5, color: '#ff0000', opacity: 1 },
        { position: 1, color: '#000000', opacity: 1 }
      ],
      metadata: {}
    })
    await page.waitForTimeout(120)

    const canvasCenter = await getCanvasPosition(page, 0.5, 0.5)
    await page.mouse.move(canvasCenter.x, canvasCenter.y)
    await page.keyboard.down('Meta')
    await page.mouse.wheel(0, -240)
    await page.keyboard.up('Meta')
    await page.waitForTimeout(180)

    const zoomedBefore = await getSelectedGradientSnapshot(page)
    expect((zoomedBefore?.zoom ?? 1) > 1).toBeTruthy()

    const startHandle = await getGradientHandleClientPosition(page, 0)
    const clientDeltaY =
      (zoomedBefore?.rect.height ?? 0) * (zoomedBefore?.zoom ?? 1) * 0.25

    await page.mouse.move(startHandle.x, startHandle.y)
    await page.mouse.down()
    await page.mouse.move(startHandle.x, startHandle.y + clientDeltaY, {
      steps: 12
    })
    await page.waitForTimeout(120)
    await page.mouse.up()
    await page.waitForTimeout(180)

    const zoomedAfter = await getSelectedGradientSnapshot(page)
    expect(zoomedAfter?.gradient?.gradientHandles[0]?.x).toBeCloseTo(0.5, 2)
    expect(zoomedAfter?.gradient?.gradientHandles[0]?.y).toBeCloseTo(0.25, 2)
    expect(zoomedAfter?.gradient?.gradientHandles[1]?.y).toBeCloseTo(1, 2)
  })

  test('dragging the start handle past the end keeps handle movement unlimited', async ({
    page
  }) => {
    await createRectangle(page, 0.3, 0.3)
    await openGradientFillEditor(page)

    await setSelectedGradient(page, {
      gradientType: 'linear',
      gradientHandles: [
        { x: 0.5, y: 0 },
        { x: 0.5, y: 1 }
      ],
      gradientStops: [
        { position: 0, color: '#ffffff', opacity: 1 },
        { position: 0.5, color: '#ff0000', opacity: 1 },
        { position: 1, color: '#000000', opacity: 1 }
      ],
      metadata: {}
    })
    await page.waitForTimeout(120)

    const beforeSnapshot = await getSelectedGradientSnapshot(page)
    const startHandle = await getGradientHandleClientPosition(page, 0)
    const clientDeltaY =
      (beforeSnapshot?.rect.height ?? 0) * (beforeSnapshot?.zoom ?? 1) * 1.2

    await page.mouse.move(startHandle.x, startHandle.y)
    await page.mouse.down()
    await page.mouse.move(startHandle.x, startHandle.y + clientDeltaY, {
      steps: 18
    })
    await page.waitForTimeout(120)

    const duringDrag = await getSelectedGradientSnapshot(page)
    expect(duringDrag?.gradient?.gradientHandles[0]?.y).toBeGreaterThan(1)

    await page.mouse.up()
    await page.waitForTimeout(180)

    const afterMouseUp = await getSelectedGradientSnapshot(page)
    expect(afterMouseUp?.gradient?.gradientHandles[0]?.y).toBeGreaterThan(1)
  })
})
