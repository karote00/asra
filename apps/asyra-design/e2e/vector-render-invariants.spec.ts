import { expect, test, type Page } from '@playwright/test'
import { resetCanvas, waitForAppReady } from './test-utils'

interface BrowserTestInfo {
  browserErrors?: string[]
}

interface StrokeRasterCapture {
  base64: string
  clipX: number
  clipY: number
  width: number
  height: number
  zoom: number
  viewport: { x: number; y: number }
  rect: { id: string; x: number; y: number; width: number; height: number }
}

const createStarTopology = () => {
  const center = { x: 420, y: 300 }
  const outerRadius = 110
  const innerRadius = 44
  const orderedPointIds = Array.from({ length: 10 }, (_, index) => `p${index}`)
  const points = Object.fromEntries(
    orderedPointIds.map((id, index) => {
      const angle =
        -Math.PI / 2 + (Math.PI * 2 * index) / orderedPointIds.length
      const radius = index % 2 === 0 ? outerRadius : innerRadius
      return [
        id,
        {
          id,
          kind: 'anchor',
          anchorType: 'sharp',
          x: center.x + Math.cos(angle) * radius,
          y: center.y + Math.sin(angle) * radius
        }
      ]
    })
  )
  const segments = Object.fromEntries(
    orderedPointIds.map((pointId, index) => {
      const nextPointId = orderedPointIds[(index + 1) % orderedPointIds.length]
      return [
        `s${index}`,
        {
          id: `s${index}`,
          startId: pointId,
          endId: nextPointId,
          outControlId: null,
          inControlId: null
        }
      ]
    })
  )
  const networks = {
    n0: {
      id: 'n0',
      pointIds: orderedPointIds,
      segmentIds: orderedPointIds.map((_, index) => `s${index}`),
      closed: true
    }
  }

  return { points, segments, networks }
}

const createPentagramTopology = () => {
  const center = { x: 420, y: 310 }
  const radius = 170
  const basePoints = Array.from({ length: 5 }, (_, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / 5
    return {
      id: `a${index}`,
      kind: 'anchor',
      anchorType: 'sharp',
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius
    }
  })
  const order = [0, 2, 4, 1, 3]
  const pointIds = order.map((index) => basePoints[index].id)
  const points = Object.fromEntries(
    basePoints.map((point) => [point.id, point])
  )
  const segments = Object.fromEntries(
    pointIds.map((pointId, index) => {
      const nextPointId = pointIds[(index + 1) % pointIds.length]
      return [
        `ps${index}`,
        {
          id: `ps${index}`,
          startId: pointId,
          endId: nextPointId,
          outControlId: null,
          inControlId: null
        }
      ]
    })
  )
  const networks = {
    pn0: {
      id: 'pn0',
      pointIds,
      segmentIds: pointIds.map((_, index) => `ps${index}`),
      closed: true
    }
  }

  return { points, segments, networks }
}

const getStarWorkspacePoints = () =>
  Object.values(createStarTopology().points) as { x: number; y: number }[]

const createLegacyLocalStarData = () => {
  const topology = createStarTopology()
  const points = Object.values(topology.points) as {
    id: string
    kind: string
    anchorType: string
    x: number
    y: number
  }[]
  const bounds = points.reduce(
    (current, point) => ({
      minX: Math.min(current.minX, point.x),
      minY: Math.min(current.minY, point.y),
      maxX: Math.max(current.maxX, point.x),
      maxY: Math.max(current.maxY, point.y)
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY
    }
  )

  return {
    x: bounds.minX,
    y: bounds.minY,
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
    points: Object.fromEntries(
      Object.entries(topology.points).map(([pointId, point]) => [
        pointId,
        {
          ...point,
          x: point.x - bounds.minX,
          y: point.y - bounds.minY
        }
      ])
    ),
    segments: topology.segments,
    networks: topology.networks
  }
}

const workspaceToClient = async (page: Page, point: { x: number; y: number }) =>
  page.evaluate((workspacePoint) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const zoom = core?.getSystemProperty?.('zoom') ?? 1
    const viewport = core?.getSystemProperty?.('viewportPosition') ?? {
      x: 0,
      y: 0
    }

    return {
      x: workspacePoint.x * zoom + viewport.x,
      y: workspacePoint.y * zoom + viewport.y
    }
  }, point)

const setSelectedVectorRedStroke = async (page: Page) => {
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const elementApis = (window as any).__AsyraE2E__?.elementApis
    const selectedId =
      core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
    if (!selectedId || !elementApis) {
      throw new Error('Missing selected vector for stroke styling')
    }

    elementApis.changeComputedData(
      [selectedId],
      {
        strokes: [
          {
            id: 'vector-invariant-stroke',
            kind: 'solid',
            style: 'solid',
            position: 'center',
            width: 12,
            dashPattern: [],
            dashOffset: 0,
            fill: null,
            defaultColorFormat: 'hex',
            colorFormat: 'hex',
            color: '#df0606',
            opacity: 0.75,
            visible: true,
            gradient: null,
            joinType: 'miter',
            capType: 'butt',
            miterAngle: 28.96
          }
        ]
      },
      { undoable: false }
    )
  })
}

const captureSelectedElementRaster = async (
  page: Page,
  padding = 48
): Promise<StrokeRasterCapture> => {
  const rect = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId =
      core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
    if (!selectedId) {
      return null
    }
    const computed = core?.deps?.sceneTree
      ?.getElementById?.(selectedId)
      ?.getAllComputedData?.()
    if (
      typeof computed?.x !== 'number' ||
      typeof computed?.y !== 'number' ||
      typeof computed?.width !== 'number' ||
      typeof computed?.height !== 'number'
    ) {
      return null
    }
    return {
      id: selectedId,
      x: computed.x,
      y: computed.y,
      width: computed.width,
      height: computed.height
    }
  })
  if (!rect) {
    throw new Error('No selected element rect available')
  }

  const viewportState = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    return {
      zoom: core?.getSystemProperty?.('zoom') ?? 1,
      viewport: core?.getSystemProperty?.('viewportPosition') ?? { x: 0, y: 0 }
    }
  })
  const viewportSize = page.viewportSize() ?? { width: 1280, height: 900 }
  const clipX = Math.max(
    0,
    Math.floor(rect.x * viewportState.zoom + viewportState.viewport.x - padding)
  )
  const clipY = Math.max(
    0,
    Math.floor(rect.y * viewportState.zoom + viewportState.viewport.y - padding)
  )
  const width = Math.max(
    1,
    Math.min(
      viewportSize.width - clipX,
      Math.ceil(rect.width * viewportState.zoom + padding * 2)
    )
  )
  const height = Math.max(
    1,
    Math.min(
      viewportSize.height - clipY,
      Math.ceil(rect.height * viewportState.zoom + padding * 2)
    )
  )
  const screenshot = await page.screenshot({
    clip: {
      x: clipX,
      y: clipY,
      width,
      height
    }
  })

  return {
    base64: screenshot.toString('base64'),
    clipX,
    clipY,
    width,
    height,
    zoom: viewportState.zoom,
    viewport: viewportState.viewport,
    rect
  }
}

