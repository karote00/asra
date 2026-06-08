import { expect, test, type Page } from '@playwright/test'
import { resetCanvas, waitForAppReady } from './test-utils'

interface ScreenPoint {
  x: number
  y: number
}

const createClosedVectorWithCustomFirstPointControls = () => ({
  points: {
    first: {
      id: 'first',
      kind: 'anchor',
      anchorType: 'smooth',
      x: 320,
      y: 120
    },
    middle: {
      id: 'middle',
      kind: 'anchor',
      anchorType: 'sharp',
      x: 520,
      y: 360
    },
    last: {
      id: 'last',
      kind: 'anchor',
      anchorType: 'sharp',
      x: 180,
      y: 380
    },
    'custom-first-out': {
      id: 'custom-first-out',
      kind: 'control',
      controlForId: 'first',
      controlRole: 'out',
      x: 390,
      y: 190
    },
    'custom-first-in': {
      id: 'custom-first-in',
      kind: 'control',
      controlForId: 'first',
      controlRole: 'in',
      x: 260,
      y: 190
    },
    'custom-middle-in': {
      id: 'custom-middle-in',
      kind: 'control',
      controlForId: 'middle',
      controlRole: 'in',
      x: 470,
      y: 300
    },
    'custom-last-out': {
      id: 'custom-last-out',
      kind: 'control',
      controlForId: 'last',
      controlRole: 'out',
      x: 220,
      y: 320
    }
  },
  segments: {
    s0: {
      id: 's0',
      startId: 'first',
      endId: 'middle',
      outControlId: 'custom-first-out',
      inControlId: 'custom-middle-in'
    },
    s1: {
      id: 's1',
      startId: 'middle',
      endId: 'last',
      outControlId: null,
      inControlId: null
    },
    s2: {
      id: 's2',
      startId: 'last',
      endId: 'first',
      outControlId: 'custom-last-out',
      inControlId: 'custom-first-in'
    }
  },
  networks: {
    n0: {
      id: 'n0',
      pointIds: ['first', 'middle', 'last'],
      segmentIds: ['s0', 's1', 's2'],
      closed: true
    }
  }
})

const createClosedVectorWithFiveAnchorsAndControls = () => {
  const anchors = [
    { id: 'p0', x: 320, y: 120 },
    { id: 'p1', x: 520, y: 210 },
    { id: 'p2', x: 470, y: 430 },
    { id: 'p3', x: 210, y: 430 },
    { id: 'p4', x: 150, y: 210 }
  ]
  const points: Record<string, Record<string, unknown>> = {}
  anchors.forEach((anchor, index) => {
    points[anchor.id] = {
      id: anchor.id,
      kind: 'anchor',
      anchorType: 'smooth',
      x: anchor.x,
      y: anchor.y
    }
    points[`custom-${anchor.id}-in`] = {
      id: `custom-${anchor.id}-in`,
      kind: 'control',
      controlForId: anchor.id,
      controlRole: 'in',
      x: anchor.x - 32,
      y: anchor.y - 32 + index * 4
    }
    points[`custom-${anchor.id}-out`] = {
      id: `custom-${anchor.id}-out`,
      kind: 'control',
      controlForId: anchor.id,
      controlRole: 'out',
      x: anchor.x + 34,
      y: anchor.y + 28 - index * 4
    }
  })

  const segments: Record<string, Record<string, unknown>> = {}
  anchors.forEach((anchor, index) => {
    const nextAnchor = anchors[(index + 1) % anchors.length]
    segments[`s${index}`] = {
      id: `s${index}`,
      startId: anchor.id,
      endId: nextAnchor.id,
      outControlId: `custom-${anchor.id}-out`,
      inControlId: `custom-${nextAnchor.id}-in`
    }
  })

  return {
    anchors,
    points,
    segments,
    networks: {
      n0: {
        id: 'n0',
        pointIds: anchors.map((anchor) => anchor.id),
        segmentIds: anchors.map((_, index) => `s${index}`),
        closed: true
      }
    }
  }
}

