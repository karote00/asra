import {
  FillKinds,
  StrokeJoinTypes,
  StrokeCapTypes,
  clampOpacity,
  createDefaultFill,
  createDefaultStroke,
  parseColor,
  rgbaToColorInt,
  type FillAttrs,
  type StrokeAttrs
} from '@asyra/utils'
import type { RenderFillStyle } from '@asyra/core'
import { toRenderableGradient } from '../fills'

export interface RenderableStroke {
  style: StrokeAttrs['style']
  position: StrokeAttrs['position']
  width: number
  dash: number
  gap: number
  join: 'miter' | 'bevel' | 'round'
  miterAngle: number
  miterLimit: number
  cap: 'butt' | 'square' | 'round'
  kind?: 'solid' | 'gradient'
  color: number
  alpha: number
  gradientStyle?: RenderFillStyle | null
  paintKey?: string
}

export type StrokeSpecRejectionReason =
  | 'invalid-entry'
  | 'invalid-width'
  | 'invisible-stroke'
  | 'invisible-paint'
  | 'invalid-paint'
  | 'invalid-gradient-paint'

export interface StrokeSpecRejectionDiagnostic {
  index: number
  reason: StrokeSpecRejectionReason
  strokeId?: string
}

export interface NormalizeStrokeSpecResult {
  strokes: RenderableStroke[]
  diagnostics: StrokeSpecRejectionDiagnostic[]
}

export const getRenderableStrokeDashAndGap = (
  stroke: Pick<RenderableStroke, 'dash' | 'gap'>
): Pick<RenderableStroke, 'dash' | 'gap'> | null =>
  stroke.dash > 0 && stroke.gap > 0
    ? { dash: stroke.dash, gap: stroke.gap }
    : null

const normalizeStrokeEntry = (value: unknown): StrokeAttrs | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const rawStroke = value as Partial<StrokeAttrs>
  const normalizedStroke = createDefaultStroke(rawStroke)

  return {
    ...normalizedStroke
  }
}

const normalizeDashLength = (value: number) =>
  Number.isFinite(value) && value > 0 ? value : 0

const resolveStrokePaint = (stroke: StrokeAttrs): FillAttrs =>
  createDefaultFill({
    ...stroke.fill,
    id: stroke.id,
    type: 'fill'
  })

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
  if (!Number.isFinite(angle)) {
    return 4
  }

  if (angle <= 0) {
    return Number.POSITIVE_INFINITY
  }

  const radians = (angle * Math.PI) / 180
  const sinHalf = Math.sin(radians / 2)
  if (sinHalf <= 0) {
    return Number.POSITIVE_INFINITY
  }

  return Math.max(1, 1 / sinHalf)
}

const getRenderableStroke = (
  stroke: StrokeAttrs
):
  | { stroke: RenderableStroke }
  | { empty: true }
  | { diagnostic: Omit<StrokeSpecRejectionDiagnostic, 'index'> } => {
  if (!Number.isFinite(stroke.width)) {
    return {
      diagnostic: {
        reason: 'invalid-width',
        strokeId: stroke.id
      }
    }
  }

  if (stroke.width <= 0) {
    return { empty: true }
  }

  const paint = resolveStrokePaint(stroke)
  if (!paint.visible) {
    return {
      diagnostic: {
        reason: 'invisible-paint',
        strokeId: stroke.id
      }
    }
  }

  const parsed = parseColor(paint.color)
  if (!parsed) {
    return {
      diagnostic: {
        reason: 'invalid-paint',
        strokeId: stroke.id
      }
    }
  }

  const dash = normalizeDashLength(stroke.dash)
  const gap = normalizeDashLength(stroke.gap)
  const gradientStyle =
    paint.kind === FillKinds.GRADIENT && paint.gradient
      ? toRenderableGradient({
          id: paint.id,
          type: 'fill',
          kind: FillKinds.GRADIENT,
          defaultColorFormat: paint.defaultColorFormat,
          colorFormat: paint.colorFormat,
          color: paint.color,
          opacity: paint.opacity,
          visible: paint.visible,
          gradient: paint.gradient
        })
      : null

  if (paint.kind === FillKinds.GRADIENT && !gradientStyle) {
    return {
      diagnostic: {
        reason: 'invalid-gradient-paint',
        strokeId: stroke.id
      }
    }
  }

  const paintKey =
    paint.kind === FillKinds.GRADIENT && paint.gradient
      ? JSON.stringify({
          kind: paint.kind,
          opacity: paint.opacity,
          gradientType: paint.gradient.gradientType,
          gradientStops: paint.gradient.gradientStops,
          gradientHandles: paint.gradient.gradientHandles
        })
      : `solid:${rgbaToColorInt(parsed)}:${clampOpacity(parsed.a * paint.opacity)}`

  return {
    stroke: {
      style: stroke.style,
      position: stroke.position,
      width: stroke.width,
      dash,
      gap,
      join: getStrokeJoin(stroke.joinType),
      miterAngle: stroke.miterAngle,
      miterLimit: getStrokeMiterLimit(stroke.miterAngle),
      cap:
        stroke.capType === StrokeCapTypes.SQUARE
          ? 'square'
          : stroke.capType === StrokeCapTypes.ROUND
            ? 'round'
            : 'butt',
      kind: paint.kind === FillKinds.GRADIENT ? 'gradient' : 'solid',
      color: rgbaToColorInt(parsed),
      alpha: clampOpacity(parsed.a * paint.opacity),
      gradientStyle,
      paintKey
    }
  }
}

export const normalizeStrokeSpec = (
  strokes: unknown
): NormalizeStrokeSpecResult => {
  if (!Array.isArray(strokes)) {
    return {
      strokes: [],
      diagnostics: []
    }
  }

  return strokes.reduce<NormalizeStrokeSpecResult>(
    (result, rawStroke, index) => {
      const stroke = normalizeStrokeEntry(rawStroke)
      if (!stroke) {
        result.diagnostics.push({
          index,
          reason: 'invalid-entry'
        })
        return result
      }

      const renderableStrokeResult = getRenderableStroke(stroke)
      if ('stroke' in renderableStrokeResult) {
        result.strokes.push(renderableStrokeResult.stroke)
      } else if ('diagnostic' in renderableStrokeResult) {
        result.diagnostics.push({
          index,
          ...renderableStrokeResult.diagnostic
        })
      }

      return result
    },
    {
      strokes: [],
      diagnostics: []
    }
  )
}

export const getRenderableStrokes = (strokes: unknown): RenderableStroke[] =>
  normalizeStrokeSpec(strokes).strokes

export const getStrokeHitWidth = (strokes: unknown): number => {
  const renderableStrokes = getRenderableStrokes(strokes)
  return renderableStrokes.reduce(
    (maxWidth, stroke) => Math.max(maxWidth, stroke.width),
    0
  )
}
