import { Unit } from '../constants/index.js'

export const PropAlias: Record<string, string> = {
  x: 'position',
  y: 'position',
  rotation: 'position',
  width: 'dimension',
  hieght: 'dimension'
}

export const DefaultPositionData = {
  x: 0,
  y: 0,
  rotation: 0,
  xUnit: Unit.PX,
  yUnit: Unit.PX
}

export const DefaultDimensionData = {
  width: 0.1,
  height: 0.1,
  widthUnit: Unit.PX,
  heightUnit: Unit.PX
}

export const AnchorPointTypes = {
  SHARP: 'sharp',
  SMOOTH: 'smooth'
} as const

export type AnchorPointType =
  (typeof AnchorPointTypes)[keyof typeof AnchorPointTypes]

export const DefaultAnchorPointData = {
  x: 0,
  y: 0,
  pointType: AnchorPointTypes.SHARP,
  isMove: undefined as boolean | undefined,
  inHandle: null as { x: number; y: number } | null,
  outHandle: null as { x: number; y: number } | null
}

export const createDefaultAnchorPointsData = () => ({
  anchorPoints: [] as string[]
})

export const isAnchorPointType = (value: unknown): value is AnchorPointType =>
  value === AnchorPointTypes.SHARP || value === AnchorPointTypes.SMOOTH
