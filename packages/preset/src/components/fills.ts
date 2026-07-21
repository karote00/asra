import {
  FillKinds,
  FillGradientTypes,
  clampOpacity,
  parseColor,
  rgbaToColorInt,
  rgbaToCssColor,
  rgbaToHex,
  type FillAttrs,
  createDefaultFills,
  createDefaultFill
} from '@asyra/utils'
import {
  default as core,
  type CreateRenderGradientFillOptions,
  type RenderFillStyle
} from '@asyra/core'

interface SolidRenderableFill {
  kind: 'solid'
  color: number
  alpha: number
}

interface GradientRenderableFill {
  kind: 'gradient'
  style: RenderFillStyle
}

type RenderableFill = SolidRenderableFill | GradientRenderableFill

const normalizeFillEntry = (value: unknown): FillAttrs | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  return {
    ...createDefaultFill(),
    ...(value as Partial<FillAttrs>)
  }
}

const sortGradientStops = (
  stops: NonNullable<FillAttrs['gradient']>['gradientStops']
) => [...stops].sort((a, b) => a.position - b.position)

const toGradientStopColor = (color: string, opacity: number): string | null => {
  const parsed = parseColor(color)
  if (!parsed) {
    return null
  }

  return rgbaToCssColor(parsed, parsed.a * opacity)
}

export const toRenderableGradient = (
  entry: FillAttrs
): RenderFillStyle | null => {
  if (entry.kind !== FillKinds.GRADIENT || !entry.gradient) {
    return null
  }

  const stops = sortGradientStops(entry.gradient.gradientStops)
  if (!stops.length) {
    return null
  }

  const colorStops = stops
    .map((stop) => ({
      offset: clampOpacity(stop.position),
      color: toGradientStopColor(stop.color, stop.opacity * entry.opacity)
    }))
    .filter(
      (stop): stop is { offset: number; color: string } => stop.color !== null
    )

  if (!colorStops.length) {
    return null
  }

  const [startHandle, endHandle] = entry.gradient.gradientHandles
  const start = startHandle ?? { x: 0, y: 0 }
  const end = endHandle ?? { x: 1, y: 0 }

  if (entry.gradient.gradientType === FillGradientTypes.RADIAL) {
    const sideHandle = entry.gradient.gradientHandles[2] ?? null
    const radiusY =
      sideHandle !== null
        ? Math.max(
            0.001,
            Math.sqrt(
              (sideHandle.x - start.x) ** 2 + (sideHandle.y - start.y) ** 2
            )
          )
        : undefined

    const radialOptions: CreateRenderGradientFillOptions = {
      type: 'radial',
      start,
      end,
      colorStops,
      textureSpace: 'local',
      ...(radiusY !== undefined ? { radiusY } : {})
    }

    return {
      ...core.createRenderGradientFillStyle(radialOptions),
      __asyraGradientOptions: radialOptions
    } as RenderFillStyle & {
      __asyraGradientOptions: CreateRenderGradientFillOptions
    }
  }

  if (entry.gradient.gradientType === FillGradientTypes.ANGULAR) {
    const angularOptions: CreateRenderGradientFillOptions = {
      type: 'angular',
      start,
      end,
      colorStops,
      textureSpace: 'local'
    }

    return {
      ...core.createRenderGradientFillStyle(angularOptions),
      __asyraGradientOptions: angularOptions
    } as RenderFillStyle & {
      __asyraGradientOptions: CreateRenderGradientFillOptions
    }
  }

  if (entry.gradient.gradientType === FillGradientTypes.DIAMOND) {
    const diamondOptions: CreateRenderGradientFillOptions = {
      type: 'diamond',
      start,
      end,
      colorStops,
      textureSpace: 'local'
    }

    return {
      ...core.createRenderGradientFillStyle(diamondOptions),
      __asyraGradientOptions: diamondOptions
    } as RenderFillStyle & {
      __asyraGradientOptions: CreateRenderGradientFillOptions
    }
  }

  // Default: linear gradient
  const linearOptions: CreateRenderGradientFillOptions = {
    type: 'linear',
    start,
    end,
    colorStops,
    textureSpace: 'local'
  }

  return {
    ...core.createRenderGradientFillStyle(linearOptions),
    __asyraGradientOptions: linearOptions
  } as RenderFillStyle & {
    __asyraGradientOptions: CreateRenderGradientFillOptions
  }
}

const getRenderableFillFromEntry = (
  entry: FillAttrs
): RenderableFill | null => {
  if (!entry.visible) {
    return null
  }

  if (entry.kind === FillKinds.GRADIENT && entry.gradient) {
    const renderableGradient = toRenderableGradient(entry)
    if (!renderableGradient) {
      return null
    }

    return {
      kind: 'gradient',
      style: renderableGradient
    }
  }

  const parsed = parseColor(entry.color)
  if (!parsed) {
    return null
  }

  return {
    kind: 'solid',
    color: rgbaToColorInt(parsed),
    alpha: clampOpacity(parsed.a * entry.opacity)
  }
}

export const getRenderableFills = (fills: unknown): RenderableFill[] => {
  if (!Array.isArray(fills)) {
    return []
  }

  return fills.reduce<RenderableFill[]>((result, rawFill) => {
    const fill = normalizeFillEntry(rawFill)
    if (!fill) {
      return result
    }

    const renderableFill = getRenderableFillFromEntry(fill)
    if (renderableFill) {
      result.push(renderableFill)
    }

    return result
  }, [])
}

export const getRenderableFill = (fills: unknown): RenderableFill | null => {
  const renderableFills = getRenderableFills(fills)
  return renderableFills[0] ?? null
}

export const applyRenderableFill = (
  graphic: { fill: unknown },
  fills: unknown,
  options?: {
    replayPath?: () => void
    order?: 'forward' | 'reverse'
  }
): boolean => {
  const renderableFills = getRenderableFills(fills)
  if (renderableFills.length === 0) {
    return false
  }

  const orderedFills =
    options?.order === 'reverse'
      ? [...renderableFills].reverse()
      : renderableFills

  const applyFill = (value: unknown) =>
    (graphic.fill as (this: typeof graphic, value: unknown) => unknown).call(
      graphic,
      value
    )

  orderedFills.forEach((renderableFill, index) => {
    if (index > 0) {
      options?.replayPath?.()
    }

    if (renderableFill.kind === 'gradient') {
      applyFill(renderableFill.style)
      return
    }

    if (renderableFill.alpha >= 1) {
      applyFill(renderableFill.color)
      return
    }

    applyFill({
      color: renderableFill.color,
      alpha: renderableFill.alpha
    })
  })
  return true
}

export const fillColorToHex = (value: string): string => {
  const parsed = parseColor(value)
  if (!parsed) {
    return '#000000'
  }

  return rgbaToHex(parsed)
}

export const DEFAULT_RECTANGLE_FILLS = createDefaultFills({ color: '#cccccc' })
export const DEFAULT_OVAL_FILLS = createDefaultFills({ color: '#cccccc' })
export const DEFAULT_FRAME_FILLS = createDefaultFills({ color: '#cccccc' })
export const DEFAULT_VECTOR_FILLS: FillAttrs[] = []
