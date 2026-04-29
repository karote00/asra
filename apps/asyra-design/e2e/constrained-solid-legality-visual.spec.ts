import { expect, test, type Page } from '@playwright/test'
import {
  createRectangle,
  createVectorPath,
  getSelectedElementClientCenter,
  getPropertiesPanel,
  getSelectedElementRect,
  resetCanvas,
  waitForAppReady
} from './test-utils'

const PADDING = 24

interface RasterCapture {
  base64: string
  width: number
  height: number
}

const ensureDebugFlag = async (page: Page, enabled: boolean) => {
  await page.evaluate((nextEnabled) => {
    ;(
      window as unknown as {
        __ASYRA_CONSTRAINED_SOLID_LEGALITY_DEBUG__?: {
          enabled?: boolean
          mode?: 'legality' | 'ownership' | 'all'
        }
      }
    ).__ASYRA_CONSTRAINED_SOLID_LEGALITY_DEBUG__ = {
      enabled: nextEnabled,
      mode: 'legality'
    }
  }, enabled)
}

const ensureOwnershipDebugFlag = async (page: Page, enabled: boolean) => {
  await page.evaluate((nextEnabled) => {
    ;(
      window as unknown as {
        __ASYRA_CONSTRAINED_SOLID_LEGALITY_DEBUG__?: {
          enabled?: boolean
          mode?: 'legality' | 'ownership' | 'all'
        }
      }
    ).__ASYRA_CONSTRAINED_SOLID_LEGALITY_DEBUG__ = {
      enabled: nextEnabled,
      mode: 'ownership'
    }
  }, enabled)
}

const ensureStrokeRow = async (page: Page) => {
  const propertiesPanel = getPropertiesPanel(page)
  if (await propertiesPanel.getByTestId('prop-strokes-empty').isVisible()) {
    await propertiesPanel.getByTestId('prop-stroke-add').click()
  }

  await expect(propertiesPanel.getByTestId('prop-stroke-0')).toBeVisible()
}

const configureConstrainedStroke = async (
  page: Page,
  position: 'inside' | 'outside'
) => {
  const propertiesPanel = getPropertiesPanel(page)
  await propertiesPanel.getByTestId('prop-width').fill('180')
  await propertiesPanel.getByTestId('prop-width').press('Enter')
  await propertiesPanel.getByTestId('prop-height').fill('120')
  await propertiesPanel.getByTestId('prop-height').press('Enter')

  await propertiesPanel
    .getByTestId('prop-stroke-position-0')
    .selectOption(position)
  await propertiesPanel.getByTestId('prop-stroke-style-0').selectOption('solid')
  await propertiesPanel.getByTestId('prop-stroke-width-0').fill('12')
  await propertiesPanel.getByTestId('prop-stroke-width-0').press('Enter')

  await page.waitForTimeout(300)
}

const configureOutsideSolidStrokeRow = async (
  page: Page,
  index: number,
  width: number,
  colorHex: string,
  join: 'miter' | 'bevel' = 'miter'
) => {
  const propertiesPanel = getPropertiesPanel(page)
  await propertiesPanel
    .getByTestId(`prop-stroke-position-${index}`)
    .selectOption('outside')
  await propertiesPanel
    .getByTestId(`prop-stroke-style-${index}`)
    .selectOption('solid')
  await propertiesPanel
    .getByTestId(`prop-stroke-join-${index}`)
    .selectOption(join)
  await propertiesPanel
    .getByTestId(`prop-stroke-width-${index}`)
    .fill(String(width))
  await propertiesPanel.getByTestId(`prop-stroke-width-${index}`).press('Enter')
  await propertiesPanel.getByTestId(`prop-stroke-color-${index}`).fill(colorHex)
  await propertiesPanel.getByTestId(`prop-stroke-color-${index}`).press('Enter')
}

const patchSelectedVectorToTwoClosedRectangles = async (page: Page) => {
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

    const secondaryNetworkId = `${primaryNetwork.id}:secondary`
    const nextPoints = {
      a: { id: 'a', kind: 'anchor', x: 0, y: 0, anchorType: 'sharp' },
      b: { id: 'b', kind: 'anchor', x: 80, y: 0, anchorType: 'sharp' },
      c: { id: 'c', kind: 'anchor', x: 80, y: 40, anchorType: 'sharp' },
      d: { id: 'd', kind: 'anchor', x: 0, y: 40, anchorType: 'sharp' },
      e: { id: 'e', kind: 'anchor', x: 120, y: 0, anchorType: 'sharp' },
      f: { id: 'f', kind: 'anchor', x: 200, y: 0, anchorType: 'sharp' },
      g: { id: 'g', kind: 'anchor', x: 200, y: 40, anchorType: 'sharp' },
      h: { id: 'h', kind: 'anchor', x: 120, y: 40, anchorType: 'sharp' }
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
      },
      ef: {
        id: 'ef',
        startId: 'e',
        endId: 'f',
        outControlId: null,
        inControlId: null
      },
      fg: {
        id: 'fg',
        startId: 'f',
        endId: 'g',
        outControlId: null,
        inControlId: null
      },
      gh: {
        id: 'gh',
        startId: 'g',
        endId: 'h',
        outControlId: null,
        inControlId: null
      },
      he: {
        id: 'he',
        startId: 'h',
        endId: 'e',
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
          },
          [secondaryNetworkId]: {
            id: secondaryNetworkId,
            pointIds: ['e', 'f', 'g', 'h'],
            segmentIds: ['ef', 'fg', 'gh', 'he'],
            closed: true
          }
        },
        closed: true,
        width: 200,
        height: 40
      },
      { undoable: false }
    )
  })

  await page.waitForTimeout(180)
}

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