const createClosedStraightVector = () => {
  const anchors = [
    { id: 'p0', x: 320, y: 120 },
    { id: 'p1', x: 520, y: 260 },
    { id: 'p2', x: 320, y: 420 },
    { id: 'p3', x: 130, y: 260 }
  ]
  const points = Object.fromEntries(
    anchors.map((anchor) => [
      anchor.id,
      {
        id: anchor.id,
        kind: 'anchor',
        anchorType: 'sharp',
        x: anchor.x,
        y: anchor.y
      }
    ])
  )
  const segments = Object.fromEntries(
    anchors.map((anchor, index) => {
      const nextAnchor = anchors[(index + 1) % anchors.length]
      return [
        `s${index}`,
        {
          id: `s${index}`,
          startId: anchor.id,
          endId: nextAnchor.id,
          outControlId: null,
          inControlId: null
        }
      ]
    })
  )

  return {
    anchors,
    points,
    segments,
    networks: {
      n0: {
        id: 'n0',
        pointIds: anchors.map((anchor) => anchor.id),
        segmentIds: anchors.map((_, index) => `s${index}`),
        closed: true
      }
    }
  }
}

const getSyntheticHandle = (
  anchor: ScreenPoint,
  neighbor: ScreenPoint
): ScreenPoint => {
  const dx = neighbor.x - anchor.x
  const dy = neighbor.y - anchor.y
  const segmentLength = Math.hypot(dx, dy)
  const handleLength = Math.min(56, segmentLength * 0.45, segmentLength / 3)
  const scale = handleLength / segmentLength
  return {
    x: anchor.x + dx * scale,
    y: anchor.y + dy * scale
  }
}

const countWhiteHandlePixelsNear = async (
  page: Page,
  screenshot: Buffer,
  point: ScreenPoint
) =>
  page.evaluate(
    async ({ base64, point: targetPoint }) => {
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
      let whitePixelCount = 0
      const radius = 10
      for (let y = -radius; y <= radius; y += 1) {
        for (let x = -radius; x <= radius; x += 1) {
          const ix = Math.round(targetPoint.x + x)
          const iy = Math.round(targetPoint.y + y)
          if (ix < 0 || iy < 0 || ix >= canvas.width || iy >= canvas.height) {
            continue
          }
          const index = (iy * canvas.width + ix) * 4
          const red = image[index] ?? 0
          const green = image[index + 1] ?? 0
          const blue = image[index + 2] ?? 0
          const alpha = image[index + 3] ?? 0
          if (alpha > 180 && red > 210 && green > 210 && blue > 210) {
            whitePixelCount += 1
          }
        }
      }
      return whitePixelCount
    },
    {
      base64: screenshot.toString('base64'),
      point
    }
  )

