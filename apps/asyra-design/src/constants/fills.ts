import type { FillAttrs } from '@asyra/utils'

export type FillWritableKey = Exclude<keyof FillAttrs, 'id'>

export const FILL_PATCH_KEYS = [
  'kind',
  'defaultColorFormat',
  'colorFormat',
  'color',
  'opacity',
  'visible',
  'gradient'
] as const satisfies readonly FillWritableKey[]