const patchSelectedVectorToMixedTopologyWithNonOrthogonalPiece = async (
  page: Page
) => {
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

    const secondaryNetworkId = `${primaryNetwork.id}:secondary`
    const nextPoints = {
      a: { id: 'a', kind: 'anchor', x: 0, y: 0, anchorType: 'sharp' },
      b: { id: 'b', kind: 'anchor', x: 80, y: 0, anchorType: 'sharp' },
      c: { id: 'c', kind: 'anchor', x: 80, y: 40, anchorType: 'sharp' },
      d: { id: 'd', kind: 'anchor', x: 40, y: 20, anchorType: 'sharp' },
      e: { id: 'e', kind: 'anchor', x: 0, y: 40, anchorType: 'sharp' },
      f: { id: 'f', kind: 'anchor', x: 120, y: 0, anchorType: 'sharp' },
      g: { id: 'g', kind: 'anchor', x: 200, y: 0, anchorType: 'sharp' },
      h: { id: 'h', kind: 'anchor', x: 200, y: 40, anchorType: 'sharp' },
      i: { id: 'i', kind: 'anchor', x: 120, y: 40, anchorType: 'sharp' }
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
      de: {
        id: 'de',
        startId: 'd',
        endId: 'e',
        outControlId: null,
        inControlId: null
      },
      ea: {
        id: 'ea',
        startId: 'e',
        endId: 'a',
        outControlId: null,
        inControlId: null
      },
      fg: {
        id: 'fg',
        startId: 'f',
        endId: 'g',
        outControlId: null,
        inControlId: null
      },
      gh: {
        id: 'gh',
        startId: 'g',
        endId: 'h',
        outControlId: null,
        inControlId: null
      },
      hi: {
        id: 'hi',
        startId: 'h',
        endId: 'i',
        outControlId: null,
        inControlId: null
      },
      if: {
        id: 'if',
        startId: 'i',
        endId: 'f',
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
            pointIds: ['a', 'b', 'c', 'd', 'e'],
            segmentIds: ['ab', 'bc', 'cd', 'de', 'ea'],
            closed: true
          },
          [secondaryNetworkId]: {
            id: secondaryNetworkId,
            pointIds: ['f', 'g', 'h', 'i'],
            segmentIds: ['fg', 'gh', 'hi', 'if'],
            closed: true
          }
        },
        closed: true,
        width: 200,
        height: 40
      },
      { undoable: false }
    )
  })

  await page.waitForTimeout(180)
}

const patchSelectedVectorToEquivalentMixedTopologyWithNonOrthogonalPiece =
  async (page: Page) => {
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

      const secondaryNetworkId = `${primaryNetwork.id}:secondary`
      const nextPoints = {
        a: { id: 'a', kind: 'anchor', x: 0, y: 40, anchorType: 'sharp' },
        b: { id: 'b', kind: 'anchor', x: 40, y: 20, anchorType: 'sharp' },
        c: { id: 'c', kind: 'anchor', x: 80, y: 40, anchorType: 'sharp' },
        d: { id: 'd', kind: 'anchor', x: 80, y: 0, anchorType: 'sharp' },
        e: { id: 'e', kind: 'anchor', x: 0, y: 0, anchorType: 'sharp' },
        f: { id: 'f', kind: 'anchor', x: 120, y: 40, anchorType: 'sharp' },
        g: { id: 'g', kind: 'anchor', x: 200, y: 40, anchorType: 'sharp' },
        h: { id: 'h', kind: 'anchor', x: 200, y: 0, anchorType: 'sharp' },
        i: { id: 'i', kind: 'anchor', x: 120, y: 0, anchorType: 'sharp' }
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
        de: {
          id: 'de',
          startId: 'd',
          endId: 'e',
          outControlId: null,
          inControlId: null
        },
        ea: {
          id: 'ea',
          startId: 'e',
          endId: 'a',
          outControlId: null,
          inControlId: null
        },
        fg: {
          id: 'fg',
          startId: 'f',
          endId: 'g',
          outControlId: null,
          inControlId: null
        },
        gh: {
          id: 'gh',
          startId: 'g',
          endId: 'h',
          outControlId: null,
          inControlId: null
        },
        hi: {
          id: 'hi',
          startId: 'h',
          endId: 'i',
          outControlId: null,
          inControlId: null
        },
        if: {
          id: 'if',
          startId: 'i',
          endId: 'f',
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
              pointIds: ['a', 'b', 'c', 'd', 'e'],
              segmentIds: ['ab', 'bc', 'cd', 'de', 'ea'],
              closed: true
            },
            [secondaryNetworkId]: {
              id: secondaryNetworkId,
              pointIds: ['f', 'g', 'h', 'i'],
              segmentIds: ['fg', 'gh', 'hi', 'if'],
              closed: true
            }
          },
          closed: true,
          width: 200,
          height: 40
        },
        { undoable: false }
      )
    })

    await page.waitForTimeout(180)
  }

const patchSelectedVectorToMixedTopologyWithMultipleNonOrthogonalPieces =
  async (page: Page) => {
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

      const secondaryNetworkId = `${primaryNetwork.id}:secondary`
      const nextPoints = {
        a: { id: 'a', kind: 'anchor', x: 0, y: 0, anchorType: 'sharp' },
        b: { id: 'b', kind: 'anchor', x: 80, y: 0, anchorType: 'sharp' },
        c: { id: 'c', kind: 'anchor', x: 80, y: 40, anchorType: 'sharp' },
        d: { id: 'd', kind: 'anchor', x: 40, y: 20, anchorType: 'sharp' },
        e: { id: 'e', kind: 'anchor', x: 0, y: 40, anchorType: 'sharp' },
        f: { id: 'f', kind: 'anchor', x: 120, y: 0, anchorType: 'sharp' },
        g: { id: 'g', kind: 'anchor', x: 200, y: 0, anchorType: 'sharp' },
        h: { id: 'h', kind: 'anchor', x: 200, y: 40, anchorType: 'sharp' },
        i: { id: 'i', kind: 'anchor', x: 160, y: 20, anchorType: 'sharp' },
        j: { id: 'j', kind: 'anchor', x: 120, y: 40, anchorType: 'sharp' }
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
        de: {
          id: 'de',
          startId: 'd',
          endId: 'e',
          outControlId: null,
          inControlId: null
        },
        ea: {
          id: 'ea',
          startId: 'e',
          endId: 'a',
          outControlId: null,
          inControlId: null
        },
        fg: {
          id: 'fg',
          startId: 'f',
          endId: 'g',
          outControlId: null,
          inControlId: null
        },
        gh: {
          id: 'gh',
          startId: 'g',
          endId: 'h',
          outControlId: null,
          inControlId: null
        },
        hi: {
          id: 'hi',
          startId: 'h',
          endId: 'i',
          outControlId: null,
          inControlId: null
        },
        ij: {
          id: 'ij',
          startId: 'i',
          endId: 'j',
          outControlId: null,
          inControlId: null
        },
        jf: {
          id: 'jf',
          startId: 'j',
          endId: 'f',
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
              pointIds: ['a', 'b', 'c', 'd', 'e'],
              segmentIds: ['ab', 'bc', 'cd', 'de', 'ea'],
              closed: true
            },
            [secondaryNetworkId]: {
              id: secondaryNetworkId,
              pointIds: ['f', 'g', 'h', 'i', 'j'],
              segmentIds: ['fg', 'gh', 'hi', 'ij', 'jf'],
              closed: true
            }
          },
          closed: true,
          width: 200,
          height: 40
        },
        { undoable: false }
      )
    })

    await page.waitForTimeout(180)
  }

