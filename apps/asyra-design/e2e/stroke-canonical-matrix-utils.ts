import { expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import {
  ARTIFACT_DIR,
  SELF_CHECK_SOURCE_SEGMENTS,
  SELF_CHECK_SOURCE_POINTS,
  SELF_CHECK_VECTOR_RECT,
  analyzeSelfCheckScreenshots,
  cubicPoint,
  createSelfCheckStar,
  getSelfCheckSegmentSamplePoint,
  getSelfCheckMetadata,
  lerpPoint,
  resetCanvas,
  waitForAppReady
} from './stroke-self-check-star-fixture'
import type {
  SelfCheckCapType,
  SelfCheckJoinType,
  SelfCheckStrokePosition,
  SelfCheckStrokeStyle,
  Vec2
} from './stroke-self-check-star-fixture'

export const CANONICAL_STROKE_POSITIONS = [
  'inside',
  'center',
  'outside'
] as const satisfies readonly SelfCheckStrokePosition[]
export const CANONICAL_SOLID_JOINS = [
  'miter',
  'bevel',
  'round'
] as const satisfies readonly SelfCheckJoinType[]
export const CANONICAL_DASHED_CAPS = [
  'butt',
  'square',
  'round'
] as const satisfies readonly SelfCheckCapType[]

export const CANONICAL_SOLID_MATRIX_CASES = CANONICAL_STROKE_POSITIONS.flatMap(
  (position) =>
    CANONICAL_SOLID_JOINS.map((joinType) => ({
      key: `solid-${position}-${joinType}`,
      position,
      joinType
    }))
)

export const CANONICAL_DASHED_MATRIX_CASES = CANONICAL_STROKE_POSITIONS.flatMap(
  (position) =>
    CANONICAL_DASHED_CAPS.map((capType) => ({
      key: `dashed-${position}-${capType}`,
      position,
      capType
    }))
)

export const CANONICAL_MATRIX_ARTIFACT_DIR = path.join(
  ARTIFACT_DIR,
  'canonical-stroke-matrix'
)

export const getCanonicalCasePaths = (
  style: SelfCheckStrokeStyle,
  key: string
) => {
  const caseDir = path.join(CANONICAL_MATRIX_ARTIFACT_DIR, style, key)
  return {
    caseDir,
    cropDir: path.join(caseDir, 'crops'),
    baselineScreenshot: path.join(caseDir, 'baseline-fill.png'),
    screenshot: path.join(caseDir, 'full.png'),
    metadata: path.join(caseDir, 'metadata.json'),
    analysis: path.join(caseDir, 'analysis.json'),
    ruleOverlay: path.join(caseDir, 'rule-overlay.png'),
    ruleOverlayMetrics: path.join(caseDir, 'rule-overlay-metrics.json')
  }
}

export const waitForSelfCheckStroke = async (page: Page) => {
  await page.waitForFunction(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId =
      core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
    const element = selectedId
      ? core?.deps?.sceneTree?.getElementById?.(selectedId)
      : null
    const computed = element?.getAllComputedData?.()
    return Boolean(computed?.strokes?.length)
  })
}

export const prepareSelfCheckCase = async (
  page: Page,
  options: {
    style: SelfCheckStrokeStyle
    position: SelfCheckStrokePosition
    capType: SelfCheckCapType
    joinType: SelfCheckJoinType
    sourceKind?: 'curved' | 'polyline'
  }
) => {
  await createSelfCheckStar(page, {
    includeStroke: false,
    capType: options.capType,
    joinType: options.joinType,
    position: options.position,
    sourceKind: options.sourceKind,
    style: options.style
  })
  await page.waitForFunction(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId =
      core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
    const element = selectedId
      ? core?.deps?.sceneTree?.getElementById?.(selectedId)
      : null
    return Boolean(element?.getAllComputedData?.()?.fills?.length)
  })
  await page.waitForTimeout(200)
  const baselineScreenshot = await page.screenshot({ fullPage: false })

  await resetCanvas(page)
  await createSelfCheckStar(page, options)
  await waitForSelfCheckStroke(page)
  await page.waitForTimeout(500)

  return {
    baselineScreenshot,
    metadata: await getSelfCheckMetadata(page),
    screenshot: await page.screenshot({ fullPage: false })
  }
}

export const prepareSelfCheckNoFillCase = async (
  page: Page,
  options: {
    style: SelfCheckStrokeStyle
    position: SelfCheckStrokePosition
    capType: SelfCheckCapType
    joinType: SelfCheckJoinType
    sourceKind?: 'curved' | 'polyline'
  }
) => {
  await createSelfCheckStar(page, {
    includeStroke: false,
    capType: options.capType,
    joinType: options.joinType,
    position: options.position,
    sourceKind: options.sourceKind,
    style: options.style
  })
  await page.waitForFunction(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId =
      core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
    const element = selectedId
      ? core?.deps?.sceneTree?.getElementById?.(selectedId)
      : null
    return Boolean(element?.getAllComputedData?.()?.fills?.length)
  })
  await page.waitForTimeout(200)
  const baselineScreenshot = await page.screenshot({ fullPage: false })

  await resetCanvas(page)
  await createSelfCheckStar(page, {
    ...options,
    includeFill: false
  })
  await waitForSelfCheckStroke(page)
  await page.waitForTimeout(500)

  return {
    baselineScreenshot,
    metadata: await getSelfCheckMetadata(page),
    screenshot: await page.screenshot({ fullPage: false })
  }
}

const readPixelData = async (page: Page, image: Buffer) =>
  page.evaluate(
    async (dataUrl) => {
      const imageElement = new Image()
      await new Promise<void>((resolve, reject) => {
        imageElement.onload = () => resolve()
        imageElement.onerror = () => reject(new Error('Failed to decode PNG'))
        imageElement.src = dataUrl
      })
      const canvas = document.createElement('canvas')
      canvas.width = imageElement.naturalWidth
      canvas.height = imageElement.naturalHeight
      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('Missing canvas 2D context')
      }
      context.drawImage(imageElement, 0, 0)
      return Array.from(
        context.getImageData(0, 0, canvas.width, canvas.height).data
      )
    },
    `data:image/png;base64,${image.toString('base64')}`
  )

const readImagePixelData = async (page: Page, image: Buffer) =>
  page.evaluate(
    async (dataUrl) => {
      const imageElement = new Image()
      await new Promise<void>((resolve, reject) => {
        imageElement.onload = () => resolve()
        imageElement.onerror = () => reject(new Error('Failed to decode PNG'))
        imageElement.src = dataUrl
      })
      const canvas = document.createElement('canvas')
      canvas.width = imageElement.naturalWidth
      canvas.height = imageElement.naturalHeight
      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('Missing canvas 2D context')
      }
      context.drawImage(imageElement, 0, 0)
      return {
        width: canvas.width,
        height: canvas.height,
        pixels: Array.from(
          context.getImageData(0, 0, canvas.width, canvas.height).data
        )
      }
    },
    `data:image/png;base64,${image.toString('base64')}`
  )

export const analyzeScreenshotPair = async (
  page: Page,
  baseline: Buffer,
  actual: Buffer
) => {
  const [baselinePixels, actualPixels] = await Promise.all([
    readPixelData(page, baseline),
    readPixelData(page, actual)
  ])
  let changedPixelCount = 0
  let redPixelCount = 0
  let darkOverdrawPixelCount = 0
  for (
    let offset = 0;
    offset < Math.min(baselinePixels.length, actualPixels.length);
    offset += 4
  ) {
    const baseR = baselinePixels[offset] ?? 0
    const baseG = baselinePixels[offset + 1] ?? 0
    const baseB = baselinePixels[offset + 2] ?? 0
    const red = actualPixels[offset] ?? 0
    const green = actualPixels[offset + 1] ?? 0
    const blue = actualPixels[offset + 2] ?? 0
    const delta =
      Math.abs(red - baseR) + Math.abs(green - baseG) + Math.abs(blue - baseB)
    if (delta > 32) {
      changedPixelCount += 1
    }
    if (red > 80 && red > green * 1.5 && red > blue * 1.5) {
      redPixelCount += 1
    }
    const isRedStroke = red > 80 && red > green * 1.5 && red > blue * 1.5
    if (
      delta > 32 &&
      !isRedStroke &&
      red + green + blue < 36 &&
      baseR + baseG + baseB > 120
    ) {
      darkOverdrawPixelCount += 1
    }
  }
  return {
    changedPixelCount,
    redPixelCount,
    darkOverdrawPixelCount
  }
}

export const analyzeSingleScreenshot = async (page: Page, image: Buffer) => {
  const pixels = await readPixelData(page, image)
  let redPixelCount = 0
  let nonBackgroundPixelCount = 0
  for (let offset = 0; offset < pixels.length; offset += 4) {
    const red = pixels[offset] ?? 0
    const green = pixels[offset + 1] ?? 0
    const blue = pixels[offset + 2] ?? 0
    if (red > 80 && red > green * 1.5 && red > blue * 1.5) {
      redPixelCount += 1
    }
    if (red + green + blue > 72) {
      nonBackgroundPixelCount += 1
    }
  }
  return {
    redPixelCount,
    nonBackgroundPixelCount
  }
}

const classifyPixel = (red: number, green: number, blue: number) => {
  const isRedStroke = red > 80 && red > green * 1.5 && red > blue * 1.5
  const isFill =
    red > 150 &&
    green > 150 &&
    blue > 150 &&
    Math.abs(red - green) < 18 &&
    Math.abs(red - blue) < 18
  const isDarkBackground = red + green + blue < 72
  return { isRedStroke, isFill, isDarkBackground }
}

const getPixelAt = (
  imageData: {
    width: number
    height: number
    pixels: number[]
  },
  x: number,
  y: number
) => {
  const pixelX = Math.round(x)
  const pixelY = Math.round(y)
  if (
    pixelX < 0 ||
    pixelY < 0 ||
    pixelX >= imageData.width ||
    pixelY >= imageData.height
  ) {
    return null
  }
  const offset = (pixelY * imageData.width + pixelX) * 4
  return {
    red: imageData.pixels[offset] ?? 0,
    green: imageData.pixels[offset + 1] ?? 0,
    blue: imageData.pixels[offset + 2] ?? 0
  }
}

export const analyzeSolidSegmentAdherence = async (
  page: Page,
  image: Buffer,
  metadata: {
    selectedRect: { x: number; y: number }
    zoom: number
    viewport: { x: number; y: number }
  }
) => {
  const imageData = await readImagePixelData(page, image)

  const samples = SELF_CHECK_SOURCE_SEGMENTS.flatMap((segment, segmentIndex) =>
    [0.18, 0.32, 0.46, 0.6, 0.74].map((t) => {
      const localPoint = getSelfCheckSegmentSamplePoint(segment, t)
      const previousPoint = getSelfCheckSegmentSamplePoint(
        segment,
        Math.max(0, t - 0.01)
      )
      const nextPoint = getSelfCheckSegmentSamplePoint(
        segment,
        Math.min(1, t + 0.01)
      )
      const dx = nextPoint.x - previousPoint.x
      const dy = nextPoint.y - previousPoint.y
      const length = Math.hypot(dx, dy)
      const unitNormal = {
        x: -dy / length,
        y: dx / length
      }
      const screenPoint = toScreenPoint(metadata, localPoint)
      const scan = []
      for (let offset = -24; offset <= 24; offset += 1) {
        const pixel = getPixelAt(
          imageData,
          screenPoint.x + unitNormal.x * offset,
          screenPoint.y + unitNormal.y * offset
        )
        if (!pixel) {
          continue
        }
        scan.push({
          offset,
          ...classifyPixel(pixel.red, pixel.green, pixel.blue)
        })
      }

      const redOffsets = scan
        .filter((entry) => entry.isRedStroke)
        .map((entry) => entry.offset)
      const fillOffsets = scan
        .filter((entry) => entry.isFill)
        .map((entry) => entry.offset)
      let minDarkGap = Number.POSITIVE_INFINITY
      for (const redOffset of redOffsets) {
        for (const fillOffset of fillOffsets) {
          const minOffset = Math.min(redOffset, fillOffset)
          const maxOffset = Math.max(redOffset, fillOffset)
          const darkGap = scan.filter(
            (entry) =>
              entry.offset > minOffset &&
              entry.offset < maxOffset &&
              entry.isDarkBackground
          ).length
          minDarkGap = Math.min(minDarkGap, darkGap)
        }
      }

      return {
        segmentIndex,
        segmentId: `${segment.startId}->${segment.endId}`,
        t,
        boundaryDarkPixelCount: scan.filter(
          (entry) => Math.abs(entry.offset) <= 2 && entry.isDarkBackground
        ).length,
        redPixelCount: redOffsets.length,
        fillPixelCount: fillOffsets.length,
        minDarkGap: minDarkGap === Number.POSITIVE_INFINITY ? null : minDarkGap
      }
    })
  )

  return {
    id: 'segment-adherence:all-source-segments',
    samples,
    coveredSamples: samples.filter(
      (sample) =>
        sample.redPixelCount > 0 &&
        sample.fillPixelCount > 0 &&
        sample.minDarkGap !== null
    ),
    failedSamples: samples.filter(
      (sample) =>
        sample.redPixelCount > 0 &&
        sample.fillPixelCount > 0 &&
        sample.minDarkGap !== null &&
        sample.minDarkGap > 1
    )
  }
}

export const captureSolidSegmentAdherenceReview = async (
  page: Page,
  cropDir: string
) => {
  const segment = SELF_CHECK_SOURCE_SEGMENTS.find(
    (candidate) => candidate.startId === 'tp-14' && candidate.endId === 'tp-15'
  )
  if (!segment) {
    throw new Error('Missing canonical tp-14 -> tp-15 source segment')
  }
  const focusPoint = getSelfCheckSegmentSamplePoint(segment, 0.5)
  await page.evaluate(
    ({ focus }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rect = (window as any).__selfCheckVectorRect
      if (!core || !rect) {
        throw new Error('Missing E2E core or self-check vector rect')
      }
      const zoom = 5
      core.setSystemProperty('zoom', zoom)
      core.setSystemProperty('viewportPosition', {
        x: 700 - (rect.x + focus.x) * zoom,
        y: 460 - (rect.y + focus.y) * zoom
      })
    },
    { focus: focusPoint }
  )
  await page.waitForTimeout(250)
  const screenshotPath = path.join(cropDir, 'segment-adherence-high-zoom.png')
  const screenshot = await page.screenshot({
    path: screenshotPath,
    fullPage: false
  })
  const metadata = await getSelfCheckMetadata(page)
  return {
    id: 'segment-adherence-high-zoom',
    path: screenshotPath,
    ...(await analyzeSolidSegmentAdherence(page, screenshot, metadata))
  }
}

