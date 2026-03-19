import type { StrokeAttrs } from '@asyra/utils'

export type StrokeWritableKey = Exclude<keyof StrokeAttrs, 'id'>

export const STROKE_PATCH_KEYS = [
  'style',
  'position',
  'width',
  'dash',
  'gap',
  'defaultColorFormat',
  'colorFormat',
  'color',
  'opacity',
  'visible',
  'joinType',
  'miterAngle'
] as const satisfies readonly StrokeWritableKey[]
