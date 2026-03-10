import { FillGradient, Matrix } from 'pixi.js'

export interface RenderGradientPoint {
  x: number
  y: number
}

export interface RenderGradientColorStop {
  offset: number
  color: string
}

export interface CreateRenderGradientFillOptions {
  type: 'linear' | 'radial'
  colorStops: RenderGradientColorStop[]
  textureSpace?: 'local' | 'global'
  start?: RenderGradientPoint
  end?: RenderGradientPoint
  center?: RenderGradientPoint
  outerCenter?: RenderGradientPoint
  innerRadius?: number
  outerRadius?: number
}

export interface RenderFillStyle {
  fill: unknown
}

export const createRenderGradientFillStyle = (
  options: CreateRenderGradientFillOptions
): RenderFillStyle => {
  if (options.type === 'radial') {
    return { fill: new FillGradient(options) }
  }

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