const analyzeRedStrokeRaster = async (page: Page, screenshotBase64: string) =>
  page.evaluate(async (base64) => {
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
    let strokePixels = 0
    let visualSignal = 0
    const totalPixels = canvas.width * canvas.height

    for (let index = 0; index < image.length; index += 4) {
      const red = image[index] ?? 0
      const green = image[index + 1] ?? 0
      const blue = image[index + 2] ?? 0
      const alpha = image[index + 3] ?? 0
      const isRedStrokePixel =
        alpha > 128 && red > 90 && red > green + 45 && red > blue + 45
      if (isRedStrokePixel) {
        strokePixels += 1
        visualSignal += red
      }
    }

    return {
      strokeCoverage: strokePixels / totalPixels,
      visualSignal: visualSignal / totalPixels
    }
  }, screenshotBase64)

const analyzeBlueHoverOutlineRaster = async (
  page: Page,
  screenshotBase64: string
) =>
  page.evaluate(async (base64) => {
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
    let bluePixels = 0
    const bounds = {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY
    }

    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const index = (y * canvas.width + x) * 4
        const red = image[index] ?? 0
        const green = image[index + 1] ?? 0
        const blue = image[index + 2] ?? 0
        const alpha = image[index + 3] ?? 0
        const isHoverBlue = alpha > 128 && blue > 150 && green > 70 && red < 80
        if (!isHoverBlue) {
          continue
        }

        bluePixels += 1
        bounds.minX = Math.min(bounds.minX, x)
        bounds.minY = Math.min(bounds.minY, y)
        bounds.maxX = Math.max(bounds.maxX, x)
        bounds.maxY = Math.max(bounds.maxY, y)
      }
    }

    return {
      bluePixels,
      bounds:
        bluePixels > 0
          ? {
              x: bounds.minX,
              y: bounds.minY,
              width: bounds.maxX - bounds.minX,
              height: bounds.maxY - bounds.minY
            }
          : null
    }
  }, screenshotBase64)

const captureSelectedVectorFullRaster = async (page: Page, padding = 56) => {
  const target = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId =
      core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
    const computed = selectedId
      ? core?.deps?.sceneTree
          ?.getElementById?.(selectedId)
          ?.getAllComputedData?.()
      : null
    const points = computed?.points ?? {}
    const segments = computed?.segments ?? {}
    const networks = computed?.networks ?? {}
    const primaryNetwork = Object.values(networks)[0] as
      | { segmentIds?: string[] }
      | undefined
    if (!selectedId || !computed || !primaryNetwork?.segmentIds?.length) {
      return null
    }
    const anchorPoints = Object.values(points).filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (point: any) => point?.kind === 'anchor'
    ) as { x: number; y: number }[]
    const bounds = anchorPoints.reduce(
      (current, point) => ({
        minX: Math.min(current.minX, point.x),
        minY: Math.min(current.minY, point.y),
        maxX: Math.max(current.maxX, point.x),
        maxY: Math.max(current.maxY, point.y)
      }),
      {
        minX: Number.POSITIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY
      }
    )

    return {
      id: selectedId,
      x: bounds.minX,
      y: bounds.minY,
      width: bounds.maxX - bounds.minX,
      height: bounds.maxY - bounds.minY,
      pointCoordinateSpace: computed.pointCoordinateSpace,
      segments: primaryNetwork.segmentIds.map((segmentId) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const segment = (segments as any)[segmentId]
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const start = segment ? (points as any)[segment.startId] : null
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const end = segment ? (points as any)[segment.endId] : null
        return {
          id: segmentId,
          start: start ? { x: start.x, y: start.y } : null,
          end: end ? { x: end.x, y: end.y } : null
        }
      })
    }
  })
  if (!target) {
    throw new Error('No selected vector raster target available')
  }

  const viewportState = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    return {
      zoom: core?.getSystemProperty?.('zoom') ?? 1,
      viewport: core?.getSystemProperty?.('viewportPosition') ?? { x: 0, y: 0 }
    }
  })
  const viewportSize = page.viewportSize() ?? { width: 1280, height: 900 }
  const clipX = Math.max(
    0,
    Math.floor(
      target.x * viewportState.zoom + viewportState.viewport.x - padding
    )
  )
  const clipY = Math.max(
    0,
    Math.floor(
      target.y * viewportState.zoom + viewportState.viewport.y - padding
    )
  )
  const width = Math.max(
    1,
    Math.min(
      viewportSize.width - clipX,
      Math.ceil(target.width * viewportState.zoom + padding * 2)
    )
  )
  const height = Math.max(
    1,
    Math.min(
      viewportSize.height - clipY,
      Math.ceil(target.height * viewportState.zoom + padding * 2)
    )
  )
  const screenshot = await page.screenshot({
    clip: {
      x: clipX,
      y: clipY,
      width,
      height
    }
  })

  return {
    base64: screenshot.toString('base64'),
    clipX,
    clipY,
    width,
    height,
    zoom: viewportState.zoom,
    viewport: viewportState.viewport,
    target
  }
}

const analyzePentagramDashSegmentCoverage = async (
  page: Page,
  raster: Awaited<ReturnType<typeof captureSelectedVectorFullRaster>>
) =>
  page.evaluate(async ({ base64, target, clipX, clipY, zoom, viewport }) => {
    const dashLength = 22
    const gapLength = 14
    const strokeWidth = 16
    const sampleStep = 2
    const transitionMargin = 3
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
    const isRedPixel = (x: number, y: number) => {
      const ix = Math.round(x)
      const iy = Math.round(y)
      if (ix < 0 || iy < 0 || ix >= canvas.width || iy >= canvas.height) {
        return false
      }
      const index = (iy * canvas.width + ix) * 4
      const red = image[index] ?? 0
      const green = image[index + 1] ?? 0
      const blue = image[index + 2] ?? 0
      const alpha = image[index + 3] ?? 0
      return alpha > 128 && red > 90 && red > green + 45 && red > blue + 45
    }
    const toImagePoint = (point: { x: number; y: number }) => ({
      x: point.x * zoom + viewport.x - clipX,
      y: point.y * zoom + viewport.y - clipY
    })
    let totalRedPixels = 0
    for (let index = 0; index < image.length; index += 4) {
      const red = image[index] ?? 0
      const green = image[index + 1] ?? 0
      const blue = image[index + 2] ?? 0
      const alpha = image[index + 3] ?? 0
      if (alpha > 128 && red > 90 && red > green + 45 && red > blue + 45) {
        totalRedPixels += 1
      }
    }

    let pathCursor = 0
    const segmentCoverages = target.segments.map((segment) => {
      if (!segment.start || !segment.end) {
        return {
          id: segment.id,
          coveredSamples: 0,
          expectedDashSamples: 0,
          sampleCount: 0,
          recall: 1
        }
      }
      const workspaceDx = segment.end.x - segment.start.x
      const workspaceDy = segment.end.y - segment.start.y
      const workspaceLength = Math.hypot(workspaceDx, workspaceDy)
      const start = toImagePoint(segment.start)
      const end = toImagePoint(segment.end)
      const imageDx = end.x - start.x
      const imageDy = end.y - start.y
      const imageLength = Math.hypot(imageDx, imageDy)
      const normal =
        imageLength > 0
          ? { x: -imageDy / imageLength, y: imageDx / imageLength }
          : { x: 0, y: 0 }
      let coveredSamples = 0
      let expectedDashSamples = 0
      let sampleCount = 0
      for (
        let distance = 0;
        distance <= workspaceLength;
        distance += sampleStep
      ) {
        const pathDistance = pathCursor + distance
        const phase = pathDistance % (dashLength + gapLength)
        const distanceToDashStart = Math.min(
          phase,
          dashLength + gapLength - phase
        )
        const distanceToDashEnd = Math.abs(phase - dashLength)
        const distanceToSegmentBoundary = Math.min(
          distance,
          workspaceLength - distance
        )
        if (
          phase >= dashLength ||
          distanceToDashStart <= transitionMargin ||
          distanceToDashEnd <= transitionMargin ||
          distanceToSegmentBoundary <= transitionMargin
        ) {
          continue
        }
        const t = workspaceLength <= 0 ? 0 : distance / workspaceLength
        const base = {
          x: start.x + imageDx * t,
          y: start.y + imageDy * t
        }
        let covered = false
        for (let offset = -strokeWidth; offset <= strokeWidth; offset += 2) {
          if (
            isRedPixel(base.x + normal.x * offset, base.y + normal.y * offset)
          ) {
            covered = true
            break
          }
        }
        sampleCount += 1
        expectedDashSamples += 1
        if (covered) {
          coveredSamples += 1
        }
      }
      pathCursor += workspaceLength
      return {
        id: segment.id,
        coveredSamples,
        expectedDashSamples,
        sampleCount,
        recall:
          expectedDashSamples === 0 ? 1 : coveredSamples / expectedDashSamples
      }
    })

    const worstSegmentRecall = Math.min(
      ...segmentCoverages.map((segment) => segment.recall)
    )
    const totalExpectedDashSamples = segmentCoverages.reduce(
      (sum, segment) => sum + segment.expectedDashSamples,
      0
    )
    const totalCoveredDashSamples = segmentCoverages.reduce(
      (sum, segment) => sum + segment.coveredSamples,
      0
    )

    return {
      totalRedPixels,
      totalExpectedDashSamples,
      totalCoveredDashSamples,
      insideDashRecall:
        totalExpectedDashSamples === 0
          ? 1
          : totalCoveredDashSamples / totalExpectedDashSamples,
      worstSegmentRecall,
      segmentCoverages,
      coveredSegmentCount: segmentCoverages.filter(
        (segment) => segment.coveredSamples > 0
      ).length
    }
  }, raster)

