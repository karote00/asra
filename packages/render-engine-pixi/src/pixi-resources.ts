import type { RenderEngineResourceDescriptor } from '@asyra/render-engine'
import {
  CanvasSource,
  FillGradient,
  FillPattern,
  Matrix,
  Texture,
  type ColorSource
} from 'pixi.js'

export interface PixiOwnedResource {
  value: unknown
  destroy?: () => void
}

interface GradientPoint {
  x: number
  y: number
}

interface GradientColorStop {
  offset: number
  color: ColorSource
}

interface GradientDescriptorData {
  type: 'linear' | 'radial' | 'angular' | 'diamond'
  colorStops: GradientColorStop[]
  textureSpace?: 'local' | 'global'
  start?: GradientPoint
  end?: GradientPoint
  center?: GradientPoint
  outerCenter?: GradientPoint
  innerRadius?: number
  outerRadius?: number
  radiusY?: number
  rotation?: number
}

interface RasterPatternDescriptorData {
  source: HTMLCanvasElement | OffscreenCanvas
  width: number
  height: number
  repeat?: 'repeat' | 'repeat-x' | 'repeat-y' | 'no-repeat'
  scale?: GradientPoint
}

type RGBA = [number, number, number, number]

interface PreparedGradientStop {
  offset: number
  color: RGBA
}

const GRADIENT_TEXTURE_SIZE = 256
let colorCanvas: OffscreenCanvas | null = null
let colorContext: OffscreenCanvasRenderingContext2D | null = null

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isGradientPoint = (value: unknown): value is GradientPoint =>
  isRecord(value) &&
  typeof value.x === 'number' &&
  Number.isFinite(value.x) &&
  typeof value.y === 'number' &&
  Number.isFinite(value.y)

const parseGradientData = (data: unknown): GradientDescriptorData => {
  if (!isRecord(data)) {
    throw new Error('Pixi gradient resource requires descriptor data')
  }
  const type = data.type
  if (
    type !== 'linear' &&
    type !== 'radial' &&
    type !== 'angular' &&
    type !== 'diamond'
  ) {
    throw new Error(`Unsupported Pixi gradient type: ${String(type)}`)
  }
  if (!Array.isArray(data.colorStops)) {
    throw new Error('Pixi gradient resource requires color stops')
  }

  return data as unknown as GradientDescriptorData
}

const parseCssColor = (color: ColorSource): RGBA => {
  if (typeof color === 'number') {
    return [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff, 0xff]
  }
  if (!colorCanvas) {
    colorCanvas = new OffscreenCanvas(1, 1)
    colorContext = colorCanvas.getContext('2d', {
      willReadFrequently: true
    })
  }
  if (!colorContext) {
    throw new Error('Pixi gradient color parsing context is unavailable')
  }
  colorContext.clearRect(0, 0, 1, 1)
  colorContext.fillStyle = String(color)
  colorContext.fillRect(0, 0, 1, 1)
  const pixel = colorContext.getImageData(0, 0, 1, 1).data
  return [pixel[0], pixel[1], pixel[2], pixel[3]]
}

const prepareGradientStops = (
  stops: GradientColorStop[]
): PreparedGradientStop[] =>
  stops
    .map((stop) => ({
      offset: Math.max(0, Math.min(1, stop.offset)),
      color: parseCssColor(stop.color)
    }))
    .sort((left, right) => left.offset - right.offset)

const sampleGradientColor = (
  stops: PreparedGradientStop[],
  position: number
): RGBA => {
  const clamped = Math.max(0, Math.min(1, position))
  if (stops.length === 0) {
    return [0, 0, 0, 255]
  }
  if (stops.length === 1) {
    return stops[0].color
  }

  let lower = stops[0]
  let upper = stops[stops.length - 1]
  for (let index = 0; index < stops.length - 1; index += 1) {
    if (clamped >= stops[index].offset && clamped <= stops[index + 1].offset) {
      lower = stops[index]
      upper = stops[index + 1]
      break
    }
  }
  const range = upper.offset - lower.offset
  const ratio = range <= 0.00001 ? 0 : (clamped - lower.offset) / range
  return lower.color.map((channel, index) =>
    Math.round(channel + (upper.color[index] - channel) * ratio)
  ) as RGBA
}