test.describe('Vector path editing controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await resetCanvas(page)
  })

  test('shows both in and out controls for the selected first point in a closed subpath', async ({
    page
  }, testInfo) => {
    const state = await page.evaluate((topology) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elementApis = (window as any).__AsyraE2E__?.elementApis
      if (!core || !elementApis) {
        throw new Error('Missing E2E core or element APIs')
      }

      const createdId = elementApis.createElement(
        {
          type: 'vector',
          points: topology.points,
          segments: topology.segments,
          networks: topology.networks,
          closed: true,
          pointCoordinateSpace: 'workspace'
        },
        { undoable: false }
      )
      if (!createdId) {
        throw new Error('Failed to create custom-control vector')
      }

      core.selectElements?.([createdId], { undoable: false })
      core.setSystemProperty?.('pathEditingVectorId', createdId)
      core.setSystemProperty?.('pathEditingMode', true)
      core.setSystemProperty?.('selectedVectorPoint', {
        elementId: createdId,
        pointId: 'first',
        index: 0,
        target: 'anchor',
        x: topology.points.first.x,
        y: topology.points.first.y
      })
      core.setSystemProperty?.('zoom', 1.2)
      core.setSystemProperty?.('viewportPosition', { x: 240, y: 120 })

      const zoom = core.getSystemProperty?.('zoom') ?? 1
      const viewport = core.getSystemProperty?.('viewportPosition') ?? {
        x: 0,
        y: 0
      }
      const toScreen = (point: ScreenPoint) => ({
        x: point.x * zoom + viewport.x,
        y: point.y * zoom + viewport.y
      })

      return {
        createdId,
        selectedVectorPoint: core.getSystemProperty?.('selectedVectorPoint'),
        firstInScreen: toScreen(topology.points['custom-first-in']),
        firstOutScreen: toScreen(topology.points['custom-first-out'])
      }
    }, createClosedVectorWithCustomFirstPointControls())

    await page.waitForTimeout(300)
    const screenshot = await page.screenshot()
    await testInfo.attach('closed-first-point-custom-controls', {
      body: screenshot,
      contentType: 'image/png'
    })

    const inHandleWhitePixels = await countWhiteHandlePixelsNear(
      page,
      screenshot,
      state.firstInScreen
    )
    const outHandleWhitePixels = await countWhiteHandlePixelsNear(
      page,
      screenshot,
      state.firstOutScreen
    )

    expect(state.selectedVectorPoint).toMatchObject({
      elementId: state.createdId,
      pointId: 'first',
      target: 'anchor'
    })
    expect(inHandleWhitePixels).toBeGreaterThan(6)
    expect(outHandleWhitePixels).toBeGreaterThan(6)
  })

  test('shows curve controls from the final selected-neighbor anchor list', async ({
    page
  }, testInfo) => {
    const topology = createClosedVectorWithFiveAnchorsAndControls()
    const state = await page.evaluate((inputTopology) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elementApis = (window as any).__AsyraE2E__?.elementApis
      if (!core || !elementApis) {
        throw new Error('Missing E2E core or element APIs')
      }

      const createdId = elementApis.createElement(
        {
          type: 'vector',
          points: inputTopology.points,
          segments: inputTopology.segments,
          networks: inputTopology.networks,
          closed: true,
          pointCoordinateSpace: 'workspace'
        },
        { undoable: false }
      )
      if (!createdId) {
        throw new Error('Failed to create custom-control vector')
      }

      core.selectElements?.([createdId], { undoable: false })
      core.setSystemProperty?.('pathEditingVectorId', createdId)
      core.setSystemProperty?.('pathEditingMode', true)
      core.setSystemProperty?.('zoom', 1)
      core.setSystemProperty?.('viewportPosition', { x: 160, y: 80 })

      const viewport = core.getSystemProperty?.('viewportPosition') ?? {
        x: 0,
        y: 0
      }
      const toScreen = (point: ScreenPoint) => ({
        x: point.x + viewport.x,
        y: point.y + viewport.y
      })
      const handleScreens = Object.fromEntries(
        inputTopology.anchors.flatMap((anchor) => {
          const inPoint = inputTopology.points[
            `custom-${anchor.id}-in`
          ] as unknown as ScreenPoint
          const outPoint = inputTopology.points[
            `custom-${anchor.id}-out`
          ] as unknown as ScreenPoint
          return [
            [`${anchor.id}:in`, toScreen(inPoint)],
            [`${anchor.id}:out`, toScreen(outPoint)]
          ]
        })
      ) as Record<string, ScreenPoint>

      return {
        createdId,
        handleScreens
      }
    }, topology)

    const selectAnchors = async (selectedIndexes: number[]) => {
      await page.evaluate(
        ({ createdId, selectedIndexes: indexes, anchors }) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const core = (window as any).__Core__
          const selectedIds = indexes.map(
            (index) => `${createdId}:${anchors[index].id}:anchor`
          )
          core.selectVectorPoints?.(selectedIds, { undoable: false })
          const primaryIndex = indexes[0]
          const primaryAnchor = anchors[primaryIndex]
          core.setSystemProperty?.('selectedVectorPoint', {
            elementId: createdId,
            pointId: primaryAnchor.id,
            index: primaryIndex,
            target: 'anchor',
            x: primaryAnchor.x,
            y: primaryAnchor.y
          })
        },
        {
          createdId: state.createdId,
          selectedIndexes,
          anchors: topology.anchors
        }
      )
      await page.waitForTimeout(120)
    }

    const expectVisibleAnchors = async (
      label: string,
      visibleAnchorIds: string[]
    ) => {
      const screenshot = await page.screenshot()
      await testInfo.attach(label, {
        body: screenshot,
        contentType: 'image/png'
      })

      const visible = new Set(visibleAnchorIds)
      for (const anchor of topology.anchors) {
        for (const side of ['in', 'out'] as const) {
          const pixelCount = await countWhiteHandlePixelsNear(
            page,
            screenshot,
            state.handleScreens[`${anchor.id}:${side}`] as ScreenPoint
          )
          if (visible.has(anchor.id)) {
            expect(pixelCount, `${label}:${anchor.id}:${side}`).toBeGreaterThan(
              6
            )
          } else {
            expect(pixelCount, `${label}:${anchor.id}:${side}`).toBeLessThan(4)
          }
        }
      }
    }

    await selectAnchors([0])
    await expectVisibleAnchors('selected-index-0-controls', ['p4', 'p0', 'p1'])

    await selectAnchors([2])
    await expectVisibleAnchors('selected-index-2-controls', ['p1', 'p2', 'p3'])

    await selectAnchors([0, 2])
    await expectVisibleAnchors('multi-selected-controls', [
      'p4',
      'p0',
      'p1',
      'p2',
      'p3'
    ])
  })

  test('shows display handles for selected straight-segment anchors', async ({
    page
  }, testInfo) => {
    const topology = createClosedStraightVector()
    const state = await page.evaluate((inputTopology) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elementApis = (window as any).__AsyraE2E__?.elementApis
      if (!core || !elementApis) {
        throw new Error('Missing E2E core or element APIs')
      }

      const createdId = elementApis.createElement(
        {
          type: 'vector',
          points: inputTopology.points,
          segments: inputTopology.segments,
          networks: inputTopology.networks,
          closed: true,
          pointCoordinateSpace: 'workspace'
        },
        { undoable: false }
      )
      if (!createdId) {
        throw new Error('Failed to create straight vector')
      }

      core.selectElements?.([createdId], { undoable: false })
      core.setSystemProperty?.('pathEditingVectorId', createdId)
      core.setSystemProperty?.('pathEditingMode', true)
      core.setSystemProperty?.('zoom', 1)
      core.setSystemProperty?.('viewportPosition', { x: 160, y: 80 })
      core.selectVectorPoints?.([`${createdId}:p0:anchor`], {
        undoable: false
      })
      core.setSystemProperty?.('selectedVectorPoint', {
        elementId: createdId,
        pointId: 'p0',
        index: 0,
        target: 'anchor',
        x: inputTopology.anchors[0].x,
        y: inputTopology.anchors[0].y
      })

      const viewport = core.getSystemProperty?.('viewportPosition') ?? {
        x: 0,
        y: 0
      }
      const toScreen = (point: ScreenPoint) => ({
        x: point.x + viewport.x,
        y: point.y + viewport.y
      })

      return {
        createdId,
        screenAnchors: Object.fromEntries(
          inputTopology.anchors.map((anchor) => [anchor.id, toScreen(anchor)])
        ) as Record<string, ScreenPoint>
      }
    }, topology)

    await page.waitForTimeout(200)
    const screenshot = await page.screenshot()
    await testInfo.attach('straight-segment-display-handles', {
      body: screenshot,
      contentType: 'image/png'
    })

    const expectedHandles = {
      'p0:in': getSyntheticHandle(state.screenAnchors.p0, state.screenAnchors.p3),
      'p0:out': getSyntheticHandle(
        state.screenAnchors.p0,
        state.screenAnchors.p1
      ),
      'p1:in': getSyntheticHandle(state.screenAnchors.p1, state.screenAnchors.p0),
      'p1:out': getSyntheticHandle(
        state.screenAnchors.p1,
        state.screenAnchors.p2
      ),
      'p3:in': getSyntheticHandle(state.screenAnchors.p3, state.screenAnchors.p2),
      'p3:out': getSyntheticHandle(state.screenAnchors.p3, state.screenAnchors.p0)
    }

    for (const [label, point] of Object.entries(expectedHandles)) {
      const pixelCount = await countWhiteHandlePixelsNear(
        page,
        screenshot,
        point
      )
      expect(pixelCount, label).toBeGreaterThan(6)
    }
  })
})
