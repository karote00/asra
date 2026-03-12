import {
  CanvasSource,
  FillGradient,
  FillPattern,
  Matrix,
  Texture
} from 'pixi.js'

export interface RenderGradientPoint {
  x: number
  y: number
}

export interface RenderGradientColorStop {
  offset: number
  color: string
}

export interface CreateRenderGradientFillOptions {
  type: 'linear' | 'radial' | 'angular' | 'diamond'
  colorStops: RenderGradientColorStop[]
  textureSpace?: 'local' | 'global'
  start?: RenderGradientPoint
  end?: RenderGradientPoint
  center?: RenderGradientPoint
  outerCenter?: RenderGradientPoint
  innerRadius?: number
  outerRadius?: number
  /** Secondary radius for elliptical radial gradients (perpendicular to primary axis). */
  radiusY?: number
  /** Rotation angle in radians for the radial gradient ellipse. */
  rotation?: number
}

export interface RenderFillStyle {
  fill: unknown
}

/**
 * Resolution of the offscreen canvas used for angular/diamond gradient textures.
 * Kept modest to avoid performance overhead while still looking smooth.
 */
const GRADIENT_TEXTURE_SIZE = 256

type RGBA = [number, number, number, number]

interface ParsedGradientStop {
  offset: number
  color: RGBA
}

/**
 * Parse a CSS color string (hex, rgb, rgba, named, etc.) to an [r, g, b, a] tuple.
 * Uses a tiny reusable offscreen canvas for maximum compatibility.
 */
let _colorCanvas: OffscreenCanvas | null = null
let _colorCtx: OffscreenCanvasRenderingContext2D | null = null

const parseCssColor = (color: string): RGBA => {
  if (!_colorCanvas) {
    _colorCanvas = new OffscreenCanvas(1, 1)
    _colorCtx = _colorCanvas.getContext('2d', {
      willReadFrequently: true
    })!
  }

  const ctx = _colorCtx!
  ctx.clearRect(0, 0, 1, 1)
  ctx.fillStyle = color
  ctx.fillRect(0, 0, 1, 1)
  const pixel = ctx.getImageData(0, 0, 1, 1).data
  return [pixel[0], pixel[1], pixel[2], pixel[3]]
}

/**
 * Pre-parse all color stops into RGBA tuples.
 * Call this ONCE before entering the pixel loop.
 */
const prepareGradientStops = (
  stops: RenderGradientColorStop[]
): ParsedGradientStop[] =>
  stops.map((stop) => ({
    offset: stop.offset,
    color: parseCssColor(stop.color)
  }))

/**
 * Interpolate between pre-parsed gradient color stops at a given normalized position (0..1).
 * Uses only numeric arrays — no CSS parsing in the hot path.
 */
const sampleGradientColor = (stops: ParsedGradientStop[], t: number): RGBA => {
  const clamped = Math.max(0, Math.min(1, t))

  if (stops.length === 0) {
    return [0, 0, 0, 255]
  }
  if (stops.length === 1) {
    return stops[0].color
  }

  // Find the surrounding stops
  let lower = stops[0]
  let upper = stops[stops.length - 1]

  for (let i = 0; i < stops.length - 1; i++) {
    if (clamped >= stops[i].offset && clamped <= stops[i + 1].offset) {
      lower = stops[i]
      upper = stops[i + 1]
      break
    }
  }

  const range = upper.offset - lower.offset
  const ratio = range < 0.00001 ? 0 : (clamped - lower.offset) / range

  const lc = lower.color
  const uc = upper.color

  return [
    Math.round(lc[0] + (uc[0] - lc[0]) * ratio),
    Math.round(lc[1] + (uc[1] - lc[1]) * ratio),
    Math.round(lc[2] + (uc[2] - lc[2]) * ratio),
    Math.round(lc[3] + (uc[3] - lc[3]) * ratio)
  ]
}

/**
 * Build an angular (conic/sweep) gradient texture.
 *
 * The gradient sweeps around the center point. The angle `0` points from center
 * toward the end handle; the sweep goes clockwise (matching Figma behavior).
 *
 * Coordinates: center and end are in local 0..1 space. The output texture is
 * GRADIENT_TEXTURE_SIZE × GRADIENT_TEXTURE_SIZE and is mapped to the 0..1 box.
 */