const captureHoveredVectorOutlineRaster = async (page: Page, padding = 72) => {
  const target = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const hoveredId = core?.getSystemProperty?.('hoveredElementId') ?? null
    const computed = hoveredId
      ? core?.deps?.sceneTree
          ?.getElementById?.(hoveredId)
          ?.getAllComputedData?.()
      : null
    const points = computed?.points ?? {}
    const anchorPoints = Object.values(points).filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (point: any) => point?.kind === 'anchor'
    ) as { x: number; y: number }[]
    if (!hoveredId || anchorPoints.length === 0) {
      return null
    }

    const bounds = anchorPoints.reduce(
      (current, point) => ({
        minX: Math.min(current.minX, point.x),
        minY: Math.min(current.minY, point.y),
        maxX: Math.max(current.maxX, point.x),
        maxY: Math.max(current.maxY, point.y)
      }),
      {
        minX: Number.POSITIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY
      }
    )

    return {
      id: hoveredId,
      x: bounds.minX,
      y: bounds.minY,
      width: bounds.maxX - bounds.minX,
      height: bounds.maxY - bounds.minY,
      pointCoordinateSpace: computed?.pointCoordinateSpace,
      computedX: computed?.x,
      computedY: computed?.y
    }
  })
  if (!target) {
    throw new Error('No hovered vector target available')
  }

  const viewportState = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    return {
      zoom: core?.getSystemProperty?.('zoom') ?? 1,
      viewport: core?.getSystemProperty?.('viewportPosition') ?? { x: 0, y: 0 }
    }
  })
  const viewportSize = page.viewportSize() ?? { width: 1280, height: 900 }
  const clipX = Math.max(
    0,
    Math.floor(
      target.x * viewportState.zoom + viewportState.viewport.x - padding
    )
  )
  const clipY = Math.max(
    0,
    Math.floor(
      target.y * viewportState.zoom + viewportState.viewport.y - padding
    )
  )
  const width = Math.max(
    1,
    Math.min(
      viewportSize.width - clipX,
      Math.ceil(target.width * viewportState.zoom + padding * 2)
    )
  )
  const height = Math.max(
    1,
    Math.min(
      viewportSize.height - clipY,
      Math.ceil(target.height * viewportState.zoom + padding * 2)
    )
  )
  const screenshot = await page.screenshot({
    clip: {
      x: clipX,
      y: clipY,
      width,
      height
    }
  })

  return {
    base64: screenshot.toString('base64'),
    clipX,
    clipY,
    width,
    height,
    zoom: viewportState.zoom,
    viewport: viewportState.viewport,
    target
  }
}

const expectHoverOutlineMatchesVectorBounds = async (
  page: Page,
  label = 'hovered vector'
) => {
  const raster = await captureHoveredVectorOutlineRaster(page)
  const stats = await analyzeBlueHoverOutlineRaster(page, raster.base64)
  const expectedBounds = {
    x: raster.target.x * raster.zoom + raster.viewport.x - raster.clipX,
    y: raster.target.y * raster.zoom + raster.viewport.y - raster.clipY,
    width: raster.target.width * raster.zoom,
    height: raster.target.height * raster.zoom
  }
  const tolerance = 8

  expect(
    stats.bluePixels,
    `${label} hover outline missing\n${JSON.stringify(
      { stats, raster: { ...raster, base64: '<omitted>' }, expectedBounds },
      null,
      2
    )}`
  ).toBeGreaterThan(120)
  expect(
    stats.bounds,
    `${label} hover outline bounds unavailable\n${JSON.stringify(
      { stats, raster: { ...raster, base64: '<omitted>' }, expectedBounds },
      null,
      2
    )}`
  ).not.toBeNull()
  if (!stats.bounds) {
    return
  }

  expect(stats.bounds.x).toBeGreaterThanOrEqual(expectedBounds.x - tolerance)
  expect(stats.bounds.y).toBeGreaterThanOrEqual(expectedBounds.y - tolerance)
  expect(stats.bounds.x + stats.bounds.width).toBeLessThanOrEqual(
    expectedBounds.x + expectedBounds.width + tolerance
  )
  expect(stats.bounds.y + stats.bounds.height).toBeLessThanOrEqual(
    expectedBounds.y + expectedBounds.height + tolerance
  )
}

const readSelectedVectorDiagnostics = async (page: Page) =>
  page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId =
      core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
    const computed = selectedId
      ? core?.deps?.sceneTree
          ?.getElementById?.(selectedId)
          ?.getAllComputedData?.()
      : null
    const renderElement = selectedId
      ? core?.deps?.render?.getElementById?.(selectedId)
      : null

    return {
      selectedId,
      computed: computed
        ? {
            x: computed.x,
            y: computed.y,
            width: computed.width,
            height: computed.height,
            pointCoordinateSpace: computed.pointCoordinateSpace,
            pointCount: Object.keys(computed.points ?? {}).length,
            segmentCount: Object.keys(computed.segments ?? {}).length,
            networkCount: Object.keys(computed.networks ?? {}).length,
            closed: computed.closed,
            strokes: computed.strokes,
            fills: computed.fills
          }
        : null,
      render: renderElement
        ? {
            x: renderElement.x,
            y: renderElement.y,
            visible: renderElement.visible,
            childCount: renderElement.children?.length ?? null,
            solidPacketCount:
              renderElement.__asyraSolidCenterStrokeExportPackets?.length ??
              null,
            nativeCenterSolidStrokeRenderCount:
              renderElement.__asyraNativeCenterSolidStrokeRenderCount ?? null,
            vectorGeometryModelCount:
              renderElement.__asyraVectorPathGeometryModelCount ?? null,
            vectorTopologyModelCount:
              renderElement.__asyraVectorPathTopologyModelCount ?? null
          }
        : null
    }
  })

