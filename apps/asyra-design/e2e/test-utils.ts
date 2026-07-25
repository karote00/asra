import type { Locator, Page } from '@playwright/test'
import type { Rect } from '@asyra/utils'

/**
 * Shared test utilities for E2E tests
 */

// Layout constants (matching the UI constants)
export const SIDEBAR_WIDTH = 240 // COLUMN_WIDTH * 4 = 60 * 4
export const HEADER_HEIGHT = 48 // h-12 = 12 * 4 = 48px

const browserErrorsByPage = new WeakMap<Page, string[]>()

export const captureBrowserErrors = (page: Page): void => {
  const browserErrors: string[] = []
  browserErrorsByPage.set(page, browserErrors)

  page.on('pageerror', (error) => {
    browserErrors.push(error.message)
  })
  page.on('console', (message) => {
    if (message.type() === 'error') {
      browserErrors.push(message.text())
    }
  })
}

export const getCapturedBrowserErrors = (page: Page): readonly string[] =>
  browserErrorsByPage.get(page) ?? []

/**
 * Get a safe canvas position that won't be intercepted by overlays
 * @param page - The Playwright page
 * @param relativeX - Relative X position within the canvas area (0-1)
 * @param relativeY - Relative Y position within the canvas area (0-1)
 */
export async function getCanvasPosition(
  page: Page,
  relativeX = 0.5,
  relativeY = 0.5
): Promise<{ x: number; y: number }> {
  const viewportSize = page.viewportSize()
  if (!viewportSize) {
    throw new Error('Viewport size not available')
  }

  // Calculate safe canvas area (excluding sidebars and header)
  const canvasLeft = SIDEBAR_WIDTH
  const canvasTop = HEADER_HEIGHT
  const canvasWidth = viewportSize.width - SIDEBAR_WIDTH * 2
  const canvasHeight = viewportSize.height - HEADER_HEIGHT - 100 // footer buffer

  return {
    x: canvasLeft + canvasWidth * relativeX,
    y: canvasTop + canvasHeight * relativeY
  }
}

/**
 * Click on the canvas at a safe position
 */
export async function clickCanvas(
  page: Page,
  relativeX = 0.5,
  relativeY = 0.5
) {
  const pos = await getCanvasPosition(page, relativeX, relativeY)
  await page.mouse.click(pos.x, pos.y)
}

/**
 * Perform a drag operation on the canvas
 */
export async function dragOnCanvas(
  page: Page,
  startRelX: number,
  startRelY: number,
  endRelX: number,
  endRelY: number,
  steps = 10
) {
  const startPos = await getCanvasPosition(page, startRelX, startRelY)
  const endPos = await getCanvasPosition(page, endRelX, endRelY)

  await page.mouse.move(startPos.x, startPos.y)
  await page.mouse.down()
  await page.mouse.move(endPos.x, endPos.y, { steps })
  await page.mouse.up()
}

/**
 * Wait for the app to be fully initialized
 */
export async function waitForAppReady(page: Page) {
  await page.waitForLoadState('networkidle')
  await page.waitForSelector('#viewport-anchor')
  await page.waitForSelector('[data-testid="toolbar"]')
  // Extra wait for canvas to be ready
  await page.waitForSelector('canvas')
  await page.waitForTimeout(500) // Allow rendering to complete
}

export async function setStrokeDiagnosticsMode(
  page: Page,
  mode: 'off' | 'summary' | 'full'
) {
  await page.evaluate((nextMode) => {
    ;(
      globalThis as unknown as {
        __ASYRA_STROKE_DIAGNOSTICS_MODE__?: 'off' | 'summary' | 'full'
      }
    ).__ASYRA_STROKE_DIAGNOSTICS_MODE__ = nextMode
  }, mode)
}

/**
 * Reset the canvas by clicking the Reset button
 */
export async function resetCanvas(page: Page) {
  await page.evaluate(() => {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index)
      if (key === 'FILE' || key?.startsWith('FILE:')) {
        localStorage.removeItem(key)
      }
    }
  })

  let resetButton = page.getByTestId('reset-button')
  const canReset = await resetButton
    .waitFor({ state: 'visible', timeout: 5_000 })
    .then(() => true)
    .catch(() => false)

  if (!canReset) {
    await page.goto('/')
    await waitForAppReady(page)
    resetButton = page.getByTestId('reset-button')
  }

  const reloadPromise = page
    .waitForEvent('load', { timeout: 10_000 })
    .catch(() => undefined)
  await resetButton.click()
  await reloadPromise
  await waitForAppReady(page)
}

