import type { BasePropertyAttrs } from './instanceTypes'
import {
  FillColorFormats,
  FillKinds,
  type FillColorFormat,
  type FillGradientData,
  type FillKind
} from './fills'

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
  dashPattern: number[]
  dashOffset: number
  /** @deprecated Compatibility only. Use dashPattern. */
  dash?: number
  /** @deprecated Compatibility only. Use dashPattern. */
  gap?: number
  defaultColorFormat: FillColorFormat
  colorFormat: FillColorFormat
  kind: FillKind
  color: string
  opacity: number
  visible: boolean
  gradient: FillGradientData | null
  joinType: StrokeJoinType
  capType: StrokeCapType
  miterAngle: number
}

export interface StrokeRowAttrs
  extends Omit<StrokeAttrs, 'id'>,
    Record<string, unknown> {
  ids: string[]
}

export interface StrokesAttrs extends BasePropertyAttrs {
  strokes: string[]
}

export const createDefaultStroke = (
  overrides: Partial<StrokeAttrs> = {}
): StrokeAttrs => ({
  id: '',
  type: 'stroke',
  style: StrokeStyles.SOLID,
  position: StrokePositions.CENTER,
  width: 1,
  dashPattern: [20, 20],
  dashOffset: 0,
  dash: 20,
  gap: 20,
  defaultColorFormat: FillColorFormats.HEX,
  colorFormat: FillColorFormats.HEX,
  kind: FillKinds.SOLID,
  color: '#000000',
  opacity: 1,
  visible: true,
  gradient: null,
  joinType: StrokeJoinTypes.MITER,
  capType: StrokeCapTypes.BUTT,
  miterAngle: 28.96,
  ...overrides
})

export const createDefaultStrokes = (
  strokeOverrides: Partial<StrokeAttrs> = {}
): StrokeAttrs[] => [createDefaultStroke(strokeOverrides)]
