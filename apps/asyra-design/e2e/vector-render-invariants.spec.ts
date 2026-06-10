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

const createOpenSelfIntersectingPentagramTopology = () => {
  const points = {
    'tp-36': {
      id: 'tp-36',
      kind: 'anchor',
      x: 672.1796903067977,
      y: -25.577192537243718,
      anchorType: 'sharp',
      handleMode: 'none'
    },
    'tp-39': {
      id: 'tp-39',
      kind: 'anchor',
      x: 494.0219478943302,
      y: 383.5816904608811,
      anchorType: 'smooth',
      handleMode: 'none'
    },
    'tp-36:in': {
      id: 'tp-36:in',
      kind: 'control',
      x: 672.1796903067977,
      y: -25.577192537243718,
      controlForId: 'tp-36',
      controlRole: 'in'
    },
    'tp-39:out': {
      id: 'tp-39:out',
      kind: 'control',
      x: 420.04119045186485,
      y: 382.0718790845042,
      controlForId: 'tp-39',
      controlRole: 'out'
    },
    'tp-39:in': {
      id: 'tp-39:in',
      kind: 'control',
      x: 568.0027053367955,
      y: 385.09150183725797,
      controlForId: 'tp-39',
      controlRole: 'in'
    },
    'tp-40': {
      id: 'tp-40',
      kind: 'anchor',
      x: 847.3178099665117,
      y: 155.6001726279776,
      anchorType: 'sharp',
      handleMode: 'none'
    },
    'tp-41': {
      id: 'tp-41',
      kind: 'anchor',
      x: 486.47289101244587,
      y: 158.61979538073132,
      anchorType: 'sharp',
      handleMode: 'none'
    },
    'tp-42': {
      id: 'tp-42',
      kind: 'anchor',
      x: 823.1608279444822,
      y: 344.32659467508313,
      anchorType: 'sharp',
      handleMode: 'none'
    }
  }
  const segments = {
    'ts-55': {
      id: 'ts-55',
      startId: 'tp-39',
      endId: 'tp-36',
      outControlId: 'tp-39:out',
      inControlId: 'tp-36:in'
    },
    'ts-56': {
      id: 'ts-56',
      startId: 'tp-40',
      endId: 'tp-39',
      outControlId: null,
      inControlId: 'tp-39:in'
    },
    'ts-57': {
      id: 'ts-57',
      startId: 'tp-41',
      endId: 'tp-40',
      outControlId: null,
      inControlId: null
    },
    'ts-58': {
      id: 'ts-58',
      startId: 'tp-42',
      endId: 'tp-41',
      outControlId: null,
      inControlId: null
    }
  }
  const openPointIds = ['tp-42', 'tp-41', 'tp-40', 'tp-39', 'tp-36']
  const segmentIds = ['ts-58', 'ts-57', 'ts-56', 'ts-55']
  const anchors = openPointIds.map((pointId) => points[pointId])
  const bounds = anchors.reduce(
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
  const networks = {
    opn0: {
      id: 'opn0',
      pointIds: openPointIds,
      segmentIds,
      closed: false
    }
  }

  return {
    x: bounds.minX,
    y: bounds.minY,
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
    points,
    segments,
    networks,
    closed: false,
    pointCoordinateSpace: 'workspace',
    fills: []
  }
}

const createReportedVector10InsideDashedDragData = () => ({
  points: {
    'tp-26': {
      id: 'tp-26',
      kind: 'anchor',
      x: 656.8700149751735,
      y: 234.1103641995735,
      anchorType: 'sharp'
    },
    'tp-27': {
      id: 'tp-27',
      kind: 'anchor',
      x: -73.6612860221885,
      y: 400.29874672393936,
      anchorType: 'smooth'
    },
    'tp-26:out': {
      id: 'tp-26:out',
      kind: 'control',
      x: 627.8986682856537,
      y: 423.73004498565365,
      controlForId: 'tp-26',
      controlRole: 'out'
    },
    'tp-27:in': {
      id: 'tp-27:in',
      kind: 'control',
      x: -143.05373318271495,
      y: 409.2940639484521,
      controlForId: 'tp-27',
      controlRole: 'in'
    },
    'tp-27:out': {
      id: 'tp-27:out',
      kind: 'control',
      x: 13.07927292846955,
      y: 389.0546001932984,
      controlForId: 'tp-27',
      controlRole: 'out'
    },
    'tp-28': {
      id: 'tp-28',
      kind: 'anchor',
      x: 406.62440150089947,
      y: 64.58065745194813,
      anchorType: 'sharp'
    },
    'tp-29': {
      id: 'tp-29',
      kind: 'anchor',
      x: -149.15769844220563,
      y: -102.47523386043028,
      anchorType: 'sharp'
    },
    'tp-30': {
      id: 'tp-30',
      kind: 'anchor',
      x: 263.6631098970371,
      y: 360.1410805430791,
      anchorType: 'smooth'
    },
    'tp-29:out': {
      id: 'tp-29:out',
      kind: 'control',
      x: -149.15769844220563,
      y: -102.47523386043028,
      controlForId: 'tp-29',
      controlRole: 'out'
    },
    'tp-30:in': {
      id: 'tp-30:in',
      kind: 'control',
      x: 249.20635007192732,
      y: 393.8735201350017,
      controlForId: 'tp-30',
      controlRole: 'in'
    },
    'tp-30:out': {
      id: 'tp-30:out',
      kind: 'control',
      x: 278.11986972214686,
      y: 326.40864095115654,
      controlForId: 'tp-30',
      controlRole: 'out'
    }
  },
  segments: {
    'ts-39': {
      id: 'ts-39',
      startId: 'tp-26',
      endId: 'tp-27',
      outControlId: 'tp-26:out',
      inControlId: 'tp-27:in'
    },
    'ts-40': {
      id: 'ts-40',
      startId: 'tp-27',
      endId: 'tp-28',
      outControlId: 'tp-27:out',
      inControlId: null
    },
    'ts-41': {
      id: 'ts-41',
      startId: 'tp-28',
      endId: 'tp-29',
      outControlId: null,
      inControlId: null
    },
    'ts-42': {
      id: 'ts-42',
      startId: 'tp-29',
      endId: 'tp-30',
      outControlId: 'tp-29:out',
      inControlId: 'tp-30:in'
    },
    'ts-43': {
      id: 'ts-43',
      startId: 'tp-30',
      endId: 'tp-26',
      outControlId: 'tp-30:out',
      inControlId: null
    }
  },
  networks: {
    'tn-7': {
      id: 'tn-7',
      pointIds: ['tp-26', 'tp-27', 'tp-28', 'tp-29', 'tp-30'],
      segmentIds: ['ts-39', 'ts-40', 'ts-41', 'ts-42', 'ts-43'],
      closed: true
    }
  }
})

const createReportedVector12OpenDashedSwitchData = () => ({
  id: 'vector-12',
  x: 480.4300533891224,
  y: -129.75417750724597,
  width: 366.8877565773893,
  height: 409.16630018489184,
  points: {
    'tp-36': {
      id: 'tp-36',
      kind: 'anchor',
      x: 672.1796903067977,
      y: -25.577192537243718,
      anchorType: 'sharp',
      handleMode: 'none'
    },
    'tp-39': {
      id: 'tp-39',
      kind: 'anchor',
      x: 494.0219478943302,
      y: 383.5816904608811,
      anchorType: 'smooth',
      handleMode: 'none'
    },
    'tp-36:in': {
      id: 'tp-36:in',
      kind: 'control',
      x: 672.1796903067977,
      y: -25.577192537243718,
      controlForId: 'tp-36',
      controlRole: 'in'
    },
    'tp-39:out': {
      id: 'tp-39:out',
      kind: 'control',
      x: 420.04119045186485,
      y: 382.0718790845042,
      controlForId: 'tp-39',
      controlRole: 'out'
    },
    'tp-39:in': {
      id: 'tp-39:in',
      kind: 'control',
      x: 568.0027053367955,
      y: 385.09150183725797,
      controlForId: 'tp-39',
      controlRole: 'in'
    },
    'tp-40': {
      id: 'tp-40',
      kind: 'anchor',
      x: 847.3178099665117,
      y: 155.6001726279776,
      anchorType: 'sharp',
      handleMode: 'none'
    },
    'tp-41': {
      id: 'tp-41',
      kind: 'anchor',
      x: 486.47289101244587,
      y: 158.61979538073132,
      anchorType: 'sharp',
      handleMode: 'none'
    },
    'tp-42': {
      id: 'tp-42',
      kind: 'anchor',
      x: 823.1608279444822,
      y: 344.32659467508313,
      anchorType: 'sharp',
      handleMode: 'none'
    }
  },
  segments: {
    'ts-55': {
      id: 'ts-55',
      startId: 'tp-39',
      endId: 'tp-36',
      outControlId: 'tp-39:out',
      inControlId: 'tp-36:in'
    },
    'ts-56': {
      id: 'ts-56',
      startId: 'tp-40',
      endId: 'tp-39',
      outControlId: null,
      inControlId: 'tp-39:in'
    },
    'ts-57': {
      id: 'ts-57',
      startId: 'tp-41',
      endId: 'tp-40',
      outControlId: null,
      inControlId: null
    },
    'ts-58': {
      id: 'ts-58',
      startId: 'tp-42',
      endId: 'tp-41',
      outControlId: null,
      inControlId: null
    }
  },
  networks: {
    'tn-9': {
      id: 'tn-9',
      pointIds: ['tp-42', 'tp-41', 'tp-40', 'tp-39', 'tp-36'],
      segmentIds: ['ts-58', 'ts-57', 'ts-56', 'ts-55'],
      closed: false
    }
  },
  closed: false,
  pointCoordinateSpace: 'workspace',
  fills: [],
  strokes: [
    {
      id: 'pp-261',
      kind: 'solid',
      style: 'solid',
      position: 'center',
      width: 10,
      dashPattern: [20, 20],
      dashOffset: 0,
      fill: null,
      defaultColorFormat: 'hex',
      colorFormat: 'hex',
      color: '#cccccc',
      opacity: 1,
      visible: true,
      gradient: null,
      joinType: 'miter',
      capType: 'butt',
      miterAngle: 28.96
    }
  ]
})

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
    const redMask = new Uint8Array(totalPixels)
    const bounds = {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY
    }

    for (let index = 0; index < image.length; index += 4) {
      const red = image[index] ?? 0
      const green = image[index + 1] ?? 0
      const blue = image[index + 2] ?? 0
      const alpha = image[index + 3] ?? 0
      const isRedStrokePixel =
        alpha > 128 && red > 90 && red > green + 45 && red > blue + 45
      if (isRedStrokePixel) {
        const pixelIndex = index / 4
        const x = pixelIndex % canvas.width
        const y = Math.floor(pixelIndex / canvas.width)
        redMask[pixelIndex] = 1
        strokePixels += 1
        visualSignal += red
        bounds.minX = Math.min(bounds.minX, x)
        bounds.minY = Math.min(bounds.minY, y)
        bounds.maxX = Math.max(bounds.maxX, x)
        bounds.maxY = Math.max(bounds.maxY, y)
      }
    }

    const visited = new Uint8Array(totalPixels)
    let connectedComponentCount = 0
    let largestComponentPixels = 0
    const queue: number[] = []
    for (let pixelIndex = 0; pixelIndex < totalPixels; pixelIndex += 1) {
      if (redMask[pixelIndex] !== 1 || visited[pixelIndex] === 1) {
        continue
      }
      connectedComponentCount += 1
      visited[pixelIndex] = 1
      queue.length = 0
      queue.push(pixelIndex)
      let componentPixels = 0
      for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
        const current = queue[queueIndex]
        componentPixels += 1
        const x = current % canvas.width
        const y = Math.floor(current / canvas.width)
        const neighbors = [
          x > 0 ? current - 1 : -1,
          x < canvas.width - 1 ? current + 1 : -1,
          y > 0 ? current - canvas.width : -1,
          y < canvas.height - 1 ? current + canvas.width : -1
        ]
        neighbors.forEach((neighbor) => {
          if (
            neighbor >= 0 &&
            redMask[neighbor] === 1 &&
            visited[neighbor] !== 1
          ) {
            visited[neighbor] = 1
            queue.push(neighbor)
          }
        })
      }
      largestComponentPixels = Math.max(largestComponentPixels, componentPixels)
    }

    return {
      strokeCoverage: strokePixels / totalPixels,
      visualSignal: visualSignal / totalPixels,
      connectedComponentCount,
      largestComponentPixelRatio:
        strokePixels > 0 ? largestComponentPixels / strokePixels : 0,
      bounds:
        strokePixels > 0
          ? {
              x: bounds.minX,
              y: bounds.minY,
              width: bounds.maxX - bounds.minX,
              height: bounds.maxY - bounds.minY
            }
          : null
    }
  }, screenshotBase64)