export function parseStrokeDashAndGapInput(pattern: string): {
  dash: string
  gap: string
} {
  const entries = pattern
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)

  const dash = entries[0] ?? '20'
  return {
    dash,
    gap: entries[1] ?? dash
  }
}

export async function fillStrokeDashAndGap(
  propertiesPanel: Locator,
  strokeIndex: number,
  pattern: string
) {
  const { dash, gap } = parseStrokeDashAndGapInput(pattern)
  const dashInput = propertiesPanel.getByTestId(
    `prop-stroke-dash-${strokeIndex}`
  )
  const gapInput = propertiesPanel.getByTestId(`prop-stroke-gap-${strokeIndex}`)

  await dashInput.fill(dash)
  await dashInput.press('Enter')
  await gapInput.fill(gap)
  await gapInput.press('Enter')
}

/**
 * Create a rectangle at the given relative canvas position
 */
export async function createRectangle(
  page: Page,
  relativeX = 0.3,
  relativeY = 0.3
) {
  // Switch to Rectangle tool
  await page.keyboard.press('r')
  await page.waitForTimeout(100)

  // Click to create rectangle
  await clickCanvas(page, relativeX, relativeY)
  await page.waitForTimeout(500)

  // Switch back to Select tool
  await page.keyboard.press('v')
  await page.waitForTimeout(100)
}

/**
 * Create an oval at the given relative canvas position
 */
export async function createOval(page: Page, relativeX = 0.3, relativeY = 0.3) {
  // Switch to Oval tool
  await page.keyboard.press('o')
  await page.waitForTimeout(100)

  // Click to create oval
  await clickCanvas(page, relativeX, relativeY)
  await page.waitForTimeout(500)

  // Switch back to Select tool
  await page.keyboard.press('v')
  await page.waitForTimeout(100)
}

/**
 * Get selected element computed position and size from core.
 */
export interface ElementRect extends Rect {
  id: string
}

export async function getSelectedElementRect(
  page: Page
): Promise<ElementRect | null> {
  return page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId = core?.deps?.selection?.getElementSelectionIds?.()?.[0]
    if (!selectedId) {
      return null
    }

    const element = core?.deps?.sceneTree?.getElementById?.(selectedId)
    const computed = element?.getAllComputedData?.() ?? {}
    const x = typeof computed.x === 'number' ? computed.x : null
    const y = typeof computed.y === 'number' ? computed.y : null
    const width = typeof computed.width === 'number' ? computed.width : null
    const height = typeof computed.height === 'number' ? computed.height : null

    if (x === null || y === null || width === null || height === null) {
      return null
    }

    return {
      id: selectedId,
      x,
      y,
      width,
      height
    }
  })
}

export async function getElementRectClientCenter(
  page: Page,
  rect: Rect
): Promise<{ x: number; y: number }> {
  return page.evaluate(({ x, y, width, height }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const zoom = core?.getSystemProperty?.('zoom') ?? 1
    const viewport = core?.getSystemProperty?.('viewportPosition') ?? {
      x: 0,
      y: 0
    }

    return {
      x: (x + width / 2) * zoom + viewport.x,
      y: (y + height / 2) * zoom + viewport.y
    }
  }, rect)
}

/**
 * Resolve selected element center in client-space.
 */
export async function getSelectedElementClientCenter(
  page: Page
): Promise<{ x: number; y: number } | null> {
  const rect = await getSelectedElementRect(page)
  if (!rect) {
    return null
  }

  return page.evaluate(({ id, width, height }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const render = (window as any).__Core__?.deps?.render
    const renderElement = render?.getElementById?.(id)
    if (!renderElement) {
      return null
    }

    const center = renderElement.toGlobal({
      x: width / 2,
      y: height / 2
    })
    const canvasBounds = render.app?.canvas?.getBoundingClientRect?.()
    const x = center.x + (canvasBounds?.left ?? 0)
    const y = center.y + (canvasBounds?.top ?? 0)
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return null
    }

    return { x, y }
  }, rect)
}

/**
 * Drag the selected element by a client-space delta.
 */
export async function dragSelectedElementBy(
  page: Page,
  deltaX: number,
  deltaY: number,
  steps = 20
) {
  const center = await getSelectedElementClientCenter(page)
  if (!center) {
    throw new Error('No selected element center available for drag')
  }

  await page.mouse.move(center.x, center.y)
  await page.mouse.down()
  await page.mouse.move(center.x + deltaX, center.y + deltaY, { steps })
  await page.mouse.up()
}

