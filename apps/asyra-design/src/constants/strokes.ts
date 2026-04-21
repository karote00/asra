import type { StrokeAttrs } from '@asyra/utils'

export type StrokeWritableKey = Exclude<keyof StrokeAttrs, 'id'>

export const STROKE_PATCH_KEYS = [
  'style',
  'position',
  'width',
  'dashPattern',
  'dashOffset',
  'defaultColorFormat',
  'colorFormat',
  'color',
  'opacity',
  'visible',
  'joinType',
  'capType',
  'miterAngle'
] as const satisfies readonly StrokeWritableKey[]
