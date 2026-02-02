/**
 * App-level select elements behavior
 */

import core from '@asyra/core'
import { SELECTION_TYPES } from '@asyra/utils'

export const selectElementsBehavior = (elementIds: string[]) => {
  const elementSelection = core.deps.selection.get(SELECTION_TYPES.ELEMENT)
  if (elementSelection) {
    elementSelection.select(elementIds)
  }
}
