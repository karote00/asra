import {
  FillGradientTypes,
  FillKinds,
  clampOpacity,
  clampUnit,
  parseColor,
  subdivideCubicBezierAtHalf,
  type FillAttrs,
  type PositionData,
  type RGBAColor
} from '@asyra/utils'
import type { RenderFillStyle } from './gradient-fill'
import { createRenderResourceStyle } from '../types/render-object'

export interface EvenOddSegment {
  type: 'line' | 'cubicBezier'
  points: number[]
}

export interface EvenOddPath {
  segments: EvenOddSegment[]
}

export interface EvenOddShape {
  paths: EvenOddPath[]
}

export interface EvenOddFillOptions {
  width: number
  height: number
  offsetX?: number
  offsetY?: number
  maxRasterPixels?: number
  shape: EvenOddShape
  fills: FillAttrs[]
}

export interface EvenOddFillResult {
  style: RenderFillStyle
  dispose: () => void
}

type Vec2 = PositionData
type RGBA = RGBAColor

interface PreparedSegment {
  type: 'line' | 'cubicBezier'
  points: number[]
  minY: number
  maxY: number
}

const FLATNESS_EPSILON = 0.2
const MAX_SUBDIVISION_DEPTH = 12
const EPSILON = 1e-6
const DEFAULT_MAX_RASTER_PIXELS = 400_000

const getCanvasContext = (
  width: number,
  height: number
): {
  canvas: HTMLCanvasElement | OffscreenCanvas
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
} | null => {
  if (width <= 0 || height <= 0) {
    return null
  }

  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) {
      return null
    }
    return { canvas, ctx }
  }

  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) {
      return null
    }
    return { canvas, ctx }
  }

  return null
}

const normalizeFillEntries = (fills: FillAttrs[]): FillAttrs[] =>
  Array.isArray(fills) ? fills.filter((fill) => !!fill) : []

const toRGBA = (value: string, opacity: number): RGBA | null => {
  const parsed = parseColor(value)
  if (!parsed) {
    return null
  }

  return {
    r: parsed.r,
    g: parsed.g,
    b: parsed.b,
    a: clampOpacity(parsed.a * opacity)
  }
}

const createSolidSampler = (
  fill: FillAttrs
): ((x: number, y: number) => RGBA) | null => {
  const color = toRGBA(fill.color, fill.opacity)
  if (!color) {
    return null
  }

  return () => color
}

const createGradientSampler = (
  fill: FillAttrs
): ((x: number, y: number) => RGBA) | null => {
  if (!fill.gradient) {
    return null
  }

  const stops = [...fill.gradient.gradientStops]
    .map((stop) => {
      const rgba = toRGBA(stop.color, stop.opacity * fill.opacity)
      if (!rgba) {
        return null
      }

      return {
        position: clampUnit(stop.position),
        color: rgba
      }
    })
    .filter((stop): stop is { position: number; color: RGBA } => !!stop)
    .sort((a, b) => a.position - b.position)

  if (stops.length === 0) {
    return null
  }

  const handles = fill.gradient.gradientHandles ?? []
  const start = handles[0] ?? { x: 0, y: 0 }
  const end = handles[1] ?? { x: 1, y: 0 }
  const side = handles[2] ?? null

  const getT = (x: number, y: number) => {
    switch (fill.gradient?.gradientType) {
      case FillGradientTypes.RADIAL: {
        const dx = end.x - start.x
        const dy = end.y - start.y
        const radiusX = Math.max(Math.hypot(dx, dy), EPSILON)
        const radiusY = side
          ? Math.max(Math.hypot(side.x - start.x, side.y - start.y), EPSILON)
          : radiusX
        const nx = (x - start.x) / radiusX
        const ny = (y - start.y) / radiusY
        return Math.sqrt(nx * nx + ny * ny)
      }
      case FillGradientTypes.ANGULAR: {
        const baseAngle = Math.atan2(end.y - start.y, end.x - start.x)
        const angle = Math.atan2(y - start.y, x - start.x)
        const delta = angle - baseAngle
        const normalized =
          ((delta % (Math.PI * 2)) + Math.PI * 2) / (Math.PI * 2)
        return normalized
      }
      case FillGradientTypes.DIAMOND: {
        const dx = end.x - start.x
        const dy = end.y - start.y
        const radiusX = Math.max(Math.hypot(dx, dy), EPSILON)
        const radiusY = side
          ? Math.max(Math.hypot(side.x - start.x, side.y - start.y), EPSILON)
          : radiusX
        const nx = Math.abs(x - start.x) / radiusX
        const ny = Math.abs(y - start.y) / radiusY
        return (nx + ny) / 2
      }
      case FillGradientTypes.LINEAR:
      default: {
        const vx = end.x - start.x
        const vy = end.y - start.y
        const denom = vx * vx + vy * vy
        if (denom <= EPSILON) {
          return 0
        }

        return ((x - start.x) * vx + (y - start.y) * vy) / denom
      }
    }
  }

  return (x, y) => {
    const t = clampUnit(getT(x, y))

    if (stops.length === 1) {
      return stops[0].color
    }

    let lower = stops[0]
    let upper = stops[stops.length - 1]

    for (let i = 0; i < stops.length - 1; i += 1) {
      const current = stops[i]
      const next = stops[i + 1]
      if (t >= current.position && t <= next.position) {
        lower = current
        upper = next
        break
      }
    }

    if (upper.position === lower.position) {
      return upper.color
    }

    const ratio = clampUnit(
      (t - lower.position) / (upper.position - lower.position)
    )
    return {
      r: lower.color.r + (upper.color.r - lower.color.r) * ratio,
      g: lower.color.g + (upper.color.g - lower.color.g) * ratio,
      b: lower.color.b + (upper.color.b - lower.color.b) * ratio,
      a: lower.color.a + (upper.color.a - lower.color.a) * ratio
    }
  }
}

