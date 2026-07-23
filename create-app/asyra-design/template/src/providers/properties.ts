import {
  MIXED_STRING,
  type FillRowAttrs,
  type StrokeRowAttrs
} from '@asyra/utils'
import { PresetSystemPropertyKeys } from '@asyra/preset'
import { useProperty } from '../hooks'
import type {
  SelectedVectorPointState,
  SelectedVectorSegmentState
} from '../common-apis/system-context'

type MixedNumber = number | typeof MIXED_STRING
type MixedFills = FillRowAttrs[] | typeof MIXED_STRING
type MixedStrokes = StrokeRowAttrs[] | typeof MIXED_STRING

const isFillRowArray = (value: MixedFills): value is FillRowAttrs[] =>
  Array.isArray(value)
const isStrokeRowArray = (value: MixedStrokes): value is StrokeRowAttrs[] =>
  Array.isArray(value)

export const useX = (): MixedNumber => useProperty<MixedNumber>('x')
export const useY = (): MixedNumber => useProperty<MixedNumber>('y')
export const useWidth = (): MixedNumber => useProperty<MixedNumber>('width')
export const useHeight = (): MixedNumber => useProperty<MixedNumber>('height')
export const useRotation = (): MixedNumber =>
  useProperty<MixedNumber>('rotation')

export const useFills = (): MixedFills => useProperty<MixedFills>('fills')
export const useStrokes = (): MixedStrokes =>
  useProperty<MixedStrokes>('strokes')

export const useFill = (fillId: string): FillRowAttrs | null => {
  const fills = useProperty<MixedFills>('fills')
  if (!isFillRowArray(fills)) {
    return null
  }

  return fills.find((fill) => fill.ids.includes(fillId)) ?? null
}

export const useStroke = (strokeId: string): StrokeRowAttrs | null => {
  const strokes = useProperty<MixedStrokes>('strokes')
  if (!isStrokeRowArray(strokes)) {
    return null
  }

  return strokes.find((stroke) => stroke.ids.includes(strokeId)) ?? null
}

export const usePathEditingVectorId = (): string | null =>
  useProperty<string | null>(PresetSystemPropertyKeys.PATH_EDITING_VECTOR_ID)

export const useVectorPointSelection = (): Set<string> =>
  useProperty<Set<string>>('vectorPointSelection')

export const useVectorSegmentSelection = (): Set<string> =>
  useProperty<Set<string>>('vectorSegmentSelection')

export const useSelectedVectorPoint = (): SelectedVectorPointState | null =>
  useProperty<SelectedVectorPointState | null>(
    PresetSystemPropertyKeys.SELECTED_VECTOR_POINT
  )

export const useSelectedVectorSegment = (): SelectedVectorSegmentState | null =>
  useProperty<SelectedVectorSegmentState | null>(
    PresetSystemPropertyKeys.SELECTED_VECTOR_SEGMENT
  )

export const useHoveredElementId = (): string | null =>
  useProperty<string | null>(PresetSystemPropertyKeys.HOVERED_ELEMENT_ID)
