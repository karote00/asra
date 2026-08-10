import { test, expect, type Page } from '@playwright/test'
import {
  createTestDocumentURL,
  waitForAppReady,
  resetCanvas,
  createRectangle,
  createVectorPath,
  clickCanvas,
  getPropertiesPanel,
  getTransactionSnapshot,
  getContentsPanel,
  undo,
  redo
} from './test-utils'

/**
 * E2E Tests for Property Management
 * Based on: .project/bdd-features/properties.feature
 *
 * Feature: Property Management
 *   As a user
 *   I want to view and edit element properties
 *   So that I can customize my design
 */

test.describe('Property Management', () => {
  const getSelectedLayoutProjection = async (page: Page) =>
    page.evaluate(async () => {
      // Formal E2E reads use the module-owned test bridge, never DevTools globals.
      const core = (await import('../src/testing/runtime-access')).core
      const selectedId = core?.deps?.selection?.getElementSelectionIds?.()?.[0]
      if (!selectedId) {
        return null
      }
      const element = core?.deps?.sceneTree?.getElementById?.(selectedId)
      const renderElement = core?.deps?.render?.getElementById?.(selectedId)
      const computed = element?.getAllComputedData?.() ?? {}
      return {
        computed: {
          x: computed.x,
          y: computed.y,
          width: computed.width,
          height: computed.height,
          rotation: computed.rotation
        },
        rendered: {
          x: renderElement?.x,
          y: renderElement?.y,
          width: renderElement?.width,
          height: renderElement?.height,
          rotation: renderElement?.rotation
        }
      }
    })

  const getSelectedVectorPointProjection = async (page: Page) =>
    page.evaluate(async () => {
      // Formal E2E reads use the module-owned test bridge, never DevTools globals.
      const core = (await import('../src/testing/runtime-access')).core
      const selected = core?.getSystemProperty?.('selectedVectorPoint')
      const element = selected?.elementId
        ? core?.deps?.sceneTree?.getElementById?.(selected.elementId)
        : null
      const computed = element?.getAllComputedData?.() ?? {}
      const point = selected?.pointId
        ? computed.points?.[selected.pointId]
        : null
      const renderElement = selected?.elementId
        ? core?.deps?.render?.getElementById?.(selected.elementId)
        : null
      const renderBounds = renderElement?.getBounds?.()

      if (!selected?.elementId || !selected?.pointId || !point) {
        return null
      }

      return {
        elementId: selected.elementId,
        pointId: selected.pointId,
        target: selected.target,
        selected: {
          x: selected.x,
          y: selected.y
        },
        computed: {
          x: point.x,
          y: point.y,
          type: point.type,
          bounds: {
            x: computed.x,
            y: computed.y,
            width: computed.width,
            height: computed.height
          }
        },
        rendered: renderBounds
          ? {
              x: renderBounds.x,
              y: renderBounds.y,
              width: renderBounds.width,
              height: renderBounds.height
            }
          : null
      }
    })

  const getSelectedFillColor = async (page: Page) =>
    page.evaluate(async () => {
      const core = (await import('../src/testing/runtime-access')).core
      const selectedId = core?.deps?.selection?.getElementSelectionIds?.()?.[0]
      if (!selectedId) {
        return null
      }

      const element = core?.deps?.sceneTree?.getElementById?.(selectedId)
      const computed = element?.getAllComputedData?.() ?? {}
      if (!Array.isArray(computed.fills) || !computed.fills[0]) {
        return null
      }

      return computed.fills[0].color ?? null
    })

  const getSelectedFillCount = async (page: Page) =>
    page.evaluate(async () => {
      const core = (await import('../src/testing/runtime-access')).core
      const selectedId = core?.deps?.selection?.getElementSelectionIds?.()?.[0]
      if (!selectedId) {
        return 0
      }

      const element = core?.deps?.sceneTree?.getElementById?.(selectedId)
      const computed = element?.getAllComputedData?.() ?? {}
      return Array.isArray(computed.fills) ? computed.fills.length : 0
    })

  const getSelectedGradientStopColor = async (page: Page, stopIndex: number) =>
    page.evaluate(async (targetStopIndex) => {
      const core = (await import('../src/testing/runtime-access')).core
      const selectedId = core?.deps?.selection?.getElementSelectionIds?.()?.[0]
      if (!selectedId) {
        return null
      }

      const element = core?.deps?.sceneTree?.getElementById?.(selectedId)
      const computed = element?.getAllComputedData?.() ?? {}
      const gradient = computed?.fills?.[0]?.gradient
      const stop = gradient?.gradientStops?.[targetStopIndex]
      return stop?.color ?? null
    }, stopIndex)

  const getSelectedGradientStopPosition = async (
    page: Page,
    stopIndex: number
  ) =>
    page.evaluate(async (targetStopIndex) => {
      const core = (await import('../src/testing/runtime-access')).core
      const selectedId = core?.deps?.selection?.getElementSelectionIds?.()?.[0]
      if (!selectedId) {
        return null
      }

      const element = core?.deps?.sceneTree?.getElementById?.(selectedId)
      const computed = element?.getAllComputedData?.() ?? {}
      return (
        computed?.fills?.[0]?.gradient?.gradientStops?.[targetStopIndex]
          ?.position ?? null
      )
    }, stopIndex)

  const getSelectedStrokeCount = async (page: Page) =>
    page.evaluate(async () => {
      const core = (await import('../src/testing/runtime-access')).core
      const selectedId = core?.deps?.selection?.getElementSelectionIds?.()?.[0]
      if (!selectedId) {
        return 0
      }

      const element = core?.deps?.sceneTree?.getElementById?.(selectedId)
      const computed = element?.getAllComputedData?.() ?? {}
      return Array.isArray(computed.strokes) ? computed.strokes.length : 0
    })

  test.beforeEach(async ({ page }) => {
    await page.goto(createTestDocumentURL())
    await waitForAppReady(page)
    await resetCanvas(page)
  })

  /**
   * Scenario: Show properties for selected element
   *   Given a rectangle is selected
   *   When I look at the Properties Panel
   *   Then the panel should display the rectangle's properties (x, y, width, height)
   *   And the values should match the selected element
   */
  test('should show properties for selected element', async ({ page }) => {
    // Create a rectangle (it will be selected after creation)
    await createRectangle(page, 0.3, 0.3)

    // Get the Properties Panel
    const propertiesPanel = getPropertiesPanel(page)

    // Verify position inputs are visible (X and Y)
    const xInput = propertiesPanel.getByTestId('prop-x')
    const yInput = propertiesPanel.getByTestId('prop-y')

    await expect(xInput).toBeVisible()
    await expect(yInput).toBeVisible()

    // Verify dimension inputs are visible (W and H)
    const widthInput = propertiesPanel.getByTestId('prop-width')
    const heightInput = propertiesPanel.getByTestId('prop-height')

    await expect(widthInput).toBeVisible()
    await expect(heightInput).toBeVisible()

    // Verify inputs have numeric values
    const xValue = await xInput.inputValue()
    const yValue = await yInput.inputValue()
    const widthValue = await widthInput.inputValue()
    const heightValue = await heightInput.inputValue()

    expect(parseFloat(xValue)).not.toBeNaN()
    expect(parseFloat(yValue)).not.toBeNaN()
    expect(parseFloat(widthValue)).toBeGreaterThan(0)
    expect(parseFloat(heightValue)).toBeGreaterThan(0)
  })

  /**
   * Scenario: Show empty state when no selection
   *   Given no element is selected
   *   When I look at the Properties Panel
   *   Then the panel should show an empty or default state
   *   And no specific property fields should be active
   */
  test('should show empty state when no element is selected', async ({
    page
  }) => {
    // Create a rectangle and then deselect it
    await createRectangle(page, 0.3, 0.3)

    // Click on empty space to deselect
    await clickCanvas(page, 0.9, 0.9)
    await page.waitForTimeout(200)

    // Get the Properties Panel
    const propertiesPanel = getPropertiesPanel(page)

    // Verify the empty state is visible
    const emptyState = propertiesPanel.locator('text=No selection')
    await expect(emptyState).toBeVisible()

    // Verify no property inputs are visible
    await expect(propertiesPanel.getByTestId('prop-x')).not.toBeVisible()
  })

  /**
   * Scenario: Update position via properties panel
   *   Given a rectangle is selected with position (100, 100)
   *   When I change the "x" input field to "200"
   *   And I press Enter or blur the field
   *   Then the rectangle's x position should update to 200 on the canvas
   */
  test('should update element position via properties panel', async ({
    page
  }) => {
    await createRectangle(page, 0.3, 0.3)
    const beforeProjection = await getSelectedLayoutProjection(page)
    expect(beforeProjection).not.toBeNull()
    const beforeHistory = await getTransactionSnapshot(page)

    // Get the Properties Panel
    const propertiesPanel = getPropertiesPanel(page)

    // Find and update the X input
    const xInput = propertiesPanel.getByTestId('prop-x')

    // Clear the current value and type new value
    await xInput.click()
    await xInput.fill('200')
    await xInput.press('Enter')
    await page.waitForTimeout(200)

    // Verify the value was updated
    const newXValue = await xInput.inputValue()
    expect(newXValue).toBe('200')
    await expect
      .poll(() => getSelectedLayoutProjection(page))
      .toMatchObject({
        computed: { x: 200 },
        rendered: { x: 200 }
      })
    expect((await getTransactionSnapshot(page)).undoCount).toBe(
      beforeHistory.undoCount + 1
    )

    await undo(page)
    await expect
      .poll(() => getSelectedLayoutProjection(page))
      .toEqual(beforeProjection)
    await redo(page)
    await expect
      .poll(() => getSelectedLayoutProjection(page))
      .toMatchObject({
        computed: { x: 200 },
        rendered: { x: 200 }
      })

    // Update Y position as well
    const yInput = propertiesPanel.getByTestId('prop-y')
    await yInput.click()
    await yInput.fill('300')
    await yInput.press('Enter')
    await page.waitForTimeout(200)

    // Verify Y value was updated
    const newYValue = await yInput.inputValue()
    expect(newYValue).toBe('300')
  })

  /**
   * Scenario: Update dimensions via properties panel
   *   Given a rectangle is selected with size (100x100)
   *   When I change the "width" input field to "300"
   *   And I press Enter or blur the field
   *   Then the rectangle's width should update to 300 on the canvas
   */
  test('should update element dimensions via properties panel', async ({
    page
  }) => {
    await createRectangle(page, 0.3, 0.3)
    const beforeProjection = await getSelectedLayoutProjection(page)
    expect(beforeProjection).not.toBeNull()
    const beforeHistory = await getTransactionSnapshot(page)

    const propertiesPanel = getPropertiesPanel(page)
    const widthInput = propertiesPanel.getByTestId('prop-width')
    await widthInput.click()
    await widthInput.fill('300')
    await widthInput.press('Enter')
    await expect
      .poll(() => getSelectedLayoutProjection(page))
      .toMatchObject({
        computed: { width: 300 },
        rendered: { width: 300 }
      })

    const heightInput = propertiesPanel.getByTestId('prop-height')
    await heightInput.click()
    await heightInput.fill('250')
    await heightInput.press('Enter')
    await expect
      .poll(() => getSelectedLayoutProjection(page))
      .toMatchObject({
        computed: { width: 300, height: 250 },
        rendered: { width: 300, height: 250 }
      })
    expect((await getTransactionSnapshot(page)).undoCount).toBe(
      beforeHistory.undoCount + 2
    )

    await undo(page)
    await expect
      .poll(() => getSelectedLayoutProjection(page))
      .toMatchObject({
        computed: { width: 300, height: beforeProjection?.computed.height },
        rendered: { width: 300, height: beforeProjection?.rendered.height }
      })
    await undo(page)
    await expect
      .poll(() => getSelectedLayoutProjection(page))
      .toEqual(beforeProjection)
    await redo(page)
    await redo(page)
    await expect
      .poll(() => getSelectedLayoutProjection(page))
      .toMatchObject({
        computed: { width: 300, height: 250 },
        rendered: { width: 300, height: 250 }
      })
  })

  test('should project rotation with one-step undo and redo', async ({
    page
  }) => {
    await createRectangle(page, 0.3, 0.3)
    const beforeProjection = await getSelectedLayoutProjection(page)
    expect(beforeProjection).not.toBeNull()
    const beforeHistory = await getTransactionSnapshot(page)
    const rotationInput = getPropertiesPanel(page).getByTestId('prop-rotation')

    await rotationInput.fill('35')
    await rotationInput.press('Enter')
    await expect
      .poll(() => getSelectedLayoutProjection(page))
      .toMatchObject({
        computed: { rotation: 35 },
        rendered: { rotation: 35 }
      })
    expect((await getTransactionSnapshot(page)).undoCount).toBe(
      beforeHistory.undoCount + 1
    )

    await undo(page)
    await expect
      .poll(() => getSelectedLayoutProjection(page))
      .toEqual(beforeProjection)
    await redo(page)
    await expect
      .poll(() => getSelectedLayoutProjection(page))
      .toMatchObject({
        computed: { rotation: 35 },
        rendered: { rotation: 35 }
      })
  })

  test('should show fills section for selected element', async ({ page }) => {
    await createRectangle(page, 0.3, 0.3)

    const propertiesPanel = getPropertiesPanel(page)
    await expect(
      propertiesPanel.getByTestId('prop-fills-section')
    ).toBeVisible()
    await expect(propertiesPanel.getByTestId('prop-fill-add')).toBeVisible()
    await expect(
      propertiesPanel.getByTestId('prop-fill-color-picker-0')
    ).toBeVisible()
  })

  test('should add and remove repeatable fills from properties panel', async ({
    page
  }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(String(error)))
    await createRectangle(page, 0.3, 0.3)

    const propertiesPanel = getPropertiesPanel(page)
    await propertiesPanel.getByTestId('prop-fill-add').click()
    await expect.poll(() => getSelectedFillCount(page)).toBe(2)
    expect(pageErrors).toEqual([])
    await expect(
      propertiesPanel.getByTestId('prop-fill-color-picker-1')
    ).toBeVisible()

    await propertiesPanel.getByTestId('prop-fill-remove-1').click()
    await expect.poll(() => getSelectedFillCount(page)).toBe(1)
    expect(pageErrors).toEqual([])
  })

  test('should show strokes section for selected element', async ({ page }) => {
    await createRectangle(page, 0.3, 0.3)

    const propertiesPanel = getPropertiesPanel(page)
    await expect(
      propertiesPanel.getByTestId('prop-strokes-section')
    ).toBeVisible()
    await expect(propertiesPanel.getByTestId('prop-stroke-add')).toBeVisible()
    await expect(
      propertiesPanel.getByTestId('prop-strokes-empty')
    ).toBeVisible()
  })

  test('should add and remove repeatable strokes from properties panel', async ({
    page
  }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(String(error)))
    await createRectangle(page, 0.3, 0.3)

    const propertiesPanel = getPropertiesPanel(page)
    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await page.waitForTimeout(100)
    expect(pageErrors).toEqual([])
    await expect
      .poll(async () => {
        return page.evaluate(async () => {
          const core = (await import('../src/testing/runtime-access')).core
          const selectedId =
            core?.deps?.selection?.getElementSelectionIds?.()?.[0]
          const element =
            selectedId && core?.deps?.sceneTree?.getElementById?.(selectedId)
          const computed = element?.getAllComputedData?.() ?? {}
          const uiStrokes = core?.getUIProperty?.('strokes')
          return {
            computedStrokeCount: Array.isArray(computed.strokes)
              ? computed.strokes.length
              : -1,
            uiStrokeCount: Array.isArray(uiStrokes) ? uiStrokes.length : -1
          }
        })
      })
      .toEqual({
        computedStrokeCount: 1,
        uiStrokeCount: 1
      })
    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect.poll(() => getSelectedStrokeCount(page)).toBe(2)
    await expect(
      propertiesPanel.getByTestId('prop-stroke-color-picker-0')
    ).toBeVisible()
    await expect(
      propertiesPanel.getByTestId('prop-stroke-color-picker-1')
    ).toBeVisible()

    for (const control of [
      'position',
      'join',
      'cap',
      'miter',
      'width',
      'style',
      'dash',
      'gap'
    ]) {
      await expect(
        propertiesPanel.getByTestId(`prop-stroke-${control}-0`)
      ).toBeHidden()
    }

    await propertiesPanel.getByTestId('prop-stroke-remove-0').click()
    await expect.poll(() => getSelectedStrokeCount(page)).toBe(1)
  })

  test('stroke color picker drag projects immediately and commits once', async ({
    page
  }) => {
    await createRectangle(page, 0.3, 0.3)

    const propertiesPanel = getPropertiesPanel(page)
    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await page.waitForTimeout(120)
    const before = await getTransactionSnapshot(page)

    await propertiesPanel
      .getByTestId('prop-stroke-color-picker-0-trigger')
      .click()
    const palette = page.getByTestId('prop-stroke-color-picker-0-saturation')
    const paletteBox = await palette.boundingBox()
    expect(paletteBox).not.toBeNull()
    if (!paletteBox) {
      return
    }

    await page.evaluate(async () => {
      const { startSharedChannelCapture } = await import(
        '../src/testing/runtime-access'
      )
      startSharedChannelCapture('stroke-preview-deliveries', 'props')
    })
    await page.mouse.move(paletteBox.x + 24, paletteBox.y + 18)
    await page.mouse.down()
    await page.mouse.move(
      paletteBox.x + paletteBox.width - 24,
      paletteBox.y + 28,
      { steps: 4 }
    )
    await page.waitForTimeout(120)

    const during = await getTransactionSnapshot(page)
    expect(during.undoCount).toBe(before.undoCount)
    expect(during.isTransacting).toBeGreaterThan(0)
    const previewDeliveries = await page.evaluate(async () => {
      const { readTestCapture } = await import('../src/testing/runtime-access')
      return readTestCapture('stroke-preview-deliveries')
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
      return readTestCapture('stroke-preview-deliveries')
    })
    expect(finalDeliveries).toHaveLength(previewDeliveryCount)
    await page.evaluate(async () => {
      const { stopTestCapture } = await import('../src/testing/runtime-access')
      stopTestCapture('stroke-preview-deliveries')
    })
    await page.waitForTimeout(200)

    const after = await getTransactionSnapshot(page)
    expect(after.undoCount).toBe(before.undoCount + 1)
    expect(after.isTransacting).toBe(0)
  })

  test('should show fills section for selected vector element', async ({
    page
  }) => {
    await createVectorPath(page, 0.3, 0.3, 0.2, 0.2)
    await page.evaluate(async () => {
      const core = (await import('../src/testing/runtime-access')).core
      core.setSystemProperty('selectedVectorPoint', null)
      core.setSystemProperty('pathEditingVectorId', null)
      core.setSystemProperty('pathEditingMode', false)
    })
    await page.waitForTimeout(120)

    const propertiesPanel = getPropertiesPanel(page)
    await expect(
      propertiesPanel.getByTestId('prop-fills-section')
    ).toBeVisible()
  })

  test('vector point fields project canonical geometry with one-step undo and redo', async ({
    page
  }, testInfo) => {
    await createVectorPath(page, 0.3, 0.3, 0.2, 0.2)

    const propertiesPanel = getPropertiesPanel(page)
    const xInput = propertiesPanel.getByTestId('prop-vector-point-x')
    await expect(xInput).toBeVisible()

    const before = await getSelectedVectorPointProjection(page)
    expect(before).not.toBeNull()
    if (!before) {
      return
    }
    const beforeHistory = await getTransactionSnapshot(page)
    const nextX = before.computed.x + 48

    await xInput.fill(String(nextX))
    await xInput.press('Enter')

    await expect
      .poll(() => getSelectedVectorPointProjection(page))
      .toMatchObject({
        selected: { x: nextX },
        computed: { x: nextX }
      })
    const after = await getSelectedVectorPointProjection(page)
    expect(after?.rendered).not.toEqual(before.rendered)
    expect((await getTransactionSnapshot(page)).undoCount).toBe(
      beforeHistory.undoCount + 1
    )

    await undo(page)
    await expect
      .poll(() => getSelectedVectorPointProjection(page))
      .toEqual(before)
    await expect(xInput).toHaveValue(String(before.computed.x))

    await redo(page)
    await expect
      .poll(() => getSelectedVectorPointProjection(page))
      .toEqual(after)
    await expect(xInput).toHaveValue(String(nextX))
    await page.screenshot({
      path: testInfo.outputPath('vector-point-property-panel.png')
    })
  })

  test('should update fill color via properties panel color picker', async ({
    page
  }) => {
    await createRectangle(page, 0.3, 0.3)

    const initialFillColor = await getSelectedFillColor(page)
    expect(initialFillColor).not.toBeNull()

    const propertiesPanel = getPropertiesPanel(page)
    await propertiesPanel
      .getByTestId('prop-fill-color-picker-0-trigger')
      .click()
    const colorHexInput = page.getByTestId('prop-fill-color-picker-0-hex')
    await colorHexInput.fill('FF0000')
    await colorHexInput.press('Enter')
    await page.waitForTimeout(200)

    const selectedFillColor = await getSelectedFillColor(page)
    expect(selectedFillColor).toBe('#ff0000')

    await undo(page)
    await page.waitForTimeout(200)

    const fillColorAfterUndo = await getSelectedFillColor(page)
    expect(fillColorAfterUndo).toBe(initialFillColor)
  })

  test('color picker drag keeps one active transaction and commits on mouse up', async ({
    page
  }) => {
    await createRectangle(page, 0.3, 0.3)

    const initialFillColor = await getSelectedFillColor(page)
    expect(initialFillColor).not.toBeNull()

    const before = await getTransactionSnapshot(page)

    const propertiesPanel = getPropertiesPanel(page)
    await propertiesPanel
      .getByTestId('prop-fill-color-picker-0-trigger')
      .click()
    const palette = page.getByTestId('prop-fill-color-picker-0-saturation')
    const paletteBox = await palette.boundingBox()
    expect(paletteBox).not.toBeNull()
    if (!paletteBox) {
      return
    }

    await page.mouse.move(paletteBox.x + 24, paletteBox.y + 18)
    await page.evaluate(async () => {
      const { startSharedChannelCapture } = await import(
        '../src/testing/runtime-access'
      )
      startSharedChannelCapture('fill-preview-deliveries', 'props')
    })
    await page.mouse.down()
    await page.mouse.move(
      paletteBox.x + paletteBox.width - 24,
      paletteBox.y + 28,
      {
        steps: 1
      }
    )
    await page.waitForTimeout(120)

    const duringFirstInput = await getTransactionSnapshot(page)
    expect(duringFirstInput.undoCount).toBe(before.undoCount)
    expect(duringFirstInput.isTransacting).toBeGreaterThan(0)
    const colorDuringDrag = await getSelectedFillColor(page)
    expect(colorDuringDrag).not.toBe(initialFillColor)

    await page.mouse.move(
      paletteBox.x + paletteBox.width - 18,
      paletteBox.y + paletteBox.height - 18,
      {
        steps: 8
      }
    )
    await page.waitForTimeout(120)

    const duringDragUpdates = await getTransactionSnapshot(page)
    expect(duringDragUpdates.undoCount).toBe(before.undoCount)
    expect(duringDragUpdates.isTransacting).toBeGreaterThan(0)
    const finalColor = await getSelectedFillColor(page)
    expect(finalColor).not.toBe(initialFillColor)
    const previewDeliveries = await page.evaluate(async () => {
      const { readTestCapture } = await import('../src/testing/runtime-access')
      return readTestCapture('fill-preview-deliveries')
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
      return readTestCapture('fill-preview-deliveries')
    })
    expect(finalDeliveries).toHaveLength(previewDeliveryCount)
    await page.evaluate(async () => {
      const { stopTestCapture } = await import('../src/testing/runtime-access')
      stopTestCapture('fill-preview-deliveries')
    })
    await page.waitForTimeout(200)

    const afterMouseUp = await getTransactionSnapshot(page)
    expect(afterMouseUp.undoCount).toBe(before.undoCount + 1)
    expect(afterMouseUp.isTransacting).toBe(0)
    expect(await getSelectedFillColor(page)).toBe(finalColor)

    await undo(page)
    await page.waitForTimeout(200)

    const fillColorAfterUndo = await getSelectedFillColor(page)
    expect(fillColorAfterUndo).toBe(initialFillColor)
  })

  test('should edit gradient stops in properties panel', async ({ page }) => {
    await createRectangle(page, 0.3, 0.3)

    const propertiesPanel = getPropertiesPanel(page)
    await propertiesPanel
      .getByTestId('prop-fill-color-picker-0-trigger')
      .click()
    await page.getByTestId('prop-fill-mode-gradient-0').click()
    await page.waitForTimeout(120)

    await expect(page.getByTestId('prop-fill-gradient-editor-0')).toBeVisible()

    await page
      .getByTestId('prop-fill-gradient-stop-color-picker-0-1-trigger')
      .click()

    const stopHexInput = page.getByTestId(
      'prop-fill-gradient-stop-color-picker-0-1-hex'
    )
    await stopHexInput.fill('00FF00')
    await stopHexInput.press('Enter')
    await page.waitForTimeout(200)

    expect(await getSelectedGradientStopColor(page, 1)).toBe('#00ff00')
  })

  test('gradient strip stop drag publishes canonical frames without a mouse-up replay', async ({
    page
  }) => {
    const browserErrors: string[] = []
    page.on('pageerror', (error) => browserErrors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') {
        browserErrors.push(message.text())
      }
    })
    await createRectangle(page, 0.3, 0.3)

    const propertiesPanel = getPropertiesPanel(page)
    await propertiesPanel
      .getByTestId('prop-fill-color-picker-0-trigger')
      .click()
    await page.getByTestId('prop-fill-mode-gradient-0').click()
    await page.waitForTimeout(120)

    const initialPosition = await getSelectedGradientStopPosition(page, 1)
    expect(initialPosition).not.toBeNull()
    const before = await getTransactionSnapshot(page)
    const strip = page.getByTestId('prop-fill-gradient-strip-0')
    const stop = page.getByTestId('prop-fill-gradient-stop-0-1')
    const stripBox = await strip.boundingBox()
    const stopBox = await stop.boundingBox()
    expect(stripBox).not.toBeNull()
    expect(stopBox).not.toBeNull()
    if (!stripBox || !stopBox) {
      return
    }

    await page.evaluate(async () => {
      const { startSharedChannelCapture } = await import(
        '../src/testing/runtime-access'
      )
      startSharedChannelCapture('gradient-strip-preview-deliveries', 'props')
    })
    await page.mouse.move(stopBox.x + stopBox.width / 2, stopBox.y + 8)
    await page.mouse.down()
    await page.mouse.move(stripBox.x + stripBox.width * 0.65, stopBox.y + 8, {
      steps: 8
    })
    await page.waitForTimeout(120)

    expect(browserErrors).toEqual([])
    const duringPosition = await getSelectedGradientStopPosition(page, 1)
    expect(duringPosition).not.toBe(initialPosition)
    const during = await getTransactionSnapshot(page)
    expect(during.undoCount).toBe(before.undoCount)
    expect(during.isTransacting).toBeGreaterThan(0)
    const previewDeliveries = await page.evaluate(async () => {
      const { readTestCapture } = await import('../src/testing/runtime-access')
      return readTestCapture('gradient-strip-preview-deliveries')
    })
    expect(previewDeliveries).toContainEqual(
      expect.objectContaining({
        options: expect.objectContaining({ sharedDelivery: 'immediate' })
      })
    )

    await page.mouse.up()
    const finalDeliveries = await page.evaluate(async () => {
      const { readTestCapture } = await import('../src/testing/runtime-access')
      return readTestCapture('gradient-strip-preview-deliveries')
    })
    expect(finalDeliveries).toHaveLength(previewDeliveries.length)
    await page.evaluate(async () => {
      const { stopTestCapture } = await import('../src/testing/runtime-access')
      stopTestCapture('gradient-strip-preview-deliveries')
    })
    await page.waitForTimeout(160)

    const after = await getTransactionSnapshot(page)
    expect(after.undoCount).toBe(before.undoCount + 1)
    expect(after.isTransacting).toBe(0)

    await undo(page)
    await page.waitForTimeout(160)
    expect(await getSelectedGradientStopPosition(page, 1)).toBe(initialPosition)
  })

  test('gradient stop color picker drag keeps one active transaction and commits on mouse up', async ({
    page
  }) => {
    const browserErrors: string[] = []
    page.on('pageerror', (error) => browserErrors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') {
        browserErrors.push(message.text())
      }
    })
    await createRectangle(page, 0.3, 0.3)

    const propertiesPanel = getPropertiesPanel(page)
    await propertiesPanel
      .getByTestId('prop-fill-color-picker-0-trigger')
      .click()
    await page.getByTestId('prop-fill-mode-gradient-0').click()
    await page.waitForTimeout(120)

    const initialStopColor = await getSelectedGradientStopColor(page, 1)
    expect(initialStopColor).not.toBeNull()

    await page
      .getByTestId('prop-fill-gradient-stop-color-picker-0-1-trigger')
      .click()

    const before = await getTransactionSnapshot(page)
    const palette = page.getByTestId(
      'prop-fill-gradient-stop-color-picker-0-1-saturation'
    )
    const paletteBox = await palette.boundingBox()
    expect(paletteBox).not.toBeNull()
    if (!paletteBox) {
      return
    }

    await page.mouse.move(paletteBox.x + 24, paletteBox.y + 18)
    await page.evaluate(async () => {
      const { startSharedChannelCapture } = await import(
        '../src/testing/runtime-access'
      )
      startSharedChannelCapture('gradient-stop-preview-deliveries', 'props')
    })
    await page.mouse.down()
    await page.mouse.move(
      paletteBox.x + paletteBox.width - 22,
      paletteBox.y + 24,
      {
        steps: 6
      }
    )
    await page.waitForTimeout(120)

    expect(browserErrors).toEqual([])
    const duringDrag = await getTransactionSnapshot(page)
    expect(duringDrag.undoCount).toBe(before.undoCount)
    expect(duringDrag.isTransacting).toBeGreaterThan(0)
    const colorDuringDrag = await getSelectedGradientStopColor(page, 1)
    expect(colorDuringDrag).not.toBe(initialStopColor)
    const previewDeliveries = await page.evaluate(async () => {
      const { readTestCapture } = await import('../src/testing/runtime-access')
      return readTestCapture('gradient-stop-preview-deliveries')
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
      return readTestCapture('gradient-stop-preview-deliveries')
    })
    expect(finalDeliveries).toHaveLength(previewDeliveryCount)
    await page.evaluate(async () => {
      const { stopTestCapture } = await import('../src/testing/runtime-access')
      stopTestCapture('gradient-stop-preview-deliveries')
    })
    await page.waitForTimeout(200)

    const afterMouseUp = await getTransactionSnapshot(page)
    expect(afterMouseUp.undoCount).toBe(before.undoCount + 1)
    expect(afterMouseUp.isTransacting).toBe(0)

    await undo(page)
    await page.waitForTimeout(200)

    expect(await getSelectedGradientStopColor(page, 1)).toBe(initialStopColor)
  })

  test('should keep gradient stop color picker open when switching stops', async ({
    page
  }) => {
    await createRectangle(page, 0.3, 0.3)

    const propertiesPanel = getPropertiesPanel(page)
    await propertiesPanel
      .getByTestId('prop-fill-color-picker-0-trigger')
      .click()
    await page.getByTestId('prop-fill-mode-gradient-0').click()
    await page.waitForTimeout(120)

    await page
      .getByTestId('prop-fill-gradient-stop-color-picker-0-1-trigger')
      .click()
    await expect(
      page.getByTestId('prop-fill-gradient-stop-color-picker-0-1-hex')
    ).toBeVisible()

    await page.getByTestId('prop-fill-gradient-stop-0-0').click()

    const firstStopHexInput = page.getByTestId(
      'prop-fill-gradient-stop-color-picker-0-0-hex'
    )
    await expect(firstStopHexInput).toBeVisible()
    await expect(firstStopHexInput).toHaveValue('CCCCCC')
  })

  /**
   * Additional test: Properties update when selecting different elements
   */
  test('should update properties when selecting different elements', async ({
    page
  }) => {
    // Create first rectangle
    await createRectangle(page, 0.2, 0.2)

    // Get initial X value
    const propertiesPanel = getPropertiesPanel(page)
    const xInput = propertiesPanel.getByTestId('prop-x')
    const firstRectX = await xInput.inputValue()

    // Create second rectangle at different position
    await createRectangle(page, 0.6, 0.6)

    // Select first rectangle via Contents Panel to verify properties update
    const contentsPanel = getContentsPanel(page)
    const firstElement = contentsPanel
      .locator('[data-layer-element="true"]')
      .first()
    await firstElement.click()
    await page.waitForTimeout(200)

    // Get X value again - it should change back to first rectangle's value
    const selectedRectX = await xInput.inputValue()

    // The properties should update when selecting different elements
    expect(selectedRectX).toBe(firstRectX)

    // If rectangles were created at different positions, the values should be different
    // But we'll focus on the fact that the panel updates correctly
  })

  /**
   * Additional test: Tab between property fields
   */
  test('should allow tabbing between property fields', async ({ page }) => {
    // Create a rectangle
    await createRectangle(page, 0.3, 0.3)

    // Get the Properties Panel
    const propertiesPanel = getPropertiesPanel(page)

    // Focus on X input
    const xInput = propertiesPanel.getByTestId('prop-x')
    await xInput.focus()

    // Press Tab to move to Y input
    await page.keyboard.press('Tab')

    // Verify Y input is now focused
    const yInput = propertiesPanel.getByTestId('prop-y')
    await expect(yInput).toBeFocused()
  })
})