const createFillSampler = (
  fill: FillAttrs
): ((x: number, y: number) => RGBA) | null => {
  if (!fill.visible) {
    return null
  }

  if (fill.kind === FillKinds.GRADIENT) {
    return createGradientSampler(fill)
  }

  return createSolidSampler(fill)
}

const prepareSegments = (shape: EvenOddShape): PreparedSegment[] => {
  const prepared: PreparedSegment[] = []

  shape.paths.forEach((path) => {
    path.segments.forEach((segment) => {
      const points = segment.points
      if (segment.type === 'line' && points.length === 4) {
        const minY = Math.min(points[1], points[3])
        const maxY = Math.max(points[1], points[3])
        prepared.push({
          type: segment.type,
          points,
          minY,
          maxY
        })
        return
      }

      if (segment.type === 'cubicBezier' && points.length === 8) {
        const minY = Math.min(points[1], points[3], points[5], points[7])
        const maxY = Math.max(points[1], points[3], points[5], points[7])
        prepared.push({
          type: segment.type,
          points,
          minY,
          maxY
        })
      }
    })
  })

  return prepared
}

const collectLineIntersection = (
  y: number,
  p1: Vec2,
  p2: Vec2,
  intersections: number[]
) => {
  if (Math.abs(p1.y - p2.y) <= EPSILON) {
    return
  }

  const minY = Math.min(p1.y, p2.y)
  const maxY = Math.max(p1.y, p2.y)
  if (y < minY || y >= maxY) {
    return
  }

  const t = (y - p1.y) / (p2.y - p1.y)
  const x = p1.x + (p2.x - p1.x) * t
  intersections.push(x)
}

const distanceToLine = (point: Vec2, a: Vec2, b: Vec2): number => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const denom = Math.hypot(dx, dy)
  if (denom <= EPSILON) {
    return Math.hypot(point.x - a.x, point.y - a.y)
  }

  return Math.abs(dy * point.x - dx * point.y + b.x * a.y - b.y * a.x) / denom
}

const collectCubicIntersections = (
  y: number,
  p0: Vec2,
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  intersections: number[],
  depth = 0
) => {
  const minY = Math.min(p0.y, p1.y, p2.y, p3.y)
  const maxY = Math.max(p0.y, p1.y, p2.y, p3.y)
  if (y < minY || y >= maxY) {
    return
  }

  const flatness =
    Math.max(distanceToLine(p1, p0, p3), distanceToLine(p2, p0, p3)) || 0
  if (depth >= MAX_SUBDIVISION_DEPTH || flatness <= FLATNESS_EPSILON) {
    collectLineIntersection(y, p0, p3, intersections)
    return
  }

  const { left, right } = subdivideCubicBezierAtHalf(p0, p1, p2, p3)
  collectCubicIntersections(
    y,
    left[0],
    left[1],
    left[2],
    left[3],
    intersections,
    depth + 1
  )
  collectCubicIntersections(
    y,
    right[0],
    right[1],
    right[2],
    right[3],
    intersections,
    depth + 1
  )
}

const buildTextureFill = (
  canvas: HTMLCanvasElement | OffscreenCanvas,
  width: number,
  height: number
): { style: RenderFillStyle; dispose: () => void } => {
  const resource = createRenderResourceStyle({
    kind: 'raster-pattern',
    data: {
      source: canvas,
      width,
      height,
      repeat: 'no-repeat',
      scale: { x: 1 / width, y: 1 / height }
    }
  })

  return {
    style: { fill: resource.style },
    dispose: resource.dispose
  }
}