const refocusSelectedElement = async (page: Page) => {
  const center = await getSelectedElementClientCenter(page)
  if (!center) {
    throw new Error('No selected element center available for refocus')
  }

  await page.mouse.click(center.x, center.y)
  await page.waitForTimeout(120)
}

const captureSelectedElementRaster = async (
  page: Page,
  padding = PADDING
): Promise<RasterCapture> => {
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

  const clip = {
    x: Math.max(
      0,
      Math.floor(
        rect.x * viewportState.zoom + viewportState.viewport.x - padding
      )
    ),
    y: Math.max(
      0,
      Math.floor(
        rect.y * viewportState.zoom + viewportState.viewport.y - padding
      )
    ),
    width: Math.max(
      1,
      Math.ceil(rect.width * viewportState.zoom + padding * 2)
    ),
    height: Math.max(
      1,
      Math.ceil(rect.height * viewportState.zoom + padding * 2)
    )
  }
  const screenshot = await page.screenshot({ clip })

  return {
    base64: screenshot.toString('base64'),
    width: clip.width,
    height: clip.height
  }
}

const getOverlayCoverage = async (
  page: Page,
  raster: RasterCapture,
  colorFamily: 'inside' | 'outside' | 'ownership'
) =>
  page.evaluate(
    async ({ base64, width, height, colorFamily: nextColorFamily }) => {
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

      let overlay = 0
      let total = 0
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const [r, g, b, a] = context.getImageData(x, y, 1, 1).data
          total += 1
          const isInside = a > 20 && g > 150 && b > 150 && r < 120
          const isOutside = a > 20 && r > 170 && g > 60 && g < 170 && b < 100
          const isOwnership =
            a > 20 &&
            ((g > 200 && r < 160) ||
              (b > 180 && g > 140) ||
              (r > 200 && g > 180))
          const matches =
            nextColorFamily === 'inside'
              ? isInside
              : nextColorFamily === 'outside'
                ? isOutside
                : isOwnership
          if (matches) {
            overlay += 1
          }
        }
      }

      return total > 0 ? overlay / total : 0
    },
    { ...raster, colorFamily }
  )

const getStrokeColorCoverage = async (
  page: Page,
  raster: RasterCapture,
  colorFamily: 'primary-red' | 'secondary-blue'
) =>
  page.evaluate(
    async ({ base64, width, height, colorFamily: nextColorFamily }) => {
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

      let overlay = 0
      let total = 0
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const [r, g, b, a] = context.getImageData(x, y, 1, 1).data
          total += 1
          const isPrimaryRed = a > 40 && r > 140 && g < 90 && b < 90
          const isSecondaryBlue = a > 40 && b > 140 && r < 90 && g < 120
          const matches =
            nextColorFamily === 'primary-red' ? isPrimaryRed : isSecondaryBlue
          if (matches) {
            overlay += 1
          }
        }
      }

      return total > 0 ? overlay / total : 0
    },
    { ...raster, colorFamily }
  )

const getDifferenceCoverage = async (
  page: Page,
  before: RasterCapture,
  after: RasterCapture
) =>
  page.evaluate(
    async ({ beforeBase64, afterBase64 }) => {
      const decode = async (base64: string) => {
        const response = await fetch(`data:image/png;base64,${base64}`)
        const blob = await response.blob()
        return createImageBitmap(blob)
      }

      const [beforeBitmap, afterBitmap] = await Promise.all([
        decode(beforeBase64),
        decode(afterBase64)
      ])

      const canvas = document.createElement('canvas')
      canvas.width = beforeBitmap.width
      canvas.height = beforeBitmap.height
      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('Canvas 2D context unavailable')
      }

      context.drawImage(beforeBitmap, 0, 0)
      const beforeData = context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      ).data
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.drawImage(afterBitmap, 0, 0)
      const afterData = context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      ).data

      let diff = 0
      for (let index = 0; index < beforeData.length; index += 4) {
        const delta =
          Math.abs(beforeData[index] - afterData[index]) +
          Math.abs(beforeData[index + 1] - afterData[index + 1]) +
          Math.abs(beforeData[index + 2] - afterData[index + 2]) +
          Math.abs(beforeData[index + 3] - afterData[index + 3])
        if (delta > 30) {
          diff += 1
        }
      }

      return diff / (canvas.width * canvas.height)
    },
    { beforeBase64: before.base64, afterBase64: after.base64 }
  )

