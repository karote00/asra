import type { BasePropertyAttrs } from './instanceTypes'

export const FillColorFormats = {
  HEX: 'hex',
  RGB: 'rgb',
  RGBA: 'rgba',
  HSL: 'hsl',
  HSLA: 'hsla',
  HWB: 'hwb',
  OKLCH: 'oklch'
} as const

export type FillColorFormat =
  (typeof FillColorFormats)[keyof typeof FillColorFormats]

export const FillKinds = {
  SOLID: 'solid',
  GRADIENT: 'gradient'
} as const

export type FillKind = (typeof FillKinds)[keyof typeof FillKinds]

export const FillGradientTypes = {
  LINEAR: 'linear',
  RADIAL: 'radial',
  ANGULAR: 'angular',
  DIAMOND: 'diamond'
} as const

export type FillGradientType =
  (typeof FillGradientTypes)[keyof typeof FillGradientTypes]

export interface FillGradientStop {
  position: number
  color: string
  opacity: number
}

export interface FillGradientHandle {
  x: number
  y: number
}

export interface FillGradientData {
  gradientType: FillGradientType | string
  gradientStops: FillGradientStop[]
  gradientHandles: FillGradientHandle[]
  metadata?: Record<string, unknown>
}

export interface FillAttrs extends BasePropertyAttrs {
  kind: FillKind
  defaultColorFormat: FillColorFormat
  colorFormat: FillColorFormat
  color: string
  opacity: number
  visible: boolean
  gradient: FillGradientData | null
}

export interface FillRowAttrs
  extends Omit<FillAttrs, 'id'>,
    Record<string, unknown> {
  ids: string[]
}

export interface FillsAttrs extends BasePropertyAttrs {
  fills: string[]
}

export const createDefaultFill = (
  overrides: Partial<FillAttrs> = {}
): FillAttrs => ({
  id: '',
  type: 'fill',
  kind: FillKinds.SOLID,
  defaultColorFormat: FillColorFormats.HEX,
  colorFormat: FillColorFormats.HEX,
  color: '#cccccc',
  opacity: 1,
  visible: true,
  gradient: null,
  ...overrides
})

export const createDefaultGradientData = (): FillGradientData => ({
  gradientType: FillGradientTypes.LINEAR,
  gradientStops: [
    {
      position: 0,
      color: '#ffffff',
      opacity: 1
    },
    {
      position: 1,
      color: '#000000',
      opacity: 1
    }
  ],
  gradientHandles: [
    {
      x: 0.5,
      y: 0
    },
    {
      x: 0.5,
      y: 1
    }
  ],
  metadata: {}
})

export const createDefaultFills = (
  fillOverrides: Partial<FillAttrs> = {}
): FillAttrs[] => [createDefaultFill(fillOverrides)]