export const getTransactionSnapshot = async (page: Page) =>
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

export const setSelectedGradient = async (
  page: Page,
  gradient: unknown
): Promise<void> => {
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

/**
 * Perform an Undo operation
 */
export async function undo(page: Page) {
  // Click on the toolbar area (neutral zone) to gain focus without triggering tools
  const toolbar = getToolbar(page)
  await toolbar.click({ position: { x: 5, y: 5 } })

  // Press the shortcut
  await page.keyboard.down('Meta')
  await page.keyboard.press('Z')
  await page.keyboard.up('Meta')
  await page.waitForTimeout(500)
}

/**
 * Perform a Redo operation
 */
export async function redo(page: Page) {
  // Click on the toolbar area (neutral zone) to gain focus without triggering tools
  const toolbar = getToolbar(page)
  await toolbar.click({ position: { x: 5, y: 5 } })

  // Press the shortcut
  await page.keyboard.down('Meta')
  await page.keyboard.down('Shift')
  await page.keyboard.press('Z')
  await page.keyboard.up('Shift')
  await page.keyboard.up('Meta')
  await page.waitForTimeout(1000) // Extra time for redo to process
}

/**
 * Check if an element is selected by checking the Properties Panel
 */
export async function hasSelectedElement(page: Page): Promise<boolean> {
  const propertiesPanel = getPropertiesPanel(page)
  const positionInput = propertiesPanel.getByTestId('prop-x')
  return await positionInput.isVisible()
}

/**
 * Get the number of elements in the Contents Panel
 */
export async function getElementCount(page: Page): Promise<number> {
  const contentsPanel = getContentsPanel(page)
  const elements = contentsPanel.locator('[data-layer-element="true"]')
  return await elements.count()
}

/**
 * Get the Contents Panel locator
 */
export function getContentsPanel(page: Page) {
  return page.getByTestId('contents-panel')
}

export async function pressGroupCommandShortcut(
  page: Page,
  command: 'group' | 'ungroup'
): Promise<void> {
  const primaryModifier = await page.evaluate(() =>
    /mac/i.test(navigator.platform) ? 'Meta' : 'Control'
  )
  const shift = command === 'ungroup' ? 'Shift+' : ''
  await page.keyboard.press(`${primaryModifier}+${shift}G`)
}

/**
 * Get the Properties Panel locator
 */
export function getPropertiesPanel(page: Page) {
  return page.getByTestId('properties-panel')
}

/**
 * Get the Toolbar locator
 */
export function getToolbar(page: Page) {
  return page.getByTestId('toolbar')
}

/**
 * Get the current zoom level from the toolbar
 */
export async function getZoomLevel(page: Page): Promise<number> {
  const zoomDisplay = page.getByTestId('zoom-level')
  const valueStr = (await zoomDisplay.getAttribute('data-value')) ?? '1'
  return parseFloat(valueStr) * 100
}

/**
 * Get the active tool based on button styling
 */
export async function getActiveTool(
  page: Page
): Promise<'select' | 'rectangle' | 'oval' | 'pen' | 'unknown'> {
  const selectTool = page.getByTestId('tool-select')
  const rectangleTool = page.getByTestId('tool-rectangle')
  const ovalTool = page.getByTestId('tool-oval')
  const penTool = page.getByTestId('tool-pen')

  if ((await selectTool.getAttribute('data-active')) === 'true') {
    return 'select'
  }
  if ((await rectangleTool.getAttribute('data-active')) === 'true') {
    return 'rectangle'
  }
  if ((await ovalTool.getAttribute('data-active')) === 'true') {
    return 'oval'
  }
  if ((await penTool.getAttribute('data-active')) === 'true') {
    return 'pen'
  }

  return 'unknown'
}

/**
 * Create a vector path with the Pen tool
 */
export async function createVectorPath(
  page: Page,
  startX = 0.3,
  startY = 0.3,
  width = 0.2,
  height = 0.2
) {
  // Switch to Pen tool
  await page.keyboard.press('p')
  await page.waitForTimeout(100)

  // Perform a drag to create the vector path
  await dragOnCanvas(page, startX, startY, startX + width, startY + height, 20)
  await page.waitForFunction(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const elements = core?.deps?.sceneTree?.getAllElements?.()
    if (!(elements instanceof Map)) {
      return false
    }

    return Array.from(elements.keys()).some((id) => id !== 'workspace')
  })
  await page.waitForTimeout(500)

  // Switch back to Select tool
  await page.keyboard.press('v')
  await page.waitForTimeout(100)
}