test.describe('Constrained Solid Legality Visual', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await resetCanvas(page)
  })

  test('shows inside legality overlay for a selected rectangle with a supported constrained solid stroke', async ({
    page
  }) => {
    await ensureDebugFlag(page, true)
    await createRectangle(page, 0.3, 0.3)
    await ensureStrokeRow(page)
    await configureConstrainedStroke(page, 'inside')

    const raster = await captureSelectedElementRaster(page, 40)
    const overlayCoverage = await getOverlayCoverage(page, raster, 'inside')
    expect(overlayCoverage).toBeGreaterThan(0.01)
  })

  test('shows outside legality overlay for a selected rectangle with a supported constrained solid stroke', async ({
    page
  }) => {
    await ensureDebugFlag(page, true)
    await createRectangle(page, 0.3, 0.3)
    await ensureStrokeRow(page)
    await configureConstrainedStroke(page, 'outside')

    const enabledRaster = await captureSelectedElementRaster(page)
    await ensureDebugFlag(page, false)
    await page.waitForTimeout(120)
    const disabledRaster = await captureSelectedElementRaster(page)
    const differenceCoverage = await getDifferenceCoverage(
      page,
      disabledRaster,
      enabledRaster
    )
    expect(differenceCoverage).toBeGreaterThan(0.002)
  })

  test('hides legality overlay when the debug flag is disabled', async ({
    page
  }) => {
    await ensureDebugFlag(page, false)
    await createRectangle(page, 0.3, 0.3)
    await ensureStrokeRow(page)
    await configureConstrainedStroke(page, 'inside')

    const raster = await captureSelectedElementRaster(page)
    const insideCoverage = await getOverlayCoverage(page, raster, 'inside')
    const outsideCoverage = await getOverlayCoverage(page, raster, 'outside')
    expect(insideCoverage).toBeLessThan(0.002)
    expect(outsideCoverage).toBeLessThan(0.002)
  })

  test('shows ownership overlay for overlapping supported constrained solid strokes', async ({
    page
  }) => {
    await ensureOwnershipDebugFlag(page, true)
    await createRectangle(page, 0.3, 0.3)
    await ensureStrokeRow(page)

    const propertiesPanel = getPropertiesPanel(page)
    await propertiesPanel.getByTestId('prop-width').fill('180')
    await propertiesPanel.getByTestId('prop-width').press('Enter')
    await propertiesPanel.getByTestId('prop-height').fill('120')
    await propertiesPanel.getByTestId('prop-height').press('Enter')

    await propertiesPanel
      .getByTestId('prop-stroke-position-0')
      .selectOption('outside')
    await propertiesPanel
      .getByTestId('prop-stroke-style-0')
      .selectOption('solid')
    await propertiesPanel.getByTestId('prop-stroke-width-0').fill('12')
    await propertiesPanel.getByTestId('prop-stroke-width-0').press('Enter')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-1')).toBeVisible()
    await propertiesPanel
      .getByTestId('prop-stroke-position-1')
      .selectOption('outside')
    await propertiesPanel
      .getByTestId('prop-stroke-style-1')
      .selectOption('solid')
    await propertiesPanel.getByTestId('prop-stroke-width-1').fill('6')
    await propertiesPanel.getByTestId('prop-stroke-width-1').press('Enter')

    await page.waitForTimeout(300)

    const raster = await captureSelectedElementRaster(page)
    const ownershipCoverage = await getOverlayCoverage(
      page,
      raster,
      'ownership'
    )
    expect(ownershipCoverage).toBeGreaterThan(0.005)
  })

  test('owner-domain clipping removes exact foreign-owned outside polygons from the final render path', async ({
    page
  }) => {
    await ensureDebugFlag(page, false)
    await createRectangle(page, 0.3, 0.3)
    await ensureStrokeRow(page)

    const propertiesPanel = getPropertiesPanel(page)
    await propertiesPanel.getByTestId('prop-width').fill('180')
    await propertiesPanel.getByTestId('prop-width').press('Enter')
    await propertiesPanel.getByTestId('prop-height').fill('120')
    await propertiesPanel.getByTestId('prop-height').press('Enter')

    await propertiesPanel
      .getByTestId('prop-stroke-position-0')
      .selectOption('outside')
    await propertiesPanel
      .getByTestId('prop-stroke-style-0')
      .selectOption('solid')
    await propertiesPanel.getByTestId('prop-stroke-width-0').fill('12')
    await propertiesPanel.getByTestId('prop-stroke-width-0').press('Enter')
    await propertiesPanel.getByTestId('prop-stroke-color-0').fill('DA0000')
    await propertiesPanel.getByTestId('prop-stroke-color-0').press('Enter')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-1')).toBeVisible()
    await propertiesPanel
      .getByTestId('prop-stroke-position-1')
      .selectOption('outside')
    await propertiesPanel
      .getByTestId('prop-stroke-style-1')
      .selectOption('solid')
    await propertiesPanel.getByTestId('prop-stroke-width-1').fill('6')
    await propertiesPanel.getByTestId('prop-stroke-width-1').press('Enter')
    await propertiesPanel.getByTestId('prop-stroke-color-1').fill('0000FF')
    await propertiesPanel.getByTestId('prop-stroke-color-1').press('Enter')

    await page.waitForTimeout(300)

    const raster = await captureSelectedElementRaster(page)
    const primaryCoverage = await getStrokeColorCoverage(
      page,
      raster,
      'primary-red'
    )
    const secondaryCoverage = await getStrokeColorCoverage(
      page,
      raster,
      'secondary-blue'
    )

    expect(primaryCoverage).toBeGreaterThan(0.01)
    expect(secondaryCoverage).toBeLessThan(0.001)
  })

  test('five nested outside strokes keep the primary owner visible while the fifth stroke remains absent on the broader owner-domain path', async ({
    page
  }) => {
    await ensureOwnershipDebugFlag(page, true)
    await createRectangle(page, 0.3, 0.3)
    await ensureStrokeRow(page)

    const propertiesPanel = getPropertiesPanel(page)
    await propertiesPanel.getByTestId('prop-width').fill('180')
    await propertiesPanel.getByTestId('prop-width').press('Enter')
    await propertiesPanel.getByTestId('prop-height').fill('120')
    await propertiesPanel.getByTestId('prop-height').press('Enter')

    await configureOutsideSolidStrokeRow(page, 0, 16, 'DA0000')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-1')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 1, 12, '0044FF')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-2')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 2, 8, '00AA44')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-3')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 3, 6, 'AA00AA')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-4')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 4, 4, '00FFFF')

    await page.waitForTimeout(300)

    const raster = await captureSelectedElementRaster(page)
    const ownershipCoverage = await getOverlayCoverage(
      page,
      raster,
      'ownership'
    )
    const primaryCoverage = await getStrokeColorCoverage(
      page,
      raster,
      'primary-red'
    )
    const fifthStrokeCoverage = await page.evaluate(
      async ({ base64, width, height }) => {
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

        let overlay = 0
        let total = 0
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const [r, g, b, a] = context.getImageData(x, y, 1, 1).data
            total += 1
            const isFifthStroke = a > 40 && g > 170 && b > 170 && r < 100
            if (isFifthStroke) {
              overlay += 1
            }
          }
        }

        return total > 0 ? overlay / total : 0
      },
      raster
    )

    expect(ownershipCoverage).toBeGreaterThan(0.005)
    expect(primaryCoverage).toBeGreaterThan(0.01)
    expect(fifthStrokeCoverage).toBeLessThan(0.001)
  })

  test('five nested outside strokes keep the primary owner visible on a mixed-topology multi-network vector while the fifth stroke remains absent on the broader owner-domain path', async ({
    page
  }) => {
    await ensureOwnershipDebugFlag(page, true)
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await patchSelectedVectorToTwoClosedRectangles(page)
    await refocusSelectedElement(page)
    await ensureStrokeRow(page)

    const propertiesPanel = getPropertiesPanel(page)
    await configureOutsideSolidStrokeRow(page, 0, 16, 'DA0000')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-1')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 1, 12, '0044FF')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-2')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 2, 8, '00AA44')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-3')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 3, 6, 'AA00AA')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-4')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 4, 4, '00FFFF')

    await page.waitForTimeout(300)

    const ownershipRaster = await captureSelectedElementRaster(page, 40)
    const ownershipCoverage = await getOverlayCoverage(
      page,
      ownershipRaster,
      'ownership'
    )

    await ensureOwnershipDebugFlag(page, false)
    await page.waitForTimeout(120)

    const finalRaster = await captureSelectedElementRaster(page, 40)
    const primaryCoverage = await getStrokeColorCoverage(
      page,
      finalRaster,
      'primary-red'
    )
    const fifthStrokeCoverage = await page.evaluate(
      async ({ base64, width, height }) => {
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

        let overlay = 0
        let total = 0
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const [r, g, b, a] = context.getImageData(x, y, 1, 1).data
            total += 1
            const isFifthStroke = a > 40 && g > 170 && b > 170 && r < 100
            if (isFifthStroke) {
              overlay += 1
            }
          }
        }

        return total > 0 ? overlay / total : 0
      },
      finalRaster
    )

    expect(ownershipCoverage).toBeGreaterThan(0.002)
    expect(primaryCoverage).toBeGreaterThan(0.005)
    expect(fifthStrokeCoverage).toBeLessThan(0.001)
  })

  test('mixed-topology outside strokes keep a local miter remainder visible when a bevel owner clips the shared sub-packets on the broader subtraction path', async ({
    page
  }) => {
    await ensureOwnershipDebugFlag(page, true)
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await patchSelectedVectorToTwoClosedRectangles(page)
    await refocusSelectedElement(page)
    await ensureStrokeRow(page)

    const propertiesPanel = getPropertiesPanel(page)
    await configureOutsideSolidStrokeRow(page, 0, 12, 'DA0000', 'bevel')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-1')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 1, 12, '0044FF', 'miter')

    await page.waitForTimeout(300)

    const ownershipRaster = await captureSelectedElementRaster(page, 40)
    const ownershipCoverage = await getOverlayCoverage(
      page,
      ownershipRaster,
      'ownership'
    )

    await ensureOwnershipDebugFlag(page, false)
    await page.waitForTimeout(120)

    const finalRaster = await captureSelectedElementRaster(page, 40)
    const primaryCoverage = await getStrokeColorCoverage(
      page,
      finalRaster,
      'primary-red'
    )
    const secondaryCoverage = await getStrokeColorCoverage(
      page,
      finalRaster,
      'secondary-blue'
    )

    expect(ownershipCoverage).toBeGreaterThan(0.002)
    expect(primaryCoverage).toBeGreaterThan(0.005)
    expect(secondaryCoverage).toBeGreaterThan(0.002)
  })

  test('mixed-topology outside strokes keep a local miter remainder visible when one disconnected sub-packet contains a non-orthogonal non-convex piece on the broader subtraction path', async ({
    page
  }) => {
    await ensureOwnershipDebugFlag(page, true)
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await patchSelectedVectorToMixedTopologyWithNonOrthogonalPiece(page)
    await refocusSelectedElement(page)
    await ensureStrokeRow(page)

    const propertiesPanel = getPropertiesPanel(page)
    await configureOutsideSolidStrokeRow(page, 0, 12, 'DA0000', 'bevel')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-1')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 1, 12, '0044FF', 'miter')
    await page.waitForTimeout(300)

    const ownershipRaster = await captureSelectedElementRaster(page, 40)
    const ownershipCoverage = await getOverlayCoverage(
      page,
      ownershipRaster,
      'ownership'
    )

    await ensureOwnershipDebugFlag(page, false)
    await page.waitForTimeout(150)

    const finalRaster = await captureSelectedElementRaster(page, 40)
    const primaryCoverage = await getStrokeColorCoverage(
      page,
      finalRaster,
      'primary-red'
    )
    const secondaryCoverage = await getStrokeColorCoverage(
      page,
      finalRaster,
      'secondary-blue'
    )

    expect(ownershipCoverage).toBeGreaterThan(0.002)
    expect(primaryCoverage).toBeGreaterThan(0.005)
    expect(secondaryCoverage).toBeGreaterThan(0.002)
  })

  test('mixed-topology outside strokes keep local miter remainders visible when multiple disconnected sub-packets are non-orthogonal non-convex pieces on the broader subtraction path', async ({
    page
  }) => {
    await ensureOwnershipDebugFlag(page, true)
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await patchSelectedVectorToMixedTopologyWithMultipleNonOrthogonalPieces(
      page
    )
    await refocusSelectedElement(page)
    await ensureStrokeRow(page)

    const propertiesPanel = getPropertiesPanel(page)
    await configureOutsideSolidStrokeRow(page, 0, 12, 'DA0000', 'bevel')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-1')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 1, 12, '0044FF', 'miter')
    await page.waitForTimeout(300)

    const ownershipRaster = await captureSelectedElementRaster(page, 40)
    const ownershipCoverage = await getOverlayCoverage(
      page,
      ownershipRaster,
      'ownership'
    )

    await ensureOwnershipDebugFlag(page, false)
    await page.waitForTimeout(150)

    const finalRaster = await captureSelectedElementRaster(page, 40)
    const primaryCoverage = await getStrokeColorCoverage(
      page,
      finalRaster,
      'primary-red'
    )
    const secondaryCoverage = await getStrokeColorCoverage(
      page,
      finalRaster,
      'secondary-blue'
    )

    expect(ownershipCoverage).toBeGreaterThan(0.002)
    expect(primaryCoverage).toBeGreaterThan(0.005)
    expect(secondaryCoverage).toBeGreaterThan(0.002)
  })

  test('shape-generated and vector-generated outside strokes keep equivalent local miter remainders on the broader subtraction path', async ({
    page
  }) => {
    await ensureOwnershipDebugFlag(page, false)

    await createRectangle(page, 0.3, 0.3)
    await ensureStrokeRow(page)
    await configureOutsideSolidStrokeRow(page, 0, 12, 'DA0000', 'bevel')

    const propertiesPanel = getPropertiesPanel(page)
    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-1')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 1, 12, '0044FF', 'miter')
    await page.waitForTimeout(300)

    const rectRaster = await captureSelectedElementRaster(page, 40)
    const rectPrimaryCoverage = await getStrokeColorCoverage(
      page,
      rectRaster,
      'primary-red'
    )
    const rectSecondaryCoverage = await getStrokeColorCoverage(
      page,
      rectRaster,
      'secondary-blue'
    )

    await resetCanvas(page)
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await patchSelectedVectorToClosedRectangle(page)
    await refocusSelectedElement(page)
    await ensureStrokeRow(page)
    await configureOutsideSolidStrokeRow(page, 0, 12, 'DA0000', 'bevel')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-1')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 1, 12, '0044FF', 'miter')
    await page.waitForTimeout(300)

    const vectorRaster = await captureSelectedElementRaster(page, 40)
    const vectorPrimaryCoverage = await getStrokeColorCoverage(
      page,
      vectorRaster,
      'primary-red'
    )
    const vectorSecondaryCoverage = await getStrokeColorCoverage(
      page,
      vectorRaster,
      'secondary-blue'
    )

    expect(rectPrimaryCoverage).toBeGreaterThan(0.005)
    expect(rectSecondaryCoverage).toBeGreaterThan(0.002)
    expect(vectorPrimaryCoverage).toBeGreaterThan(0.005)
    expect(vectorSecondaryCoverage).toBeGreaterThan(0.002)
    expect(Math.abs(rectPrimaryCoverage - vectorPrimaryCoverage)).toBeLessThan(
      0.01
    )
    expect(
      Math.abs(rectSecondaryCoverage - vectorSecondaryCoverage)
    ).toBeLessThan(0.01)
  })

  test('equivalent mixed-topology vectors keep equivalent local miter remainders when one disconnected sub-packet is a non-orthogonal non-convex piece on the broader subtraction path', async ({
    page
  }) => {
    await ensureOwnershipDebugFlag(page, false)

    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await patchSelectedVectorToMixedTopologyWithNonOrthogonalPiece(page)
    await refocusSelectedElement(page)
    await ensureStrokeRow(page)

    const propertiesPanel = getPropertiesPanel(page)
    await configureOutsideSolidStrokeRow(page, 0, 12, 'DA0000', 'bevel')
    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-1')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 1, 12, '0044FF', 'miter')
    await page.waitForTimeout(300)

    const canonicalRaster = await captureSelectedElementRaster(page, 40)
    const canonicalPrimaryCoverage = await getStrokeColorCoverage(
      page,
      canonicalRaster,
      'primary-red'
    )
    const canonicalSecondaryCoverage = await getStrokeColorCoverage(
      page,
      canonicalRaster,
      'secondary-blue'
    )

    await resetCanvas(page)
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await patchSelectedVectorToEquivalentMixedTopologyWithNonOrthogonalPiece(
      page
    )
    await refocusSelectedElement(page)
    await ensureStrokeRow(page)
    await configureOutsideSolidStrokeRow(page, 0, 12, 'DA0000', 'bevel')
    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-1')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 1, 12, '0044FF', 'miter')
    await page.waitForTimeout(300)

    const equivalentRaster = await captureSelectedElementRaster(page, 40)
    const equivalentPrimaryCoverage = await getStrokeColorCoverage(
      page,
      equivalentRaster,
      'primary-red'
    )
    const equivalentSecondaryCoverage = await getStrokeColorCoverage(
      page,
      equivalentRaster,
      'secondary-blue'
    )

    expect(canonicalPrimaryCoverage).toBeGreaterThan(0.005)
    expect(canonicalSecondaryCoverage).toBeGreaterThan(0.002)
    expect(equivalentPrimaryCoverage).toBeGreaterThan(0.005)
    expect(equivalentSecondaryCoverage).toBeGreaterThan(0.002)
    expect(
      Math.abs(canonicalPrimaryCoverage - equivalentPrimaryCoverage)
    ).toBeLessThan(0.01)
    expect(
      Math.abs(canonicalSecondaryCoverage - equivalentSecondaryCoverage)
    ).toBeLessThan(0.01)
  })

  test('six nested outside strokes keep the primary owner visible on a mixed-topology multi-network vector while the sixth stroke remains absent on the broader owner-domain path', async ({
    page
  }) => {
    await ensureOwnershipDebugFlag(page, true)
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await patchSelectedVectorToTwoClosedRectangles(page)
    await refocusSelectedElement(page)
    await ensureStrokeRow(page)

    const propertiesPanel = getPropertiesPanel(page)
    await configureOutsideSolidStrokeRow(page, 0, 20, 'DA0000')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-1')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 1, 16, '0044FF')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-2')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 2, 12, '00AA44')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-3')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 3, 8, 'AA00AA')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-4')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 4, 6, '00FFFF')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-5')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 5, 4, 'FFAA00')

    await page.waitForTimeout(300)

    const ownershipRaster = await captureSelectedElementRaster(page, 40)
    const ownershipCoverage = await getOverlayCoverage(
      page,
      ownershipRaster,
      'ownership'
    )

    await ensureOwnershipDebugFlag(page, false)
    await page.waitForTimeout(120)

    const finalRaster = await captureSelectedElementRaster(page, 40)
    const primaryCoverage = await getStrokeColorCoverage(
      page,
      finalRaster,
      'primary-red'
    )
    const sixthStrokeCoverage = await page.evaluate(
      async ({ base64, width, height }) => {
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

        let overlay = 0
        let total = 0
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const [r, g, b, a] = context.getImageData(x, y, 1, 1).data
            total += 1
            const isSixthStroke =
              a > 40 && r > 180 && g > 120 && g < 210 && b < 100
            if (isSixthStroke) {
              overlay += 1
            }
          }
        }

        return total > 0 ? overlay / total : 0
      },
      finalRaster
    )

    expect(ownershipCoverage).toBeGreaterThan(0.002)
    expect(primaryCoverage).toBeGreaterThan(0.005)
    expect(sixthStrokeCoverage).toBeLessThan(0.001)
  })

  test('six nested outside strokes keep the primary owner visible while the sixth stroke remains absent on the broader owner-domain path', async ({
    page
  }) => {
    await ensureOwnershipDebugFlag(page, true)
    await createRectangle(page, 0.3, 0.3)
    await ensureStrokeRow(page)

    const propertiesPanel = getPropertiesPanel(page)
    await propertiesPanel.getByTestId('prop-width').fill('180')
    await propertiesPanel.getByTestId('prop-width').press('Enter')
    await propertiesPanel.getByTestId('prop-height').fill('120')
    await propertiesPanel.getByTestId('prop-height').press('Enter')

    await configureOutsideSolidStrokeRow(page, 0, 20, 'DA0000')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-1')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 1, 16, '0044FF')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-2')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 2, 12, '00AA44')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-3')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 3, 8, 'AA00AA')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-4')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 4, 6, '00FFFF')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-5')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 5, 4, 'FFAA00')

    await page.waitForTimeout(300)

    const raster = await captureSelectedElementRaster(page)
    const ownershipCoverage = await getOverlayCoverage(
      page,
      raster,
      'ownership'
    )
    const primaryCoverage = await getStrokeColorCoverage(
      page,
      raster,
      'primary-red'
    )
    const sixthStrokeCoverage = await page.evaluate(
      async ({ base64, width, height }) => {
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

        let overlay = 0
        let total = 0
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const [r, g, b, a] = context.getImageData(x, y, 1, 1).data
            total += 1
            const isSixthStroke =
              a > 40 && r > 180 && g > 120 && g < 210 && b < 100
            if (isSixthStroke) {
              overlay += 1
            }
          }
        }

        return total > 0 ? overlay / total : 0
      },
      raster
    )

    expect(ownershipCoverage).toBeGreaterThan(0.005)
    expect(primaryCoverage).toBeGreaterThan(0.01)
    expect(sixthStrokeCoverage).toBeLessThan(0.001)
  })

  test('seven nested outside strokes keep the primary owner visible while the seventh stroke remains absent on the broader owner-domain path', async ({
    page
  }) => {
    await ensureOwnershipDebugFlag(page, true)
    await createRectangle(page, 0.3, 0.3)
    await ensureStrokeRow(page)

    const propertiesPanel = getPropertiesPanel(page)
    await propertiesPanel.getByTestId('prop-width').fill('180')
    await propertiesPanel.getByTestId('prop-width').press('Enter')
    await propertiesPanel.getByTestId('prop-height').fill('120')
    await propertiesPanel.getByTestId('prop-height').press('Enter')

    await configureOutsideSolidStrokeRow(page, 0, 24, 'DA0000')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-1')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 1, 20, '0044FF')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-2')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 2, 16, '00AA44')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-3')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 3, 12, 'AA00AA')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-4')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 4, 8, '00FFFF')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-5')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 5, 6, 'FFAA00')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-6')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 6, 4, '8855FF')

    await page.waitForTimeout(300)

    const raster = await captureSelectedElementRaster(page)
    const ownershipCoverage = await getOverlayCoverage(
      page,
      raster,
      'ownership'
    )
    const primaryCoverage = await getStrokeColorCoverage(
      page,
      raster,
      'primary-red'
    )
    const seventhStrokeCoverage = await page.evaluate(
      async ({ base64, width, height }) => {
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

        let overlay = 0
        let total = 0
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const [r, g, b, a] = context.getImageData(x, y, 1, 1).data
            total += 1
            const isSeventhStroke =
              a > 40 && r > 90 && r < 170 && b > 170 && g < 120
            if (isSeventhStroke) {
              overlay += 1
            }
          }
        }

        return total > 0 ? overlay / total : 0
      },
      raster
    )

    expect(ownershipCoverage).toBeGreaterThan(0.005)
    expect(primaryCoverage).toBeGreaterThan(0.01)
    expect(seventhStrokeCoverage).toBeLessThan(0.001)
  })

  test('eight nested outside strokes keep the primary owner visible while the eighth stroke remains absent on the broader owner-domain path', async ({
    page
  }) => {
    await ensureOwnershipDebugFlag(page, true)
    await createRectangle(page, 0.3, 0.3)
    await ensureStrokeRow(page)

    const propertiesPanel = getPropertiesPanel(page)
    await propertiesPanel.getByTestId('prop-width').fill('180')
    await propertiesPanel.getByTestId('prop-width').press('Enter')
    await propertiesPanel.getByTestId('prop-height').fill('120')
    await propertiesPanel.getByTestId('prop-height').press('Enter')

    await configureOutsideSolidStrokeRow(page, 0, 28, 'DA0000')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-1')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 1, 24, '0044FF')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-2')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 2, 20, '00AA44')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-3')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 3, 16, 'AA00AA')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-4')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 4, 12, '00FFFF')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-5')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 5, 8, 'FFAA00')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-6')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 6, 6, '8855FF')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-7')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 7, 4, '44AA88')

    await page.waitForTimeout(300)

    const ownershipRaster = await captureSelectedElementRaster(page, 40)
    const ownershipCoverage = await getOverlayCoverage(
      page,
      ownershipRaster,
      'ownership'
    )
    await ensureOwnershipDebugFlag(page, false)
    await page.waitForTimeout(120)
    const finalRaster = await captureSelectedElementRaster(page, 40)
    const primaryCoverage = await getStrokeColorCoverage(
      page,
      finalRaster,
      'primary-red'
    )
    const eighthStrokeCoverage = await page.evaluate(
      async ({ base64, width, height }) => {
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

        let overlay = 0
        let total = 0
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const [r, g, b, a] = context.getImageData(x, y, 1, 1).data
            total += 1
            const isEighthStroke =
              a > 40 && g > 120 && g < 210 && b > 120 && b < 190 && r < 100
            if (isEighthStroke) {
              overlay += 1
            }
          }
        }

        return total > 0 ? overlay / total : 0
      },
      finalRaster
    )

    expect(ownershipCoverage).toBeGreaterThan(0.005)
    expect(primaryCoverage).toBeGreaterThan(0.01)
    expect(eighthStrokeCoverage).toBeLessThan(0.001)
  })

  test('nine nested outside strokes keep the primary owner visible while the ninth stroke remains absent on the broader owner-domain path', async ({
    page
  }) => {
    await ensureOwnershipDebugFlag(page, true)
    await createRectangle(page, 0.3, 0.3)
    await ensureStrokeRow(page)

    const propertiesPanel = getPropertiesPanel(page)
    await propertiesPanel.getByTestId('prop-width').fill('180')
    await propertiesPanel.getByTestId('prop-width').press('Enter')
    await propertiesPanel.getByTestId('prop-height').fill('120')
    await propertiesPanel.getByTestId('prop-height').press('Enter')

    await configureOutsideSolidStrokeRow(page, 0, 32, 'DA0000')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-1')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 1, 28, '0044FF')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-2')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 2, 24, '00AA44')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-3')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 3, 20, 'AA00AA')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-4')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 4, 16, '00FFFF')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-5')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 5, 12, 'FFAA00')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-6')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 6, 8, '8855FF')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-7')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 7, 6, '44AA88')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-8')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 8, 4, 'AA8844')

    await page.waitForTimeout(300)

    const ownershipRaster = await captureSelectedElementRaster(page, 56)
    const ownershipCoverage = await getOverlayCoverage(
      page,
      ownershipRaster,
      'ownership'
    )
    await ensureOwnershipDebugFlag(page, false)
    await page.waitForTimeout(120)
    const finalRaster = await captureSelectedElementRaster(page, 56)
    const primaryCoverage = await getStrokeColorCoverage(
      page,
      finalRaster,
      'primary-red'
    )
    const ninthStrokeCoverage = await page.evaluate(
      async ({ base64, width, height }) => {
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

        let overlay = 0
        let total = 0
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const [r, g, b, a] = context.getImageData(x, y, 1, 1).data
            total += 1
            const isNinthStroke =
              a > 40 && r > 120 && r < 190 && g > 90 && g < 150 && b < 100
            if (isNinthStroke) {
              overlay += 1
            }
          }
        }

        return total > 0 ? overlay / total : 0
      },
      finalRaster
    )

    expect(ownershipCoverage).toBeGreaterThan(0.005)
    expect(primaryCoverage).toBeGreaterThan(0.01)
    expect(ninthStrokeCoverage).toBeLessThan(0.001)
  })

  test('ten nested outside strokes keep the primary owner visible while the tenth stroke remains absent under the subset-budget broader owner-domain gate', async ({
    page
  }) => {
    await ensureOwnershipDebugFlag(page, true)
    await createRectangle(page, 0.3, 0.3)
    await ensureStrokeRow(page)

    const propertiesPanel = getPropertiesPanel(page)
    await propertiesPanel.getByTestId('prop-width').fill('180')
    await propertiesPanel.getByTestId('prop-width').press('Enter')
    await propertiesPanel.getByTestId('prop-height').fill('120')
    await propertiesPanel.getByTestId('prop-height').press('Enter')

    await configureOutsideSolidStrokeRow(page, 0, 36, 'DA0000')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-1')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 1, 32, '0044FF')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-2')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 2, 28, '00AA44')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-3')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 3, 24, 'AA00AA')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-4')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 4, 20, '00FFFF')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-5')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 5, 16, 'FFAA00')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-6')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 6, 12, '8855FF')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-7')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 7, 8, '44AA88')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-8')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 8, 6, 'AA8844')

    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(propertiesPanel.getByTestId('prop-stroke-9')).toBeVisible()
    await configureOutsideSolidStrokeRow(page, 9, 4, 'CC6677')

    await page.waitForTimeout(300)

    const ownershipRaster = await captureSelectedElementRaster(page, 60)
    const ownershipCoverage = await getOverlayCoverage(
      page,
      ownershipRaster,
      'ownership'
    )
    await ensureOwnershipDebugFlag(page, false)
    await page.waitForTimeout(120)
    const finalRaster = await captureSelectedElementRaster(page, 60)
    const primaryCoverage = await getStrokeColorCoverage(
      page,
      finalRaster,
      'primary-red'
    )
    const tenthStrokeCoverage = await page.evaluate(
      async ({ base64, width, height }) => {
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

        let overlay = 0
        let total = 0
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const [r, g, b, a] = context.getImageData(x, y, 1, 1).data
            total += 1
            const isTenthStroke =
              a > 40 &&
              r > 150 &&
              r < 240 &&
              g > 70 &&
              g < 150 &&
              b > 90 &&
              b < 150
            if (isTenthStroke) {
              overlay += 1
            }
          }
        }

        return total > 0 ? overlay / total : 0
      },
      finalRaster
    )

    expect(ownershipCoverage).toBeGreaterThan(0.005)
    expect(primaryCoverage).toBeGreaterThan(0.01)
    expect(tenthStrokeCoverage).toBeLessThan(0.001)
  })
})
