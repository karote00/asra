import { BaseSelection, type SelectionDefinition } from '@asyra/core'
import type { PresetCoreAPIs } from '../types'
import {
  SelectionActions,
  SelectionChannels,
  type SelectionChannel
} from './channels'

type SelectionFactory = () => BaseSelection

const DEFAULT_SELECTION_DEFINITIONS: Record<
  SelectionChannel,
  SelectionDefinition
> = {
  [SelectionChannels.ELEMENT]: {
    selectionType: SelectionChannels.ELEMENT,
    selectAction: SelectionActions.SELECT_ELEMENTS,
    eventName: SelectionActions.SELECT_ELEMENTS
  },
  [SelectionChannels.VECTOR_POINT]: {
    selectionType: SelectionChannels.VECTOR_POINT,
    selectAction: SelectionActions.SELECT_VECTOR_POINTS,
    eventName: SelectionActions.SELECT_VECTOR_POINTS
  },
  [SelectionChannels.VECTOR_SEGMENT]: {
    selectionType: SelectionChannels.VECTOR_SEGMENT,
    selectAction: SelectionActions.SELECT_VECTOR_SEGMENTS,
    eventName: SelectionActions.SELECT_VECTOR_SEGMENTS
  }
}

const DEFAULT_SELECTION_FACTORIES: Record<SelectionChannel, SelectionFactory> =
  Object.fromEntries(
    Object.entries(DEFAULT_SELECTION_DEFINITIONS).map(
      ([channel, definition]) => [channel, () => new BaseSelection(definition)]
    )
  ) as Record<SelectionChannel, SelectionFactory>

export const registerSelections = (
  core: Pick<PresetCoreAPIs, 'defineSelection' | 'getSelection'>
): void => {
  Object.entries(DEFAULT_SELECTION_FACTORIES).forEach(([channel, create]) => {
    const selectionChannel = channel as SelectionChannel
    if (!core.getSelection(selectionChannel)) {
      core.defineSelection(selectionChannel, create())
    }
  })
}