const expectVisibleRedStroke = async (
  page: Page,
  label = 'selected vector'
) => {
  const raster = await captureSelectedElementRaster(page)
  const stats = await analyzeRedStrokeRaster(page, raster.base64)
  const diagnostics = await readSelectedVectorDiagnostics(page)
  expect(
    stats.strokeCoverage,
    `${label} red stroke coverage\n${JSON.stringify(
      { stats, raster: { ...raster, base64: '<omitted>' }, diagnostics },
      null,
      2
    )}`
  ).toBeGreaterThan(0.015)
  expect(
    stats.visualSignal,
    `${label} red stroke signal\n${JSON.stringify({ stats, diagnostics }, null, 2)}`
  ).toBeGreaterThan(2)
}

const vectorInvariantProbe = async (page: Page) => {
  return page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId =
      core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
    if (!selectedId) {
      throw new Error('No selected vector available')
    }

    const element = core?.deps?.sceneTree?.getElementById?.(selectedId)
    const computed = element?.getAllComputedData?.() ?? {}
    const renderElement = core?.deps?.render?.getElementById?.(selectedId)
    const points = computed.points ?? {}
    const anchorPoints = Object.values(points).filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (point: any) => point?.kind === 'anchor'
    ) as { id: string; x: number; y: number }[]
    const anchorBounds = anchorPoints.reduce(
      (bounds, point) => ({
        minX: Math.min(bounds.minX, point.x),
        minY: Math.min(bounds.minY, point.y),
        maxX: Math.max(bounds.maxX, point.x),
        maxY: Math.max(bounds.maxY, point.y)
      }),
      {
        minX: Number.POSITIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY
      }
    )
    const includeGeometryPoint = (
      bounds: {
        minX: number
        minY: number
        maxX: number
        maxY: number
      },
      point: { x: number; y: number }
    ) => {
      bounds.minX = Math.min(bounds.minX, point.x)
      bounds.minY = Math.min(bounds.minY, point.y)
      bounds.maxX = Math.max(bounds.maxX, point.x)
      bounds.maxY = Math.max(bounds.maxY, point.y)
    }
    const cubicAt = (
      p0: number,
      p1: number,
      p2: number,
      p3: number,
      t: number
    ) => {
      const mt = 1 - t
      return (
        mt * mt * mt * p0 +
        3 * mt * mt * t * p1 +
        3 * mt * t * t * p2 +
        t * t * t * p3
      )
    }
    const cubicExtrema = (p0: number, p1: number, p2: number, p3: number) => {
      const a = -p0 + 3 * p1 - 3 * p2 + p3
      const b = 2 * (p0 - 2 * p1 + p2)
      const c = -p0 + p1
      const values: number[] = []
      if (Math.abs(a) < 1e-9) {
        if (Math.abs(b) > 1e-9) {
          values.push(-c / b)
        }
      } else {
        const discriminant = b * b - 4 * a * c
        if (discriminant >= 0) {
          const root = Math.sqrt(discriminant)
          values.push((-b + root) / (2 * a), (-b - root) / (2 * a))
        }
      }
      return values.filter((t) => t > 0 && t < 1)
    }
    const geometryBounds = anchorPoints.reduce(
      (bounds, point) => {
        includeGeometryPoint(bounds, point)
        return bounds
      },
      {
        minX: Number.POSITIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY
      }
    )
    Object.values(computed.segments ?? {}).forEach(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (segment: any) => {
        const start = points[segment?.startId]
        const end = points[segment?.endId]
        if (
          start?.kind !== 'anchor' ||
          end?.kind !== 'anchor' ||
          (!segment?.outControlId && !segment?.inControlId)
        ) {
          return
        }

        const outControl = points[segment.outControlId]
        const inControl = points[segment.inControlId]
        const p1 =
          outControl?.kind === 'control'
            ? outControl
            : { x: start.x, y: start.y }
        const p2 =
          inControl?.kind === 'control' ? inControl : { x: end.x, y: end.y }
        cubicExtrema(start.x, p1.x, p2.x, end.x).forEach((t) => {
          includeGeometryPoint(geometryBounds, {
            x: cubicAt(start.x, p1.x, p2.x, end.x, t),
            y: cubicAt(start.y, p1.y, p2.y, end.y, t)
          })
        })
        cubicExtrema(start.y, p1.y, p2.y, end.y).forEach((t) => {
          includeGeometryPoint(geometryBounds, {
            x: cubicAt(start.x, p1.x, p2.x, end.x, t),
            y: cubicAt(start.y, p1.y, p2.y, end.y, t)
          })
        })
      }
    )
    const usesWorkspacePoints = computed.pointCoordinateSpace === 'workspace'
    const overlayBounds = anchorPoints.reduce(
      (bounds, point) => {
        const x = usesWorkspacePoints ? point.x : point.x + (computed.x ?? 0)
        const y = usesWorkspacePoints ? point.y : point.y + (computed.y ?? 0)
        return {
          minX: Math.min(bounds.minX, x),
          minY: Math.min(bounds.minY, y),
          maxX: Math.max(bounds.maxX, x),
          maxY: Math.max(bounds.maxY, y)
        }
      },
      {
        minX: Number.POSITIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY
      }
    )
    const renderBounds = renderElement?.getBounds?.()
    const localBounds = renderElement?.getLocalBounds?.()

    return {
      selectedId,
      computed: {
        x: computed.x,
        y: computed.y,
        width: computed.width,
        height: computed.height,
        pointCoordinateSpace: computed.pointCoordinateSpace,
        pointCount: Object.keys(points).length,
        segmentCount: Object.keys(computed.segments ?? {}).length,
        networkCount: Object.keys(computed.networks ?? {}).length
      },
      anchorBounds: {
        x: anchorBounds.minX,
        y: anchorBounds.minY,
        width: anchorBounds.maxX - anchorBounds.minX,
        height: anchorBounds.maxY - anchorBounds.minY
      },
      geometryBounds: {
        x: geometryBounds.minX,
        y: geometryBounds.minY,
        width: geometryBounds.maxX - geometryBounds.minX,
        height: geometryBounds.maxY - geometryBounds.minY
      },
      overlayBounds: {
        x: overlayBounds.minX,
        y: overlayBounds.minY,
        width: overlayBounds.maxX - overlayBounds.minX,
        height: overlayBounds.maxY - overlayBounds.minY
      },
      render: {
        exists: Boolean(renderElement),
        visible: renderElement?.visible ?? null,
        x: renderElement?.x ?? null,
        y: renderElement?.y ?? null,
        renderBounds: renderBounds
          ? {
              x: renderBounds.x,
              y: renderBounds.y,
              width: renderBounds.width,
              height: renderBounds.height
            }
          : null,
        localBounds: localBounds
          ? {
              x: localBounds.x,
              y: localBounds.y,
              width: localBounds.width,
              height: localBounds.height
            }
          : null,
        vectorGeometryModelCount:
          renderElement?.__asyraVectorPathGeometryModelCount ?? null,
        vectorTopologyModelCount:
          renderElement?.__asyraVectorPathTopologyModelCount ?? null,
        solidPacketCount:
          renderElement?.__asyraSolidCenterStrokeExportPackets?.length ?? 0
      }
    }
  })
}

