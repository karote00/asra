import { test, expect } from '@playwright/test'
import {
  createTestDocumentURL,
  createRectangle,
  getCanvasPosition,
  getTransactionSnapshot,
  resetCanvas,
  setSelectedGradient,
  undo,
  waitForAppReady
} from './test-utils'
import {
  getGradientHandleClientPosition,
  getSelectedGradientSnapshot,
  openGradientFillEditor
} from './gradient-test-utils'

test.describe('Gradient Fill Handles', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(createTestDocumentURL())
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

    await page.evaluate(async () => {
      const { startSharedChannelCapture } =
        await import('../src/testing/runtime-access')
      startSharedChannelCapture('gradient-preview-deliveries', 'props')
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
    const previewDeliveries = await page.evaluate(async () => {
      const { readTestCapture } = await import('../src/testing/runtime-access')
      return readTestCapture('gradient-preview-deliveries')
    })
    expect(previewDeliveries).toContainEqual(
      expect.objectContaining({
        options: expect.objectContaining({ sharedDelivery: 'immediate' })
      })
    )
    const previewDeliveryCount = previewDeliveries.length

    await page.mouse.up()
    const finalDeliveries = await page.evaluate(async () => {
      const { readTestCapture } = await import('../src/testing/runtime-access')
      return readTestCapture('gradient-preview-deliveries')
    })
    expect(finalDeliveries).toHaveLength(previewDeliveryCount)
    await page.evaluate(async () => {
      const { stopTestCapture } = await import('../src/testing/runtime-access')
      stopTestCapture('gradient-preview-deliveries')
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
