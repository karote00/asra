import { ElementSelection, VertexSelection } from '@asyra/core'
import { SELECTION_TYPES } from '@asyra/utils'
import type { PresetCoreAPIs } from '../types'

export const registerSelections = (
  core: Pick<PresetCoreAPIs, 'registerSelection' | 'getSelection'>
): void => {
  if (!core.getSelection(SELECTION_TYPES.ELEMENT)) {
    core.registerSelection(SELECTION_TYPES.ELEMENT, new ElementSelection())
  }

  if (!core.getSelection(SELECTION_TYPES.VERTEX)) {
    core.registerSelection(SELECTION_TYPES.VERTEX, new VertexSelection())
  }
}