const analyzeBrightStrokeOutsideCurrentVectorBounds = async (
  page: Page,
  screenshotBase64: string,
  padding = 120
) =>
  page.evaluate(
    async ({ base64, padding }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const selectedId =
        core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
      const computed = selectedId
        ? core?.deps?.sceneTree?.getElementById?.(selectedId)?.getAllComputedData?.()
        : null
      const points = Object.values(computed?.points ?? {}) as {
        x?: number
        y?: number
      }[]
      const numericPoints = points.filter(
        (point): point is { x: number; y: number } =>
          typeof point.x === 'number' && typeof point.y === 'number'
      )
      if (!computed || numericPoints.length === 0) {
        throw new Error('No selected vector bounds available')
      }

      const zoom = core?.getSystemProperty?.('zoom') ?? 1
      const viewport = core?.getSystemProperty?.('viewportPosition') ?? {
        x: 0,
        y: 0
      }
      const bounds = numericPoints.reduce(
        (current, point) => ({
          minX: Math.min(current.minX, point.x * zoom + viewport.x),
          minY: Math.min(current.minY, point.y * zoom + viewport.y),
          maxX: Math.max(current.maxX, point.x * zoom + viewport.x),
          maxY: Math.max(current.maxY, point.y * zoom + viewport.y)
        }),
        {
          minX: Number.POSITIVE_INFINITY,
          minY: Number.POSITIVE_INFINITY,
          maxX: Number.NEGATIVE_INFINITY,
          maxY: Number.NEGATIVE_INFINITY
        }
      )
      const reviewBounds = {
        minX: bounds.minX - padding,
        minY: bounds.minY - padding,
        maxX: bounds.maxX + padding,
        maxY: bounds.maxY + padding
      }

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
      let outsideStrokePixels = 0
      const canvasReviewRegion = {
        minX: Math.min(240, Math.floor(canvas.width * 0.2)),
        minY: 40,
        maxX: Math.max(0, canvas.width - Math.min(240, Math.floor(canvas.width * 0.2))),
        maxY: canvas.height
      }

      for (let index = 0; index < image.length; index += 4) {
        const pixelIndex = index / 4
        const x = pixelIndex % canvas.width
        const y = Math.floor(pixelIndex / canvas.width)
        if (
          x < canvasReviewRegion.minX ||
          x > canvasReviewRegion.maxX ||
          y < canvasReviewRegion.minY ||
          y > canvasReviewRegion.maxY
        ) {
          continue
        }

        const red = image[index] ?? 0
        const green = image[index + 1] ?? 0
        const blue = image[index + 2] ?? 0
        const alpha = image[index + 3] ?? 0
        const isBrightStrokePixel =
          alpha > 128 &&
          red > 150 &&
          green > 150 &&
          blue > 150 &&
          Math.abs(red - green) < 48 &&
          Math.abs(red - blue) < 48
        if (!isBrightStrokePixel) {
          continue
        }

        strokePixels += 1
        if (
          x < reviewBounds.minX ||
          x > reviewBounds.maxX ||
          y < reviewBounds.minY ||
          y > reviewBounds.maxY
        ) {
          outsideStrokePixels += 1
        }
      }

      return {
        selectedId,
        strokePixels,
        outsideStrokePixels,
        outsideRatio:
          strokePixels > 0 ? outsideStrokePixels / strokePixels : 0,
        reviewBounds,
        canvasReviewRegion
      }
    },
    { base64: screenshotBase64, padding }
  )

const analyzeSelectedBrightStrokeAlignmentRaster = async (
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
    const blueBounds = {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY
    }

    for (let index = 0; index < image.length; index += 4) {
      const red = image[index] ?? 0
      const green = image[index + 1] ?? 0
      const blue = image[index + 2] ?? 0
      const alpha = image[index + 3] ?? 0
      const isSelectionBlue =
        alpha > 160 && blue > 150 && green > 80 && red < 80
      if (!isSelectionBlue) {
        continue
      }
      const pixelIndex = index / 4
      const x = pixelIndex % canvas.width
      const y = Math.floor(pixelIndex / canvas.width)
      blueBounds.minX = Math.min(blueBounds.minX, x)
      blueBounds.minY = Math.min(blueBounds.minY, y)
      blueBounds.maxX = Math.max(blueBounds.maxX, x)
      blueBounds.maxY = Math.max(blueBounds.maxY, y)
    }

    const hasBlueBounds =
      Number.isFinite(blueBounds.minX) && Number.isFinite(blueBounds.minY)
    const brightBounds = {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY
    }
    let strokePixels = 0
    const reviewPadding = 96
    const reviewRegion = hasBlueBounds
      ? {
          minX: Math.max(0, blueBounds.minX - reviewPadding),
          minY: Math.max(0, blueBounds.minY - reviewPadding),
          maxX: Math.min(canvas.width - 1, blueBounds.maxX + reviewPadding),
          maxY: Math.min(canvas.height - 1, blueBounds.maxY + reviewPadding)
        }
      : null

    for (let index = 0; index < image.length; index += 4) {
      const pixelIndex = index / 4
      const x = pixelIndex % canvas.width
      const y = Math.floor(pixelIndex / canvas.width)
      if (
        !reviewRegion ||
        x < reviewRegion.minX ||
        x > reviewRegion.maxX ||
        y < reviewRegion.minY ||
        y > reviewRegion.maxY
      ) {
        continue
      }
      const red = image[index] ?? 0
      const green = image[index + 1] ?? 0
      const blue = image[index + 2] ?? 0
      const alpha = image[index + 3] ?? 0
      const isBrightStrokePixel =
        alpha > 128 &&
        red > 150 &&
        green > 150 &&
        blue > 150 &&
        Math.abs(red - green) < 48 &&
        Math.abs(red - blue) < 48
      if (!isBrightStrokePixel) {
        continue
      }
      strokePixels += 1
      brightBounds.minX = Math.min(brightBounds.minX, x)
      brightBounds.minY = Math.min(brightBounds.minY, y)
      brightBounds.maxX = Math.max(brightBounds.maxX, x)
      brightBounds.maxY = Math.max(brightBounds.maxY, y)
    }

    const toBounds = (bounds: typeof blueBounds) =>
      Number.isFinite(bounds.minX) && Number.isFinite(bounds.minY)
        ? {
            x: bounds.minX,
            y: bounds.minY,
            width: bounds.maxX - bounds.minX,
            height: bounds.maxY - bounds.minY
          }
        : null

    return {
      blueBounds: toBounds(blueBounds),
      strokeBounds: toBounds(brightBounds),
      strokePixels
    }
  }, screenshotBase64)