const toScreenPoint = (
  metadata: {
    selectedRect: { x: number; y: number }
    zoom: number
    viewport: { x: number; y: number }
  },
  localPoint: Vec2
) => ({
  x:
    (metadata.selectedRect.x + localPoint.x) * metadata.zoom +
    metadata.viewport.x,
  y:
    (metadata.selectedRect.y + localPoint.y) * metadata.zoom +
    metadata.viewport.y
})

const getClipAround = (page: Page, center: Vec2, size: number) => {
  const viewport = page.viewportSize() ?? { width: 1400, height: 1100 }
  const x = Math.max(0, Math.min(viewport.width - size, center.x - size / 2))
  const y = Math.max(0, Math.min(viewport.height - size, center.y - size / 2))
  return { x, y, width: size, height: size }
}

interface DiagnosticPixelComponent {
  area: number
  minX: number
  minY: number
  maxX: number
  maxY: number
  centerX: number
  centerY: number
}

const captureDiagnosticComponentCrop = async (
  page: Page,
  cropDir: string,
  name: string,
  component: DiagnosticPixelComponent | undefined
) => {
  const cropPath = path.join(cropDir, `${name}.png`)
  if (!component) {
    if (fs.existsSync(cropPath)) {
      fs.rmSync(cropPath)
    }
    return null
  }
  fs.mkdirSync(cropDir, { recursive: true })
  const width = component.maxX - component.minX + 1
  const height = component.maxY - component.minY + 1
  const crop = await page.screenshot({
    path: cropPath,
    clip: getClipAround(
      page,
      { x: component.centerX, y: component.centerY },
      Math.max(160, width + 120, height + 120)
    )
  })
  return {
    id: name,
    path: cropPath,
    component,
    ...(await analyzeSingleScreenshot(page, crop))
  }
}

export const captureCanonicalCrops = async (
  page: Page,
  metadata: {
    selectedRect: { x: number; y: number }
    zoom: number
    viewport: { x: number; y: number }
    computedStrokes?: Array<{ style?: string; position?: string }>
    boundaryDomainPackets?: Array<{
      finalCoverageBuilderStatus?: string
      bounds?: {
        minX: number
        minY: number
        maxX: number
        maxY: number
      }
      polygons?: Vec2[][]
    }>
  },
  cropDir: string
) => {
  fs.mkdirSync(cropDir, { recursive: true })
  const getBoundaryDomainDashProbe = (id: string): { id: string; point: Vec2; size: number } | null => {
    const packets = metadata.boundaryDomainPackets
      ?.filter(
        (packet) =>
          packet.finalCoverageBuilderStatus === 'product-final' &&
          packet.bounds &&
          packet.polygons &&
          packet.polygons.length > 0
      )
      .map((packet) => {
        const polygon = packet.polygons?.[0] ?? []
        const centroid =
          polygon.length > 0
            ? polygon.reduce(
                (sum, point) => ({
                  x: sum.x + point.x / polygon.length,
                  y: sum.y + point.y / polygon.length
                }),
                { x: 0, y: 0 }
              )
            : {
                x: ((packet.bounds?.minX ?? 0) + (packet.bounds?.maxX ?? 0)) / 2,
                y: ((packet.bounds?.minY ?? 0) + (packet.bounds?.maxY ?? 0)) / 2
              }
        const bounds = packet.bounds as NonNullable<typeof packet.bounds>
        return {
          point: centroid,
          area: Math.max(0, bounds.maxX - bounds.minX) *
            Math.max(0, bounds.maxY - bounds.minY)
        }
      })
      .filter((packet) => packet.area > 24)
      .sort((left, right) => right.area - left.area)
    const packet = packets?.[1] ?? packets?.[0]
    return packet ? { id, point: packet.point, size: 160 } : null
  }
  const curveA = cubicPoint(
    SELF_CHECK_SOURCE_POINTS['tp-12'],
    { x: 164.3673966581619, y: 140.91988215887423 },
    { x: -42.09205809548172, y: 344.92238636482955 },
    SELF_CHECK_SOURCE_POINTS['tp-13'],
    0.45
  )
  const curveB = cubicPoint(
    SELF_CHECK_SOURCE_POINTS['tp-15'],
    SELF_CHECK_SOURCE_POINTS['tp-15'],
    { x: 263.9105229796075, y: 364.43172122813246 },
    SELF_CHECK_SOURCE_POINTS['tp-16'],
    0.55
  )
  const stroke = metadata.computedStrokes?.[0]
  const curveBProbe =
    stroke?.style === 'dashed' && stroke.position === 'outside'
      ? (getBoundaryDomainDashProbe('boundary-domain-dash-b') ?? {
          id: 'curve-sample-b',
          point: curveB,
          size: 160
        })
      : { id: 'curve-sample-b', point: curveB, size: 160 }
  const probes = [
    { id: 'tp-14', point: SELF_CHECK_SOURCE_POINTS['tp-14'], size: 180 },
    { id: 'tp-15', point: SELF_CHECK_SOURCE_POINTS['tp-15'], size: 180 },
    { id: 'tp-16', point: SELF_CHECK_SOURCE_POINTS['tp-16'], size: 180 },
    { id: 'self-intersection', point: { x: 185, y: 155 }, size: 180 },
    { id: 'curve-sample-a', point: curveA, size: 160 },
    curveBProbe
  ]
  const cropAnalyses = []
  for (const probe of probes) {
    const cropPath = path.join(cropDir, `${probe.id}.png`)
    const crop = await page.screenshot({
      path: cropPath,
      clip: getClipAround(
        page,
        toScreenPoint(metadata, probe.point),
        probe.size
      )
    })
    cropAnalyses.push({
      id: probe.id,
      path: cropPath,
      ...(await analyzeSingleScreenshot(page, crop))
    })
  }
  return cropAnalyses
}

export const captureDashedSourceJoinReviewCrops = async (
  page: Page,
  cropDir: string
) => {
  fs.mkdirSync(cropDir, { recursive: true })
  const sourceAnchorProbes = SELF_CHECK_SOURCE_SEGMENTS.map((segment) => ({
    id: segment.startId,
    point: SELF_CHECK_SOURCE_POINTS[segment.startId]
  }))
  const analyses = []
  await page.setViewportSize({ width: 1760, height: 1150 })
  for (const probe of sourceAnchorProbes) {
    await page.evaluate(
      ({ focus }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const core = (window as any).__Core__
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rect = (window as any).__selfCheckVectorRect
        if (!core || !rect) {
          throw new Error('Missing E2E core or self-check vector rect')
        }
        const zoom = 10
        core.setSystemProperty('zoom', zoom)
        core.setSystemProperty('viewportPosition', {
          x: 710 - (rect.x + focus.x) * zoom,
          y: 450 - (rect.y + focus.y) * zoom
        })
      },
      { focus: probe.point }
    )
    await page.waitForTimeout(80)
    const closeupPath = path.join(
      cropDir,
      `source-join-${probe.id}-closeup.png`
    )
    const closeup = await page.screenshot({
      path: closeupPath,
      clip: { x: 240, y: 40, width: 1230, height: 1080 }
    })
    analyses.push({
      id: `source-join-${probe.id}-closeup`,
      path: closeupPath,
      ...(await analyzeSingleScreenshot(page, closeup))
    })
  }
  return analyses
}

export const createOpenCurvedPath = async (
  page: Page,
  options: {
    style: SelfCheckStrokeStyle
    position: SelfCheckStrokePosition
    capType: SelfCheckCapType
    joinType: SelfCheckJoinType
  }
) => {
  await page.goto('/')
  await waitForAppReady(page)
  await resetCanvas(page)
  await page.setViewportSize({ width: 1400, height: 1100 })
  await page.evaluate(
    ({ options: innerOptions, rect }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elementApis = (window as any).__AsyraE2E__?.elementApis
      if (!core || !elementApis) {
        throw new Error('Missing E2E core or element APIs')
      }
      const localPoints = {
        'op-1': { id: 'op-1', kind: 'anchor', x: 0, y: 120 },
        'op-1:out': {
          id: 'op-1:out',
          kind: 'control',
          x: 64,
          y: 0,
          controlForId: 'op-1',
          controlRole: 'out'
        },
        'op-2:in': {
          id: 'op-2:in',
          kind: 'control',
          x: 150,
          y: 0,
          controlForId: 'op-2',
          controlRole: 'in'
        },
        'op-2': { id: 'op-2', kind: 'anchor', x: 220, y: 120 },
        'op-2:out': {
          id: 'op-2:out',
          kind: 'control',
          x: 285,
          y: 240,
          controlForId: 'op-2',
          controlRole: 'out'
        },
        'op-3:in': {
          id: 'op-3:in',
          kind: 'control',
          x: 370,
          y: 240,
          controlForId: 'op-3',
          controlRole: 'in'
        },
        'op-3': { id: 'op-3', kind: 'anchor', x: 440, y: 120 }
      }
      const points = Object.fromEntries(
        Object.entries(localPoints).map(([pointId, point]) => [
          pointId,
          {
            ...point,
            x: point.x + rect.x,
            y: point.y + rect.y
          }
        ])
      )
      const segments = {
        'os-1': {
          id: 'os-1',
          startId: 'op-1',
          endId: 'op-2',
          outControlId: 'op-1:out',
          inControlId: 'op-2:in'
        },
        'os-2': {
          id: 'os-2',
          startId: 'op-2',
          endId: 'op-3',
          outControlId: 'op-2:out',
          inControlId: 'op-3:in'
        }
      }
      const networks = {
        'on-1': {
          id: 'on-1',
          pointIds: ['op-1', 'op-2', 'op-3'],
          segmentIds: ['os-1', 'os-2'],
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
          pointCoordinateSpace: 'workspace'
        },
        { undoable: false }
      )
      elementApis.changeComputedData(
        [createdId],
        {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          points,
          segments,
          networks,
          closed: false,
          pointCoordinateSpace: 'workspace',
          fills: [],
          strokes: [
            {
              id: `canonical-open-${innerOptions.style}-${innerOptions.position}`,
              kind: 'solid',
              style: innerOptions.style,
              position: innerOptions.position,
              width: 12,
              dashPattern: innerOptions.style === 'dashed' ? [34, 18] : [],
              dashOffset: 0,
              fill: null,
              defaultColorFormat: 'hex',
              colorFormat: 'hex',
              color: '#df0606',
              opacity: 0.6,
              visible: true,
              gradient: null,
              joinType: innerOptions.joinType,
              capType: innerOptions.capType,
              miterAngle: 28.96
            }
          ]
        },
        { undoable: false }
      )
      core.selectElements([createdId], { undoable: false })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).__canonicalOpenVectorRect = { ...rect }
      core.setSystemProperty('zoom', 1.8)
      core.setSystemProperty('viewportPosition', { x: 140, y: 145 })
    },
    {
      options,
      rect: {
        x: SELF_CHECK_VECTOR_RECT.x,
        y: SELF_CHECK_VECTOR_RECT.y + 70,
        width: 440,
        height: 260
      }
    }
  )
  await waitForSelfCheckStroke(page)
  await page.waitForTimeout(300)
}

export const captureOpenPathTerminalCrop = async (
  page: Page,
  cropDir: string,
  name: string
) => {
  fs.mkdirSync(cropDir, { recursive: true })
  const target = await page.evaluate(
    (fallbackRect) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const zoom = core?.getSystemProperty?.('zoom') ?? 1
      const viewport = core?.getSystemProperty?.('viewportPosition') ?? {
        x: 0,
        y: 0
      }
      const rect =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__canonicalOpenVectorRect ?? fallbackRect
      return {
        x: rect.x * zoom + viewport.x,
        y: (rect.y + 120) * zoom + viewport.y
      }
    },
    {
      x: SELF_CHECK_VECTOR_RECT.x,
      y: SELF_CHECK_VECTOR_RECT.y + 70
    }
  )
  const cropPath = path.join(cropDir, `${name}.png`)
  const clip = getClipAround(page, target, 220)
  const crop = await page.screenshot({
    path: cropPath,
    clip
  })
  const imageData = await readImagePixelData(page, crop)
  const terminal = {
    x: target.x - clip.x,
    y: target.y - clip.y
  }
  const tangentLength = Math.hypot(64, -120)
  const tangent = { x: 64 / tangentLength, y: -120 / tangentLength }
  const normal = { x: -tangent.y, y: tangent.x }
  const sampleRed = (x: number, y: number) => {
    const pixel = getPixelAt(imageData, x, y)
    return pixel
      ? classifyPixel(pixel.red, pixel.green, pixel.blue).isRedStroke
      : false
  }
  return {
    id: name,
    path: cropPath,
    terminalCapFootprint: {
      forwardRed: sampleRed(
        terminal.x + tangent.x * 9,
        terminal.y + tangent.y * 9
      ),
      backwardRed: sampleRed(
        terminal.x - tangent.x * 9,
        terminal.y - tangent.y * 9
      ),
      backwardCornerRed: sampleRed(
        terminal.x - tangent.x * 9 + normal.x * 9,
        terminal.y - tangent.y * 9 + normal.y * 9
      )
    },
    ...(await analyzeSingleScreenshot(page, crop))
  }
}

export const writeJson = (filePath: string, value: unknown) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

interface CanonicalRuntimePoint extends Vec2 {
  id: string
  anchorType?: string
}

interface CanonicalRuntimeSegment {
  id: string
  startId: string
  endId: string
  outControlId: string | null
  inControlId: string | null
}

interface CanonicalRuntimeSnapshot {
  selectedId: string | null
  selectedRect: {
    x: number
    y: number
    width: number
    height: number
  }
  zoom: number
  viewport: Vec2
  pointCoordinateSpace: 'workspace' | 'local'
  points: Record<string, CanonicalRuntimePoint>
  segments: Record<string, CanonicalRuntimeSegment>
  segmentOrder: string[]
  stroke: {
    style: SelfCheckStrokeStyle
    position: SelfCheckStrokePosition
    width: number
    dashPattern: number[]
    dashOffset: number
    capType: SelfCheckCapType
    joinType: SelfCheckJoinType
  }
}

interface CanonicalRuleSample {
  segmentId: string
  segmentIndex: number
  t: number
  sourceDistance: number
  sourceSegmentDistance?: number
  distance: number
  point: Vec2
  screenPoint: Vec2
  normal: Vec2
}

interface CanonicalRuleFailure {
  category: string
  segmentId?: string
  segmentIndex?: number
  t?: number
  x?: number
  y?: number
  detail?: Record<string, unknown>
}

