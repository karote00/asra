import {
  StrokeJoinTypes,
  StrokeCapTypes,
  clampOpacity,
  createDefaultStroke,
  parseColor,
  rgbaToColorInt,
  type StrokeAttrs
} from '@asyra/utils'

export interface RenderableStroke {
  style: StrokeAttrs['style']
  position: StrokeAttrs['position']
  width: number
  dash: number
  gap: number
  join: 'miter' | 'bevel' | 'round'
  miterLimit: number
  cap: 'butt' | 'square' | 'round' | 'none'
  color: number
  alpha: number
}

const normalizeStrokeEntry = (value: unknown): StrokeAttrs | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  return {
    ...createDefaultStroke(),
    ...(value as Partial<StrokeAttrs>)
  }
}

const getStrokeJoin = (
  joinType: StrokeAttrs['joinType']
): RenderableStroke['join'] => {
  if (joinType === StrokeJoinTypes.BEVEL) {
    return 'bevel'
  }

  if (joinType === StrokeJoinTypes.ROUND) {
    return 'round'
  }

  return 'miter'
}

const getStrokeMiterLimit = (angle: number): number => {
  if (!Number.isFinite(angle) || angle <= 0) {
    return 4
  }

  const radians = (angle * Math.PI) / 180
  const sinHalf = Math.sin(radians / 2)
  if (sinHalf <= 0) {
    return 4
  }

  return Math.max(1, 1 / sinHalf)
}

const getRenderableStroke = (stroke: StrokeAttrs): RenderableStroke | null => {
  if (!stroke.visible || stroke.width <= 0) {
    return null
  }

  const parsed = parseColor(stroke.color)
  if (!parsed) {
    return null
  }

  return {
    style: stroke.style,
    position: stroke.position,
    width: stroke.width,
    dash: stroke.dash,
    gap: stroke.gap,
    join: getStrokeJoin(stroke.joinType),
    miterLimit: getStrokeMiterLimit(stroke.miterAngle),
    cap:
      stroke.capType === StrokeCapTypes.SQUARE
        ? 'square'
        : stroke.capType === StrokeCapTypes.ROUND
          ? 'round'
          : 'butt',
    color: rgbaToColorInt(parsed),
    alpha: clampOpacity(parsed.a * stroke.opacity)
  }
}

export const getRenderableStrokes = (strokes: unknown): RenderableStroke[] => {
  if (!Array.isArray(strokes)) {
    return []
  }

  return strokes.reduce<RenderableStroke[]>((result, rawStroke) => {
    const stroke = normalizeStrokeEntry(rawStroke)
    if (!stroke) {
      return result
    }

    const renderableStroke = getRenderableStroke(stroke)
    if (renderableStroke) {
      result.push(renderableStroke)
    }

    return result
  }, [])
}

export const getStrokeHitWidth = (strokes: unknown): number => {
  const renderableStrokes = getRenderableStrokes(strokes)
  return renderableStrokes.reduce(
    (maxWidth, stroke) => Math.max(maxWidth, stroke.width),
    0
  )
}
