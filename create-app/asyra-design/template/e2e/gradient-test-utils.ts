import { expect, type Page } from '@playwright/test'
import type { FillGradientHandle, FillGradientStop } from '@asyra/utils'

export interface SelectedGradientSnapshot {
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
    gradientHandles: FillGradientHandle[]
    gradientStops: FillGradientStop[]
  } | null
}

export const getSelectedGradientSnapshot = async (
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

export const openGradientFillEditor = async (page: Page) => {
  await page.getByTestId('prop-fill-color-picker-0-trigger').click()
  await page.getByTestId('prop-fill-mode-gradient-0').click()
  await expect(page.getByTestId('prop-fill-gradient-editor-0')).toBeVisible()
}

export const getGradientHandleClientPosition = async (
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
