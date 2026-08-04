import type { BasePropertyAttrs } from './instanceTypes.js'
import { type FillAttrs, createDefaultFill } from './fills.js'

export const StrokeStyles = {
  SOLID: 'solid',
  DASHED: 'dashed'
} as const

export type StrokeStyle = (typeof StrokeStyles)[keyof typeof StrokeStyles]

export const StrokePositions = {
  CENTER: 'center',
  INSIDE: 'inside',
  OUTSIDE: 'outside'
} as const

export type StrokePosition =
  (typeof StrokePositions)[keyof typeof StrokePositions]

export const StrokeJoinTypes = {
  MITER: 'miter',
  BEVEL: 'bevel',
  ROUND: 'round'
} as const

export type StrokeJoinType =
  (typeof StrokeJoinTypes)[keyof typeof StrokeJoinTypes]

export const StrokeCapTypes = {
  BUTT: 'butt',
  SQUARE: 'square',
  ROUND: 'round'
} as const

export type StrokeCapType = (typeof StrokeCapTypes)[keyof typeof StrokeCapTypes]

export interface StrokeAttrs extends BasePropertyAttrs {
  style: StrokeStyle
  position: StrokePosition
  width: number
  dash: number
  gap: number
  fill: FillAttrs
  joinType: StrokeJoinType
  capType: StrokeCapType
  miterAngle: number
}

export type LegacyStrokePaintAttrs = Partial<
  Pick<
    FillAttrs,
    | 'kind'
    | 'defaultColorFormat'
    | 'colorFormat'
    | 'color'
    | 'opacity'
    | 'visible'
    | 'gradient'
  >
> & {
  fill?: Partial<FillAttrs> | null
}

export interface StrokeRowAttrs
  extends Omit<StrokeAttrs, 'id'>,
    Record<string, unknown> {
  ids: string[]
}

export interface StrokesAttrs extends BasePropertyAttrs {
  strokes: string[]
}

const isFillPayload = (value: unknown): value is Partial<FillAttrs> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const compactDefined = <T extends Record<string, unknown>>(value: T) =>
  Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as Partial<T>

const resolveStrokeFill = (
  strokeId: string,
  overrides: Partial<StrokeAttrs> & LegacyStrokePaintAttrs
): FillAttrs => {
  const legacyPaint = compactDefined({
    kind: overrides.kind,
    defaultColorFormat: overrides.defaultColorFormat,
    colorFormat: overrides.colorFormat,
    color: overrides.color,
    opacity: overrides.opacity,
    visible: overrides.visible,
    gradient: overrides.gradient
  })
  const fillOverrides = isFillPayload(overrides.fill)
    ? overrides.fill
    : legacyPaint

  return createDefaultFill({
    color: '#000000',
    ...compactDefined(fillOverrides),
    id: strokeId,
    type: 'fill'
  })
}

export const createDefaultStroke = (
  overrides: Partial<StrokeAttrs> & LegacyStrokePaintAttrs = {}
): StrokeAttrs => {
  const id = overrides.id ?? ''

  return {
    id,
    type: 'stroke',
    style: overrides.style ?? StrokeStyles.SOLID,
    position: overrides.position ?? StrokePositions.CENTER,
    width: overrides.width ?? 1,
    dash: overrides.dash ?? 20,
    gap: overrides.gap ?? 20,
    fill: resolveStrokeFill(id, overrides),
    joinType: overrides.joinType ?? StrokeJoinTypes.MITER,
    capType: overrides.capType ?? StrokeCapTypes.BUTT,
    miterAngle: overrides.miterAngle ?? 28.96
  }
}

export const createDefaultStrokes = (
  strokeOverrides: Partial<StrokeAttrs> & LegacyStrokePaintAttrs = {}
): StrokeAttrs[] => [createDefaultStroke(strokeOverrides)]