const buildAngularGradientTexture = (
  colorStops: RenderGradientColorStop[],
  center: RenderGradientPoint,
  end: RenderGradientPoint
): Texture => {
  const size = GRADIENT_TEXTURE_SIZE
  const canvas = new OffscreenCanvas(size, size)
  const ctx = canvas.getContext('2d')!
  const imageData = ctx.createImageData(size, size)
  const data = imageData.data
  const parsedStops = prepareGradientStops(colorStops)

  // The reference angle: from center toward end handle
  const refAngle = Math.atan2(end.y - center.y, end.x - center.x)

  const cx = center.x * size
  const cy = center.y * size

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const dx = px - cx
      const dy = py - cy

      // Angle from center to this pixel, relative to refAngle, normalized to 0..1
      let angle = Math.atan2(dy, dx) - refAngle
      // Normalize to [0, 2π)
      angle = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
      const t = angle / (2 * Math.PI)

      const [r, g, b, a] = sampleGradientColor(parsedStops, t)
      const idx = (py * size + px) * 4
      data[idx] = r
      data[idx + 1] = g
      data[idx + 2] = b
      data[idx + 3] = a
    }
  }

  ctx.putImageData(imageData, 0, 0)

  const source = new CanvasSource({
    resource: canvas as unknown as HTMLCanvasElement,
    width: size,
    height: size
  })

  return new Texture({ source })
}

/**
 * Build a radial gradient texture.
 *
 * The gradient radiates from the center using Euclidean distance.
 * Supports elliptical gradients via separate radiusX (outerRadius / distance to end)
 * and radiusY (perpendicular axis, from 3rd handle).
 * Falls back to circular when radiusY is not provided.
 *
 * The primary axis points from center toward end, and the ellipse is aligned
 * to that axis.
 */
const buildRadialGradientTexture = (
  colorStops: RenderGradientColorStop[],
  center: RenderGradientPoint,
  end: RenderGradientPoint,
  radiusY?: number
): Texture => {
  const size = GRADIENT_TEXTURE_SIZE
  const canvas = new OffscreenCanvas(size, size)
  const ctx = canvas.getContext('2d')!
  const imageData = ctx.createImageData(size, size)
  const data = imageData.data
  const parsedStops = prepareGradientStops(colorStops)

  const cx = center.x * size
  const cy = center.y * size
  const ex = end.x * size
  const ey = end.y * size

  const ddx = ex - cx
  const ddy = ey - cy
  const radiusX = Math.max(0.001, Math.sqrt(ddx * ddx + ddy * ddy))
  const ry = radiusY !== undefined ? radiusY * size : radiusX

  // Rotation angle from center to end handle
  const angle = Math.atan2(ddy, ddx)
  const cosA = Math.cos(-angle)
  const sinA = Math.sin(-angle)

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const vx = px - cx
      const vy = py - cy

      // Rotate into the ellipse's local coordinate system
      const rx = vx * cosA - vy * sinA
      const ry2 = vx * sinA + vy * cosA

      // Elliptical distance: normalize each axis by its radius
      const nx = rx / radiusX
      const ny = ry2 / ry
      const t = Math.sqrt(nx * nx + ny * ny)

      const [r, g, b, a] = sampleGradientColor(parsedStops, t)
      const idx = (py * size + px) * 4
      data[idx] = r
      data[idx + 1] = g
      data[idx + 2] = b
      data[idx + 3] = a
    }
  }

  ctx.putImageData(imageData, 0, 0)

  const source = new CanvasSource({
    resource: canvas as unknown as HTMLCanvasElement,
    width: size,
    height: size
  })

  return new Texture({ source })
}

/**
 * Build a diamond gradient texture.
 *
 * The gradient radiates from the center using Manhattan distance (|dx| + |dy|),
 * producing a diamond/rhombus shape. The distance to the end handle determines
 * the outer extent (where t = 1).
 *
 * The diamond shape rotates so that one axis points from center toward end.
 */
