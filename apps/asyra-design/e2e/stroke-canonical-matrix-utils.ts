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
    analysis: path.join(caseDir, 'analysis.json')
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
  }
) => {
  await createSelfCheckStar(page, {
    includeStroke: false,
    capType: options.capType,
    joinType: options.joinType,
    position: options.position,
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
  },
  cropDir: string
) => {
  fs.mkdirSync(cropDir, { recursive: true })
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
  const probes = [
    { id: 'tp-14', point: SELF_CHECK_SOURCE_POINTS['tp-14'], size: 180 },
    { id: 'tp-15', point: SELF_CHECK_SOURCE_POINTS['tp-15'], size: 180 },
    { id: 'tp-16', point: SELF_CHECK_SOURCE_POINTS['tp-16'], size: 180 },
    { id: 'self-intersection', point: { x: 185, y: 155 }, size: 180 },
    { id: 'curve-sample-a', point: curveA, size: 160 },
    { id: 'curve-sample-b', point: curveB, size: 160 }
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
      const points = {
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
        { type: 'vector', points, segments, networks, closed: false },
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
    cropAnalysis,
    segmentAdherenceAnalysis,
    segmentAdherenceReview,
    openTerminalAnalysis
  }
  writeJson(paths.analysis, analysis)

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
  }
) => {
  const paths = getCanonicalCasePaths('dashed', caseDef.key)
  fs.mkdirSync(paths.cropDir, { recursive: true })
  const { baselineScreenshot, metadata, screenshot } =
    await prepareSelfCheckCase(page, {
      style: 'dashed',
      position: caseDef.position,
      capType: caseDef.capType,
      joinType: 'round'
    })
  fs.writeFileSync(paths.baselineScreenshot, baselineScreenshot)
  fs.writeFileSync(paths.screenshot, screenshot)
  writeJson(paths.metadata, metadata)

  const diffAnalysis = await analyzeScreenshotPair(
    page,
    baselineScreenshot,
    screenshot
  )
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
  await createOpenCurvedPath(page, {
    style: 'dashed',
    position: caseDef.position,
    capType: caseDef.capType,
    joinType: 'round'
  })
  const openTerminalAnalysis = await captureOpenPathTerminalCrop(
    page,
    paths.cropDir,
    'open-path-terminal'
  )
  const analysis = {
    case: caseDef,
    diffAnalysis,
    legalAnalysis,
    cropAnalysis,
    diagnosticCrops: {
      outsideLeakCrop,
      darkOverdrawCrop
    },
    openTerminalAnalysis
  }
  writeJson(paths.analysis, analysis)

  expect(metadata.exportPacketCount, caseDef.key).toBeGreaterThan(0)
  expect(
    metadata.computedStrokes?.[0]?.position,
    JSON.stringify(metadata.computedStrokes, null, 2)
  ).toBe(caseDef.position)
  expect(
    metadata.computedStrokes?.[0]?.capType,
    JSON.stringify(metadata.computedStrokes, null, 2)
  ).toBe(caseDef.capType)
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