export interface CanonicalRuleOverlayMetrics {
  caseKey: string
  style: SelfCheckStrokeStyle
  position: SelfCheckStrokePosition
  capType?: SelfCheckCapType
  joinType?: SelfCheckJoinType
  selectedId: string | null
  zoom: number
  viewport: Vec2
  screenshotSize: { width: number; height: number }
  inspectedSampleCount: number
  dashExpectedSampleCount: number
  gapExpectedSampleCount: number
  expectedPaintedSampleCount: number
  missingExpectedSampleCount: number
  wrongSideDominanceSampleCount: number
  gapLeakSampleCount: number
  allowedCrossSourceOverlapSampleCount: number
  allowedSideFootprintSampleCount: number
  unclassifiedDomainSampleCount: number
  sourceSegmentSummaries: {
    segmentId: string
    segmentIndex: number
    inspectedSampleCount: number
    dashExpectedSampleCount: number
    expectedPaintedSampleCount: number
    missingExpectedSampleCount: number
    wrongSideDominanceSampleCount: number
    gapLeakSampleCount: number
    expectedRecall: number
  }[]
  expectedRecall: number
  worstSegmentExpectedRecall: number
  wrongSideDominanceRate: number
  gapLeakRate: number
  redPixelCount: number
  doubleAlphaRate: number
  terminalRecordCount: number
  splitTerminalRecordCount: number
  productFinalPacketCount: number
  boundaryDomainIntervalCount: number
  failureMarkers: CanonicalRuleFailure[]
  overlayLegend: string[]
}

const captureCanonicalRuntimeSnapshot = async (
  page: Page
): Promise<CanonicalRuntimeSnapshot> =>
  page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId =
      core?.deps?.selection?.getElementSelectionIds?.()?.[0] ??
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__selfCheckVectorId ??
      null
    const element = selectedId
      ? core?.deps?.sceneTree?.getElementById?.(selectedId)
      : null
    const computed = element?.getAllComputedData?.()
    if (!computed) {
      throw new Error('Missing canonical stroke runtime computed data')
    }
    const zoom = core?.getSystemProperty?.('zoom') ?? 1
    const viewport = core?.getSystemProperty?.('viewportPosition') ?? {
      x: 0,
      y: 0
    }
    const points = Object.fromEntries(
      Object.entries(computed.points ?? {}).flatMap(([pointId, value]) => {
        const point = value as Record<string, unknown>
        return typeof point.x === 'number' && typeof point.y === 'number'
          ? [
              [
                pointId,
                {
                  ...(point as object),
                  id: typeof point.id === 'string' ? point.id : pointId,
                  x: point.x,
                  y: point.y
                }
              ]
            ]
          : []
      })
    )
    const segments = Object.fromEntries(
      Object.entries(computed.segments ?? {}).flatMap(([segmentId, value]) => {
        const segment = value as Record<string, unknown>
        return typeof segment.startId === 'string' &&
          typeof segment.endId === 'string'
          ? [
              [
                segmentId,
                {
                  id:
                    typeof segment.id === 'string' ? segment.id : segmentId,
                  startId: segment.startId,
                  endId: segment.endId,
                  outControlId:
                    typeof segment.outControlId === 'string'
                      ? segment.outControlId
                      : null,
                  inControlId:
                    typeof segment.inControlId === 'string'
                      ? segment.inControlId
                      : null
                }
              ]
            ]
          : []
      })
    )
    const firstNetwork = Object.values(computed.networks ?? {})[0] as
      | Record<string, unknown>
      | undefined
    const segmentOrder = Array.isArray(firstNetwork?.segmentIds)
      ? firstNetwork.segmentIds.filter(
          (segmentId): segmentId is string => typeof segmentId === 'string'
        )
      : Object.keys(segments)
    const stroke = computed.strokes?.[0] ?? {}
    return {
      selectedId,
      selectedRect: {
        x: computed.x,
        y: computed.y,
        width: computed.width,
        height: computed.height
      },
      zoom,
      viewport,
      pointCoordinateSpace:
        computed.pointCoordinateSpace === 'workspace' ? 'workspace' : 'local',
      points,
      segments,
      segmentOrder,
      stroke: {
        style: stroke.style === 'dashed' ? 'dashed' : 'solid',
        position:
          stroke.position === 'center' || stroke.position === 'outside'
            ? stroke.position
            : 'inside',
        width: typeof stroke.width === 'number' ? stroke.width : 10,
        dashPattern: Array.isArray(stroke.dashPattern)
          ? stroke.dashPattern.filter(
              (entry): entry is number => typeof entry === 'number'
            )
          : [],
        dashOffset:
          typeof stroke.dashOffset === 'number' ? stroke.dashOffset : 0,
        capType:
          stroke.capType === 'butt' || stroke.capType === 'square'
            ? stroke.capType
            : 'round',
        joinType:
          stroke.joinType === 'miter' || stroke.joinType === 'bevel'
            ? stroke.joinType
            : 'round'
      }
    }
  })

const pointToWorkspace = (
  runtime: CanonicalRuntimeSnapshot,
  point: Vec2
) =>
  runtime.pointCoordinateSpace === 'workspace'
    ? point
    : {
        x: runtime.selectedRect.x + point.x,
        y: runtime.selectedRect.y + point.y
      }

const pointToScreen = (runtime: CanonicalRuntimeSnapshot, point: Vec2) => {
  const workspacePoint = pointToWorkspace(runtime, point)
  return {
    x: workspacePoint.x * runtime.zoom + runtime.viewport.x,
    y: workspacePoint.y * runtime.zoom + runtime.viewport.y
  }
}

const getRuntimeSegmentPoint = (
  runtime: CanonicalRuntimeSnapshot,
  segment: CanonicalRuntimeSegment,
  key: 'startId' | 'endId' | 'outControlId' | 'inControlId'
) => {
  const pointId = segment[key]
  return pointId ? runtime.points[pointId] : undefined
}

const getRuntimeSegmentSamplePoint = (
  runtime: CanonicalRuntimeSnapshot,
  segment: CanonicalRuntimeSegment,
  t: number
) => {
  const start = getRuntimeSegmentPoint(runtime, segment, 'startId')
  const end = getRuntimeSegmentPoint(runtime, segment, 'endId')
  if (!start || !end) {
    throw new Error(`Missing runtime segment endpoints for ${segment.id}`)
  }
  const outControl = getRuntimeSegmentPoint(runtime, segment, 'outControlId')
  const inControl = getRuntimeSegmentPoint(runtime, segment, 'inControlId')
  return outControl || inControl
    ? cubicPoint(start, outControl ?? start, inControl ?? end, end, t)
    : lerpPoint(start, end, t)
}

const estimateRuntimeSegmentArcLength = (
  runtime: CanonicalRuntimeSnapshot,
  segment: CanonicalRuntimeSegment,
  t: number
) => {
  const clampedT = Math.max(0, Math.min(1, t))
  if (clampedT <= 0) {
    return 0
  }
  const steps = Math.max(12, Math.ceil(360 * clampedT))
  let length = 0
  let previous = getRuntimeSegmentSamplePoint(runtime, segment, 0)
  for (let index = 1; index <= steps; index += 1) {
    const point = getRuntimeSegmentSamplePoint(
      runtime,
      segment,
      (clampedT * index) / steps
    )
    length += Math.hypot(point.x - previous.x, point.y - previous.y)
    previous = point
  }
  return length
}

const buildCanonicalRuleSamples = (
  runtime: CanonicalRuntimeSnapshot,
  options: { divisions?: number; stride?: number } = {}
): CanonicalRuleSample[] => {
  const divisions = options.divisions ?? 72
  const stride = options.stride ?? 3
  const samples: CanonicalRuleSample[] = []
  let cumulativeSourceDistance = 0
  runtime.segmentOrder.forEach((segmentId, segmentIndex) => {
    const segment = runtime.segments[segmentId]
    if (!segment) {
      return
    }
    const segmentStartDistance = cumulativeSourceDistance
    const segmentLength = estimateRuntimeSegmentArcLength(runtime, segment, 1)
    for (let step = 0; step <= divisions; step += 1) {
      const t = step / divisions
      const point = getRuntimeSegmentSamplePoint(runtime, segment, t)
      if (step % stride !== 0 || step === 0 || step === divisions) {
        continue
      }
      const sourceDistance =
        segmentStartDistance + estimateRuntimeSegmentArcLength(runtime, segment, t)
      const sourceSegmentDistance = sourceDistance - segmentStartDistance
      const previous = pointToScreen(
        runtime,
        getRuntimeSegmentSamplePoint(runtime, segment, Math.max(0, t - 0.01))
      )
      const next = pointToScreen(
        runtime,
        getRuntimeSegmentSamplePoint(runtime, segment, Math.min(1, t + 0.01))
      )
      const dx = next.x - previous.x
      const dy = next.y - previous.y
      const length = Math.hypot(dx, dy)
      if (length <= 1e-6) {
        continue
      }
      samples.push({
        segmentId,
        segmentIndex,
        t,
        sourceDistance,
        sourceSegmentDistance,
        distance: sourceDistance + runtime.stroke.dashOffset,
        point,
        screenPoint: pointToScreen(runtime, point),
        normal: {
          x: -dy / length,
          y: dx / length
        }
      })
    }
    cumulativeSourceDistance += segmentLength
  })
  return samples
}

const buildCanonicalSourceVertexRuleSamples = (
  runtime: CanonicalRuntimeSnapshot
): CanonicalRuleSample[] => {
  if (runtime.stroke.style === 'solid') {
    return []
  }
  const samples: CanonicalRuleSample[] = []
  let cumulativeSourceDistance = 0
  runtime.segmentOrder.forEach((segmentId, segmentIndex) => {
    const segment = runtime.segments[segmentId]
    if (!segment) {
      return
    }
    const segmentLength = estimateRuntimeSegmentArcLength(runtime, segment, 1)
    const start = getRuntimeSegmentSamplePoint(runtime, segment, 0)
    const end = getRuntimeSegmentSamplePoint(runtime, segment, 1)
    const nearStart = getRuntimeSegmentSamplePoint(runtime, segment, 0.02)
    const nearEnd = getRuntimeSegmentSamplePoint(runtime, segment, 0.98)
    const pushEndpointSample = (
      endpoint: Vec2,
      pointId: string,
      neighbor: Vec2,
      t: number,
      sourceDistance: number,
      sourceSegmentDistance: number,
      suffix: 'start-vertex' | 'end-vertex'
    ) => {
      const point = runtime.points[pointId]
      if (point?.anchorType === 'smooth') {
        return
      }
      const screenEndpoint = pointToScreen(runtime, endpoint)
      const screenNeighbor = pointToScreen(runtime, neighbor)
      const dx =
        suffix === 'start-vertex'
          ? screenNeighbor.x - screenEndpoint.x
          : screenEndpoint.x - screenNeighbor.x
      const dy =
        suffix === 'start-vertex'
          ? screenNeighbor.y - screenEndpoint.y
          : screenEndpoint.y - screenNeighbor.y
      const length = Math.hypot(dx, dy)
      if (length <= 1e-6) {
        return
      }
      samples.push({
        segmentId: `${segment.id}:${suffix}`,
        segmentIndex,
        t,
        sourceDistance,
        sourceSegmentDistance,
        distance: sourceDistance + runtime.stroke.dashOffset,
        point: endpoint,
        screenPoint: screenEndpoint,
        normal: {
          x: -dy / length,
          y: dx / length
        }
      })
    }

    pushEndpointSample(
      start,
      segment.startId,
      nearStart,
      0,
      cumulativeSourceDistance,
      0,
      'start-vertex'
    )
    pushEndpointSample(
      end,
      segment.endId,
      nearEnd,
      1,
      cumulativeSourceDistance + segmentLength,
      segmentLength,
      'end-vertex'
    )
    cumulativeSourceDistance += segmentLength
  })
  return samples
}

const crossVec2 = (left: Vec2, right: Vec2) =>
  left.x * right.y - left.y * right.x

const subtractVec2 = (left: Vec2, right: Vec2): Vec2 => ({
  x: left.x - right.x,
  y: left.y - right.y
})

const buildCanonicalSelfIntersectionRuleSamples = (
  runtime: CanonicalRuntimeSnapshot
): CanonicalRuleSample[] => {
  const segmentPolylines: {
    segmentId: string
    segmentIndex: number
    samples: {
      point: Vec2
      t: number
      sourceDistance: number
    }[]
  }[] = []
  let cumulativeSourceDistance = 0
  runtime.segmentOrder.forEach((segmentId, segmentIndex) => {
    const segment = runtime.segments[segmentId]
    if (!segment) {
      return
    }
    const samples = []
    const steps = 96
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps
      samples.push({
        point: getRuntimeSegmentSamplePoint(runtime, segment, t),
        t,
        sourceDistance:
          cumulativeSourceDistance +
          estimateRuntimeSegmentArcLength(runtime, segment, t)
      })
    }
    segmentPolylines.push({ segmentId, segmentIndex, samples })
    cumulativeSourceDistance += estimateRuntimeSegmentArcLength(
      runtime,
      segment,
      1
    )
  })

  const output: CanonicalRuleSample[] = []
  const seen = new Set<string>()
  segmentPolylines.forEach((left, leftIndex) => {
    segmentPolylines.slice(leftIndex + 1).forEach((right) => {
      const segmentDistance = Math.abs(left.segmentIndex - right.segmentIndex)
      const areAdjacent =
        segmentDistance === 1 ||
        segmentDistance === runtime.segmentOrder.length - 1
      if (areAdjacent) {
        return
      }
      for (
        let leftSampleIndex = 1;
        leftSampleIndex < left.samples.length;
        leftSampleIndex += 1
      ) {
        const leftA = left.samples[leftSampleIndex - 1]
        const leftB = left.samples[leftSampleIndex]
        const leftVector = subtractVec2(leftB.point, leftA.point)
        for (
          let rightSampleIndex = 1;
          rightSampleIndex < right.samples.length;
          rightSampleIndex += 1
        ) {
          const rightA = right.samples[rightSampleIndex - 1]
          const rightB = right.samples[rightSampleIndex]
          const rightVector = subtractVec2(rightB.point, rightA.point)
          const denominator = crossVec2(leftVector, rightVector)
          if (Math.abs(denominator) <= 1e-6) {
            continue
          }
          const delta = subtractVec2(rightA.point, leftA.point)
          const leftAmount = crossVec2(delta, rightVector) / denominator
          const rightAmount = crossVec2(delta, leftVector) / denominator
          if (
            leftAmount <= 1e-4 ||
            leftAmount >= 1 - 1e-4 ||
            rightAmount <= 1e-4 ||
            rightAmount >= 1 - 1e-4
          ) {
            continue
          }
          const point = {
            x: leftA.point.x + leftVector.x * leftAmount,
            y: leftA.point.y + leftVector.y * leftAmount
          }
          const roundedKey = [
            Math.round(point.x * 10),
            Math.round(point.y * 10),
            left.segmentIndex,
            right.segmentIndex
          ].join(':')
          if (seen.has(roundedKey)) {
            continue
          }
          seen.add(roundedKey)
          const pushIntersectionSample = (
            owner: typeof left,
            samplePoint: Vec2,
            sampleT: number,
            sourceDistance: number,
            sourceSegmentDistance: number,
            peer: typeof right,
            suffix: string,
            tangentPointA: Vec2,
            tangentPointB: Vec2
          ) => {
            const screenA = pointToScreen(runtime, tangentPointA)
            const screenB = pointToScreen(runtime, tangentPointB)
            const dx = screenB.x - screenA.x
            const dy = screenB.y - screenA.y
            const length = Math.hypot(dx, dy)
            if (length <= 1e-6) {
              return
            }
            output.push({
              segmentId: `${owner.segmentId}:self-intersection:${peer.segmentId}:${suffix}`,
              segmentIndex: owner.segmentIndex,
              t: sampleT,
              sourceDistance,
              sourceSegmentDistance,
              distance: sourceDistance + runtime.stroke.dashOffset,
              point: samplePoint,
              screenPoint: pointToScreen(runtime, samplePoint),
              normal: {
                x: -dy / length,
                y: dx / length
              }
            })
          }
          const pushIntersectionSamplesForOwner = (
            owner: typeof left,
            ownerA: typeof leftA,
            ownerB: typeof leftB,
            amount: number,
            peer: typeof right
          ) => {
            const segment = runtime.segments[owner.segmentId]
            if (!segment) {
              return
            }
            const exactT = ownerA.t + (ownerB.t - ownerA.t) * amount
            const segmentStartDistance =
              owner.samples[0]?.sourceDistance ?? ownerA.sourceDistance
            const pushAtT = (sampleT: number, suffix: string) => {
              const clampedT = Math.max(0.001, Math.min(0.999, sampleT))
              const samplePoint = getRuntimeSegmentSamplePoint(
                runtime,
                segment,
                clampedT
              )
              const tangentPointA = getRuntimeSegmentSamplePoint(
                runtime,
                segment,
                Math.max(0.001, clampedT - 0.01)
              )
              const tangentPointB = getRuntimeSegmentSamplePoint(
                runtime,
                segment,
                Math.min(0.999, clampedT + 0.01)
              )
              pushIntersectionSample(
                owner,
                samplePoint,
                clampedT,
                segmentStartDistance +
                  estimateRuntimeSegmentArcLength(runtime, segment, clampedT),
                estimateRuntimeSegmentArcLength(runtime, segment, clampedT),
                peer,
                suffix,
                tangentPointA,
                tangentPointB
              )
            }

            pushIntersectionSample(
              owner,
              point,
              exactT,
              ownerA.sourceDistance +
                (ownerB.sourceDistance - ownerA.sourceDistance) * amount,
              ownerA.sourceDistance +
                (ownerB.sourceDistance - ownerA.sourceDistance) * amount -
                segmentStartDistance,
              peer,
              'center',
              ownerA.point,
              ownerB.point
            )

            const deltaT = 0.025
            pushAtT(exactT - deltaT, 'before')
            pushAtT(exactT + deltaT, 'after')
          }
          pushIntersectionSamplesForOwner(left, leftA, leftB, leftAmount, right)
          pushIntersectionSamplesForOwner(right, rightA, rightB, rightAmount, left)
        }
      }
    })
  })
  return output
}