const sampleRedStrokeAtWorkspacePoints = async (
  page: Page,
  raster: StrokeRasterCapture,
  points: { x: number; y: number }[]
) =>
  page.evaluate(
    async ({ points: samplePoints, raster: capture }) => {
      const response = await fetch(`data:image/png;base64,${capture.base64}`)
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

      return samplePoints.map((point) => {
        const x = point.x * capture.zoom + capture.viewport.x - capture.clipX
        const y = point.y * capture.zoom + capture.viewport.y - capture.clipY
        return {
          point,
          covered: isRedPixel(x, y)
        }
      })
    },
    { points, raster }
  )

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
        const outControl = segment?.outControlId
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (points as any)[segment.outControlId]
          : null
        const inControl = segment?.inControlId
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (points as any)[segment.inControlId]
          : null
        return {
          id: segmentId,
          start: start ? { x: start.x, y: start.y } : null,
          end: end ? { x: end.x, y: end.y } : null,
          outControl: outControl
            ? { x: outControl.x, y: outControl.y }
            : null,
          inControl: inControl ? { x: inControl.x, y: inControl.y } : null
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

const analyzeOpenPathSegmentDashRecall = async (
  page: Page,
  raster: Awaited<ReturnType<typeof captureSelectedVectorFullRaster>>
) =>
  page.evaluate(async ({ base64, target, clipX, clipY, zoom, viewport }) => {
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
    const lerp = (
      start: { x: number; y: number },
      end: { x: number; y: number },
      t: number
    ) => ({
      x: start.x + (end.x - start.x) * t,
      y: start.y + (end.y - start.y) * t
    })
    const sampleCubic = (
      p0: { x: number; y: number },
      p1: { x: number; y: number },
      p2: { x: number; y: number },
      p3: { x: number; y: number },
      t: number
    ) => {
      const a = lerp(p0, p1, t)
      const b = lerp(p1, p2, t)
      const c = lerp(p2, p3, t)
      const d = lerp(a, b, t)
      const e = lerp(b, c, t)
      return lerp(d, e, t)
    }
    const sampleCubicTangent = (
      p0: { x: number; y: number },
      p1: { x: number; y: number },
      p2: { x: number; y: number },
      p3: { x: number; y: number },
      t: number
    ) => {
      const mt = 1 - t
      return {
        x:
          3 * mt * mt * (p1.x - p0.x) +
          6 * mt * t * (p2.x - p1.x) +
          3 * t * t * (p3.x - p2.x),
        y:
          3 * mt * mt * (p1.y - p0.y) +
          6 * mt * t * (p2.y - p1.y) +
          3 * t * t * (p3.y - p2.y)
      }
    }
    const hasRedNearSample = (
      point: { x: number; y: number },
      tangent: { x: number; y: number }
    ) => {
      const length = Math.hypot(tangent.x, tangent.y)
      if (length <= 1e-6) {
        return false
      }
      const normal = {
        x: -tangent.y / length,
        y: tangent.x / length
      }
      const tangentUnit = {
        x: tangent.x / length,
        y: tangent.y / length
      }
      for (let side = -1; side <= 1; side += 2) {
        for (let normalOffset = 2; normalOffset <= 18; normalOffset += 2) {
          for (let tangentOffset = -2; tangentOffset <= 2; tangentOffset += 2) {
            if (
              isRedPixel(
                point.x + normal.x * normalOffset * side + tangentUnit.x * tangentOffset,
                point.y + normal.y * normalOffset * side + tangentUnit.y * tangentOffset
              )
            ) {
              return true
            }
          }
        }
      }
      return false
    }
    const hasRedNearSampleOnSide = (
      point: { x: number; y: number },
      tangent: { x: number; y: number },
      side: -1 | 1
    ) => {
      const length = Math.hypot(tangent.x, tangent.y)
      if (length <= 1e-6) {
        return false
      }
      const normal = {
        x: -tangent.y / length,
        y: tangent.x / length
      }
      const tangentUnit = {
        x: tangent.x / length,
        y: tangent.y / length
      }
      for (let normalOffset = 2; normalOffset <= 18; normalOffset += 2) {
        for (let tangentOffset = -2; tangentOffset <= 2; tangentOffset += 2) {
          if (
            isRedPixel(
              point.x + normal.x * normalOffset * side + tangentUnit.x * tangentOffset,
              point.y + normal.y * normalOffset * side + tangentUnit.y * tangentOffset
            )
          ) {
            return true
          }
        }
      }
      return false
    }
    const distanceToLineSegment = (
      point: { x: number; y: number },
      start: { x: number; y: number },
      end: { x: number; y: number }
    ) => {
      const dx = end.x - start.x
      const dy = end.y - start.y
      const lengthSquared = dx * dx + dy * dy
      if (lengthSquared <= 1e-6) {
        return Math.hypot(point.x - start.x, point.y - start.y)
      }
      const t = Math.max(
        0,
        Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared)
      )
      return Math.hypot(point.x - (start.x + dx * t), point.y - (start.y + dy * t))
    }
    const segments = target.segments
      .filter((segment) => segment.start && segment.end)
      .map((segment) => {
        const start = toImagePoint(segment.start)
        const end = toImagePoint(segment.end)
        const outControl = segment.outControl
          ? toImagePoint(segment.outControl)
          : null
        const inControl = segment.inControl ? toImagePoint(segment.inControl) : null
        const control1 = outControl ?? start
        const control2 = inControl ?? end
        const roughLength = Math.hypot(end.x - start.x, end.y - start.y)
        const sampleCount = Math.max(18, Math.ceil(roughLength / 10))
        let hitCount = 0
        let leftHitCount = 0
        let rightHitCount = 0
        let currentRun = 0
        let maxRun = 0
        for (let index = 0; index < sampleCount; index += 1) {
          const t = (index + 0.5) / sampleCount
          const point =
            outControl || inControl
              ? sampleCubic(start, control1, control2, end, t)
              : lerp(start, end, t)
          const tangent =
            outControl || inControl
              ? sampleCubicTangent(start, control1, control2, end, t)
              : { x: end.x - start.x, y: end.y - start.y }
          const hasLeft = hasRedNearSampleOnSide(point, tangent, 1)
          const hasRight = hasRedNearSampleOnSide(point, tangent, -1)
          if (hasLeft) {
            leftHitCount += 1
          }
          if (hasRight) {
            rightHitCount += 1
          }
          if (hasLeft || hasRight) {
            hitCount += 1
            currentRun += 1
            maxRun = Math.max(maxRun, currentRun)
          } else {
            currentRun = 0
          }
        }
        return {
          id: segment.id,
          hitCount,
          leftHitCount,
          rightHitCount,
          sampleCount,
          recall: sampleCount > 0 ? hitCount / sampleCount : 0,
          leftRecall: sampleCount > 0 ? leftHitCount / sampleCount : 0,
          rightRecall: sampleCount > 0 ? rightHitCount / sampleCount : 0,
          bothSideRecall:
            sampleCount > 0
              ? Math.min(leftHitCount, rightHitCount) / sampleCount
              : 0,
          maxConsecutiveHitRatio: sampleCount > 0 ? maxRun / sampleCount : 0
        }
      })
    const firstSegment = target.segments.find(
      (segment) => segment.start && segment.end
    )
    const lastSegment = [...target.segments]
      .reverse()
      .find((segment) => segment.start && segment.end)
    const implicitClosingEdge =
      firstSegment?.start && lastSegment?.end
        ? (() => {
            const authoredImageSegments = target.segments
              .filter((segment) => segment.start && segment.end)
              .map((segment) => ({
                start: toImagePoint(segment.start),
                end: toImagePoint(segment.end)
              }))
            const start = toImagePoint(lastSegment.end)
            const end = toImagePoint(firstSegment.start)
            const length = Math.hypot(end.x - start.x, end.y - start.y)
            const sampleCount = Math.max(18, Math.ceil(length / 10))
            let hitCount = 0
            let consideredCount = 0
            for (let index = 0; index < sampleCount; index += 1) {
              const t = (index + 0.5) / sampleCount
              const point = lerp(start, end, t)
              if (
                authoredImageSegments.some(
                  (segment) =>
                    distanceToLineSegment(point, segment.start, segment.end) < 24
                )
              ) {
                continue
              }
              consideredCount += 1
              const tangent = { x: end.x - start.x, y: end.y - start.y }
              if (hasRedNearSample(point, tangent)) {
                hitCount += 1
              }
            }
            return {
              hitCount,
              sampleCount: consideredCount,
              recall: consideredCount > 0 ? hitCount / consideredCount : 0
            }
          })()
        : null

    return {
      segments,
      minRecall:
        segments.length > 0
          ? Math.min(...segments.map((segment) => segment.recall))
          : 0,
      maxRecall:
        segments.length > 0
          ? Math.max(...segments.map((segment) => segment.recall))
          : 0,
      maxConsecutiveHitRatio:
        segments.length > 0
          ? Math.max(
              ...segments.map((segment) => segment.maxConsecutiveHitRatio)
            )
          : 0,
      maxBothSideRecall:
        segments.length > 0
          ? Math.max(...segments.map((segment) => segment.bothSideRecall))
          : 0,
      implicitClosingEdge
    }
  }, raster)

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
    const minimumVisualGapRatio = 0.6
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
    const lineIntersection = (
      a: { x: number; y: number },
      b: { x: number; y: number },
      c: { x: number; y: number },
      d: { x: number; y: number }
    ) => {
      const denominator =
        (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x)
      if (Math.abs(denominator) <= 1e-6) {
        return null
      }
      const t =
        ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) /
        denominator
      const u =
        ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) /
        denominator
      if (t <= 1e-5 || t >= 1 - 1e-5 || u <= 1e-5 || u >= 1 - 1e-5) {
        return null
      }
      return { t, u }
    }
    const isAdjacentClosedSegment = (
      leftIndex: number,
      rightIndex: number,
      segmentCount: number
    ) => {
      const distance = Math.abs(leftIndex - rightIndex)
      return distance === 1 || distance === segmentCount - 1
    }
    const uniqueSortedDistances = (distances: number[], totalLength: number) =>
      distances
        .filter(
          (distance) =>
            Number.isFinite(distance) &&
            distance >= -1e-5 &&
            distance <= totalLength + 1e-5
        )
        .map((distance) => Math.min(totalLength, Math.max(0, distance)))
        .sort((left, right) => left - right)
        .filter(
          (distance, index, sorted) =>
            index === 0 || Math.abs(distance - (sorted[index - 1] ?? 0)) > 1e-4
        )
    const getBestSplitRangeDashUnitCount = (
      rangeLength: number,
      referenceGapLength: number,
      minimumCenterlineGapLength = 0
    ) => {
      const epsilon = 1e-6
      if (rangeLength <= dashLength) {
        return 1
      }
      const maxDashUnitCountByDash = Math.max(
        1,
        Math.floor(rangeLength / dashLength)
      )
      const maxDashUnitCountByGap =
        minimumCenterlineGapLength > 0
          ? Math.max(
              1,
              Math.floor(
                rangeLength / (dashLength + minimumCenterlineGapLength) +
                  epsilon
              )
            )
          : maxDashUnitCountByDash
      const maxDashUnitCount = Math.min(
        maxDashUnitCountByDash,
        maxDashUnitCountByGap
      )
      if (!Number.isFinite(referenceGapLength) || referenceGapLength <= 0) {
        return maxDashUnitCount
      }
      const idealCount = rangeLength / (dashLength + referenceGapLength)
      return Math.max(
        1,
        Math.min(maxDashUnitCount, Math.floor(idealCount + 0.5 - epsilon))
      )
    }
    const getSplitRangeGapLength = (
      rangeLength: number,
      dashUnitCount: number
    ) =>
      dashUnitCount <= 0
        ? Number.POSITIVE_INFINITY
        : (rangeLength - dashUnitCount * dashLength) / dashUnitCount
    const getReferenceGapLength = (rangeLengths: number[]) => {
      const normalRangeMinLength = 2 * (dashLength + gapLength)
      const referenceGaps = rangeLengths
        .filter((rangeLength) => rangeLength >= normalRangeMinLength)
        .map((rangeLength) =>
          getSplitRangeGapLength(
            rangeLength,
            getBestSplitRangeDashUnitCount(rangeLength, gapLength)
          )
        )
        .filter((gap) => Number.isFinite(gap) && gap > 0)
        .sort((left, right) => left - right)
      return referenceGaps[Math.floor(referenceGaps.length / 2)] ?? gapLength
    }
    const allocateSplitRangeVisibleRanges = (
      rangeLength: number,
      referenceGapLength: number
    ) => {
      if (!Number.isFinite(rangeLength) || rangeLength <= 0) {
        return []
      }
      const minimumCenterlineGapLength =
        gapLength * minimumVisualGapRatio + strokeWidth * 2
      if (
        rangeLength <= dashLength ||
        rangeLength <= dashLength + minimumCenterlineGapLength
      ) {
        return [{ start: 0, end: rangeLength }]
      }
      const halfDashLength = dashLength / 2
      const dashUnitCount = getBestSplitRangeDashUnitCount(
        rangeLength,
        referenceGapLength,
        minimumCenterlineGapLength
      )
      const middleDashCount = Math.max(0, dashUnitCount - 1)
      const averageGapLength =
        (rangeLength - dashLength - middleDashCount * dashLength) /
        (middleDashCount + 1)
      return [
        { start: 0, end: halfDashLength },
        ...Array.from({ length: middleDashCount }, (_, middleIndex) => {
          const start =
            halfDashLength +
            averageGapLength * (middleIndex + 1) +
            dashLength * middleIndex
          return { start, end: start + dashLength }
        }),
        { start: rangeLength - halfDashLength, end: rangeLength }
      ]
    }
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

    const segmentModels = target.segments.map((segment) => {
      if (!segment.start || !segment.end) {
        return {
          id: segment.id,
          start: null,
          end: null,
          workspaceLength: 0,
          imageStart: { x: 0, y: 0 },
          imageDx: 0,
          imageDy: 0,
          imageLength: 0,
          normal: { x: 0, y: 0 },
          breakpoints: [0]
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
      return {
        id: segment.id,
        start: segment.start,
        end: segment.end,
        workspaceLength,
        imageStart: start,
        imageDx,
        imageDy,
        imageLength,
        normal,
        breakpoints: [0, workspaceLength]
      }
    })

    for (let leftIndex = 0; leftIndex < segmentModels.length; leftIndex += 1) {
      const left = segmentModels[leftIndex]
      if (!left?.start || !left.end || left.workspaceLength <= 0) {
        continue
      }
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < segmentModels.length;
        rightIndex += 1
      ) {
        const right = segmentModels[rightIndex]
        if (
          !right?.start ||
          !right.end ||
          right.workspaceLength <= 0 ||
          isAdjacentClosedSegment(leftIndex, rightIndex, segmentModels.length)
        ) {
          continue
        }
        const intersection = lineIntersection(
          left.start,
          left.end,
          right.start,
          right.end
        )
        if (!intersection) {
          continue
        }
        left.breakpoints.push(intersection.t * left.workspaceLength)
        right.breakpoints.push(intersection.u * right.workspaceLength)
      }
    }

    const splitRanges = segmentModels.flatMap((segment, segmentIndex) => {
      const breakpoints = uniqueSortedDistances(
        segment.breakpoints,
        segment.workspaceLength
      )
      return breakpoints.slice(0, -1).flatMap((startDistance, index) => {
        const endDistance = breakpoints[index + 1] ?? startDistance
        const length = endDistance - startDistance
        if (length <= 1e-4) {
          return []
        }
        return [
          {
            segmentIndex,
            startDistance,
            endDistance,
            length
          }
        ]
      })
    })
    const referenceGapLength = getReferenceGapLength(
      splitRanges.map((range) => range.length)
    )

    const segmentCoverages = segmentModels.map((segment, segmentIndex) => {
      let coveredSamples = 0
      let expectedDashSamples = 0
      let sampleCount = 0
      const rangesForSegment = splitRanges.filter(
        (range) => range.segmentIndex === segmentIndex
      )
      rangesForSegment.forEach((range) => {
        const visibleRanges = allocateSplitRangeVisibleRanges(
          range.length,
          referenceGapLength
        )
        visibleRanges.forEach((visibleRange) => {
          const intervalStart = range.startDistance + visibleRange.start
          const intervalEnd = range.startDistance + visibleRange.end
          const intervalLength = intervalEnd - intervalStart
          const localTransitionMargin = Math.min(
            transitionMargin,
            Math.max(0, intervalLength / 4)
          )
          for (
            let distance = intervalStart + localTransitionMargin;
            distance <= intervalEnd - localTransitionMargin;
            distance += sampleStep
          ) {
            if (!segment.start || !segment.end || segment.workspaceLength <= 0) {
              continue
            }
            const t = distance / segment.workspaceLength
            const base = {
              x: segment.imageStart.x + segment.imageDx * t,
              y: segment.imageStart.y + segment.imageDy * t
            }
            let covered = false
            for (
              let offset = -strokeWidth;
              offset <= strokeWidth;
              offset += 2
            ) {
              if (
                isRedPixel(
                  base.x + segment.normal.x * offset,
                  base.y + segment.normal.y * offset
                )
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
        })
      })
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
      referenceGapLength,
      splitRangeCount: splitRanges.length,
      segmentCoverages,
      coveredSegmentCount: segmentCoverages.filter(
        (segment) => segment.coveredSamples > 0
      ).length
    }
  }, raster)

const analyzeReportedInsideDashedSegmentCoverage = async (
  page: Page,
  raster: Awaited<ReturnType<typeof captureSelectedVectorFullRaster>>
) =>
  page.evaluate(async ({ base64, target, clipX, clipY, zoom, viewport }) => {
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
      return alpha > 96 && red > 80 && red > green + 35 && red > blue + 35
    }
    const toImagePoint = (point: { x: number; y: number }) => ({
      x: point.x * zoom + viewport.x - clipX,
      y: point.y * zoom + viewport.y - clipY
    })
    const cubicPoint = (
      start: { x: number; y: number },
      outControl: { x: number; y: number },
      inControl: { x: number; y: number },
      end: { x: number; y: number },
      t: number
    ) => {
      const mt = 1 - t
      return {
        x:
          mt * mt * mt * start.x +
          3 * mt * mt * t * outControl.x +
          3 * mt * t * t * inControl.x +
          t * t * t * end.x,
        y:
          mt * mt * mt * start.y +
          3 * mt * mt * t * outControl.y +
          3 * mt * t * t * inControl.y +
          t * t * t * end.y
      }
    }
    const samplePathPoint = (segment: (typeof target.segments)[number], t: number) => {
      if (!segment.start || !segment.end) {
        return null
      }
      if (segment.outControl && segment.inControl) {
        return cubicPoint(
          segment.start,
          segment.outControl,
          segment.inControl,
          segment.end,
          t
        )
      }
      return {
        x: segment.start.x + (segment.end.x - segment.start.x) * t,
        y: segment.start.y + (segment.end.y - segment.start.y) * t
      }
    }
    const hasRedNearPoint = (point: { x: number; y: number }) => {
      const imagePoint = toImagePoint(point)
      const searchRadius = Math.max(8, 13 * zoom)
      for (let y = -searchRadius; y <= searchRadius; y += 2) {
        for (let x = -searchRadius; x <= searchRadius; x += 2) {
          if (isRedPixel(imagePoint.x + x, imagePoint.y + y)) {
            return true
          }
        }
      }
      return false
    }

    let totalRedPixels = 0
    for (let index = 0; index < image.length; index += 4) {
      const red = image[index] ?? 0
      const green = image[index + 1] ?? 0
      const blue = image[index + 2] ?? 0
      const alpha = image[index + 3] ?? 0
      if (alpha > 96 && red > 80 && red > green + 35 && red > blue + 35) {
        totalRedPixels += 1
      }
    }

    const segmentCoverages = target.segments.map((segment) => {
      let coveredSamples = 0
      let sampleCount = 0
      for (let index = 0; index <= 30; index += 1) {
        const t = index / 30
        if (t < 0.04 || t > 0.96) {
          continue
        }
        const point = samplePathPoint(segment, t)
        if (!point) {
          continue
        }
        sampleCount += 1
        if (hasRedNearPoint(point)) {
          coveredSamples += 1
        }
      }
      return {
        id: segment.id,
        coveredSamples,
        sampleCount,
        recall: sampleCount === 0 ? 0 : coveredSamples / sampleCount
      }
    })

    return {
      totalRedPixels,
      segmentCoverages,
      coveredSegmentCount: segmentCoverages.filter(
        (segment) => segment.coveredSamples > 0
      ).length,
      worstSegmentRecall: Math.min(
        ...segmentCoverages.map((segment) => segment.recall)
      ),
      averageSegmentRecall:
        segmentCoverages.reduce((sum, segment) => sum + segment.recall, 0) /
        Math.max(1, segmentCoverages.length)
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
            constrainedDashedProductNetworkIds:
              renderElement.__asyraConstrainedDashedProductNetworkIds ?? null,
            constrainedDashedRuntimeDiagnostics:
              renderElement.__asyraConstrainedDashedRuntimeDiagnostics ?? null,
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

  test('renders open center dashed networks with endpoint half dashes and cap-aware gaps', async ({
    page
  }, testInfo) => {
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elementApis = (window as any).__AsyraE2E__?.elementApis
      if (!core || !elementApis) {
        throw new Error('Missing E2E core or element APIs')
      }

      const points = {
        lineA: {
          id: 'lineA',
          kind: 'anchor',
          anchorType: 'sharp',
          x: 180,
          y: 140
        },
        lineB: {
          id: 'lineB',
          kind: 'anchor',
          anchorType: 'sharp',
          x: 270,
          y: 140
        },
        polyA: {
          id: 'polyA',
          kind: 'anchor',
          anchorType: 'sharp',
          x: 320,
          y: 140
        },
        polyB: {
          id: 'polyB',
          kind: 'anchor',
          anchorType: 'sharp',
          x: 365,
          y: 140
        },
        polyC: {
          id: 'polyC',
          kind: 'anchor',
          anchorType: 'sharp',
          x: 365,
          y: 185
        },
        curveA: {
          id: 'curveA',
          kind: 'anchor',
          anchorType: 'smooth',
          x: 420,
          y: 140
        },
        'curveA:out': {
          id: 'curveA:out',
          kind: 'control',
          controlForId: 'curveA',
          controlRole: 'out',
          x: 450,
          y: 90
        },
        curveB: {
          id: 'curveB',
          kind: 'anchor',
          anchorType: 'smooth',
          x: 510,
          y: 185
        },
        'curveB:in': {
          id: 'curveB:in',
          kind: 'control',
          controlForId: 'curveB',
          controlRole: 'in',
          x: 480,
          y: 235
        },
        shortA: {
          id: 'shortA',
          kind: 'anchor',
          anchorType: 'sharp',
          x: 180,
          y: 260
        },
        shortB: {
          id: 'shortB',
          kind: 'anchor',
          anchorType: 'sharp',
          x: 205,
          y: 260
        }
      }
      const segments = {
        lineS: {
          id: 'lineS',
          startId: 'lineA',
          endId: 'lineB',
          outControlId: null,
          inControlId: null
        },
        polyS0: {
          id: 'polyS0',
          startId: 'polyA',
          endId: 'polyB',
          outControlId: null,
          inControlId: null
        },
        polyS1: {
          id: 'polyS1',
          startId: 'polyB',
          endId: 'polyC',
          outControlId: null,
          inControlId: null
        },
        curveS: {
          id: 'curveS',
          startId: 'curveA',
          endId: 'curveB',
          outControlId: 'curveA:out',
          inControlId: 'curveB:in'
        },
        shortS: {
          id: 'shortS',
          startId: 'shortA',
          endId: 'shortB',
          outControlId: null,
          inControlId: null
        }
      }
      const networks = {
        lineN: {
          id: 'lineN',
          pointIds: ['lineA', 'lineB'],
          segmentIds: ['lineS'],
          closed: false
        },
        polyN: {
          id: 'polyN',
          pointIds: ['polyA', 'polyB', 'polyC'],
          segmentIds: ['polyS0', 'polyS1'],
          closed: false
        },
        curveN: {
          id: 'curveN',
          pointIds: ['curveA', 'curveB'],
          segmentIds: ['curveS'],
          closed: false
        },
        shortN: {
          id: 'shortN',
          pointIds: ['shortA', 'shortB'],
          segmentIds: ['shortS'],
          closed: false
        }
      }
      const createdId = elementApis.createElement(
        {
          type: 'vector',
          points,
          segments,
          networks,
          closed: false,
          pointCoordinateSpace: 'workspace',
          fills: []
        },
        { undoable: false }
      )
      if (!createdId) {
        throw new Error('Failed to create open dashed vector')
      }
      elementApis.changeComputedData(
        [createdId],
        {
          fills: [],
          strokes: [
            {
              id: 'open-center-dashed-network-stroke',
              kind: 'solid',
              style: 'dashed',
              position: 'center',
              width: 8,
              dashPattern: [20, 10],
              dashOffset: 0,
              fill: null,
              defaultColorFormat: 'hex',
              colorFormat: 'hex',
              color: '#df0606',
              opacity: 0.95,
              visible: true,
              gradient: null,
              joinType: 'round',
              capType: 'round',
              miterAngle: 28.96
            }
          ]
        },
        { undoable: false }
      )
      core.selectElements?.([createdId], { undoable: false })
      core.setSystemProperty?.('pathEditingVectorId', createdId)
      core.setSystemProperty?.('pathEditingMode', true)
      core.setSystemProperty?.('zoom', 1)
      core.setSystemProperty?.('viewportPosition', { x: 90, y: 90 })
    })

    await page.waitForTimeout(400)
    const diagnostics = await readSelectedVectorDiagnostics(page)
    expect(diagnostics.computed?.networkCount).toBe(4)

    const raster = await captureSelectedElementRaster(page, 80)
    const stats = await analyzeRedStrokeRaster(page, raster.base64)
    expect(
      stats.strokeCoverage,
      `open center dashed multi-network red stroke coverage\n${JSON.stringify(
        { stats, raster: { ...raster, base64: '<omitted>' }, diagnostics },
        null,
        2
      )}`
    ).toBeGreaterThan(0.008)
    expect(
      stats.visualSignal,
      `open center dashed multi-network red stroke signal\n${JSON.stringify(
        { stats, diagnostics },
        null,
        2
      )}`
    ).toBeGreaterThan(1.5)
    const samples = await sampleRedStrokeAtWorkspacePoints(page, raster, [
      { x: 192, y: 140 },
      { x: 202, y: 140 },
      { x: 225, y: 140 },
      { x: 262, y: 140 }
    ])
    await testInfo.attach('open-center-dashed-network-half-terminal-review', {
      body: Buffer.from(raster.base64, 'base64'),
      contentType: 'image/png'
    })
    expect(samples.map((sample) => sample.covered)).toEqual([
      true,
      false,
      true,
      true
    ])
  })

  test('keeps open pentagram dashed stroke aligned after switching from solid', async ({
    page
  }, testInfo) => {
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elementApis = (window as any).__AsyraE2E__?.elementApis
      if (!core || !elementApis) {
        throw new Error('Missing E2E core or element APIs')
      }

      const center = { x: 360, y: 300 }
      const radius = 220
      const basePoints = Array.from({ length: 5 }, (_, index) => {
        const angle = -Math.PI / 2 + (Math.PI * 2 * index) / 5
        return {
          id: `open-p${index}`,
          kind: 'anchor',
          anchorType: 'smooth',
          x: center.x + Math.cos(angle) * radius,
          y: center.y + Math.sin(angle) * radius
        }
      })
      const order = [0, 2, 4, 1, 3]
      const pointIds = order.map((index) => basePoints[index]?.id ?? '')
      const points = Object.fromEntries(
        basePoints.map((point) => [point.id, point])
      )
      const segments = Object.fromEntries(
        pointIds.slice(0, -1).map((pointId, index) => {
          const nextPointId = pointIds[index + 1] ?? ''
          const start = points[pointId]
          const end = points[nextPointId]
          if (!start || !end) {
            throw new Error('Missing open pentagram endpoint')
          }
          const dx = end.x - start.x
          const dy = end.y - start.y
          const length = Math.hypot(dx, dy) || 1
          const normal = {
            x: -dy / length,
            y: dx / length
          }
          const bend = index % 2 === 0 ? 58 : -46
          const outControlId = `${pointId}:out:${index}`
          const inControlId = `${nextPointId}:in:${index}`
          points[outControlId] = {
            id: outControlId,
            kind: 'control',
            controlForId: pointId,
            controlRole: 'out',
            x: start.x + dx * 0.34 + normal.x * bend,
            y: start.y + dy * 0.34 + normal.y * bend
          }
          points[inControlId] = {
            id: inControlId,
            kind: 'control',
            controlForId: nextPointId,
            controlRole: 'in',
            x: end.x - dx * 0.34 + normal.x * bend,
            y: end.y - dy * 0.34 + normal.y * bend
          }
          return [
            `open-s${index}`,
            {
              id: `open-s${index}`,
              startId: pointId,
              endId: nextPointId,
              outControlId,
              inControlId
            }
          ]
        })
      )
      const networks = {
        openStar: {
          id: 'openStar',
          pointIds,
          segmentIds: pointIds.slice(0, -1).map((_, index) => `open-s${index}`),
          closed: false
        }
      }
      const createdId = elementApis.createElement(
        {
          type: 'vector',
          points,
          segments,
          networks,
          closed: false,
          pointCoordinateSpace: 'workspace',
          fills: []
        },
        { undoable: false }
      )
      if (!createdId) {
        throw new Error('Failed to create open pentagram vector')
      }
      core.selectElements?.([createdId], { undoable: false })
      core.setSystemProperty?.('pathEditingMode', false)
      core.setSystemProperty?.('pathEditingVectorId', null)
      core.setSystemProperty?.('zoom', 1)
      core.setSystemProperty?.('viewportPosition', { x: 110, y: 80 })
    })

    await expect(page.getByTestId('prop-stroke-width-0')).toBeVisible()
    await page.getByTestId('prop-stroke-width-0').fill('10')
    await page.getByTestId('prop-stroke-width-0').press('Enter')
    await expect(page.getByTestId('prop-stroke-width-0')).toHaveValue('10')
    await page.getByTestId('prop-stroke-style-0').selectOption('dashed')
    await page.getByTestId('prop-stroke-dash-0').fill('27')
    await page.getByTestId('prop-stroke-dash-0').press('Enter')
    await page.getByTestId('prop-stroke-gap-0').fill('20')
    await page.getByTestId('prop-stroke-gap-0').press('Enter')
    await page.waitForTimeout(400)
    const pageScreenshot = await page.screenshot({
      path: testInfo.outputPath('open-pentagram-dashed-switch-page.png'),
      fullPage: true
    })
    await testInfo.attach('open-pentagram-dashed-switch-page', {
      body: pageScreenshot,
      contentType: 'image/png'
    })
    const alignmentStats = await analyzeSelectedBrightStrokeAlignmentRaster(
      page,
      pageScreenshot.toString('base64')
    )
    const raster = await captureSelectedElementRaster(page, 96)
    await testInfo.attach('open-pentagram-dashed-switch-crop', {
      body: Buffer.from(raster.base64, 'base64'),
      contentType: 'image/png'
    })
    const runtimeSnapshot = await page.evaluate(() => {
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
      const exportPackets = Array.isArray(
        renderElement?.__asyraSolidCenterStrokeExportPackets
      )
        ? renderElement.__asyraSolidCenterStrokeExportPackets
        : []
      const exportPacketSummary = exportPackets.slice(0, 8).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (packet: any) => ({
          bounds: packet.bounds ?? null,
          geometryFamily: packet.debugMeta?.geometryFamily ?? null,
          networkId: packet.debugMeta?.networkId ?? null,
          sourceTopology: packet.debugMeta?.sourceTopology ?? null,
          strokePosition: packet.debugMeta?.strokePosition ?? null
        })
      )
      const exportPacketBounds = exportPackets.reduce(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (bounds: any, packet: any) => {
          const packetBounds = packet.bounds
          if (!packetBounds) {
            return bounds
          }
          return {
            minX: Math.min(bounds.minX, packetBounds.minX),
            minY: Math.min(bounds.minY, packetBounds.minY),
            maxX: Math.max(bounds.maxX, packetBounds.maxX),
            maxY: Math.max(bounds.maxY, packetBounds.maxY)
          }
        },
        {
          minX: Number.POSITIVE_INFINITY,
          minY: Number.POSITIVE_INFINITY,
          maxX: Number.NEGATIVE_INFINITY,
          maxY: Number.NEGATIVE_INFINITY
        }
      )
      const extremeExportPackets = exportPackets
        .filter(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (packet: any) =>
            packet.bounds?.minX < -4 ||
            packet.bounds?.minY < -4 ||
            packet.bounds?.maxX > (computed?.width ?? 0) + 4 ||
            packet.bounds?.maxY > (computed?.height ?? 0) + 4
        )
        .slice(0, 8)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((packet: any) => ({
          bounds: packet.bounds ?? null,
          geometryId: packet.geometryId ?? null,
          debugMeta: packet.debugMeta ?? null
        }))
      const meshCacheEntries = Array.from(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (renderElement?.__asyraStrokeMeshCache as Map<string, any> | undefined)
          ?.entries?.() ?? []
      ).map(([key, entry]) => ({
        key,
        kind: entry?.kind ?? null,
        signature: entry?.signature ?? null,
        paintKey: entry?.paintKey ?? null,
        lastDirtyKeys: entry?.lastDirtyKeys ?? null
      }))
      const anchors = Object.values(computed?.points ?? {}).filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (point: any) => point?.kind === 'anchor'
      ) as { id: string; x: number; y: number }[]
      const anchorBounds = anchors.reduce(
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
      return {
        selectedId,
        computed: computed
          ? {
              x: computed.x,
              y: computed.y,
              width: computed.width,
              height: computed.height,
              pointCoordinateSpace: computed.pointCoordinateSpace,
              anchorBounds,
              anchors,
              strokes: computed.strokes
            }
          : null,
        render: {
          x: renderElement?.x ?? null,
          y: renderElement?.y ?? null,
          exportPacketCount: exportPackets.length,
          exportPacketBounds,
          exportPacketSummary,
          extremeExportPackets,
          meshCacheEntries
        }
      }
    })
    await testInfo.attach('open-pentagram-dashed-switch-alignment-review', {
      body: Buffer.from(raster.base64, 'base64'),
      contentType: 'image/png'
    })
    expect(
      alignmentStats.blueBounds,
      `open pentagram dashed switch missing selected bounds\n${JSON.stringify(
        { alignmentStats, runtimeSnapshot },
        null,
        2
      )}`
    ).not.toBeNull()
    expect(
      alignmentStats.strokeBounds,
      `open pentagram dashed stroke missing after solid-to-dashed switch\n${JSON.stringify(
        {
          alignmentStats,
          raster: { ...raster, base64: '<omitted>' },
          runtimeSnapshot
        },
        null,
        2
      )}`
    ).not.toBeNull()
    if (!alignmentStats.blueBounds || !alignmentStats.strokeBounds) {
      return
    }
    const tolerance = 48
    expect(
      alignmentStats.strokeBounds.x,
      `open pentagram dashed stroke shifted left\n${JSON.stringify(
        { alignmentStats, runtimeSnapshot },
        null,
        2
      )}`
    ).toBeGreaterThanOrEqual(alignmentStats.blueBounds.x - tolerance)
    expect(
      alignmentStats.strokeBounds.y,
      `open pentagram dashed stroke shifted above\n${JSON.stringify(
        { alignmentStats, runtimeSnapshot },
        null,
        2
      )}`
    ).toBeGreaterThanOrEqual(alignmentStats.blueBounds.y - tolerance)
    expect(
      alignmentStats.strokeBounds.x + alignmentStats.strokeBounds.width,
      `open pentagram dashed stroke shifted right\n${JSON.stringify(
        { alignmentStats, runtimeSnapshot },
        null,
        2
      )}`
    ).toBeLessThanOrEqual(
      alignmentStats.blueBounds.x + alignmentStats.blueBounds.width + tolerance
    )
    expect(
      alignmentStats.strokeBounds.y + alignmentStats.strokeBounds.height,
      `open pentagram dashed stroke shifted below\n${JSON.stringify(
        { alignmentStats, runtimeSnapshot },
        null,
        2
      )}`
    ).toBeLessThanOrEqual(
      alignmentStats.blueBounds.y + alignmentStats.blueBounds.height + tolerance
    )
  })

  test('repairs reported open dashed vector bounds when switching stroke style', async ({
    page
  }, testInfo) => {
    await page.evaluate((data) => {
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
          points: data.points,
          segments: data.segments,
          networks: data.networks,
          closed: false,
          pointCoordinateSpace: 'workspace',
          fills: []
        },
        { undoable: false }
      )
      if (!createdId) {
        throw new Error('Failed to create reported open dashed vector')
      }

      elementApis.changeComputedData(
        [createdId],
        {
          x: data.x,
          y: data.y,
          width: data.width,
          height: data.height,
          points: data.points,
          segments: data.segments,
          networks: data.networks,
          closed: data.closed,
          pointCoordinateSpace: data.pointCoordinateSpace,
          fills: data.fills,
          strokes: data.strokes
        },
        { undoable: false }
      )
      core.selectElements?.([createdId], { undoable: false })
      core.setSystemProperty?.('pathEditingMode', false)
      core.setSystemProperty?.('pathEditingVectorId', null)
      core.setSystemProperty?.('zoom', 0.9)
      core.setSystemProperty?.('viewportPosition', { x: 30, y: 180 })
    }, createReportedVector12OpenDashedSwitchData())

    await expect(page.getByTestId('prop-stroke-style-0')).toBeVisible()
    await page.getByTestId('prop-stroke-style-0').selectOption('dashed')
    await page.waitForTimeout(400)

    const pageScreenshot = await page.screenshot({
      path: testInfo.outputPath('reported-open-dashed-switch-page.png'),
      fullPage: true
    })
    await testInfo.attach('reported-open-dashed-switch-page', {
      body: pageScreenshot,
      contentType: 'image/png'
    })
    const alignmentStats = await analyzeSelectedBrightStrokeAlignmentRaster(
      page,
      pageScreenshot.toString('base64')
    )
    const runtimeSnapshot = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const selectedId =
        core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
      const computed = selectedId
        ? core?.deps?.sceneTree
            ?.getElementById?.(selectedId)
            ?.getAllComputedData?.()
        : null
      const anchors = Object.values(computed?.points ?? {}).filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (point: any) => point?.kind === 'anchor'
      ) as { id: string; x: number; y: number }[]
      const anchorBounds = anchors.reduce(
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
      return {
        selectedId,
        computed: computed
          ? {
              x: computed.x,
              y: computed.y,
              width: computed.width,
              height: computed.height,
              pointCoordinateSpace: computed.pointCoordinateSpace,
              anchorBounds,
              strokes: computed.strokes
            }
          : null
      }
    })

    expect(
      runtimeSnapshot.computed,
      `reported open dashed vector missing computed data\n${JSON.stringify(
        { runtimeSnapshot, alignmentStats },
        null,
        2
      )}`
    ).not.toBeNull()
    if (!runtimeSnapshot.computed) {
      return
    }

    const computedBottom =
      runtimeSnapshot.computed.y + runtimeSnapshot.computed.height
    expect(
      runtimeSnapshot.computed.y,
      `reported open dashed vector bounds top does not cover anchors\n${JSON.stringify(
        { runtimeSnapshot, alignmentStats },
        null,
        2
      )}`
    ).toBeLessThanOrEqual(runtimeSnapshot.computed.anchorBounds.minY + 1)
    expect(
      computedBottom,
      `reported open dashed vector bounds bottom does not cover anchors\n${JSON.stringify(
        { runtimeSnapshot, alignmentStats },
        null,
        2
      )}`
    ).toBeGreaterThanOrEqual(runtimeSnapshot.computed.anchorBounds.maxY - 1)

    expect(
      alignmentStats.blueBounds,
      `reported open dashed switch missing selected bounds\n${JSON.stringify(
        { runtimeSnapshot, alignmentStats },
        null,
        2
      )}`
    ).not.toBeNull()
    expect(
      alignmentStats.strokeBounds,
      `reported open dashed switch missing bright stroke\n${JSON.stringify(
        { runtimeSnapshot, alignmentStats },
        null,
        2
      )}`
    ).not.toBeNull()
    if (!alignmentStats.blueBounds || !alignmentStats.strokeBounds) {
      return
    }
    const tolerance = 48
    expect(
      alignmentStats.strokeBounds.x,
      `reported open dashed stroke shifted left\n${JSON.stringify(
        { runtimeSnapshot, alignmentStats },
        null,
        2
      )}`
    ).toBeGreaterThanOrEqual(alignmentStats.blueBounds.x - tolerance)
    expect(
      alignmentStats.strokeBounds.y,
      `reported open dashed stroke shifted above\n${JSON.stringify(
        { runtimeSnapshot, alignmentStats },
        null,
        2
      )}`
    ).toBeGreaterThanOrEqual(alignmentStats.blueBounds.y - tolerance)
    expect(
      alignmentStats.strokeBounds.x + alignmentStats.strokeBounds.width,
      `reported open dashed stroke shifted right\n${JSON.stringify(
        { runtimeSnapshot, alignmentStats },
        null,
        2
      )}`
    ).toBeLessThanOrEqual(
      alignmentStats.blueBounds.x + alignmentStats.blueBounds.width + tolerance
    )
    expect(
      alignmentStats.strokeBounds.y + alignmentStats.strokeBounds.height,
      `reported open dashed stroke shifted below\n${JSON.stringify(
        { runtimeSnapshot, alignmentStats },
        null,
        2
      )}`
    ).toBeLessThanOrEqual(
      alignmentStats.blueBounds.y + alignmentStats.blueBounds.height + tolerance
    )
  })

  ;(['inside', 'outside'] as const).forEach((strokePosition) => {
    test(`renders open self-intersecting ${strokePosition} dashed stroke through constrained domain`, async ({
      page
    }, testInfo) => {
      await page.evaluate(
        ({ topology, strokePosition }) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const core = (window as any).__Core__
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const elementApis = (window as any).__AsyraE2E__?.elementApis
          if (!core || !elementApis) {
            throw new Error('Missing E2E core or element APIs')
          }

          const stroke = {
            id: `open-self-intersecting-${strokePosition}-stroke`,
            kind: 'solid',
            style: 'dashed',
            position: strokePosition,
            width: 10,
            dashPattern: [27, 20],
            dashOffset: 0,
            fill: null,
            defaultColorFormat: 'hex',
            colorFormat: 'hex',
            color: '#f40606',
            opacity: 1,
            visible: true,
            gradient: null,
            joinType: 'miter',
            capType: 'square',
            miterAngle: 28.96
          }
          const createdId = elementApis.createElement(
            {
              type: 'vector',
              points: topology.points,
              segments: topology.segments,
              networks: topology.networks,
              closed: false,
              pointCoordinateSpace: 'workspace',
              fills: [],
              strokes: [stroke]
            },
            { undoable: false }
          )
          if (!createdId) {
            throw new Error('Failed to create open self-intersecting vector')
          }

          elementApis.changeComputedData(
            [createdId],
            {
              x: topology.x,
              y: topology.y,
              width: topology.width,
              height: topology.height,
              points: topology.points,
              segments: topology.segments,
              networks: topology.networks,
              closed: false,
              pointCoordinateSpace: 'workspace',
              fills: [],
              strokes: [stroke]
            },
            { undoable: false }
          )
          core.selectElements?.([createdId], { undoable: false })
          core.setSystemProperty?.('pathEditingMode', true)
          core.setSystemProperty?.('pathEditingVectorId', createdId)
          core.setSystemProperty?.('zoom', 1)
          core.setSystemProperty?.('viewportPosition', { x: -120, y: 140 })
        },
        {
          topology: createOpenSelfIntersectingPentagramTopology(),
          strokePosition
        }
      )
      await page.waitForTimeout(300)

      const pageScreenshot = await page.screenshot({
        path: testInfo.outputPath(
          `open-self-intersecting-${strokePosition}-dashed-page.png`
        ),
        fullPage: true
      })
      await testInfo.attach(
        `open-self-intersecting-${strokePosition}-dashed-page`,
        {
          body: pageScreenshot,
          contentType: 'image/png'
        }
      )
      const raster = await captureSelectedVectorFullRaster(page, 96)
      await testInfo.attach(
        `open-self-intersecting-${strokePosition}-dashed`,
        {
          body: Buffer.from(raster.base64, 'base64'),
          contentType: 'image/png'
        }
      )
      const stats = await analyzeRedStrokeRaster(page, raster.base64)
      const segmentRecall = await analyzeOpenPathSegmentDashRecall(page, raster)
      const runtimeSnapshot = await page.evaluate((strokePosition) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const core = (window as any).__Core__
        const selectedId =
          core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
        const renderElement = selectedId
          ? core?.deps?.render?.getElementById?.(selectedId)
          : null
        const exportPackets =
          renderElement?.__asyraSolidCenterStrokeExportPackets ?? []
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const metas = exportPackets.map((packet: any) => packet.debugMeta)
        const renderFaceMetas =
          renderElement?.__asyraStrokeRenderFaceDebugMetas ?? []
        const allMetas = [...metas, ...renderFaceMetas]
        return {
          selectedId,
          constrainedDashedProductNetworkIds:
            renderElement?.__asyraConstrainedDashedProductNetworkIds ?? null,
          constrainedDashedRuntimeDiagnostics:
            renderElement?.__asyraConstrainedDashedRuntimeDiagnostics ?? null,
          renderFaceMetaCount: renderFaceMetas.length,
          matchingConstrainedPacketCount: allMetas.filter(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (meta: any) =>
              meta?.geometryFamily === 'constrained-dashed' &&
              meta?.strokePosition === strokePosition &&
              meta?.sourceTopology === 'self-intersecting'
          ).length,
          splitRangePacketCount: allMetas.filter(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (meta: any) => meta?.figmaLikeSplitRangeId !== undefined
          ).length,
          sourceSpanFallbackPacketCount: allMetas.filter(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (meta: any) =>
              typeof meta?.figmaLikeSplitRangeId === 'string' &&
              meta.figmaLikeSplitRangeId.startsWith('source-span-fallback:')
          ).length,
          sourceSpanFallbackMetas: allMetas
            .filter(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (meta: any) =>
                typeof meta?.figmaLikeSplitRangeId === 'string' &&
                meta.figmaLikeSplitRangeId.startsWith('source-span-fallback:')
            )
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((meta: any) => ({
              splitRangeId: meta.figmaLikeSplitRangeId,
              sourceSegmentIndex: meta.figmaLikeSplitRangeSourceSegmentIndex,
              selectedSide: meta.figmaLikeSelectedSide,
              boundaryRole: meta.figmaLikeBoundaryRole,
              sideResolutionReason: meta.figmaLikeSideResolutionReason
            })),
          splitRangeTerminalRoles: allMetas
            .filter(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (meta: any) =>
                meta?.geometryFamily === 'constrained-dashed' &&
                meta?.figmaLikeSplitRangeId !== undefined
            )
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((meta: any) => ({
              splitRangeId: meta.figmaLikeSplitRangeId,
              terminalRole: meta.figmaLikeTerminalRole
            })),
          sampleMetas: allMetas
            .filter(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (meta: any) => meta?.geometryFamily === 'constrained-dashed'
            )
            .slice(0, 8)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((meta: any) => ({
              keys: Object.keys(meta ?? {}).slice(0, 16),
              geometryFamily: meta?.geometryFamily,
              strokePosition: meta?.strokePosition,
              sourceTopology: meta?.sourceTopology,
              topologyFamily: meta?.topologyFamily,
              intervalId: meta?.intervalId,
              finalCoverageBuilderStatus: meta?.finalCoverageBuilderStatus,
              resolutionStatus: meta?.resolutionStatus,
              runtimeStatus: meta?.runtimeStatus,
              splitRangeId: meta?.figmaLikeSplitRangeId,
              sideReason: meta?.figmaLikeSideResolutionReason
            })),
          centerPacketCount: allMetas.filter(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (meta: any) => meta?.geometryFamily === 'dashed-center'
          ).length
        }
      }, strokePosition)

      expect(
        stats.strokeCoverage,
        `open self-intersecting ${strokePosition} dashed stroke missing raster output\n${JSON.stringify(
          { stats, runtimeSnapshot },
          null,
          2
        )}`
      ).toBeGreaterThan(0.015)
      expect(
        stats.connectedComponentCount,
        `open self-intersecting ${strokePosition} dashed stroke collapsed into too few visible dash components\n${JSON.stringify(
          { stats, runtimeSnapshot },
          null,
          2
        )}`
      ).toBeGreaterThan(6)
      expect(
        stats.largestComponentPixelRatio,
        `open self-intersecting ${strokePosition} dashed stroke has an oversized continuous component\n${JSON.stringify(
          { stats, segmentRecall, runtimeSnapshot },
          null,
          2
        )}`
      ).toBeLessThan(0.35)
      expect(
        segmentRecall.maxConsecutiveHitRatio,
        `open self-intersecting ${strokePosition} dashed stroke visually collapsed into a solid-like run\n${JSON.stringify(
          { stats, segmentRecall, runtimeSnapshot },
          null,
          2
        )}`
      ).toBeLessThan(0.72)
      expect(
        segmentRecall.implicitClosingEdge?.recall ?? 1,
        `open self-intersecting ${strokePosition} dashed stroke painted the invisible closing edge\n${JSON.stringify(
          { stats, segmentRecall, runtimeSnapshot },
          null,
          2
        )}`
      ).toBeLessThan(0.22)
      if (strokePosition === 'outside') {
        expect(
          segmentRecall.minRecall,
          `open self-intersecting outside dashed stroke is missing open branch or contour segment coverage\n${JSON.stringify(
            { stats, segmentRecall, runtimeSnapshot },
            null,
            2
          )}`
        ).toBeGreaterThan(0.18)
        expect(
          segmentRecall.maxBothSideRecall,
          `open self-intersecting outside dashed stroke never paints both sides of an open source branch\n${JSON.stringify(
            { stats, segmentRecall, runtimeSnapshot },
            null,
            2
          )}`
        ).toBeGreaterThan(0.18)
        expect(
          runtimeSnapshot.sourceSpanFallbackPacketCount,
          `open self-intersecting outside dashed stroke did not keep open source-span fallback metadata\n${JSON.stringify(
            { stats, segmentRecall, runtimeSnapshot },
            null,
            2
          )}`
        ).toBeGreaterThan(0)
        expect(
          runtimeSnapshot.sourceSpanFallbackMetas.every(
            (meta: {
              sourceSegmentIndex?: number
              selectedSide?: number
              boundaryRole?: string
              sideResolutionReason?: string
            }) =>
              meta.selectedSide === undefined &&
              meta.boundaryRole === 'ambiguous' &&
              meta.sideResolutionReason === 'open-source-span-both-sides'
          ),
          `open self-intersecting outside dashed source-span fallback must be both-side, not selected-side\n${JSON.stringify(
            { stats, segmentRecall, runtimeSnapshot },
            null,
            2
          )}`
        ).toBe(true)
        const fallbackSourceSegmentIndexes = new Set(
          runtimeSnapshot.sourceSpanFallbackMetas.map(
            (meta: { sourceSegmentIndex?: number }) => meta.sourceSegmentIndex
          )
        )
        expect(
          fallbackSourceSegmentIndexes.has(0),
          `open self-intersecting outside dashed stroke did not paint the first dangling open branch\n${JSON.stringify(
            { stats, segmentRecall, runtimeSnapshot },
            null,
            2
          )}`
        ).toBe(true)
        expect(
          fallbackSourceSegmentIndexes.has(3),
          `open self-intersecting outside dashed stroke did not paint the last dangling open branch\n${JSON.stringify(
            { stats, segmentRecall, runtimeSnapshot },
            null,
            2
          )}`
        ).toBe(true)
      } else {
        expect(
          segmentRecall.maxRecall,
          `open self-intersecting inside dashed stroke is missing contour-owned dash output\n${JSON.stringify(
            { stats, segmentRecall, runtimeSnapshot },
            null,
            2
          )}`
        ).toBeGreaterThan(0.18)
      }
      const hasConstrainedDescriptor =
        Array.isArray(runtimeSnapshot.constrainedDashedProductNetworkIds) &&
        runtimeSnapshot.constrainedDashedProductNetworkIds.includes('opn0')
      expect(
        hasConstrainedDescriptor ||
          runtimeSnapshot.matchingConstrainedPacketCount > 0,
        `open self-intersecting ${strokePosition} dashed stroke did not route through constrained dashed product output\n${JSON.stringify(
          { stats, segmentRecall, runtimeSnapshot },
          null,
          2
        )}`
      ).toBe(true)
      if (!hasConstrainedDescriptor) {
        expect(
          runtimeSnapshot.splitRangePacketCount,
          `open self-intersecting ${strokePosition} dashed stroke did not preserve split-range packet metadata\n${JSON.stringify(
            { stats, segmentRecall, runtimeSnapshot },
            null,
            2
          )}`
        ).toBeGreaterThan(0)
      }
      expect(
        runtimeSnapshot.splitRangeTerminalRoles.some(
          (record: { terminalRole?: string }) =>
            record.terminalRole === 'start' ||
            record.terminalRole === 'end' ||
            record.terminalRole === 'start-end'
        ),
        `open self-intersecting ${strokePosition} dashed stroke did not preserve per-range terminal half-dash metadata\n${JSON.stringify(
          { stats, segmentRecall, runtimeSnapshot },
          null,
          2
        )}`
      ).toBe(true)
      expect(
        runtimeSnapshot.centerPacketCount,
        `open self-intersecting ${strokePosition} dashed stroke should not emit center dashed packets\n${JSON.stringify(
          { stats, segmentRecall, runtimeSnapshot },
          null,
          2
        )}`
      ).toBe(0)
    })
  })

  test('clears stale inside dashed open-path cap render entries after cap switch and viewport pan', async ({
    page
  }, testInfo) => {
    await page.evaluate(({ topology }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elementApis = (window as any).__AsyraE2E__?.elementApis
      if (!core || !elementApis) {
        throw new Error('Missing E2E core or element APIs')
      }

      const stroke = {
        id: 'open-self-intersecting-inside-cap-switch-stroke',
        kind: 'solid',
        style: 'dashed',
        position: 'inside',
        width: 10,
        dashPattern: [27, 20],
        dashOffset: 0,
        fill: null,
        defaultColorFormat: 'hex',
        colorFormat: 'hex',
        color: '#cccccc',
        opacity: 1,
        visible: true,
        gradient: null,
        joinType: 'round',
        capType: 'square',
        miterAngle: 28.96
      }
      const createdId = elementApis.createElement(
        {
          type: 'vector',
          x: topology.x,
          y: topology.y,
          width: topology.width,
          height: topology.height,
          points: topology.points,
          segments: topology.segments,
          networks: topology.networks,
          closed: false,
          pointCoordinateSpace: 'workspace',
          fills: [],
          strokes: [stroke]
        },
        { undoable: false }
      )
      if (!createdId) {
        throw new Error('Failed to create open cap-switch vector')
      }

      elementApis.changeComputedData(
        [createdId],
        {
          x: topology.x,
          y: topology.y,
          width: topology.width,
          height: topology.height,
          points: topology.points,
          segments: topology.segments,
          networks: topology.networks,
          closed: false,
          pointCoordinateSpace: 'workspace',
          fills: [],
          strokes: [stroke]
        },
        { undoable: false }
      )
      core.selectElements?.([createdId], { undoable: false })
      core.setSystemProperty?.('pathEditingMode', true)
      core.setSystemProperty?.('pathEditingVectorId', createdId)
      core.setSystemProperty?.('zoom', 1)
      core.setSystemProperty?.('viewportPosition', { x: -80, y: 130 })
    }, { topology: createOpenSelfIntersectingPentagramTopology() })
    await page.waitForTimeout(250)

    const transitions = [
      {
        capType: 'round',
        viewportPosition: { x: 210, y: 80 },
        artifact: 'inside-open-cap-square-to-round-pan.png',
        expectCurrentStrokeVisible: true
      },
      {
        capType: 'square',
        viewportPosition: { x: -1100, y: 130 },
        artifact: 'inside-open-cap-round-to-square-pan.png',
        expectCurrentStrokeVisible: false
      }
    ] as const

    for (const transition of transitions) {
      await page.getByTestId('prop-stroke-cap-0').selectOption(transition.capType)
      const canvasBox = await page
        .locator('#viewport-anchor')
        .boundingBox()
      if (!canvasBox) {
        throw new Error('Missing viewport anchor for wheel pan regression')
      }
      await page.mouse.move(
        canvasBox.x + canvasBox.width / 2,
        canvasBox.y + canvasBox.height / 2
      )
      const startViewport = await page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const core = (window as any).__Core__
        return core?.getSystemProperty?.('viewportPosition') ?? { x: 0, y: 0 }
      })
      const targetDelta = {
        x: transition.viewportPosition.x - startViewport.x,
        y: transition.viewportPosition.y - startViewport.y
      }
      for (let frameIndex = 0; frameIndex < 12; frameIndex += 1) {
        await page.mouse.wheel(
          -targetDelta.x / 12,
          -targetDelta.y / 12
        )
        await page.waitForTimeout(16)
      }
      await page.waitForFunction(
        ({ expectedX, expectedY }) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const core = (window as any).__Core__
          const viewport = core?.getSystemProperty?.('viewportPosition') ?? {
            x: 0,
            y: 0
          }
          return (
            Math.abs(viewport.x - expectedX) < 2 &&
            Math.abs(viewport.y - expectedY) < 2
          )
        },
        {
          expectedX: transition.viewportPosition.x,
          expectedY: transition.viewportPosition.y
        }
      )
      await page.waitForTimeout(250)

      const screenshot = await page.screenshot({
        path: testInfo.outputPath(transition.artifact),
        fullPage: true
      })
      await testInfo.attach(transition.artifact, {
        body: screenshot,
        contentType: 'image/png'
      })
      const staleStats = await analyzeBrightStrokeOutsideCurrentVectorBounds(
        page,
        screenshot.toString('base64')
      )
      const runtimeSnapshot = await page.evaluate(() => {
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
        const meshCache = renderElement?.__asyraStrokeMeshCache
        const childCount = Array.isArray(renderElement?.children)
          ? renderElement.children.length
          : null
        return {
          selectedId,
          capType: computed?.strokes?.[0]?.capType ?? null,
          productNetworkIds:
            renderElement?.__asyraConstrainedDashedProductNetworkIds ?? null,
          renderFaceMetaCount:
            renderElement?.__asyraStrokeRenderFaceDebugMetas?.length ?? 0,
          exportPacketCount:
            renderElement?.__asyraSolidCenterStrokeExportPackets?.length ?? 0,
          strokeRenderCacheSize:
            meshCache instanceof Map ? meshCache.size : null,
          renderChildCount: childCount
        }
      })

      expect(runtimeSnapshot.capType).toBe(transition.capType)
      expect(
        runtimeSnapshot.strokeRenderCacheSize,
        `cap switch leaked stale stroke render cache entries\n${JSON.stringify(
          { transition, runtimeSnapshot },
          null,
          2
        )}`
      ).toBe(runtimeSnapshot.exportPacketCount)
      expect(
        runtimeSnapshot.renderChildCount,
        `cap switch leaked stale Pixi render children\n${JSON.stringify(
          { transition, runtimeSnapshot },
          null,
          2
        )}`
      ).toBe(runtimeSnapshot.strokeRenderCacheSize)
      if (transition.expectCurrentStrokeVisible) {
        expect(
          staleStats.strokePixels,
          `cap switch produced no current inside dashed stroke\n${JSON.stringify(
            { transition, staleStats, runtimeSnapshot },
            null,
            2
          )}`
        ).toBeGreaterThan(150)
      }
      expect(
        staleStats.outsideRatio,
        `cap switch left stale red stroke outside the current vector bounds after pan\n${JSON.stringify(
          { transition, staleStats, runtimeSnapshot },
          null,
          2
        )}`
      ).toBeLessThan(0.01)
    }
  })

  test('keeps reported inside dashed drag network visible across every segment', async ({
    page
  }, testInfo) => {
    await page.evaluate((data) => {
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
          x: -149.15769844220563,
          y: -102.47523386043028,
          width: 806.0277134173791,
          height: 507.298249032066,
          points: data.points,
          segments: data.segments,
          networks: data.networks,
          closed: true,
          pointCoordinateSpace: 'workspace',
          fills: []
        },
        { undoable: false }
      )
      if (!createdId) {
        throw new Error('Failed to create reported inside dashed vector')
      }

      elementApis.changeComputedData(
        [createdId],
        {
          fills: [],
          strokes: [
            {
              id: 'reported-vector-10-inside-dashed-stroke',
              kind: 'solid',
              style: 'dashed',
              position: 'inside',
              width: 10,
              dashPattern: [27, 20],
              dashOffset: 0,
              fill: null,
              defaultColorFormat: 'hex',
              colorFormat: 'hex',
              color: '#f40606',
              opacity: 0.5,
              visible: true,
              gradient: null,
              joinType: 'round',
              capType: 'round',
              miterAngle: 28.96
            }
          ]
        },
        { undoable: false }
      )
      core.selectElements?.([createdId], { undoable: false })
      core.setSystemProperty?.('pathEditingVectorId', createdId)
      core.setSystemProperty?.('pathEditingMode', true)
      core.setSystemProperty?.('mouseDown', true)
      core.setSystemProperty?.('mouseDragging', true)
      core.setSystemProperty?.('zoom', 0.9)
      core.setSystemProperty?.('viewportPosition', { x: 220, y: 170 })
    }, createReportedVector10InsideDashedDragData())

    await page.waitForTimeout(500)

    const raster = await captureSelectedVectorFullRaster(page)
    await testInfo.attach('reported-vector-10-inside-dashed-drag', {
      body: Buffer.from(raster.base64, 'base64'),
      contentType: 'image/png'
    })
    const coverage = await analyzeReportedInsideDashedSegmentCoverage(
      page,
      raster
    )
    const diagnostics = await readSelectedVectorDiagnostics(page)
    expect(
      coverage.totalRedPixels,
      JSON.stringify(
        { coverage, diagnostics, raster: { ...raster, base64: '<omitted>' } },
        null,
        2
      )
    ).toBeGreaterThan(500)
    expect(
      coverage.coveredSegmentCount,
      JSON.stringify(
        { coverage, diagnostics, raster: { ...raster, base64: '<omitted>' } },
        null,
        2
      )
    ).toBe(5)
    expect(
      coverage.worstSegmentRecall,
      JSON.stringify(
        { coverage, diagnostics, raster: { ...raster, base64: '<omitted>' } },
        null,
        2
      )
    ).toBeGreaterThanOrEqual(0.12)
    expect(
      coverage.averageSegmentRecall,
      JSON.stringify(
        { coverage, diagnostics, raster: { ...raster, base64: '<omitted>' } },
        null,
        2
      )
    ).toBeGreaterThanOrEqual(0.25)
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