export const createEvenOddFillStyle = (
  options: EvenOddFillOptions
): EvenOddFillResult | null => {
  const baseWidth = Math.max(1, options.width)
  const baseHeight = Math.max(1, options.height)
  const offsetX = options.offsetX ?? 0
  const offsetY = options.offsetY ?? 0
  const basePixels = baseWidth * baseHeight
  const maxPixels = options.maxRasterPixels ?? DEFAULT_MAX_RASTER_PIXELS

  let scale = Math.min(1, Math.sqrt(maxPixels / basePixels))
  scale = Math.max(scale, 0.25)
  let supersample = basePixels <= 200_000 ? 2 : 1
  let rasterScale = scale * supersample
  if (basePixels * rasterScale * rasterScale > maxPixels) {
    supersample = 1
    rasterScale = scale
  }

  const width = Math.max(1, Math.ceil(baseWidth * rasterScale))
  const height = Math.max(1, Math.ceil(baseHeight * rasterScale))

  const preparedFills = normalizeFillEntries(options.fills)
  if (preparedFills.length === 0) {
    return null
  }

  const samplers = preparedFills
    .map((fill) => createFillSampler(fill))
    .filter((sampler): sampler is (x: number, y: number) => RGBA => !!sampler)

  if (samplers.length === 0) {
    return null
  }

  const preparedSegments = prepareSegments(options.shape)
  if (preparedSegments.length === 0) {
    return null
  }

  const canvasContext = getCanvasContext(width, height)
  if (!canvasContext) {
    return null
  }

  const { canvas, ctx } = canvasContext
  const image = ctx.createImageData(width, height)
  const data = image.data
  const scaleX = baseWidth / width
  const scaleY = baseHeight / height

  for (let row = 0; row < height; row += 1) {
    const y = offsetY + (row + 0.5) * scaleY
    const intersections: number[] = []

    preparedSegments.forEach((segment) => {
      if (y < segment.minY || y >= segment.maxY) {
        return
      }

      if (segment.type === 'line') {
        const [x1, y1, x2, y2] = segment.points
        collectLineIntersection(
          y,
          { x: x1, y: y1 },
          { x: x2, y: y2 },
          intersections
        )
        return
      }

      const [x1, y1, cx1, cy1, cx2, cy2, x2, y2] = segment.points
      collectCubicIntersections(
        y,
        { x: x1, y: y1 },
        { x: cx1, y: cy1 },
        { x: cx2, y: cy2 },
        { x: x2, y: y2 },
        intersections
      )
    })

    if (intersections.length === 0) {
      continue
    }

    intersections.sort((a, b) => a - b)

    for (let i = 0; i + 1 < intersections.length; i += 2) {
      const startX = intersections[i]
      const endX = intersections[i + 1]
      if (endX <= startX) {
        continue
      }

      const clippedStart = Math.max(startX, offsetX)
      const clippedEnd = Math.min(endX, offsetX + baseWidth)
      if (clippedEnd <= clippedStart) {
        continue
      }

      const startIndex = Math.max(
        0,
        Math.ceil((clippedStart - offsetX) / scaleX - 0.5)
      )
      const endIndex = Math.min(
        width - 1,
        Math.floor((clippedEnd - offsetX) / scaleX - 0.5)
      )

      if (startIndex > endIndex) {
        continue
      }

      for (let col = startIndex; col <= endIndex; col += 1) {
        const x = offsetX + (col + 0.5) * scaleX
        const nx = baseWidth ? (x - offsetX) / baseWidth : 0
        const ny = baseHeight ? (y - offsetY) / baseHeight : 0
        const idx = (row * width + col) * 4

        let dstR = data[idx]
        let dstG = data[idx + 1]
        let dstB = data[idx + 2]
        let dstA = data[idx + 3] / 255

        samplers.forEach((sample) => {
          const color = sample(nx, ny)
          if (color.a <= 0) {
            return
          }

          const srcA = clampUnit(color.a)
          const outA = srcA + dstA * (1 - srcA)
          if (outA <= EPSILON) {
            dstR = 0
            dstG = 0
            dstB = 0
            dstA = 0
            return
          }

          const outR = (color.r * srcA + dstR * dstA * (1 - srcA)) / outA
          const outG = (color.g * srcA + dstG * dstA * (1 - srcA)) / outA
          const outB = (color.b * srcA + dstB * dstA * (1 - srcA)) / outA

          dstR = outR
          dstG = outG
          dstB = outB
          dstA = outA
        })

        data[idx] = Math.round(dstR)
        data[idx + 1] = Math.round(dstG)
        data[idx + 2] = Math.round(dstB)
        data[idx + 3] = Math.round(dstA * 255)
      }
    }
  }

  ctx.putImageData(image, 0, 0)

  return buildTextureFill(canvas, width, height)
}