const toDataUrl = (buffer: Buffer) =>
  `data:image/png;base64,${buffer.toString('base64')}`

export const captureCanonicalRuleOverlay = async (
  page: Page,
  options: {
    key: string
    style: SelfCheckStrokeStyle
    position: SelfCheckStrokePosition
    capType?: SelfCheckCapType
    joinType?: SelfCheckJoinType
    baselineScreenshot: Buffer
    screenshot: Buffer
    metadata: Awaited<ReturnType<typeof getSelfCheckMetadata>>
    overlayPath: string
    metricsPath: string
  }
): Promise<CanonicalRuleOverlayMetrics> => {
  const runtime = await captureCanonicalRuntimeSnapshot(page)
  const samples = buildCanonicalRuleSamples(runtime)
  const sourceDerivedSamples = [
    ...buildCanonicalSourceVertexRuleSamples(runtime),
    ...buildCanonicalSelfIntersectionRuleSamples(runtime)
  ]
  const overlapSamples = buildCanonicalRuleSamples(runtime, {
    divisions: 216,
    stride: 1
  })
  const result = await page.evaluate(
    async ({
      actualDataUrl,
      baselineDataUrl,
      caseInfo,
      metadata,
      overlapSamples,
      runtime,
      samples,
      sourceDerivedSamples
    }) => {
      const loadImage = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image()
          image.onload = () => resolve(image)
          image.onerror = () => reject(new Error(`Failed to decode ${src}`))
          image.src = src
        })
      const [baselineImage, actualImage] = await Promise.all([
        loadImage(baselineDataUrl),
        loadImage(actualDataUrl)
      ])
      const width = actualImage.width
      const height = actualImage.height
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('Missing canvas context for canonical rule overlay')
      }
      context.drawImage(baselineImage, 0, 0)
      const baselineData = context.getImageData(0, 0, width, height).data
      context.clearRect(0, 0, width, height)
      context.drawImage(actualImage, 0, 0)
      const actualData = context.getImageData(0, 0, width, height).data

      const indexOf = (x: number, y: number) => {
        const pixelX = Math.round(x)
        const pixelY = Math.round(y)
        if (pixelX < 0 || pixelY < 0 || pixelX >= width || pixelY >= height) {
          return null
        }
        return (pixelY * width + pixelX) * 4
      }
      const read = (data: Uint8ClampedArray, x: number, y: number) => {
        const index = indexOf(x, y)
        if (index === null) {
          return null
        }
        return {
          r: data[index] ?? 0,
          g: data[index + 1] ?? 0,
          b: data[index + 2] ?? 0,
          a: data[index + 3] ?? 0
        }
      }
      const isRed = (pixel: ReturnType<typeof read>) =>
        Boolean(
          pixel &&
            pixel.a > 80 &&
            pixel.r > 74 &&
            pixel.r > pixel.g * 1.45 &&
            pixel.r > pixel.b * 1.45
        )
      const isFill = (pixel: ReturnType<typeof read>) =>
        Boolean(
          pixel &&
            pixel.r > 125 &&
            pixel.g > 125 &&
            pixel.b > 125 &&
            Math.abs(pixel.r - pixel.g) < 34 &&
            Math.abs(pixel.r - pixel.b) < 34
        )
      const countAlong = (
        data: Uint8ClampedArray,
        predicate: (pixel: ReturnType<typeof read>) => boolean,
        sample: CanonicalRuleSample,
        sign: 1 | -1,
        minOffset: number,
        maxOffset: number
      ) => {
        let count = 0
        for (let offset = minOffset; offset <= maxOffset; offset += 2) {
          if (
            predicate(
              read(
                data,
                sample.screenPoint.x + sample.normal.x * offset * sign,
                sample.screenPoint.y + sample.normal.y * offset * sign
              )
            )
          ) {
            count += 1
          }
        }
        return count
      }
      const totalRedAround = (sample: CanonicalRuleSample) =>
        countAlong(actualData, isRed, sample, 1, 1, 24) +
        countAlong(actualData, isRed, sample, -1, 1, 24)
      const countAround = (
        data: Uint8ClampedArray,
        predicate: (pixel: ReturnType<typeof read>) => boolean,
        sample: CanonicalRuleSample,
        radius: number
      ) => {
        let count = 0
        const minX = Math.max(0, Math.floor(sample.screenPoint.x - radius))
        const maxX = Math.min(width - 1, Math.ceil(sample.screenPoint.x + radius))
        const minY = Math.max(0, Math.floor(sample.screenPoint.y - radius))
        const maxY = Math.min(height - 1, Math.ceil(sample.screenPoint.y + radius))
        const radiusSquared = radius * radius
        for (let y = minY; y <= maxY; y += 1) {
          for (let x = minX; x <= maxX; x += 1) {
            const dx = x - sample.screenPoint.x
            const dy = y - sample.screenPoint.y
            if (dx * dx + dy * dy > radiusSquared) {
              continue
            }
            if (predicate(read(data, x, y))) {
              count += 1
            }
          }
        }
        return count
      }

      const dashPattern =
        runtime.stroke.style === 'dashed' && runtime.stroke.dashPattern.length
          ? runtime.stroke.dashPattern
          : []
      const dashLength = dashPattern[0] ?? 0
      const gapLength = dashPattern[1] ?? 0
      const cycleLength = dashLength + gapLength
      const capPathReach =
        runtime.stroke.capType === 'butt' ? 0 : runtime.stroke.width / 2
      const roundMetric = (value: number) => Math.round(value * 1000) / 1000
      const getPhase = (sample: CanonicalRuleSample) =>
        cycleLength > 0
          ? ((sample.distance % cycleLength) + cycleLength) % cycleLength
          : 0
      const visibleIntervals = metadata.boundaryDomainPackets.flatMap(
        (packet: {
          debugIntervalId?: unknown
          startDistance?: unknown
          endDistance?: unknown
          figmaLikeSplitRangeSourceSegmentIndex?: unknown
          figmaLikeSelectedSide?: unknown
          figmaLikeSplitRangeStartDistance?: unknown
          figmaLikeSplitRangeEndDistance?: unknown
          figmaLikeBoundaryStartDistance?: unknown
          figmaLikeBoundaryEndDistance?: unknown
          figmaLikeBoundaryPoints?: unknown
          figmaLikeSplitRangeId?: unknown
          figmaLikeTerminalRole?: unknown
          geometryFamily?: unknown
          finalCoverageBuilderStatus?: unknown
          polygons?: unknown
        }) =>
          typeof packet.startDistance === 'number' &&
          typeof packet.endDistance === 'number'
            ? [
                {
                  intervalId:
                    typeof packet.debugIntervalId === 'string'
                      ? packet.debugIntervalId
                      : null,
                  startDistance: packet.startDistance,
                  endDistance: packet.endDistance,
                  sourceSegmentIndex:
                    typeof packet.figmaLikeSplitRangeSourceSegmentIndex ===
                    'number'
                      ? packet.figmaLikeSplitRangeSourceSegmentIndex
                      : null,
                  selectedSide:
                    packet.figmaLikeSelectedSide === 1 ||
                    packet.figmaLikeSelectedSide === -1
                      ? packet.figmaLikeSelectedSide
                      : null,
                  splitRangeStartDistance:
                    typeof packet.figmaLikeSplitRangeStartDistance ===
                    'number'
                      ? packet.figmaLikeSplitRangeStartDistance
                      : null,
                  splitRangeEndDistance:
                    typeof packet.figmaLikeSplitRangeEndDistance === 'number'
                      ? packet.figmaLikeSplitRangeEndDistance
                      : null,
                  boundaryStartDistance:
                    typeof packet.figmaLikeBoundaryStartDistance === 'number'
                      ? packet.figmaLikeBoundaryStartDistance
                      : null,
                  boundaryEndDistance:
                    typeof packet.figmaLikeBoundaryEndDistance === 'number'
                      ? packet.figmaLikeBoundaryEndDistance
                      : null,
                  boundaryPoints: Array.isArray(packet.figmaLikeBoundaryPoints)
                    ? packet.figmaLikeBoundaryPoints.flatMap((point) => {
                        if (
                          typeof point === 'object' &&
                          point !== null &&
                          typeof (point as { x?: unknown }).x === 'number' &&
                          typeof (point as { y?: unknown }).y === 'number'
                        ) {
                          return [
                            {
                              x: (point as { x: number }).x,
                              y: (point as { y: number }).y
                            }
                          ]
                        }
                        return []
                      })
                    : [],
                  splitRangeId:
                    typeof packet.figmaLikeSplitRangeId === 'string'
                      ? packet.figmaLikeSplitRangeId
                      : null,
                  polygons: Array.isArray(packet.polygons)
                    ? packet.polygons.flatMap((polygon) => {
                        if (!Array.isArray(polygon)) {
                          return []
                        }
                        const points = polygon.flatMap((point) => {
                          if (
                            typeof point === 'object' &&
                            point !== null &&
                            typeof (point as { x?: unknown }).x === 'number' &&
                            typeof (point as { y?: unknown }).y === 'number'
                          ) {
                            return [
                              {
                                x: (point as { x: number }).x,
                                y: (point as { y: number }).y
                              }
                            ]
                          }
                          return []
                        })
                        return points.length >= 3 ? [points] : []
                      })
                    : [],
                  terminalRole:
                    typeof packet.figmaLikeTerminalRole === 'string'
                      ? packet.figmaLikeTerminalRole
                      : null,
                  geometryFamily:
                    typeof packet.geometryFamily === 'string'
                      ? packet.geometryFamily
                      : null,
                  finalCoverageBuilderStatus:
                    typeof packet.finalCoverageBuilderStatus === 'string'
                      ? packet.finalCoverageBuilderStatus
                      : null
                }
              ]
            : []
      )
      const localPointToScreen = (point: Vec2) => ({
        x: (runtime.selectedRect.x + point.x) * runtime.zoom + runtime.viewport.x,
        y: (runtime.selectedRect.y + point.y) * runtime.zoom + runtime.viewport.y
      })
      const getBoundaryLengthTable = (points: Vec2[]) => {
        const cumulative = [0]
        for (let index = 1; index < points.length; index += 1) {
          const previous = points[index - 1]
          const current = points[index]
          cumulative.push(
            cumulative[index - 1] +
              Math.hypot(current.x - previous.x, current.y - previous.y)
          )
        }
        return cumulative
      }
      const pointToSegmentProjection = (
        point: Vec2,
        start: Vec2,
        end: Vec2
      ) => {
        const dx = end.x - start.x
        const dy = end.y - start.y
        const lengthSquared = dx * dx + dy * dy
        if (lengthSquared <= 1e-8) {
          return {
            amount: 0,
            point: start,
            distance: Math.hypot(point.x - start.x, point.y - start.y)
          }
        }
        const amount = Math.max(
          0,
          Math.min(
            1,
            ((point.x - start.x) * dx + (point.y - start.y) * dy) /
              lengthSquared
          )
        )
        const projected = {
          x: start.x + dx * amount,
          y: start.y + dy * amount
        }
        return {
          amount,
          point: projected,
          distance: Math.hypot(point.x - projected.x, point.y - projected.y)
        }
      }
      const projectPointToBoundaryDistance = (point: Vec2, points: Vec2[]) => {
        if (points.length < 2) {
          return null
        }
        const cumulative = getBoundaryLengthTable(points)
        let best:
          | {
              distance: number
              distanceAlong: number
              point: Vec2
              tangent: Vec2
            }
          | null = null
        for (let index = 1; index < points.length; index += 1) {
          const start = points[index - 1]
          const end = points[index]
          const projection = pointToSegmentProjection(point, start, end)
          const segmentLength = Math.hypot(end.x - start.x, end.y - start.y)
          const tangent =
            segmentLength <= 1e-6
              ? { x: 1, y: 0 }
              : {
                  x: (end.x - start.x) / segmentLength,
                  y: (end.y - start.y) / segmentLength
                }
          const distanceAlong =
            (cumulative[index - 1] ?? 0) + segmentLength * projection.amount
          if (!best || projection.distance < best.distance) {
            best = {
              distance: projection.distance,
              distanceAlong,
              point: projection.point,
              tangent
            }
          }
        }
        return best
      }
      const samplePointToLocal = (sample: CanonicalRuleSample) =>
        runtime.pointCoordinateSpace === 'workspace'
          ? {
              x: sample.point.x - runtime.selectedRect.x,
              y: sample.point.y - runtime.selectedRect.y
            }
          : sample.point
      const sampleBoundaryPointsAtDistance = (
        points: Vec2[],
        distance: number
      ) => {
        if (points.length === 0) {
          return null
        }
        if (points.length === 1) {
          return {
            point: points[0],
            tangent: { x: 1, y: 0 }
          }
        }
        const cumulative = getBoundaryLengthTable(points)
        const totalLength = cumulative[cumulative.length - 1] ?? 0
        const clampedDistance = Math.max(0, Math.min(totalLength, distance))
        for (let index = 1; index < points.length; index += 1) {
          const startDistance = cumulative[index - 1]
          const endDistance = cumulative[index]
          if (clampedDistance > endDistance && index < points.length - 1) {
            continue
          }
          const start = points[index - 1]
          const end = points[index]
          const length = Math.max(1e-6, endDistance - startDistance)
          const t = (clampedDistance - startDistance) / length
          const dx = end.x - start.x
          const dy = end.y - start.y
          const tangentLength = Math.max(1e-6, Math.hypot(dx, dy))
          return {
            point: {
              x: start.x + dx * t,
              y: start.y + dy * t
            },
            tangent: {
              x: dx / tangentLength,
              y: dy / tangentLength
            }
          }
        }
        const previous = points[points.length - 2]
        const point = points[points.length - 1]
        const dx = point.x - previous.x
        const dy = point.y - previous.y
        const tangentLength = Math.max(1e-6, Math.hypot(dx, dy))
        return {
          point,
          tangent: {
            x: dx / tangentLength,
            y: dy / tangentLength
          }
        }
      }
      const makeBoundaryRuleSample = (
        interval: (typeof visibleIntervals)[number],
        sourceDistance: number,
        idSuffix: string
      ): CanonicalRuleSample | null => {
        if (
          interval.boundaryStartDistance === null ||
          interval.boundaryPoints.length < 2
        ) {
          return null
        }
        const boundarySample = sampleBoundaryPointsAtDistance(
          interval.boundaryPoints,
          sourceDistance - interval.boundaryStartDistance
        )
        if (!boundarySample) {
          return null
        }
        const screenPoint = localPointToScreen(boundarySample.point)
        return {
          segmentId: `boundary:${interval.splitRangeId ?? interval.intervalId ?? 'unknown'}:${idSuffix}`,
          segmentIndex: interval.sourceSegmentIndex ?? -1,
          t: 0.5,
          sourceDistance,
          distance: sourceDistance,
          point: boundarySample.point,
          screenPoint,
          normal: {
            x: -boundarySample.tangent.y,
            y: boundarySample.tangent.x
          }
        }
      }
      const makePolygonRuleSample = (
        interval: (typeof visibleIntervals)[number],
        idSuffix: string
      ): CanonicalRuleSample | null => {
        const polygon = interval.polygons
          .slice()
          .sort((left, right) => right.length - left.length)[0]
        if (!polygon || polygon.length < 3) {
          return null
        }
        const bounds = polygon.reduce(
          (state, vertex) => ({
            minX: Math.min(state.minX, vertex.x),
            minY: Math.min(state.minY, vertex.y),
            maxX: Math.max(state.maxX, vertex.x),
            maxY: Math.max(state.maxY, vertex.y)
          }),
          {
            minX: Number.POSITIVE_INFINITY,
            minY: Number.POSITIVE_INFINITY,
            maxX: Number.NEGATIVE_INFINITY,
            maxY: Number.NEGATIVE_INFINITY
          }
        )
        if (
          Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) *
            runtime.zoom <
          2
        ) {
          return null
        }
        const point = polygon.reduce(
          (sum, vertex) => ({
            x: sum.x + vertex.x / polygon.length,
            y: sum.y + vertex.y / polygon.length
          }),
          { x: 0, y: 0 }
        )
        let screenPoint = localPointToScreen(point)
        const screenBounds = polygon
          .map(localPointToScreen)
          .reduce(
            (state, vertex) => ({
              minX: Math.min(state.minX, vertex.x),
              minY: Math.min(state.minY, vertex.y),
              maxX: Math.max(state.maxX, vertex.x),
              maxY: Math.max(state.maxY, vertex.y)
            }),
            {
              minX: Number.POSITIVE_INFINITY,
              minY: Number.POSITIVE_INFINITY,
              maxX: Number.NEGATIVE_INFINITY,
              maxY: Number.NEGATIVE_INFINITY
            }
          )
        let foundRedPixel: Vec2 | null = null
        const minPixelX = Math.max(0, Math.floor(screenBounds.minX) - 2)
        const minPixelY = Math.max(0, Math.floor(screenBounds.minY) - 2)
        const maxPixelX = Math.min(width - 1, Math.ceil(screenBounds.maxX) + 2)
        const maxPixelY = Math.min(height - 1, Math.ceil(screenBounds.maxY) + 2)
        for (
          let pixelY = minPixelY;
          pixelY <= maxPixelY && foundRedPixel === null;
          pixelY += 1
        ) {
          for (let pixelX = minPixelX; pixelX <= maxPixelX; pixelX += 1) {
            if (isRed(read(actualData, pixelX, pixelY))) {
              foundRedPixel = { x: pixelX, y: pixelY }
              break
            }
          }
        }
        if (foundRedPixel) {
          screenPoint = foundRedPixel
        }
        const first = polygon[0]
        const second = polygon[1] ?? { x: first.x + 1, y: first.y }
        const dx = second.x - first.x
        const dy = second.y - first.y
        const tangentLength = Math.max(1e-6, Math.hypot(dx, dy))
        return {
          segmentId: `boundary:${interval.splitRangeId ?? interval.intervalId ?? 'unknown'}:${idSuffix}`,
          segmentIndex: interval.sourceSegmentIndex ?? -1,
          t: 0.5,
          sourceDistance: (interval.startDistance + interval.endDistance) / 2,
          distance: (interval.startDistance + interval.endDistance) / 2,
          point,
          screenPoint,
          normal: {
            x: -dy / tangentLength,
            y: dx / tangentLength
          }
        }
      }
      const isConstrainedRenderPacket = (
        interval: (typeof visibleIntervals)[number]
      ) =>
        interval.polygons.length > 0 &&
        (interval.finalCoverageBuilderStatus === 'product-final' ||
          (runtime.stroke.style === 'solid' &&
            runtime.stroke.position !== 'center' &&
            interval.geometryFamily === 'constrained-solid'))
      const constrainedPacketSamples =
        runtime.stroke.position !== 'center'
          ? visibleIntervals.flatMap((interval) => {
              if (!isConstrainedRenderPacket(interval)) {
                return []
              }
              const sample = makePolygonRuleSample(interval, 'paint')
              return sample ? [sample] : []
            })
          : []
      const constrainedPacketGapSamples =
        runtime.stroke.style === 'dashed' && runtime.stroke.position !== 'center'
          ? [
              ...visibleIntervals
                .reduce((groups, interval) => {
                  if (!isConstrainedRenderPacket(interval) || !interval.splitRangeId) {
                    return groups
                  }
                  groups.set(interval.splitRangeId, [
                    ...(groups.get(interval.splitRangeId) ?? []),
                    interval
                  ])
                  return groups
                }, new Map<string, typeof visibleIntervals>())
                .values()
            ].flatMap((group) => {
              const sorted = group
                .slice()
                .sort((left, right) => left.startDistance - right.startDistance)
              return sorted.flatMap((interval, index) => {
                const next = sorted[index + 1]
                if (!next) {
                  return []
                }
                const gapLength = next.startDistance - interval.endDistance
                const safeGapInset =
                  capPathReach + Math.max(1, runtime.stroke.width * 0.16)
                if (gapLength <= safeGapInset * 2 + 1) {
                  return []
                }
                const distance = (interval.endDistance + next.startDistance) / 2
                if (cycleLength > 0) {
                  const phase =
                    ((distance % cycleLength) + cycleLength) % cycleLength
                  const isAuthoredGap =
                    phase >= dashLength + capPathReach &&
                    phase <= cycleLength - capPathReach
                  if (!isAuthoredGap) {
                    return []
                  }
                }
                const sample = makeBoundaryRuleSample(
                  interval,
                  distance,
                  `gap:${index}`
                )
                return sample ? [sample] : []
              })
            })
          : []
      const ruleSamples =
        constrainedPacketSamples.length > 0
          ? [
              ...sourceDerivedSamples,
              ...constrainedPacketSamples,
              ...constrainedPacketGapSamples
            ]
          : [...samples, ...sourceDerivedSamples]
      const getIntervalComparisonDistance = (
        sample: CanonicalRuleSample,
        interval: (typeof visibleIntervals)[number]
      ) => {
        if (
          !sample.segmentId.startsWith('boundary:') &&
          interval.boundaryPoints.length >= 2
        ) {
          const projection = projectPointToBoundaryDistance(
            samplePointToLocal(sample),
            interval.boundaryPoints
          )
          const projectionTolerance = Math.max(1.5, runtime.stroke.width * 0.5)
          return projection && projection.distance <= projectionTolerance
            ? projection.distanceAlong +
                (interval.boundaryStartDistance ??
                  interval.splitRangeStartDistance ??
                  0)
            : Number.NaN
        }
        return interval.sourceSegmentIndex !== null &&
          sample.sourceSegmentDistance !== undefined
          ? sample.sourceSegmentDistance
          : sample.sourceDistance
      }
      const findContainingVisibleInterval = (sample: CanonicalRuleSample) => {
        const epsilon = Math.max(0.75, runtime.stroke.width * 0.03)
        let best:
          | (typeof visibleIntervals)[number] & {
              distanceToCenter: number
            }
          | null = null
        for (const interval of visibleIntervals) {
          if (
            interval.sourceSegmentIndex !== null &&
            interval.sourceSegmentIndex !== sample.segmentIndex
          ) {
            continue
          }
          const comparisonDistance = getIntervalComparisonDistance(
            sample,
            interval
          )
          if (!Number.isFinite(comparisonDistance)) {
            continue
          }
          if (
            comparisonDistance < interval.startDistance - epsilon ||
            comparisonDistance > interval.endDistance + epsilon
          ) {
            continue
          }
          const distanceToCenter = Math.abs(
            comparisonDistance -
              (interval.startDistance + interval.endDistance) / 2
          )
          if (!best || distanceToCenter < best.distanceToCenter) {
            best = { ...interval, distanceToCenter }
          }
        }
        return best
      }
      const getBoundaryProjectedRuleSample = (
        sample: CanonicalRuleSample,
        interval: ReturnType<typeof findContainingVisibleInterval>
      ) => {
        if (
          !interval ||
          sample.segmentId.startsWith('boundary:') ||
          interval.boundaryPoints.length < 2
        ) {
          return null
        }
        const projection = projectPointToBoundaryDistance(
          samplePointToLocal(sample),
          interval.boundaryPoints
        )
        const projectionTolerance = Math.max(1.5, runtime.stroke.width * 0.5)
        if (!projection || projection.distance > projectionTolerance) {
          return null
        }
        const projectedDistance =
          projection.distanceAlong +
          (interval.boundaryStartDistance ??
            interval.splitRangeStartDistance ??
            0)
        return {
          ...sample,
          sourceDistance: projectedDistance,
          distance: projectedDistance,
          point:
            runtime.pointCoordinateSpace === 'workspace'
              ? {
                  x: projection.point.x + runtime.selectedRect.x,
                  y: projection.point.y + runtime.selectedRect.y
                }
              : projection.point,
          screenPoint: localPointToScreen(projection.point),
          normal: {
            x: projection.tangent.y,
            y: -projection.tangent.x
          }
        }
      }
      const isTerminalBoundaryDomainSample = (
        sample: CanonicalRuleSample,
        interval: ReturnType<typeof findContainingVisibleInterval>
      ) => {
        if (!interval) {
          return false
        }
        if (
          interval.geometryFamily !== 'constrained-dashed' ||
          interval.finalCoverageBuilderStatus !== 'product-final'
        ) {
          return false
        }
        const terminalReach = Math.max(1, runtime.stroke.width * runtime.zoom)
        const sourceReach = Math.max(1, runtime.stroke.width * 2)
        const distanceToIntervalStart = Math.abs(
          sample.sourceDistance - interval.startDistance
        )
        const distanceToIntervalEnd = Math.abs(
          sample.sourceDistance - interval.endDistance
        )
        const distanceToSplitStart =
          interval.splitRangeStartDistance === null
            ? Number.POSITIVE_INFINITY
            : Math.abs(
                sample.sourceDistance - interval.splitRangeStartDistance
              )
        const distanceToSplitEnd =
          interval.splitRangeEndDistance === null
            ? Number.POSITIVE_INFINITY
            : Math.abs(sample.sourceDistance - interval.splitRangeEndDistance)
        return (
          distanceToIntervalStart <= terminalReach ||
          distanceToIntervalEnd <= terminalReach ||
          distanceToSplitStart <= sourceReach ||
          distanceToSplitEnd <= sourceReach ||
          interval.terminalRole === 'start' ||
          interval.terminalRole === 'end' ||
          interval.terminalRole === 'start-end'
        )
      }
      const findNearestVisibleInterval = (sample: CanonicalRuleSample) => {
        let nearest:
          | (typeof visibleIntervals)[number] & {
              distanceToStart: number
              distanceToEnd: number
              distanceToInterval: number
            }
          | null = null
        for (const interval of visibleIntervals) {
          const comparisonDistance = getIntervalComparisonDistance(
            sample,
            interval
          )
          if (!Number.isFinite(comparisonDistance)) {
            continue
          }
          const distanceToStart = comparisonDistance - interval.startDistance
          const distanceToEnd = comparisonDistance - interval.endDistance
          const distanceToInterval =
            comparisonDistance < interval.startDistance
              ? interval.startDistance - comparisonDistance
              : comparisonDistance > interval.endDistance
                ? comparisonDistance - interval.endDistance
                : 0
          if (!nearest || distanceToInterval < nearest.distanceToInterval) {
            nearest = {
              ...interval,
              distanceToStart,
              distanceToEnd,
              distanceToInterval
            }
          }
        }
        return nearest
      }
      const getDashDiagnostics = (sample: CanonicalRuleSample) => {
        if (runtime.stroke.style !== 'dashed') {
          return {}
        }
        const nearest = findNearestVisibleInterval(sample)
        return {
          sourceDistance: roundMetric(sample.sourceDistance),
          phase: roundMetric(getPhase(sample)),
          dashLength,
          gapLength,
          cycleLength,
          capPathReach,
          nearestVisibleInterval: nearest
            ? {
                intervalId: nearest.intervalId,
                startDistance: roundMetric(nearest.startDistance),
                endDistance: roundMetric(nearest.endDistance),
                distanceToStart: roundMetric(nearest.distanceToStart),
                distanceToEnd: roundMetric(nearest.distanceToEnd),
                distanceToInterval: roundMetric(nearest.distanceToInterval),
                geometryFamily: nearest.geometryFamily,
                finalCoverageBuilderStatus: nearest.finalCoverageBuilderStatus
              }
            : null
        }
      }
      const isDashSample = (sample: CanonicalRuleSample) => {
        if (runtime.stroke.style !== 'dashed') {
          return true
        }
        if (
          runtime.stroke.position !== 'center' &&
          sample.segmentId.startsWith('boundary:')
        ) {
          return !sample.segmentId.includes(':gap:')
        }
        if (
          runtime.stroke.position !== 'center' &&
          !sample.segmentId.startsWith('boundary:')
        ) {
          const containingInterval = findContainingVisibleInterval(sample)
          if (containingInterval) {
            return true
          }
          if (capPathReach <= 0) {
            return false
          }
          const nearest = findNearestVisibleInterval(sample)
          return (
            nearest !== null &&
            nearest.geometryFamily === 'constrained-dashed' &&
            nearest.finalCoverageBuilderStatus === 'product-final' &&
            nearest.distanceToInterval <=
              capPathReach + Math.max(0.75, runtime.stroke.width * 0.08)
          )
        }
        if (cycleLength <= 0) {
          return true
        }
        const phase = getPhase(sample)
        return (
          phase < dashLength + capPathReach ||
          phase > cycleLength - capPathReach
        )
      }
      const isCapExtensionSample = (sample: CanonicalRuleSample) => {
        if (
          runtime.stroke.style !== 'dashed' ||
          capPathReach <= 0 ||
          cycleLength <= 0
        ) {
          return false
        }
        if (runtime.stroke.position !== 'center' && visibleIntervals.length > 0) {
          if (findContainingVisibleInterval(sample)) {
            return false
          }
          const nearest = findNearestVisibleInterval(sample)
          return (
            nearest !== null &&
            nearest.geometryFamily === 'constrained-dashed' &&
            nearest.finalCoverageBuilderStatus === 'product-final' &&
            nearest.distanceToInterval <=
              capPathReach + Math.max(0.75, runtime.stroke.width * 0.08)
          )
        }
        const phase = getPhase(sample)
        return phase >= dashLength && isDashSample(sample)
      }
      const isTerminalCapFootprintSample = (sample: CanonicalRuleSample) => {
        if (
          runtime.stroke.style !== 'dashed' ||
          capPathReach <= 0 ||
          cycleLength <= 0
        ) {
          return false
        }
        const nearest = findNearestVisibleInterval(sample)
        if (
          !nearest ||
          nearest.geometryFamily !== 'constrained-dashed' ||
          nearest.finalCoverageBuilderStatus !== 'product-final'
        ) {
          return false
        }
        const rasterReach = capPathReach + Math.max(1, runtime.stroke.width * 0.3)
        return nearest.distanceToInterval <= rasterReach
      }
      const findLegalOverlappingDashSample = (sample: CanonicalRuleSample) => {
        const threshold = Math.max(24, runtime.stroke.width * runtime.zoom * 4)
        let nearest:
          | {
              segmentId: string
              segmentIndex: number
              t: number
              distance: number
              phase: number
            }
          | null = null
        for (const candidate of [...overlapSamples, ...sourceDerivedSamples]) {
          if (
            candidate.segmentId === sample.segmentId ||
            candidate.segmentIndex === sample.segmentIndex
          ) {
            continue
          }
          if (!isDashSample(candidate)) {
            continue
          }
          const distance = Math.hypot(
            candidate.screenPoint.x - sample.screenPoint.x,
            candidate.screenPoint.y - sample.screenPoint.y
          )
          if (distance > threshold) {
            continue
          }
          if (!nearest || distance < nearest.distance) {
            nearest = {
              segmentId: candidate.segmentId,
              segmentIndex: candidate.segmentIndex,
              t: roundMetric(candidate.t),
              distance: roundMetric(distance),
              phase: roundMetric(getPhase(candidate))
            }
          }
        }
        return nearest
      }

      const failureMarkers: CanonicalRuleFailure[] = []
      const segmentStats = new Map<
        string,
        {
          segmentId: string
          segmentIndex: number
          inspectedSampleCount: number
          dashExpectedSampleCount: number
          expectedPaintedSampleCount: number
          missingExpectedSampleCount: number
          wrongSideDominanceSampleCount: number
          gapLeakSampleCount: number
          unclassifiedDomainSampleCount: number
        }
      >()
      let inspectedSampleCount = 0
      let dashExpectedSampleCount = 0
      let gapExpectedSampleCount = 0
      let expectedPaintedSampleCount = 0
      let missingExpectedSampleCount = 0
      let wrongSideDominanceSampleCount = 0
      let gapLeakSampleCount = 0
      let allowedCrossSourceOverlapSampleCount = 0
      let allowedSideFootprintSampleCount = 0
      let unclassifiedDomainSampleCount = 0
      const pushFailure = (
        category: string,
        sample: CanonicalRuleSample,
        detail: Record<string, unknown> = {}
      ) => {
        failureMarkers.push({
          category,
          segmentId: sample.segmentId,
          segmentIndex: sample.segmentIndex,
          t: Math.round(sample.t * 1000) / 1000,
          x: Math.round(sample.screenPoint.x),
          y: Math.round(sample.screenPoint.y),
          detail: {
            ...detail,
            ...getDashDiagnostics(sample)
          }
        })
      }
      const getSegmentStat = (sample: CanonicalRuleSample) => {
        const existing = segmentStats.get(sample.segmentId)
        if (existing) {
          return existing
        }
        const created = {
          segmentId: sample.segmentId,
          segmentIndex: sample.segmentIndex,
          inspectedSampleCount: 0,
          dashExpectedSampleCount: 0,
          expectedPaintedSampleCount: 0,
          missingExpectedSampleCount: 0,
          wrongSideDominanceSampleCount: 0,
          gapLeakSampleCount: 0,
          unclassifiedDomainSampleCount: 0
        }
        segmentStats.set(sample.segmentId, created)
        return created
      }

      for (const sample of ruleSamples) {
        const metadataVisibleInterval = findContainingVisibleInterval(sample)
        const boundaryProjectedSample =
          runtime.stroke.style === 'dashed' &&
          runtime.stroke.position !== 'center'
            ? getBoundaryProjectedRuleSample(sample, metadataVisibleInterval)
            : null
        const measurementSample = boundaryProjectedSample ?? sample
        const plusFill = countAlong(
          baselineData,
          isFill,
          measurementSample,
          1,
          3,
          24
        )
        const minusFill = countAlong(
          baselineData,
          isFill,
          measurementSample,
          -1,
          3,
          24
        )
        const fillDifference = Math.abs(plusFill - minusFill)
        const fillSign: 1 | -1 | null =
          fillDifference <= 2 ? null : plusFill > minusFill ? 1 : -1
        const stat = getSegmentStat(sample)
        inspectedSampleCount += 1
        stat.inspectedSampleCount += 1
        const dashExpected = isDashSample(sample)
        if (dashExpected) {
          dashExpectedSampleCount += 1
          stat.dashExpectedSampleCount += 1
        } else {
          gapExpectedSampleCount += 1
        }

        const scanLimit = Math.max(12, runtime.stroke.width * runtime.zoom * 2)
        const centerRed =
          countAlong(actualData, isRed, measurementSample, 1, 0, 3) +
          countAlong(actualData, isRed, measurementSample, -1, 0, 3)
        const plusRed = countAlong(
          actualData,
          isRed,
          measurementSample,
          1,
          3,
          scanLimit
        )
        const minusRed = countAlong(
          actualData,
          isRed,
          measurementSample,
          -1,
          3,
          scanLimit
        )
        const totalRed = plusRed + minusRed + centerRed

        if (!dashExpected) {
          if (totalRed >= 3) {
            if (
              runtime.stroke.position !== 'center' &&
              sample.segmentId.includes(':self-intersection:')
            ) {
              allowedCrossSourceOverlapSampleCount += 1
              continue
            }
            if (isTerminalCapFootprintSample(sample)) {
              allowedSideFootprintSampleCount += 1
              continue
            }
            const legalOverlap = findLegalOverlappingDashSample(sample)
            if (legalOverlap) {
              allowedCrossSourceOverlapSampleCount += 1
              continue
            }
            if (
              runtime.stroke.position === 'center' &&
              centerRed === 0 &&
              (plusRed === 0 || minusRed === 0)
            ) {
              allowedSideFootprintSampleCount += 1
              continue
            }
            const minimumGapLeakRed = Math.max(
              6,
              Math.round(runtime.stroke.width * runtime.zoom * 0.75)
            )
            if (
              centerRed <= 0 &&
              totalRed < minimumGapLeakRed &&
              sample.segmentId.startsWith('boundary:')
            ) {
              allowedSideFootprintSampleCount += 1
              continue
            }
            gapLeakSampleCount += 1
            stat.gapLeakSampleCount += 1
            pushFailure(
              runtime.stroke.position === 'inside'
                ? 'inside_gap_leak'
                : 'gap_leak',
              sample,
              { plusRed, minusRed, centerRed }
            )
          }
          continue
        }

        if (
          runtime.stroke.position !== 'center' &&
          sample.segmentId.startsWith('boundary:')
        ) {
          const expectedPainted = totalRed >= 2
          if (expectedPainted) {
            expectedPaintedSampleCount += 1
            stat.expectedPaintedSampleCount += 1
          } else {
            missingExpectedSampleCount += 1
            stat.missingExpectedSampleCount += 1
            pushFailure('missing_dash', sample, {
              plusRed,
              minusRed,
              centerRed,
              expected: 'constrained-packet'
            })
          }
          continue
        }

        if (runtime.stroke.position === 'center') {
          const capExtensionExpected = isCapExtensionSample(sample)
          const expectedPainted = capExtensionExpected
            ? totalRed >= 1
            : plusRed >= 1 && minusRed >= 1
          if (expectedPainted) {
            expectedPaintedSampleCount += 1
            stat.expectedPaintedSampleCount += 1
          } else {
            missingExpectedSampleCount += 1
            stat.missingExpectedSampleCount += 1
            pushFailure(
              runtime.stroke.style === 'dashed'
                ? 'missing_dash'
                : 'missing_expected_output',
              sample,
              {
                plusRed,
                minusRed,
                centerRed,
                expected: capExtensionExpected ? 'cap-footprint' : 'both-sides'
              }
            )
          }
          continue
        }

        if (boundaryProjectedSample) {
          const footprintRadius = Math.max(
            6,
            runtime.stroke.width * runtime.zoom * 1.25
          )
          const footprintRed = countAround(
            actualData,
            isRed,
            measurementSample,
            footprintRadius
          )
          const minimumFootprintRed = Math.max(
            12,
            Math.round(runtime.stroke.width * runtime.zoom * 0.9)
          )
          if (footprintRed >= minimumFootprintRed) {
            expectedPaintedSampleCount += 1
            stat.expectedPaintedSampleCount += 1
            continue
          }
        }

        const metadataExpectedSign =
          runtime.stroke.style === 'dashed' &&
          runtime.stroke.position !== 'center' &&
          metadataVisibleInterval?.selectedSide
            ? boundaryProjectedSample
              ? metadataVisibleInterval.selectedSide
              : ((-metadataVisibleInterval.selectedSide) as 1 | -1)
            : null

        if (!fillSign && !metadataExpectedSign) {
          unclassifiedDomainSampleCount += 1
          stat.unclassifiedDomainSampleCount += 1
          if (dashExpected) {
            dashExpectedSampleCount -= 1
            stat.dashExpectedSampleCount -= 1
          }
          continue
        }

        const expectedSign: 1 | -1 =
          fillSign
            ? runtime.stroke.position === 'inside'
              ? fillSign
              : ((-fillSign) as 1 | -1)
            : metadataExpectedSign ?? 1
        const expectedRed = expectedSign === 1 ? plusRed : minusRed
        const forbiddenRed = expectedSign === 1 ? minusRed : plusRed
        if (expectedRed >= 1) {
          expectedPaintedSampleCount += 1
          stat.expectedPaintedSampleCount += 1
        } else {
          missingExpectedSampleCount += 1
          stat.missingExpectedSampleCount += 1
          pushFailure(
            runtime.stroke.style === 'dashed' &&
              !sample.segmentId.startsWith('boundary:')
              ? 'source_derived_probe_missing'
              : runtime.stroke.style === 'dashed'
              ? 'missing_dash'
              : 'missing_expected_output',
            measurementSample,
            { plusRed, minusRed, expectedSign, plusFill, minusFill }
          )
        }
        if (forbiddenRed >= 2 && forbiddenRed > expectedRed * 1.15) {
          if (
            runtime.stroke.style === 'dashed' &&
            runtime.stroke.position !== 'center' &&
            expectedRed >= 1 &&
            (isTerminalBoundaryDomainSample(sample, metadataVisibleInterval) ||
              isTerminalCapFootprintSample(sample))
          ) {
            allowedSideFootprintSampleCount += 1
            continue
          }
          wrongSideDominanceSampleCount += 1
          stat.wrongSideDominanceSampleCount += 1
          pushFailure(
            runtime.stroke.style === 'dashed'
              ? 'wrong_side_dash'
              : 'wrong_side_output',
            measurementSample,
            {
              plusRed,
              minusRed,
              expectedSign,
              forbiddenRed,
              expectedRed,
              plusFill,
              minusFill
            }
          )
        }
      }

      let redPixelCount = 0
      let darkRedPixelCount = 0
      for (let index = 0; index < actualData.length; index += 4) {
        const pixel = {
          r: actualData[index] ?? 0,
          g: actualData[index + 1] ?? 0,
          b: actualData[index + 2] ?? 0,
          a: actualData[index + 3] ?? 0
        }
        if (isRed(pixel)) {
          redPixelCount += 1
          if (pixel.r < 98 && pixel.g < 34 && pixel.b < 34) {
            darkRedPixelCount += 1
          }
        }
      }
      const terminalRecordCount = metadata.boundaryDomainPackets.reduce(
        (count: number, packet: { figmaLikeSplitRangeTerminals?: unknown[] }) =>
          count + (packet.figmaLikeSplitRangeTerminals?.length ?? 0),
        0
      )
      const splitTerminalRecordCount = terminalRecordCount
      const productFinalPacketCount = metadata.boundaryDomainPackets.filter(
        (packet: { finalCoverageBuilderStatus?: unknown }) =>
          packet.finalCoverageBuilderStatus === 'product-final'
      ).length
      if (runtime.stroke.style === 'dashed' && runtime.stroke.position !== 'center') {
        if (productFinalPacketCount <= 0) {
          failureMarkers.push({
            category: 'lost_interval_provenance',
            detail: { productFinalPacketCount }
          })
        }
        if (terminalRecordCount <= 0) {
          failureMarkers.push({
            category: 'split_terminal_missing',
            detail: { terminalRecordCount }
          })
        }
      }

      const sourceSegmentSummaries = Array.from(segmentStats.values()).map(
        (stat) => ({
          ...stat,
          expectedRecall:
            stat.dashExpectedSampleCount > 0
              ? stat.expectedPaintedSampleCount / stat.dashExpectedSampleCount
              : 1
        })
      )
      for (const summary of sourceSegmentSummaries) {
        const failedExpectedSamples =
          summary.missingExpectedSampleCount +
          summary.wrongSideDominanceSampleCount
        if (summary.expectedRecall < 0.35 && failedExpectedSamples > 0) {
          failureMarkers.push({
            category: 'source_segment_dropout',
            segmentId: summary.segmentId,
            segmentIndex: summary.segmentIndex,
            detail: summary
          })
        }
      }
      const expectedRecall =
        dashExpectedSampleCount > 0
          ? expectedPaintedSampleCount / dashExpectedSampleCount
          : 1
      const worstSegmentExpectedRecall = sourceSegmentSummaries.reduce(
        (worst, stat) => Math.min(worst, stat.expectedRecall),
        1
      )
      const wrongSideDominanceRate =
        dashExpectedSampleCount > 0
          ? wrongSideDominanceSampleCount / dashExpectedSampleCount
          : 0
      const gapLeakRate =
        gapExpectedSampleCount > 0
          ? gapLeakSampleCount / gapExpectedSampleCount
          : 0
      const doubleAlphaRate =
        redPixelCount > 0 ? darkRedPixelCount / redPixelCount : 0

      context.clearRect(0, 0, width, height)
      context.drawImage(actualImage, 0, 0)
      context.save()
      context.lineWidth = 1.5
      context.strokeStyle = 'rgba(0, 145, 255, 0.92)'
      context.beginPath()
      ruleSamples.forEach((sample, index) => {
        if (index === 0) {
          context.moveTo(sample.screenPoint.x, sample.screenPoint.y)
        } else {
          context.lineTo(sample.screenPoint.x, sample.screenPoint.y)
        }
      })
      context.stroke()
      context.restore()

      const drawProbe = (
        sample: CanonicalRuleSample,
        sign: 1 | -1,
        color: string
      ) => {
        const x = sample.screenPoint.x + sample.normal.x * 13 * sign
        const y = sample.screenPoint.y + sample.normal.y * 13 * sign
        context.fillStyle = color
        context.fillRect(x - 1.5, y - 1.5, 3, 3)
      }
      for (const sample of ruleSamples) {
        if (runtime.stroke.position === 'center') {
          drawProbe(sample, 1, 'rgba(57,255,20,0.75)')
          drawProbe(sample, -1, 'rgba(57,255,20,0.75)')
          continue
        }
        const plusFill = countAlong(baselineData, isFill, sample, 1, 3, 24)
        const minusFill = countAlong(baselineData, isFill, sample, -1, 3, 24)
        if (plusFill === minusFill) {
          drawProbe(sample, 1, 'rgba(255,220,0,0.88)')
          drawProbe(sample, -1, 'rgba(255,220,0,0.88)')
          continue
        }
        const fillSign: 1 | -1 = plusFill > minusFill ? 1 : -1
        const expectedSign: 1 | -1 =
          runtime.stroke.position === 'inside' ? fillSign : -fillSign
        drawProbe(sample, expectedSign, 'rgba(57,255,20,0.78)')
        drawProbe(sample, expectedSign === 1 ? -1 : 1, 'rgba(255,0,190,0.6)')
      }
      for (const marker of failureMarkers.slice(0, 240)) {
        if (typeof marker.x !== 'number' || typeof marker.y !== 'number') {
          continue
        }
        context.strokeStyle =
          marker.category === 'wrong_side_dash' ||
          marker.category === 'wrong_side_output'
            ? 'rgba(255,0,190,0.96)'
            : marker.category.includes('gap')
              ? 'rgba(255,150,0,0.96)'
              : 'rgba(255,230,0,0.96)'
        context.lineWidth = 2
        context.beginPath()
        context.moveTo(marker.x - 6, marker.y - 6)
        context.lineTo(marker.x + 6, marker.y + 6)
        context.moveTo(marker.x + 6, marker.y - 6)
        context.lineTo(marker.x - 6, marker.y + 6)
        context.stroke()
      }
      context.fillStyle = 'rgba(0,0,0,0.72)'
      context.fillRect(12, 12, 520, 128)
      context.fillStyle = 'white'
      context.font = '13px monospace'
      const legend = [
        `${caseInfo.key} | ${runtime.stroke.style}/${runtime.stroke.position}`,
        `green=expected side  magenta=forbidden side  yellow/orange=fail`,
        `expected recall=${expectedRecall.toFixed(3)} worst segment=${worstSegmentExpectedRecall.toFixed(3)}`,
        `wrong-side=${wrongSideDominanceSampleCount} gap-leak=${gapLeakSampleCount} missing=${missingExpectedSampleCount}`,
        `failures=${failureMarkers.length} terminals=${terminalRecordCount} product-final=${productFinalPacketCount}`
      ]
      legend.forEach((line, index) => {
        context.fillText(line, 24, 34 + index * 22)
      })

      const metrics: CanonicalRuleOverlayMetrics = {
        caseKey: caseInfo.key,
        style: runtime.stroke.style,
        position: runtime.stroke.position,
        capType: runtime.stroke.capType,
        joinType: runtime.stroke.joinType,
        selectedId: runtime.selectedId,
        zoom: runtime.zoom,
        viewport: runtime.viewport,
        screenshotSize: { width, height },
        inspectedSampleCount,
        dashExpectedSampleCount,
        gapExpectedSampleCount,
        expectedPaintedSampleCount,
        missingExpectedSampleCount,
        wrongSideDominanceSampleCount,
        gapLeakSampleCount,
        allowedCrossSourceOverlapSampleCount,
        allowedSideFootprintSampleCount,
        unclassifiedDomainSampleCount,
        sourceSegmentSummaries,
        expectedRecall,
        worstSegmentExpectedRecall,
        wrongSideDominanceRate,
        gapLeakRate,
        redPixelCount,
        doubleAlphaRate,
        terminalRecordCount,
        splitTerminalRecordCount,
        productFinalPacketCount,
        boundaryDomainIntervalCount:
          metadata.boundaryDomainIntervalIds?.length ?? 0,
        failureMarkers,
        overlayLegend: legend
      }
      return {
        overlayDataUrl: canvas.toDataURL('image/png'),
        metrics
      }
    },
    {
      actualDataUrl: toDataUrl(options.screenshot),
      baselineDataUrl: toDataUrl(options.baselineScreenshot),
      caseInfo: {
        key: options.key,
        style: options.style,
        position: options.position,
        capType: options.capType,
        joinType: options.joinType
      },
      metadata: options.metadata,
      overlapSamples,
      runtime,
      samples,
      sourceDerivedSamples
    }
  )
  fs.mkdirSync(path.dirname(options.overlayPath), { recursive: true })
  fs.writeFileSync(
    options.overlayPath,
    Buffer.from(result.overlayDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64')
  )
  writeJson(options.metricsPath, result.metrics)
  return result.metrics
}