const expectWorkspaceVectorInvariants = async (
  page: Page,
  label = 'selected vector'
) => {
  const summary = await vectorInvariantProbe(page)
  expect(summary.computed.pointCoordinateSpace).toBe('workspace')
  expect(summary.computed.x).toBeCloseTo(summary.geometryBounds.x, 4)
  expect(summary.computed.y).toBeCloseTo(summary.geometryBounds.y, 4)
  expect(summary.computed.width).toBeCloseTo(summary.geometryBounds.width, 4)
  expect(summary.computed.height).toBeCloseTo(summary.geometryBounds.height, 4)
  expect(summary.overlayBounds).toEqual(summary.anchorBounds)
  expect(summary.render.exists).toBe(true)
  expect(summary.render.visible).toBe(true)
  expect(summary.render.x).toBeCloseTo(summary.computed.x, 4)
  expect(summary.render.y).toBeCloseTo(summary.computed.y, 4)
  expect(summary.render.vectorGeometryModelCount).toBeGreaterThan(0)
  expect(summary.render.vectorTopologyModelCount).toBeGreaterThan(0)
  await expectVisibleRedStroke(page, label)
  return summary
}

const getLastUndoPatchSummary = async (page: Page) =>
  page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const stack = core?.deps?.factory?.transact?.undoStack ?? []
    const last = stack[stack.length - 1] ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const firstPayload = (last[0] as any)?.payload ?? {}
    const patch = firstPayload.patch ?? {}

    return {
      changeTypes: last.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (event: any) => event?.type
      ),
      valueKeys: Object.keys(patch.values ?? {}),
      pointSetIds: Object.keys(patch.records?.points?.set ?? {}),
      pointRemoveIds: Object.keys(patch.records?.points?.remove ?? {}),
      segmentSetIds: Object.keys(patch.records?.segments?.set ?? {}),
      segmentRemoveIds: Object.keys(patch.records?.segments?.remove ?? {}),
      networkSetIds: Object.keys(patch.records?.networks?.set ?? {}),
      networkRemoveIds: Object.keys(patch.records?.networks?.remove ?? {})
    }
  })

const expectOnlyComputedPatchUndo = (summary: { changeTypes: string[] }) => {
  expect(summary.changeTypes).toEqual(['updateComputedDataPatch'])
}

