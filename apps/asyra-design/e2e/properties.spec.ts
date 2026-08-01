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
  const getSelectedFillColor = async (page: Page) =>
    page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
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

  const getSelectedGradientStopColor = async (page: Page, stopIndex: number) =>
    page.evaluate((targetStopIndex) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
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

  const getSelectedStrokeCount = async (page: Page) =>
    page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const selectedId = core?.deps?.selection?.getElementSelectionIds?.()?.[0]
      if (!selectedId) {
        return 0
      }

      const element = core?.deps?.sceneTree?.getElementById?.(selectedId)
      const computed = element?.getAllComputedData?.() ?? {}
      return Array.isArray(computed.strokes) ? computed.strokes.length : 0
    })

  const getSelectedStroke = async (page: Page, strokeIndex = 0) =>
    page.evaluate((targetStrokeIndex) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const selectedId = core?.deps?.selection?.getElementSelectionIds?.()?.[0]
      if (!selectedId) {
        return null
      }

      const element = core?.deps?.sceneTree?.getElementById?.(selectedId)
      const computed = element?.getAllComputedData?.() ?? {}
      return Array.isArray(computed.strokes)
        ? (computed.strokes[targetStrokeIndex] ?? null)
        : null
    }, strokeIndex)

  const patchSelectedStroke = async (
    page: Page,
    strokePatch: Record<string, unknown>,
    strokeIndex = 0
  ) =>
    page.evaluate(
      ({ strokePatch, strokeIndex }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const core = (window as any).__Core__
        const selectedId =
          core?.deps?.selection?.getElementSelectionIds?.()?.[0]
        if (!selectedId) {
          throw new Error('No selected element available for stroke patch')
        }

        const element = core?.deps?.sceneTree?.getElementById?.(selectedId)
        const computed = element?.getAllComputedData?.() ?? {}
        if (
          !Array.isArray(computed.strokes) ||
          !computed.strokes[strokeIndex]
        ) {
          throw new Error(`No stroke row available at index ${strokeIndex}`)
        }

        const stroke = computed.strokes[strokeIndex]
        if (!stroke?.id) {
          throw new Error(`Stroke row at index ${strokeIndex} has no id`)
        }
        if (typeof core?.patchElementProperties !== 'function') {
          throw new Error('Typed element-property patch API is unavailable')
        }
        core.patchElementProperties(
          [
            {
              elementId: selectedId,
              records: [
                {
                  key: 'strokes',
                  set: {
                    [stroke.id]: { ...stroke, ...strokePatch }
                  }
                }
              ]
            }
          ],
          { undoable: false }
        )
      },
      { strokePatch, strokeIndex }
    )

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
    // Create a rectangle
    await createRectangle(page, 0.3, 0.3)

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
    // Create a rectangle
    await createRectangle(page, 0.3, 0.3)

    // Get the Properties Panel
    const propertiesPanel = getPropertiesPanel(page)

    // Find and update the Width input (3rd input after X, Y)
    const widthInput = propertiesPanel.getByTestId('prop-width')

    // Clear the current value and type new value
    await widthInput.click()
    await widthInput.fill('300')
    await widthInput.press('Enter')
    await page.waitForTimeout(200)

    // Verify the value was updated
    const newWidthValue = await widthInput.inputValue()
    expect(newWidthValue).toBe('300')

    // Update Height as well (4th input)
    const heightInput = propertiesPanel.getByTestId('prop-height')
    await heightInput.click()
    await heightInput.fill('250')
    await heightInput.press('Enter')
    await page.waitForTimeout(200)

    // Verify Height value was updated
    const newHeightValue = await heightInput.inputValue()
    expect(newHeightValue).toBe('250')
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
    await createRectangle(page, 0.3, 0.3)

    const propertiesPanel = getPropertiesPanel(page)
    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await page.waitForTimeout(120)
    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await page.waitForTimeout(120)

    expect(await getSelectedStrokeCount(page)).toBe(2)
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
    await page.waitForTimeout(120)
    expect(await getSelectedStrokeCount(page)).toBe(1)
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

    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const scope = window as any
      scope.__strokePreviewDeliveries = []
      scope.__disposeStrokePreviewObserver =
        scope.__Core__?.deps?.factory?.observeSharedDataChannel?.(
          'props',
          (change: unknown) => scope.__strokePreviewDeliveries.push(change)
        )
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
    const previewDeliveries = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (window as any).__strokePreviewDeliveries ?? []
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
      scope.__disposeStrokePreviewObserver?.()
      delete scope.__disposeStrokePreviewObserver
      delete scope.__strokePreviewDeliveries
    })
    await page.waitForTimeout(200)

    const after = await getTransactionSnapshot(page)
    expect(after.undoCount).toBe(before.undoCount + 1)
    expect(after.isTransacting).toBe(0)
  })

  test('should edit dashed stroke through Dash and Gap fields', async ({
    page
  }) => {
    test.skip(
      true,
      'Stroke geometry controls stay hidden until stroke implementation is complete.'
    )

    await createRectangle(page, 0.3, 0.3)

    const propertiesPanel = getPropertiesPanel(page)
    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await page.waitForTimeout(120)
    await propertiesPanel
      .getByTestId('prop-stroke-style-0')
      .selectOption('dashed')

    const dashInput = propertiesPanel.getByTestId('prop-stroke-dash-0')
    const gapInput = propertiesPanel.getByTestId('prop-stroke-gap-0')

    await expect(dashInput).toBeVisible()
    await expect(gapInput).toBeVisible()
    await expect(
      propertiesPanel.getByTestId('prop-stroke-pattern-0')
    ).toHaveCount(0)
    await expect(
      propertiesPanel.getByTestId('prop-stroke-offset-0')
    ).toHaveCount(0)

    await dashInput.fill('27')
    await dashInput.press('Enter')
    await gapInput.fill('20')
    await gapInput.press('Enter')

    await expect
      .poll(() => getSelectedStroke(page))
      .toMatchObject({
        dash: 27,
        gap: 20
      })

    await patchSelectedStroke(page, {
      dash: 27,
      gap: 20
    })
    await page.waitForTimeout(120)

    await expect(dashInput).toHaveValue('27')
    await expect(gapInput).toHaveValue('20')

    await gapInput.fill('21')
    await gapInput.press('Enter')

    await expect
      .poll(() => getSelectedStroke(page))
      .toMatchObject({
        dash: 27,
        gap: 21
      })
  })

  test('should edit every basic stroke geometry parameter with one-step undo and redo', async ({
    page
  }) => {
    test.skip(
      true,
      'Stroke geometry controls stay hidden until stroke implementation is complete.'
    )

    await createRectangle(page, 0.3, 0.3)

    const propertiesPanel = getPropertiesPanel(page)
    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await page.waitForTimeout(120)

    await propertiesPanel
      .getByTestId('prop-stroke-position-0')
      .selectOption('outside')
    await propertiesPanel
      .getByTestId('prop-stroke-join-0')
      .selectOption('miter')
    await propertiesPanel
      .getByTestId('prop-stroke-cap-0')
      .selectOption('square')

    const miterInput = propertiesPanel.getByTestId('prop-stroke-miter-0')
    const widthInput = propertiesPanel.getByTestId('prop-stroke-width-0')
    await miterInput.fill('42')
    await miterInput.press('Enter')
    await widthInput.fill('18')
    await widthInput.press('Enter')

    await propertiesPanel
      .getByTestId('prop-stroke-style-0')
      .selectOption('dashed')
    const dashInput = propertiesPanel.getByTestId('prop-stroke-dash-0')
    const gapInput = propertiesPanel.getByTestId('prop-stroke-gap-0')
    await dashInput.fill('27')
    await dashInput.press('Enter')

    const gapBeforeEdit = (await getSelectedStroke(page))?.gap
    await gapInput.fill('13')
    await gapInput.press('Enter')

    const expectedStroke = {
      position: 'outside',
      width: 18,
      capType: 'square',
      joinType: 'miter',
      miterAngle: 42,
      style: 'dashed',
      dash: 27,
      gap: 13
    }
    await expect
      .poll(() => getSelectedStroke(page))
      .toMatchObject(expectedStroke)

    await undo(page)
    await expect
      .poll(() => getSelectedStroke(page))
      .toMatchObject({
        ...expectedStroke,
        gap: gapBeforeEdit
      })

    await redo(page)
    await expect
      .poll(() => getSelectedStroke(page))
      .toMatchObject(expectedStroke)
  })

  test('should show fills section for selected vector element', async ({
    page
  }) => {
    await createVectorPath(page, 0.3, 0.3, 0.2, 0.2)
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
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
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const scope = window as any
      scope.__fillPreviewDeliveries = []
      scope.__disposeFillPreviewObserver =
        scope.__Core__?.deps?.factory?.observeSharedDataChannel?.(
          'props',
          (change: unknown) => scope.__fillPreviewDeliveries.push(change)
        )
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
    const previewDeliveries = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (window as any).__fillPreviewDeliveries ?? []
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
      scope.__disposeFillPreviewObserver?.()
      delete scope.__disposeFillPreviewObserver
      delete scope.__fillPreviewDeliveries
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

  test('gradient stop color picker drag keeps one active transaction and commits on mouse up', async ({
    page
  }) => {
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
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const scope = window as any
      scope.__gradientStopPreviewDeliveries = []
      scope.__disposeGradientStopPreviewObserver =
        scope.__Core__?.deps?.factory?.observeSharedDataChannel?.(
          'props',
          (change: unknown) =>
            scope.__gradientStopPreviewDeliveries.push(change)
        )
    })
    await page.mouse.down()
    await page.mouse.move(
      paletteBox.x + paletteBox.width - 22,
      paletteBox.y + paletteBox.height - 24,
      {
        steps: 6
      }
    )
    await page.waitForTimeout(120)

    const duringDrag = await getTransactionSnapshot(page)
    expect(duringDrag.undoCount).toBe(before.undoCount)
    expect(duringDrag.isTransacting).toBeGreaterThan(0)
    const colorDuringDrag = await getSelectedGradientStopColor(page, 1)
    expect(colorDuringDrag).not.toBe(initialStopColor)
    const previewDeliveries = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (window as any).__gradientStopPreviewDeliveries ?? []
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
      scope.__disposeGradientStopPreviewObserver?.()
      delete scope.__disposeGradientStopPreviewObserver
      delete scope.__gradientStopPreviewDeliveries
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