export const expectCanonicalRuleOverlayPass = (
  metrics: CanonicalRuleOverlayMetrics
) => {
  expect(
    metrics.failureMarkers,
    JSON.stringify(
      {
        caseKey: metrics.caseKey,
        expectedRecall: metrics.expectedRecall,
        worstSegmentExpectedRecall: metrics.worstSegmentExpectedRecall,
        wrongSideDominanceRate: metrics.wrongSideDominanceRate,
        gapLeakRate: metrics.gapLeakRate,
        failureMarkers: metrics.failureMarkers.slice(0, 24)
      },
      null,
      2
    )
  ).toEqual([])
}

const readJson = <T>(filePath: string): T | undefined => {
  if (!fs.existsSync(filePath)) {
    return undefined
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T
}

const expectCanonicalCropCoverage = (
  caseKey: string,
  cropAnalysis: {
    id: string
    redPixelCount: number
    nonBackgroundPixelCount: number
  }[]
) => {
  expect(cropAnalysis, caseKey).toHaveLength(6)
  for (const crop of cropAnalysis) {
    expect(
      crop.nonBackgroundPixelCount,
      JSON.stringify({ caseKey, crop }, null, 2)
    ).toBeGreaterThan(900)
    if (crop.id !== 'self-intersection') {
      expect(
        crop.redPixelCount,
        JSON.stringify({ caseKey, crop }, null, 2)
      ).toBeGreaterThan(80)
    }
  }
}

const expectOpenTerminalCoverage = (
  caseKey: string,
  openTerminalAnalysis: {
    id: string
    redPixelCount: number
    nonBackgroundPixelCount: number
    terminalCapFootprint?: {
      forwardRed: boolean
      backwardRed: boolean
      backwardCornerRed: boolean
    }
  },
  capType?: SelfCheckCapType
) => {
  expect(openTerminalAnalysis.id, caseKey).toBe('open-path-terminal')
  expect(
    openTerminalAnalysis.nonBackgroundPixelCount,
    JSON.stringify({ caseKey, openTerminalAnalysis }, null, 2)
  ).toBeGreaterThan(100)
  expect(
    openTerminalAnalysis.redPixelCount,
    JSON.stringify({ caseKey, openTerminalAnalysis }, null, 2)
  ).toBeGreaterThan(80)
  if (capType) {
    expect(
      openTerminalAnalysis.terminalCapFootprint?.forwardRed,
      JSON.stringify({ caseKey, openTerminalAnalysis }, null, 2)
    ).toBe(true)
    expect(
      openTerminalAnalysis.terminalCapFootprint?.backwardRed,
      JSON.stringify({ caseKey, openTerminalAnalysis }, null, 2)
    ).toBe(capType !== 'butt')
    if (capType === 'square') {
      expect(
        openTerminalAnalysis.terminalCapFootprint?.backwardCornerRed,
        JSON.stringify({ caseKey, openTerminalAnalysis }, null, 2)
      ).toBe(true)
    }
    if (capType === 'round') {
      expect(
        openTerminalAnalysis.terminalCapFootprint?.backwardCornerRed,
        JSON.stringify({ caseKey, openTerminalAnalysis }, null, 2)
      ).toBe(false)
    }
  }
}

export const runCanonicalSolidCase = async (
  page: Page,
  caseDef: {
    key: string
    position: SelfCheckStrokePosition
    joinType: SelfCheckJoinType
  }
) => {
  const paths = getCanonicalCasePaths('solid', caseDef.key)
  fs.mkdirSync(paths.cropDir, { recursive: true })
  const { baselineScreenshot, metadata, screenshot } =
    await prepareSelfCheckCase(page, {
      style: 'solid',
      position: caseDef.position,
      capType: 'round',
      joinType: caseDef.joinType
    })
  fs.writeFileSync(paths.baselineScreenshot, baselineScreenshot)
  fs.writeFileSync(paths.screenshot, screenshot)
  writeJson(paths.metadata, metadata)

  const diffAnalysis = await analyzeScreenshotPair(
    page,
    baselineScreenshot,
    screenshot
  )
  const ruleOverlayReview = await captureCanonicalRuleOverlay(page, {
    key: caseDef.key,
    style: 'solid',
    position: caseDef.position,
    joinType: caseDef.joinType,
    baselineScreenshot,
    screenshot,
    metadata,
    overlayPath: paths.ruleOverlay,
    metricsPath: paths.ruleOverlayMetrics
  })
  const cropAnalysis = await captureCanonicalCrops(
    page,
    metadata,
    paths.cropDir
  )
  const segmentAdherenceAnalysis = await analyzeSolidSegmentAdherence(
    page,
    screenshot,
    metadata
  )
  const segmentAdherenceReview = await captureSolidSegmentAdherenceReview(
    page,
    paths.cropDir
  )
  await createOpenCurvedPath(page, {
    style: 'solid',
    position: caseDef.position,
    capType: 'round',
    joinType: caseDef.joinType
  })
  const openTerminalAnalysis = await captureOpenPathTerminalCrop(
    page,
    paths.cropDir,
    'open-path-terminal'
  )
  const analysis = {
    case: caseDef,
    diffAnalysis,
    ruleOverlayReview,
    cropAnalysis,
    segmentAdherenceAnalysis,
    segmentAdherenceReview,
    openTerminalAnalysis
  }
  writeJson(paths.analysis, analysis)

  expectCanonicalRuleOverlayPass(ruleOverlayReview)
  expect(metadata.exportPacketCount, caseDef.key).toBeGreaterThan(0)
  expect(
    metadata.computedStrokes?.[0]?.position,
    JSON.stringify(metadata.computedStrokes, null, 2)
  ).toBe(caseDef.position)
  expect(
    metadata.computedStrokes?.[0]?.joinType,
    JSON.stringify(metadata.computedStrokes, null, 2)
  ).toBe(caseDef.joinType)
  expect(diffAnalysis.changedPixelCount, caseDef.key).toBeGreaterThan(1200)
  expect(diffAnalysis.redPixelCount, caseDef.key).toBeGreaterThan(500)
  expect(
    diffAnalysis.darkOverdrawPixelCount,
    JSON.stringify({ caseDef, diffAnalysis }, null, 2)
  ).toBeLessThan(120)
  expectCanonicalCropCoverage(caseDef.key, cropAnalysis)
  expect(
    segmentAdherenceAnalysis.coveredSamples.length,
    JSON.stringify({ caseDef, segmentAdherenceAnalysis }, null, 2)
  ).toBeGreaterThanOrEqual(8)
  expect(
    segmentAdherenceAnalysis.failedSamples,
    JSON.stringify({ caseDef, segmentAdherenceAnalysis }, null, 2)
  ).toEqual([])
  if (caseDef.position === 'outside') {
    expect(
      segmentAdherenceReview.coveredSamples.length,
      JSON.stringify({ caseDef, segmentAdherenceReview }, null, 2)
    ).toBeGreaterThanOrEqual(4)
    expect(
      segmentAdherenceReview.failedSamples,
      JSON.stringify({ caseDef, segmentAdherenceReview }, null, 2)
    ).toEqual([])
  }
  expectOpenTerminalCoverage(caseDef.key, openTerminalAnalysis)
  if (caseDef.position !== 'center') {
    expect(
      metadata.boundaryDomainPackets.some(
        (packet) =>
          packet.strokePosition === caseDef.position &&
          packet.resolutionStatus === 'exact-constrained'
      ),
      JSON.stringify(metadata.boundaryDomainPackets, null, 2)
    ).toBe(true)
  }

  return analysis
}

export const runCanonicalDashedCase = async (
  page: Page,
  caseDef: {
    key: string
    position: SelfCheckStrokePosition
    capType: SelfCheckCapType
    joinType?: SelfCheckJoinType
    captureSourceJoinReview?: boolean
  }
) => {
  const joinType = caseDef.joinType ?? 'round'
  const paths = getCanonicalCasePaths('dashed', caseDef.key)
  fs.mkdirSync(paths.cropDir, { recursive: true })
  const { baselineScreenshot, metadata, screenshot } =
    await prepareSelfCheckCase(page, {
      style: 'dashed',
      position: caseDef.position,
      capType: caseDef.capType,
      joinType
    })
  fs.writeFileSync(paths.baselineScreenshot, baselineScreenshot)
  fs.writeFileSync(paths.screenshot, screenshot)
  writeJson(paths.metadata, metadata)

  const diffAnalysis = await analyzeScreenshotPair(
    page,
    baselineScreenshot,
    screenshot
  )
  const ruleOverlayReview = await captureCanonicalRuleOverlay(page, {
    key: caseDef.key,
    style: 'dashed',
    position: caseDef.position,
    capType: caseDef.capType,
    joinType,
    baselineScreenshot,
    screenshot,
    metadata,
    overlayPath: paths.ruleOverlay,
    metricsPath: paths.ruleOverlayMetrics
  })
  const legalAnalysis = await analyzeSelfCheckScreenshots(
    page,
    baselineScreenshot,
    screenshot,
    metadata
  )
  const cropAnalysis = await captureCanonicalCrops(
    page,
    metadata,
    paths.cropDir
  )
  const outsideLeakCrop = await captureDiagnosticComponentCrop(
    page,
    paths.cropDir,
    'largest-outside-leak',
    legalAnalysis.outsideComponents?.[0]
  )
  const darkOverdrawCrop = await captureDiagnosticComponentCrop(
    page,
    paths.cropDir,
    'largest-dark-overdraw',
    legalAnalysis.darkOverdrawComponents?.[0]
  )
  const sourceJoinReview =
    caseDef.captureSourceJoinReview === true
      ? await captureDashedSourceJoinReviewCrops(page, paths.cropDir)
      : undefined
  await createOpenCurvedPath(page, {
    style: 'dashed',
    position: caseDef.position,
    capType: caseDef.capType,
    joinType
  })
  const openTerminalAnalysis = await captureOpenPathTerminalCrop(
    page,
    paths.cropDir,
    'open-path-terminal'
  )
  const analysis = {
    case: caseDef,
    diffAnalysis,
    ruleOverlayReview,
    legalAnalysis,
    cropAnalysis,
    diagnosticCrops: {
      outsideLeakCrop,
      darkOverdrawCrop
    },
    ...(sourceJoinReview ? { sourceJoinReview } : {}),
    openTerminalAnalysis
  }
  writeJson(paths.analysis, analysis)

  expectCanonicalRuleOverlayPass(ruleOverlayReview)
  expect(metadata.exportPacketCount, caseDef.key).toBeGreaterThan(0)
  expect(
    metadata.computedStrokes?.[0]?.position,
    JSON.stringify(metadata.computedStrokes, null, 2)
  ).toBe(caseDef.position)
  expect(
    metadata.computedStrokes?.[0]?.capType,
    JSON.stringify(metadata.computedStrokes, null, 2)
  ).toBe(caseDef.capType)
  expect(
    metadata.computedStrokes?.[0]?.joinType,
    JSON.stringify(metadata.computedStrokes, null, 2)
  ).toBe(joinType)
  expect(diffAnalysis.changedPixelCount, caseDef.key).toBeGreaterThan(800)
  expect(diffAnalysis.redPixelCount, caseDef.key).toBeGreaterThan(300)
  expect(
    diffAnalysis.darkOverdrawPixelCount,
    JSON.stringify({ caseDef, diffAnalysis }, null, 2)
  ).toBeLessThan(160)
  if (caseDef.position === 'inside') {
    expect(
      legalAnalysis.outsideRedPixelCount,
      JSON.stringify({ caseDef, legalAnalysis }, null, 2)
    ).toBeLessThanOrEqual(24)
    expect(
      legalAnalysis.maxOutsideComponentArea,
      JSON.stringify({ caseDef, legalAnalysis }, null, 2)
    ).toBeLessThanOrEqual(8)
    expect(
      legalAnalysis.darkOverdrawPixelCount,
      JSON.stringify({ caseDef, legalAnalysis }, null, 2)
    ).toBeLessThanOrEqual(24)
    expect(
      legalAnalysis.maxDarkOverdrawComponentArea,
      JSON.stringify({ caseDef, legalAnalysis }, null, 2)
    ).toBeLessThanOrEqual(8)
  }
  expectCanonicalCropCoverage(caseDef.key, cropAnalysis)
  expectOpenTerminalCoverage(caseDef.key, openTerminalAnalysis, caseDef.capType)
  if (caseDef.position !== 'center') {
    expect(
      metadata.boundaryDomainPackets.some(
        (packet) =>
          packet.strokePosition === caseDef.position &&
          packet.resolutionStatus === 'exact-constrained' &&
          packet.finalCoverageBuilderStatus === 'product-final'
      ),
      JSON.stringify(metadata.boundaryDomainPackets, null, 2)
    ).toBe(true)
    expect(
      metadata.boundaryDomainPackets.some((packet) =>
        packet.geometryId?.includes('boundary-terminal-join')
      ),
      JSON.stringify(metadata.boundaryDomainPackets, null, 2)
    ).toBe(false)
  }

  return analysis
}

export const runCanonicalDashedOutsideSourceJoinCase = async (
  page: Page,
  caseDef: {
    key: string
    joinType: SelfCheckJoinType
  }
) => {
  const analysis = await runCanonicalDashedCase(page, {
    key: caseDef.key,
    position: 'outside',
    capType: 'butt',
    joinType: caseDef.joinType,
    captureSourceJoinReview: true
  })
  const paths = getCanonicalCasePaths('dashed', caseDef.key)
  const sourceJoinReview = analysis.sourceJoinReview ?? []
  writeJson(paths.analysis, analysis)
  expect(
    sourceJoinReview,
    JSON.stringify({ caseDef, sourceJoinReview }, null, 2)
  ).toHaveLength(SELF_CHECK_SOURCE_SEGMENTS.length)
  expect(
    SELF_CHECK_SOURCE_SEGMENTS.every((segment) =>
      sourceJoinReview.some(
        (crop) => crop.id === `source-join-${segment.startId}-closeup`
      )
    ),
    JSON.stringify({ caseDef, sourceJoinReview }, null, 2)
  ).toBe(true)
  for (const crop of sourceJoinReview) {
    expect(
      crop.nonBackgroundPixelCount,
      JSON.stringify({ caseDef, crop }, null, 2)
    ).toBeGreaterThan(10_000)
    expect(
      crop.redPixelCount,
      JSON.stringify({ caseDef, crop }, null, 2)
    ).toBeGreaterThan(1_000)
  }
  expect(
    {
      key: analysis.case.key,
      position: analysis.case.position,
      capType: analysis.case.capType,
      joinType: analysis.case.joinType
    },
    JSON.stringify({ caseDef, case: analysis.case }, null, 2)
  ).toEqual({
    key: caseDef.key,
    position: 'outside',
    capType: 'butt',
    joinType: caseDef.joinType
  })
  return analysis
}

export const runCanonicalDashedOutsideSourceJoinMatrixCase = async (
  page: Page,
  caseDef: {
    key: string
    joinType: SelfCheckJoinType
  }
) => {
  const analysis = await runCanonicalDashedCase(page, {
    key: caseDef.key,
    position: 'outside',
    capType: 'butt',
    joinType: caseDef.joinType,
    captureSourceJoinReview: false
  })
  expect(
    {
      key: analysis.case.key,
      position: analysis.case.position,
      capType: analysis.case.capType,
      joinType: analysis.case.joinType
    },
    JSON.stringify({ caseDef, case: analysis.case }, null, 2)
  ).toEqual({
    key: caseDef.key,
    position: 'outside',
    capType: 'butt',
    joinType: caseDef.joinType
  })
  return analysis
}

export const runCanonicalDashedOutsideNoFillSourceJoinMatrixCase = async (
  page: Page,
  caseDef: {
    key: string
    joinType: SelfCheckJoinType
    sourceKind?: 'curved' | 'polyline'
  }
) => {
  const sourceKind = caseDef.sourceKind ?? 'curved'
  const key =
    sourceKind === 'polyline'
      ? `${caseDef.key}-polyline-no-fill`
      : `${caseDef.key}-no-fill`
  const paths = getCanonicalCasePaths('dashed', key)
  fs.mkdirSync(paths.cropDir, { recursive: true })
  const { baselineScreenshot, metadata, screenshot } =
    await prepareSelfCheckNoFillCase(page, {
      style: 'dashed',
      position: 'outside',
      capType: 'butt',
      joinType: caseDef.joinType,
      sourceKind
    })
  fs.writeFileSync(paths.baselineScreenshot, baselineScreenshot)
  fs.writeFileSync(paths.screenshot, screenshot)
  writeJson(paths.metadata, metadata)

  const ruleOverlayReview = await captureCanonicalRuleOverlay(page, {
    key,
    style: 'dashed',
    position: 'outside',
    capType: 'butt',
    joinType: caseDef.joinType,
    baselineScreenshot,
    screenshot,
    metadata,
    overlayPath: paths.ruleOverlay,
    metricsPath: paths.ruleOverlayMetrics
  })
  const legalAnalysis = await analyzeSelfCheckScreenshots(
    page,
    baselineScreenshot,
    screenshot,
    metadata
  )
  const smoothAnchorIds = ['tp-12', 'tp-13', 'tp-16'] as const
  const smoothSourceVertexJoinPackets =
    sourceKind === 'curved'
      ? smoothAnchorIds.flatMap((anchorId) => {
          const anchor = SELF_CHECK_SOURCE_POINTS[anchorId]
          return metadata.boundaryDomainPackets.flatMap((packet) => {
            if (!packet.geometryId?.includes(':source-vertex-join:')) {
              return []
            }
            const isLocal = packet.polygons.some((polygon) =>
              polygon.some(
                (point) =>
                  Math.hypot(point.x - anchor.x, point.y - anchor.y) <= 28
              )
            )
            return isLocal
              ? [
                  {
                    anchorId,
                    geometryId: packet.geometryId,
                    terminalRole: packet.figmaLikeTerminalRole,
                    boundaryRole: packet.figmaLikeBoundaryRole,
                    finalCoverageBuilderStatus:
                      packet.finalCoverageBuilderStatus
                  }
                ]
              : []
          })
        })
      : []
  const analysis = {
    case: {
      key,
      position: 'outside',
      capType: 'butt',
      joinType: caseDef.joinType,
      sourceKind,
      fill: false
    },
    legalAnalysis,
    smoothSourceVertexJoinPackets,
    ruleOverlayReview
  }
  writeJson(paths.analysis, analysis)
  expect(
    smoothSourceVertexJoinPackets,
    JSON.stringify({ caseDef, smoothSourceVertexJoinPackets }, null, 2)
  ).toEqual([])
  if (sourceKind === 'polyline') {
    const requiredSharpAnchorIds = Object.keys(SELF_CHECK_SOURCE_POINTS).filter(
      (anchorId) => /^tp-\d+$/.test(anchorId)
    )
    const sourceJoinPacketAnchorIds = Object.entries(SELF_CHECK_SOURCE_POINTS)
      .filter(([anchorId]) => /^tp-\d+$/.test(anchorId))
      .flatMap(([anchorId, anchor]) => {
        const hasLocalJoinPacket = metadata.boundaryDomainPackets.some(
          (packet) =>
            packet.geometryId?.includes(':source-vertex-join:') &&
            packet.polygons.some((polygon) =>
              polygon.some(
                (point) =>
                  Math.hypot(point.x - anchor.x, point.y - anchor.y) <= 34
              )
            )
        )
        return hasLocalJoinPacket ? [anchorId] : []
      })
    const missingSharpSourceVertexJoinPackets = requiredSharpAnchorIds.filter(
      (anchorId) => !sourceJoinPacketAnchorIds.includes(anchorId)
    )
    expect(
      missingSharpSourceVertexJoinPackets,
      JSON.stringify(
        {
          caseDef,
          requiredSharpAnchorIds,
          sourceJoinPacketAnchorIds,
          missingSharpSourceVertexJoinPackets
        },
        null,
        2
      )
    ).toEqual([])
  }
  expectCanonicalRuleOverlayPass(ruleOverlayReview)
  expect(
    {
      key: analysis.case.key,
      position: analysis.case.position,
      capType: analysis.case.capType,
      joinType: analysis.case.joinType,
      sourceKind: analysis.case.sourceKind,
      fill: analysis.case.fill
    },
    JSON.stringify({ caseDef, case: analysis.case }, null, 2)
  ).toEqual({
    key,
    position: 'outside',
    capType: 'butt',
    joinType: caseDef.joinType,
    sourceKind,
    fill: false
  })
  return analysis
}

export const runCanonicalDashedOutsideSourceJoinReviewCase = async (
  page: Page,
  caseDef: {
    key: string
    joinType: SelfCheckJoinType
  }
) => {
  const paths = getCanonicalCasePaths('dashed', caseDef.key)
  fs.mkdirSync(paths.cropDir, { recursive: true })
  const { baselineScreenshot, metadata, screenshot } =
    await prepareSelfCheckCase(page, {
      style: 'dashed',
      position: 'outside',
      capType: 'butt',
      joinType: caseDef.joinType
    })
  fs.writeFileSync(paths.baselineScreenshot, baselineScreenshot)
  fs.writeFileSync(paths.screenshot, screenshot)
  writeJson(paths.metadata, metadata)

  const sourceJoinReview = await captureDashedSourceJoinReviewCrops(
    page,
    paths.cropDir
  )
  const existingAnalysis =
    readJson<Record<string, unknown>>(paths.analysis) ?? {}
  const analysis = {
    ...existingAnalysis,
    case: {
      key: caseDef.key,
      position: 'outside',
      capType: 'butt',
      joinType: caseDef.joinType
    },
    sourceJoinReview
  }
  writeJson(paths.analysis, analysis)

  expect(
    sourceJoinReview,
    JSON.stringify({ caseDef, sourceJoinReview }, null, 2)
  ).toHaveLength(SELF_CHECK_SOURCE_SEGMENTS.length)
  expect(
    SELF_CHECK_SOURCE_SEGMENTS.every((segment) =>
      sourceJoinReview.some(
        (crop) => crop.id === `source-join-${segment.startId}-closeup`
      )
    ),
    JSON.stringify({ caseDef, sourceJoinReview }, null, 2)
  ).toBe(true)
  for (const crop of sourceJoinReview) {
    expect(
      crop.nonBackgroundPixelCount,
      JSON.stringify({ caseDef, crop }, null, 2)
    ).toBeGreaterThan(10_000)
    expect(
      crop.redPixelCount,
      JSON.stringify({ caseDef, crop }, null, 2)
    ).toBeGreaterThan(1_000)
  }

  return analysis
}
