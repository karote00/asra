import { useProperty } from '../hooks'
import { MIXED_STRING } from '@asyra/utils'
import type { SelectedVectorPointState } from '../common-apis/system-context'

type MixedNumber = number | typeof MIXED_STRING

export const useX = (): MixedNumber => useProperty<MixedNumber>('x')
export const useY = (): MixedNumber => useProperty<MixedNumber>('y')
export const useWidth = (): MixedNumber => useProperty<MixedNumber>('width')
export const useHeight = (): MixedNumber => useProperty<MixedNumber>('height')
export const useRotation = (): MixedNumber =>
  useProperty<MixedNumber>('rotation')

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