test.describe('Vector render invariants', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const browserErrors: string[] = []
    ;(testInfo as typeof testInfo & BrowserTestInfo).browserErrors =
      browserErrors
    page.on('pageerror', (error) => {
      browserErrors.push(error.message)
    })
    page.on('console', (message) => {
      if (message.type() === 'error') {
        browserErrors.push(message.text())
      }
    })

    await page.goto('/')
    await waitForAppReady(page)
    await resetCanvas(page)
  })

  test.afterEach(async ({ page: _page }, testInfo) => {
    const browserErrors =
      (testInfo as typeof testInfo & BrowserTestInfo).browserErrors ?? []
    expect(browserErrors).toEqual([])
  })

  test('keeps scene-tree, render graphic, and path-editing overlay aligned after star create and point update', async ({
    page
  }) => {
    await page.evaluate((topology) => {
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
          closed: true
        },
        { undoable: false }
      )
      if (!createdId) {
        throw new Error('Failed to create vector star')
      }

      elementApis.changeComputedData(
        [createdId],
        {
          fills: [
            {
              id: 'vector-invariant-fill',
              kind: 'solid',
              fillType: 'color',
              color: '#d5d5d5',
              opacity: 1,
              visible: true
            }
          ],
          strokes: [
            {
              id: 'vector-invariant-stroke',
              kind: 'solid',
              style: 'solid',
              position: 'center',
              width: 12,
              dashPattern: [],
              dashOffset: 0,
              fill: null,
              defaultColorFormat: 'hex',
              colorFormat: 'hex',
              color: '#df0606',
              opacity: 0.75,
              visible: true,
              gradient: null,
              joinType: 'miter',
              capType: 'butt',
              miterAngle: 28.96
            }
          ]
        },
        { undoable: false }
      )
      core.selectElements?.([createdId], { undoable: false })
      core.setSystemProperty?.('pathEditingVectorId', createdId)
      core.setSystemProperty?.('pathEditingMode', true)
    }, createStarTopology())

    await page.waitForTimeout(250)

    const created = await vectorInvariantProbe(page)
    expect(created.computed.pointCoordinateSpace).toBe('workspace')
    expect(created.computed.pointCount).toBe(10)
    expect(created.computed.segmentCount).toBe(10)
    expect(created.computed.networkCount).toBe(1)
    expect(created.computed.x).toBeCloseTo(created.geometryBounds.x, 4)
    expect(created.computed.y).toBeCloseTo(created.geometryBounds.y, 4)
    expect(created.computed.width).toBeCloseTo(created.geometryBounds.width, 4)
    expect(created.computed.height).toBeCloseTo(
      created.geometryBounds.height,
      4
    )
    expect(created.overlayBounds).toEqual(created.anchorBounds)
    expect(created.render.exists).toBe(true)
    expect(created.render.visible).toBe(true)
    expect(created.render.x).toBeCloseTo(created.computed.x, 4)
    expect(created.render.y).toBeCloseTo(created.computed.y, 4)
    expect(created.render.vectorGeometryModelCount).toBeGreaterThan(0)
    expect(created.render.vectorTopologyModelCount).toBeGreaterThan(0)
    await expectVisibleRedStroke(page)

    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elementApis = (window as any).__AsyraE2E__?.elementApis
      const selectedId =
        core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
      const point = core?.deps?.sceneTree
        ?.getElementById?.(selectedId)
        ?.getAllComputedData?.()?.points?.p0
      if (!selectedId || !point) {
        throw new Error('Missing selected vector point for update')
      }

      elementApis.updateVectorAnchorPointPosition(
        selectedId,
        'p0',
        { x: point.x + 36, y: point.y + 24 },
        { undoable: false, skipResult: true }
      )
    })

    await page.waitForTimeout(250)

    const updated = await vectorInvariantProbe(page)
    expect(updated.computed.pointCoordinateSpace).toBe('workspace')
    expect(updated.computed.x).toBeCloseTo(updated.geometryBounds.x, 4)
    expect(updated.computed.y).toBeCloseTo(updated.geometryBounds.y, 4)
    expect(updated.computed.width).toBeCloseTo(updated.geometryBounds.width, 4)
    expect(updated.computed.height).toBeCloseTo(
      updated.geometryBounds.height,
      4
    )
    expect(updated.overlayBounds).toEqual(updated.anchorBounds)
    expect(updated.render.exists).toBe(true)
    expect(updated.render.visible).toBe(true)
    expect(updated.render.x).toBeCloseTo(updated.computed.x, 4)
    expect(updated.render.y).toBeCloseTo(updated.computed.y, 4)
    expect(updated.render.vectorGeometryModelCount).toBeGreaterThan(0)
    expect(updated.render.vectorTopologyModelCount).toBeGreaterThan(0)
    await expectVisibleRedStroke(page)
  })

  test('keeps inside dashed vector hover outline aligned with canonical workspace points', async ({
    page
  }) => {
    await page.evaluate((topology) => {
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
          closed: true
        },
        { undoable: false }
      )
      if (!createdId) {
        throw new Error('Failed to create hover outline vector')
      }

      elementApis.changeComputedData(
        [createdId],
        {
          fills: [],
          strokes: [
            {
              id: 'vector-hover-dashed-inside-stroke',
              kind: 'solid',
              style: 'dashed',
              position: 'inside',
              width: 14,
              dashPattern: [20, 14],
              dashOffset: 0,
              fill: null,
              defaultColorFormat: 'hex',
              colorFormat: 'hex',
              color: '#df0606',
              opacity: 0.85,
              visible: true,
              gradient: null,
              joinType: 'miter',
              capType: 'butt',
              miterAngle: 28.96
            }
          ]
        },
        { undoable: false }
      )
      core.selectElements?.([], { undoable: false })
      core.setSystemProperty?.('pathEditingVectorId', null)
      core.setSystemProperty?.('pathEditingMode', false)
      core.setSystemProperty?.('selectedVectorPoint', null)
      core.setSystemProperty?.('hoveredVectorPoint', null)
      core.setSystemProperty?.('hoveredElementId', createdId)
      core.setSystemProperty?.('zoom', 1.2)
      core.setSystemProperty?.('viewportPosition', { x: 80, y: 70 })
    }, createStarTopology())

    await page.waitForTimeout(300)

    await expectHoverOutlineMatchesVectorBounds(
      page,
      'inside dashed vector hover outline'
    )
  })

  test('renders app-created self-intersecting inside dashed pentagram across all source segments', async ({
    page
  }) => {
    await page.evaluate((topology) => {
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
          pointCoordinateSpace: 'workspace',
          fills: []
        },
        { undoable: false }
      )
      if (!createdId) {
        throw new Error('Failed to create inside dashed pentagram')
      }

      elementApis.changeComputedData(
        [createdId],
        {
          fills: [],
          strokes: [
            {
              id: 'vector-pentagram-inside-dashed-stroke',
              kind: 'solid',
              style: 'dashed',
              position: 'inside',
              width: 16,
              dashPattern: [22, 14],
              dashOffset: 0,
              fill: null,
              defaultColorFormat: 'hex',
              colorFormat: 'hex',
              color: '#df0606',
              opacity: 0.85,
              visible: true,
              gradient: null,
              joinType: 'miter',
              capType: 'square',
              miterAngle: 28.96
            }
          ]
        },
        { undoable: false }
      )
      core.selectElements?.([createdId], { undoable: false })
      core.setSystemProperty?.('pathEditingVectorId', createdId)
      core.setSystemProperty?.('pathEditingMode', true)
      core.setSystemProperty?.('zoom', 1.25)
      core.setSystemProperty?.('viewportPosition', { x: 120, y: 90 })
    }, createPentagramTopology())

    await page.waitForTimeout(600)

    const raster = await captureSelectedVectorFullRaster(page)
    const coverage = await analyzePentagramDashSegmentCoverage(page, raster)
    expect(
      coverage.totalRedPixels,
      JSON.stringify(
        { coverage, raster: { ...raster, base64: '<omitted>' } },
        null,
        2
      )
    ).toBeGreaterThan(600)
    expect(
      coverage.coveredSegmentCount,
      JSON.stringify(
        { coverage, raster: { ...raster, base64: '<omitted>' } },
        null,
        2
      )
    ).toBe(5)
    expect(
      coverage.insideDashRecall,
      JSON.stringify(
        { coverage, raster: { ...raster, base64: '<omitted>' } },
        null,
        2
      )
    ).toBeGreaterThanOrEqual(0.75)
    expect(
      coverage.worstSegmentRecall,
      JSON.stringify(
        { coverage, raster: { ...raster, base64: '<omitted>' } },
        null,
        2
      )
    ).toBeGreaterThanOrEqual(0.6)
  })

  test('keeps scene-tree, render graphic, and path-editing overlay aligned after pen-created star', async ({
    page
  }) => {
    const starPoints = getStarWorkspacePoints()

    await page.keyboard.press('p')
    await page.waitForTimeout(100)

    for (const point of starPoints) {
      const clientPoint = await workspaceToClient(page, point)
      await page.mouse.click(clientPoint.x, clientPoint.y)
      await page.waitForTimeout(80)
    }

    const firstPoint = await workspaceToClient(page, starPoints[0])
    await page.mouse.click(firstPoint.x, firstPoint.y)
    await setSelectedVectorRedStroke(page)
    await page.waitForTimeout(350)

    const created = await vectorInvariantProbe(page)
    expect(created.computed.pointCoordinateSpace).toBe('workspace')
    expect(created.computed.pointCount).toBe(10)
    expect(created.computed.segmentCount).toBe(10)
    expect(created.computed.networkCount).toBe(1)
    expect(created.computed.x).toBeCloseTo(created.geometryBounds.x, 4)
    expect(created.computed.y).toBeCloseTo(created.geometryBounds.y, 4)
    expect(created.computed.width).toBeCloseTo(created.geometryBounds.width, 4)
    expect(created.computed.height).toBeCloseTo(
      created.geometryBounds.height,
      4
    )
    expect(created.overlayBounds).toEqual(created.anchorBounds)
    expect(created.render.exists).toBe(true)
    expect(created.render.visible).toBe(true)
    expect(created.render.x).toBeCloseTo(created.computed.x, 4)
    expect(created.render.y).toBeCloseTo(created.computed.y, 4)
    expect(created.render.vectorGeometryModelCount).toBeGreaterThan(0)
    expect(created.render.vectorTopologyModelCount).toBeGreaterThan(0)
    await expectVisibleRedStroke(page)

    await page.keyboard.press('v')
    await page.waitForTimeout(100)

    const dragStart = await workspaceToClient(page, starPoints[0])
    const dragEnd = await workspaceToClient(page, {
      x: starPoints[0].x + 36,
      y: starPoints[0].y + 24
    })
    await page.mouse.move(dragStart.x, dragStart.y)
    await page.mouse.down()
    await page.mouse.move(dragEnd.x, dragEnd.y, { steps: 12 })
    await page.mouse.up()
    await page.waitForTimeout(350)

    const dragged = await vectorInvariantProbe(page)
    expect(dragged.computed.pointCoordinateSpace).toBe('workspace')
    expect(dragged.computed.x).toBeCloseTo(dragged.geometryBounds.x, 4)
    expect(dragged.computed.y).toBeCloseTo(dragged.geometryBounds.y, 4)
    expect(dragged.computed.width).toBeCloseTo(dragged.geometryBounds.width, 4)
    expect(dragged.computed.height).toBeCloseTo(
      dragged.geometryBounds.height,
      4
    )
    expect(dragged.overlayBounds).toEqual(dragged.anchorBounds)
    expect(dragged.render.exists).toBe(true)
    expect(dragged.render.visible).toBe(true)
    expect(dragged.render.x).toBeCloseTo(dragged.computed.x, 4)
    expect(dragged.render.y).toBeCloseTo(dragged.computed.y, 4)
    expect(dragged.render.vectorGeometryModelCount).toBeGreaterThan(0)
    expect(dragged.render.vectorTopologyModelCount).toBeGreaterThan(0)
    await expectVisibleRedStroke(page)
  })

  test('migrates legacy local vector data during first point drag without render or overlay drift', async ({
    page
  }) => {
    await page.evaluate(
      async ({ topology, legacyData }) => {
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
            closed: true
          },
          { undoable: false }
        )
        if (!createdId) {
          throw new Error('Failed to create vector before legacy load fixture')
        }
        elementApis.changeComputedData(
          [createdId],
          {
            strokes: [
              {
                id: 'legacy-vector-invariant-stroke',
                kind: 'solid',
                style: 'solid',
                position: 'center',
                width: 12,
                dashPattern: [],
                dashOffset: 0,
                fill: null,
                defaultColorFormat: 'hex',
                colorFormat: 'hex',
                color: '#df0606',
                opacity: 0.75,
                visible: true,
                gradient: null,
                joinType: 'miter',
                capType: 'butt',
                miterAngle: 28.96
              }
            ]
          },
          { undoable: false }
        )

        const saved = await core.save()
        const elementRaw = saved.sceneTree.elements?.[createdId]
        const props = elementRaw?.props ?? {}
        const savedProps = saved.props ?? {}
        const positionProp = props.position ? savedProps[props.position] : null
        const dimensionProp = props.dimension
          ? savedProps[props.dimension]
          : null
        const pointsProp = props.points ? savedProps[props.points] : null
        const pointCoordinateSpaceProp = props.pointCoordinateSpace
          ? savedProps[props.pointCoordinateSpace]
          : null

        if (!positionProp || !dimensionProp || !pointsProp) {
          throw new Error('Missing vector persisted property components')
        }

        positionProp.x = legacyData.x
        positionProp.y = legacyData.y
        dimensionProp.width = legacyData.width
        dimensionProp.height = legacyData.height
        Object.entries(legacyData.points).forEach(([pointId, localPoint]) => {
          const pointComponent = savedProps[pointId]
          if (!pointComponent) {
            throw new Error(`Missing point property component ${pointId}`)
          }
          pointComponent.x = localPoint.x
          pointComponent.y = localPoint.y
        })
        if (pointCoordinateSpaceProp) {
          delete pointCoordinateSpaceProp.pointCoordinateSpace
        }
        core.load({
          ...saved
        })
        core.selectElements?.([createdId], { undoable: false })
        core.setSystemProperty?.('pathEditingVectorId', createdId)
        core.setSystemProperty?.('pathEditingMode', true)
      },
      {
        topology: createStarTopology(),
        legacyData: createLegacyLocalStarData()
      }
    )

    await page.waitForTimeout(350)

    const created = await vectorInvariantProbe(page)
    expect(created.computed.pointCoordinateSpace).not.toBe('workspace')
    expect(created.computed.x).toBeCloseTo(created.overlayBounds.x, 4)
    expect(created.computed.y).toBeCloseTo(created.overlayBounds.y, 4)
    expect(created.render.exists).toBe(true)
    expect(created.render.visible).toBe(true)
    expect(created.render.x).toBeCloseTo(created.computed.x, 4)
    expect(created.render.y).toBeCloseTo(created.computed.y, 4)
    expect(created.render.vectorGeometryModelCount).toBeGreaterThan(0)
    await expectVisibleRedStroke(page)

    await page.keyboard.press('v')
    await page.waitForTimeout(100)

    const firstPoint = getStarWorkspacePoints()[0]
    const dragStart = await workspaceToClient(page, firstPoint)
    const dragEnd = await workspaceToClient(page, {
      x: firstPoint.x + 36,
      y: firstPoint.y + 24
    })
    await page.mouse.move(dragStart.x, dragStart.y)
    await page.mouse.down()
    await page.mouse.move(dragEnd.x, dragEnd.y, { steps: 12 })
    await page.mouse.up()
    await page.waitForTimeout(350)

    const dragged = await vectorInvariantProbe(page)
    expect(dragged.computed.pointCoordinateSpace).toBe('workspace')
    expect(dragged.computed.x).toBeCloseTo(dragged.geometryBounds.x, 4)
    expect(dragged.computed.y).toBeCloseTo(dragged.geometryBounds.y, 4)
    expect(dragged.computed.width).toBeCloseTo(dragged.geometryBounds.width, 4)
    expect(dragged.computed.height).toBeCloseTo(
      dragged.geometryBounds.height,
      4
    )
    expect(dragged.overlayBounds).toEqual(dragged.anchorBounds)
    expect(dragged.render.exists).toBe(true)
    expect(dragged.render.visible).toBe(true)
    expect(dragged.render.x).toBeCloseTo(dragged.computed.x, 4)
    expect(dragged.render.y).toBeCloseTo(dragged.computed.y, 4)
    expect(dragged.render.vectorGeometryModelCount).toBeGreaterThan(0)
    expect(dragged.render.vectorTopologyModelCount).toBeGreaterThan(0)
    await expectVisibleRedStroke(page)
  })

  test('keeps full topology operations aligned through append, split, remove, and close', async ({
    page
  }) => {
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elementApis = (window as any).__AsyraE2E__?.elementApis
      if (!core || !elementApis) {
        throw new Error('Missing E2E core or element APIs')
      }

      const elementId = elementApis.createElement(
        {
          type: 'vector',
          points: {
            A: {
              id: 'A',
              kind: 'anchor',
              anchorType: 'sharp',
              x: 260,
              y: 260
            },
            B: {
              id: 'B',
              kind: 'anchor',
              anchorType: 'sharp',
              x: 370,
              y: 210
            },
            C: {
              id: 'C',
              kind: 'anchor',
              anchorType: 'sharp',
              x: 480,
              y: 275
            }
          },
          segments: {
            AB: {
              id: 'AB',
              startId: 'A',
              endId: 'B',
              outControlId: null,
              inControlId: null
            },
            BC: {
              id: 'BC',
              startId: 'B',
              endId: 'C',
              outControlId: null,
              inControlId: null
            }
          },
          networks: {
            main: {
              id: 'main',
              pointIds: ['A', 'B', 'C'],
              segmentIds: ['AB', 'BC'],
              closed: false
            }
          },
          closed: false
        },
        { undoable: false }
      )
      if (!elementId) {
        throw new Error('Failed to create full topology fixture')
      }
      core.selectElements?.([elementId], { undoable: false })
      core.setSystemProperty?.('pathEditingVectorId', elementId)
      core.setSystemProperty?.('pathEditingMode', true)
    })
    await setSelectedVectorRedStroke(page)
    await page.waitForTimeout(250)
    await expectWorkspaceVectorInvariants(page, 'full-topology:create')

    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elementApis = (window as any).__AsyraE2E__?.elementApis
      const elementId =
        core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
      if (!elementId) {
        throw new Error('Missing selected vector for append')
      }
      elementApis.appendVectorAnchorPoint(elementId, {
        id: 'D',
        type: 'sharp',
        x: 430,
        y: 380,
        isMove: undefined,
        inHandle: null,
        outHandle: null
      })
    })
    await page.waitForTimeout(250)
    await expectWorkspaceVectorInvariants(page, 'full-topology:append')
    const appendUndo = await getLastUndoPatchSummary(page)
    expectOnlyComputedPatchUndo(appendUndo)
    expect(appendUndo.pointSetIds).toEqual(['D'])
    expect(appendUndo.pointRemoveIds).toEqual([])
    expect(appendUndo.networkSetIds).toEqual(['main'])

    const splitPointId = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elementApis = (window as any).__AsyraE2E__?.elementApis
      const elementId =
        core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
      const computed = elementId
        ? core?.deps?.sceneTree
            ?.getElementById?.(elementId)
            ?.getAllComputedData?.()
        : null
      if (!elementId || !computed) {
        throw new Error('Missing selected vector for split')
      }
      const segment = computed.segments?.AB
      const start = computed.points?.[segment?.startId]
      const end = computed.points?.[segment?.endId]
      if (!segment || !start || !end) {
        throw new Error('Missing AB segment for split')
      }
      const result = elementApis.splitVectorSegmentAtWorkspacePos(
        elementId,
        'AB',
        {
          x: (start.x + end.x) / 2,
          y: (start.y + end.y) / 2
        }
      )
      if (!result?.point?.id) {
        throw new Error('Failed to split vector segment')
      }
      return result.point.id
    })
    await page.waitForTimeout(250)
    await expectWorkspaceVectorInvariants(page, 'full-topology:split')
    const splitUndo = await getLastUndoPatchSummary(page)
    expectOnlyComputedPatchUndo(splitUndo)
    expect(splitUndo.pointSetIds).toEqual([splitPointId])
    expect(splitUndo.pointRemoveIds).toEqual([])
    expect(splitUndo.segmentRemoveIds).toContain('AB')
    expect(splitUndo.networkSetIds).toEqual(['main'])

    await page.evaluate((pointId) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elementApis = (window as any).__AsyraE2E__?.elementApis
      const elementId =
        core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
      if (!elementId) {
        throw new Error('Missing selected vector for remove')
      }
      if (!elementApis.removeVectorAnchorPoint(elementId, pointId)) {
        throw new Error('Failed to remove split vector point')
      }
    }, splitPointId)
    await page.waitForTimeout(250)
    await expectWorkspaceVectorInvariants(page, 'full-topology:remove')
    const removeUndo = await getLastUndoPatchSummary(page)
    expectOnlyComputedPatchUndo(removeUndo)
    expect(removeUndo.pointSetIds).toEqual([])
    expect(removeUndo.pointRemoveIds).toEqual([splitPointId])
    expect(removeUndo.networkSetIds).toEqual(['main'])

    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elementApis = (window as any).__AsyraE2E__?.elementApis
      const elementId =
        core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
      if (!elementId) {
        throw new Error('Missing selected vector for close')
      }
      const connected = elementApis.connectVectorAnchorEndpoints(
        elementId,
        'D',
        'A'
      )
      if (!connected?.closed) {
        throw new Error('Failed to close vector topology')
      }
    })
    await page.waitForTimeout(250)
    const closed = await expectWorkspaceVectorInvariants(
      page,
      'full-topology:close'
    )
    expect(closed.computed.pointCount).toBe(4)
    expect(closed.computed.segmentCount).toBe(4)
    expect(closed.computed.networkCount).toBe(1)
    const closeUndo = await getLastUndoPatchSummary(page)
    expectOnlyComputedPatchUndo(closeUndo)
    expect(closeUndo.pointSetIds).toEqual([])
    expect(closeUndo.pointRemoveIds).toEqual([])
    expect(closeUndo.valueKeys).toContain('closed')
    expect(closeUndo.networkSetIds).toEqual(['main'])

    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elementApis = (window as any).__AsyraE2E__?.elementApis
      const elementId =
        core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
      if (!elementId) {
        throw new Error('Missing selected vector for set anchor type')
      }
      const updated = elementApis.updateVectorAnchorPointType(
        elementId,
        'B',
        'smooth'
      )
      if (!updated?.point?.id) {
        throw new Error('Failed to set vector anchor type')
      }
    })
    await page.waitForTimeout(250)
    await expectWorkspaceVectorInvariants(page, 'full-topology:set-type')
    const setTypeUndo = await getLastUndoPatchSummary(page)
    expectOnlyComputedPatchUndo(setTypeUndo)
    expect(setTypeUndo.pointSetIds).toEqual(['B'])
    expect(setTypeUndo.pointRemoveIds).toEqual([])
    expect(setTypeUndo.segmentSetIds).toEqual([])
    expect(setTypeUndo.networkSetIds).toEqual([])

    const handleSegmentIds = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elementApis = (window as any).__AsyraE2E__?.elementApis
      const elementId =
        core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
      const computed = elementId
        ? core?.deps?.sceneTree
            ?.getElementById?.(elementId)
            ?.getAllComputedData?.()
        : null
      const point = computed?.points?.B
      if (!elementId || !point) {
        throw new Error('Missing selected vector for set handles')
      }
      interface SegmentLike {
        id: string
        startId: string
        endId: string
      }
      const adjacentSegmentIds = (
        Object.values(computed.segments ?? {}) as SegmentLike[]
      )
        .filter((segment) => segment.startId === 'B' || segment.endId === 'B')
        .map((segment) => segment.id)
      elementApis.updateVectorAnchorPointHandles(elementId, [
        {
          pointId: 'B',
          target: 'inHandle',
          position: { x: point.x - 42, y: point.y + 18 },
          forceSmooth: true
        },
        {
          pointId: 'B',
          target: 'outHandle',
          position: { x: point.x + 48, y: point.y - 22 },
          forceSmooth: true
        }
      ])
      return adjacentSegmentIds
    })
    await page.waitForTimeout(250)
    await expectWorkspaceVectorInvariants(page, 'full-topology:set-handles')
    const setHandlesUndo = await getLastUndoPatchSummary(page)
    expectOnlyComputedPatchUndo(setHandlesUndo)
    expect([...setHandlesUndo.pointSetIds].sort()).toEqual(['B:in', 'B:out'])
    expect(setHandlesUndo.pointRemoveIds).toEqual([])
    expect([...setHandlesUndo.segmentSetIds].sort()).toEqual(
      handleSegmentIds.sort()
    )
    expect(setHandlesUndo.networkSetIds).toEqual([])

    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elementApis = (window as any).__AsyraE2E__?.elementApis
      const elementId =
        core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
      if (!elementId) {
        throw new Error('Missing selected vector for set handle mode')
      }
      const updated = elementApis.setVectorAnchorPointHandleMode(
        elementId,
        'B',
        'mirror-angle-length'
      )
      if (!updated?.point?.id) {
        throw new Error('Failed to set vector handle mode')
      }
    })
    await page.waitForTimeout(250)
    await expectWorkspaceVectorInvariants(page, 'full-topology:set-handle-mode')
    const setHandleModeUndo = await getLastUndoPatchSummary(page)
    expectOnlyComputedPatchUndo(setHandleModeUndo)
    expect(
      setHandleModeUndo.pointSetIds.every((pointId) =>
        ['B', 'B:in', 'B:out'].includes(pointId)
      )
    ).toBe(true)
    expect(setHandleModeUndo.pointRemoveIds).toEqual([])

    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elementApis = (window as any).__AsyraE2E__?.elementApis
      const elementId =
        core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
      if (!elementId) {
        throw new Error('Missing selected vector for set closed')
      }
      elementApis.setVectorClosed(elementId, false)
    })
    await page.waitForTimeout(250)
    await expectWorkspaceVectorInvariants(page, 'full-topology:set-open')
    const setOpenUndo = await getLastUndoPatchSummary(page)
    expectOnlyComputedPatchUndo(setOpenUndo)
    expect(setOpenUndo.pointSetIds).toEqual([])
    expect(setOpenUndo.pointRemoveIds).toEqual([])
    expect(setOpenUndo.valueKeys).toContain('closed')
    expect(setOpenUndo.networkSetIds).toEqual(['main'])
  })
})
