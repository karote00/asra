import {
  ElementSelection,
  VectorPointSelection,
  VectorSegmentSelection
} from '@asyra/core'
import { SELECTION_TYPES } from '@asyra/utils'
import type { PresetCoreAPIs } from '../types'

export const registerSelections = (
  core: Pick<PresetCoreAPIs, 'registerSelection' | 'getSelection'>
): void => {
  if (!core.getSelection(SELECTION_TYPES.ELEMENT)) {
    core.registerSelection(SELECTION_TYPES.ELEMENT, new ElementSelection())
  }

  if (!core.getSelection(SELECTION_TYPES.VECTOR_POINT)) {
    core.registerSelection(
      SELECTION_TYPES.VECTOR_POINT,
      new VectorPointSelection()
    )
  }

  if (!core.getSelection(SELECTION_TYPES.VECTOR_SEGMENT)) {
    core.registerSelection(
      SELECTION_TYPES.VECTOR_SEGMENT,
      new VectorSegmentSelection()
    )
  }
}
