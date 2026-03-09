import { MIXED_STRING, type FillRowAttrs } from '@asyra/utils'
import { useProperty } from '../hooks'
import type { SelectedVectorPointState } from '../common-apis/system-context'

type MixedNumber = number | typeof MIXED_STRING
type MixedFills = FillRowAttrs[] | typeof MIXED_STRING

const isFillRowArray = (value: MixedFills): value is FillRowAttrs[] =>
  Array.isArray(value)

export const useX = (): MixedNumber => useProperty<MixedNumber>('x')
export const useY = (): MixedNumber => useProperty<MixedNumber>('y')
export const useWidth = (): MixedNumber => useProperty<MixedNumber>('width')
export const useHeight = (): MixedNumber => useProperty<MixedNumber>('height')
export const useRotation = (): MixedNumber =>
  useProperty<MixedNumber>('rotation')

export const useFills = (): MixedFills => useProperty<MixedFills>('fills')

export const useFill = (fillId: string): FillRowAttrs | null => {
  const fills = useProperty<MixedFills>('fills')
  if (!isFillRowArray(fills)) {
    return null
  }

  return fills.find((fill) => fill.ids.includes(fillId)) ?? null
}

export const usePathEditingVectorId = (): string | null =>
  useProperty<string | null>('pathEditingVectorId')

export const useVectorPointSelection = (): Set<string> =>
  useProperty<Set<string>>('vectorPointSelection')

export const useVectorSegmentSelection = (): Set<string> =>
  useProperty<Set<string>>('vectorSegmentSelection')

interface SelectedVectorSegmentState extends Record<string, unknown> {
  elementId: string
  segmentId: string
}

export const useSelectedVectorPoint = (): SelectedVectorPointState | null =>
  useProperty<SelectedVectorPointState | null>('selectedVectorPoint')

export const useSelectedVectorSegment = (): SelectedVectorSegmentState | null =>
  useProperty<SelectedVectorSegmentState | null>('selectedVectorSegment')

export const useHoveredElementId = (): string | null =>
  useProperty<string | null>('hoveredElementId')