const buildProceduralGradientTexture = (
  options: GradientDescriptorData
): Texture => {
  const size = GRADIENT_TEXTURE_SIZE
  const canvas = new OffscreenCanvas(size, size)
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Pixi gradient texture context is unavailable')
  }
  const image = context.createImageData(size, size)
  const preparedStops = prepareGradientStops(options.colorStops)
  const center = options.start ?? options.center ?? { x: 0.5, y: 0.5 }
  const end = options.end ?? options.outerCenter ?? { x: 0.5, y: 0 }
  const centerX = center.x * size
  const centerY = center.y * size
  const deltaX = (end.x - center.x) * size
  const deltaY = (end.y - center.y) * size
  const radiusX = Math.max(0.001, Math.hypot(deltaX, deltaY))
  const radiusY = Math.max(0.001, (options.radiusY ?? radiusX / size) * size)
  const rotation = options.rotation ?? Math.atan2(deltaY, deltaX)
  const cosine = Math.cos(-rotation)
  const sine = Math.sin(-rotation)

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offsetX = x - centerX
      const offsetY = y - centerY
      const rotatedX = offsetX * cosine - offsetY * sine
      const rotatedY = offsetX * sine + offsetY * cosine
      let position: number

      if (options.type === 'angular') {
        const angle = Math.atan2(offsetY, offsetX) - rotation
        position =
          (((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) /
          (Math.PI * 2)
      } else if (options.type === 'diamond') {
        position = Math.abs(rotatedX) / radiusX + Math.abs(rotatedY) / radiusY
      } else {
        position = Math.hypot(rotatedX / radiusX, rotatedY / radiusY)
      }

      const [red, green, blue, alpha] = sampleGradientColor(
        preparedStops,
        position
      )
      const pixel = (y * size + x) * 4
      image.data[pixel] = red
      image.data[pixel + 1] = green
      image.data[pixel + 2] = blue
      image.data[pixel + 3] = alpha
    }
  }

  context.putImageData(image, 0, 0)
  return new Texture({
    source: new CanvasSource({
      resource: canvas,
      width: size,
      height: size
    })
  })
}

const createPatternResource = (
  texture: Texture,
  repeat: RasterPatternDescriptorData['repeat'] = 'no-repeat',
  scale: GradientPoint = { x: 1 / texture.width, y: 1 / texture.height }
): PixiOwnedResource => {
  const pattern = new FillPattern(texture, repeat)
  const matrix = new Matrix()
  matrix.scale(scale.x, scale.y)
  pattern.setTransform(matrix)
  return {
    value: pattern,
    destroy: () => texture.destroy(true)
  }
}

const createGradientResource = (data: unknown): PixiOwnedResource => {
  const options = parseGradientData(data)
  if (options.type !== 'linear') {
    return createPatternResource(buildProceduralGradientTexture(options))
  }

  const gradient = new FillGradient({
    type: 'linear',
    start: { x: 0, y: 0 },
    end: { x: 1, y: 0 },
    colorStops: options.colorStops,
    textureSpace: options.textureSpace ?? 'local'
  })
  const start = options.start ?? { x: 0, y: 0 }
  const end = options.end ?? { x: 1, y: 0 }
  const deltaX = end.x - start.x
  const deltaY = end.y - start.y
  const matrix = new Matrix()
  matrix.scale(Math.max(0.0001, Math.hypot(deltaX, deltaY)), 1)
  matrix.rotate(Math.atan2(deltaY, deltaX))
  matrix.translate(start.x, start.y)
  const buildGradient = gradient.buildGradient.bind(gradient)
  gradient.buildGradient = () => {
    buildGradient()
    gradient.transform = matrix
  }

  return {
    value: gradient,
    destroy: () => gradient.destroy()
  }
}

const createRasterPatternResource = (data: unknown): PixiOwnedResource => {
  if (!isRecord(data)) {
    throw new Error('Pixi raster pattern requires descriptor data')
  }
  const descriptor = data as unknown as RasterPatternDescriptorData
  if (
    !descriptor.source ||
    !Number.isFinite(descriptor.width) ||
    !Number.isFinite(descriptor.height)
  ) {
    throw new Error('Pixi raster pattern requires source dimensions')
  }
  const texture = new Texture({
    source: new CanvasSource({
      resource: descriptor.source,
      width: descriptor.width,
      height: descriptor.height
    })
  })
  return createPatternResource(
    texture,
    descriptor.repeat,
    isGradientPoint(descriptor.scale)
      ? descriptor.scale
      : { x: 1 / descriptor.width, y: 1 / descriptor.height }
  )
}

export const createPixiOwnedResource = (
  descriptor: RenderEngineResourceDescriptor
): PixiOwnedResource => {
  switch (descriptor.kind) {
    case 'texture': {
      const texture = Texture.from(descriptor.data as never)
      return { value: texture, destroy: () => texture.destroy() }
    }
    case 'gradient':
      return createGradientResource(descriptor.data)
    case 'raster-pattern':
      return createRasterPatternResource(descriptor.data)
    default:
      return { value: descriptor.data }
  }
}