const buildDiamondGradientTexture = (
  colorStops: RenderGradientColorStop[],
  center: RenderGradientPoint,
  end: RenderGradientPoint
): Texture => {
  const size = GRADIENT_TEXTURE_SIZE
  const canvas = new OffscreenCanvas(size, size)
  const ctx = canvas.getContext('2d')!
  const imageData = ctx.createImageData(size, size)
  const data = imageData.data
  const parsedStops = prepareGradientStops(colorStops)

  const cx = center.x * size
  const cy = center.y * size
  const ex = end.x * size
  const ey = end.y * size

  const ddx = ex - cx
  const ddy = ey - cy
  const maxDist = Math.max(0.001, Math.sqrt(ddx * ddx + ddy * ddy))

  // Rotation angle from center to end
  const angle = Math.atan2(ddy, ddx)
  const cosA = Math.cos(-angle)
  const sinA = Math.sin(-angle)

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      // Vector from center to pixel
      const vx = px - cx
      const vy = py - cy

      // Rotate into the diamond's local coordinate system
      const rx = vx * cosA - vy * sinA
      const ry = vx * sinA + vy * cosA

      // Manhattan distance, normalized by maxDist
      const t = (Math.abs(rx) + Math.abs(ry)) / maxDist

      const [r, g, b, a] = sampleGradientColor(parsedStops, t)
      const idx = (py * size + px) * 4
      data[idx] = r
      data[idx + 1] = g
      data[idx + 2] = b
      data[idx + 3] = a
    }
  }

  ctx.putImageData(imageData, 0, 0)

  const source = new CanvasSource({
    resource: canvas as unknown as HTMLCanvasElement,
    width: size,
    height: size
  })

  return new Texture({ source })
}

/**
 * Create a FillPattern from a texture, mapped to the 0..1 local coordinate space.
 */
const createPatternFill = (texture: Texture): RenderFillStyle => {
  const pattern = new FillPattern(texture, 'no-repeat')

  // Map the texture from pixel coords to the 0..1 local bounding box
  const m = new Matrix()
  m.scale(1 / texture.width, 1 / texture.height)
  pattern.setTransform(m)

  return { fill: pattern }
}

export const createRenderGradientFillStyle = (
  options: CreateRenderGradientFillOptions
): RenderFillStyle => {
  if (options.type === 'radial') {
    const center = options.start ?? options.center ?? { x: 0.5, y: 0.5 }
    const end = options.end ?? options.outerCenter ?? { x: 0.5, y: 0 }
    const texture = buildRadialGradientTexture(
      options.colorStops,
      center,
      end,
      options.radiusY
    )
    return createPatternFill(texture)
  }

  if (options.type === 'angular') {
    const center = options.start ?? { x: 0.5, y: 0.5 }
    const end = options.end ?? { x: 0.5, y: 0 }
    const texture = buildAngularGradientTexture(options.colorStops, center, end)
    return createPatternFill(texture)
  }

  if (options.type === 'diamond') {
    const center = options.start ?? { x: 0.5, y: 0.5 }
    const end = options.end ?? { x: 0.5, y: 0 }
    const texture = buildDiamondGradientTexture(options.colorStops, center, end)
    return createPatternFill(texture)
  }

  // Linear gradient (default)
  // Create a perfectly normalized 0->1 horizontal unit gradient.
  // This physically bypasses PixiJS's buggy internal dx<0||dy<0 coordinate flipping
  // algorithm, because it is strictly positive on exactly one axis.
  const gradient = new FillGradient({
    type: 'linear',
    start: { x: 0, y: 0 },
    end: { x: 1, y: 0 },
    colorStops: options.colorStops,
    textureSpace: options.textureSpace || 'local'
  })

  // Manually build an affine matrix to map this unit gradient texture to the
  // user's requested `start` -> `end` vector!
  const sx = options.start?.x ?? 0
  const sy = options.start?.y ?? 0
  const ex = options.end?.x ?? 1
  const ey = options.end?.y ?? 0

  const dx = ex - sx
  const dy = ey - sy
  const dist = Math.max(0.0001, Math.sqrt(dx * dx + dy * dy))
  const angle = Math.atan2(dy, dx)

  const m = new Matrix()
  m.scale(dist, 1)
  m.rotate(angle)
  m.translate(sx, sy)

  // Pixi intercepts `FillGradient` inputs and forces `fill.matrix = value.transform` inside `toFillStyle`.
  // To inject our matrix, we override `buildGradient` which runs synchronously right before `toFillStyle` reads it.
  const originalBuild = gradient.buildGradient.bind(gradient)
  gradient.buildGradient = () => {
    originalBuild()
    gradient.transform = m
  }

  return {
    fill: gradient
  }
}
