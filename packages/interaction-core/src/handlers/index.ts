import { InteractionActions, InteractionEvent } from '@asra/utils'
import { PrimaryToolHandlers } from './primary-tool'
import { ElementHandlers } from './element'
import { UndoRedoHandlers } from './undoredo'

export const InteractionCoreHandlers: Record<
  InteractionActions,
  (payload?: InteractionEvent['payload']) => void
> = {
  ...PrimaryToolHandlers,
  ...ElementHandlers,
  ...UndoRedoHandlers
}
