import { InteractionActions, InteractionEvent } from '@asyra/utils'
import { TransactionHandlers } from './transaction'
import { PrimaryToolHandlers } from './primary-tool'
import { ElementHandlers } from './element'
import { UndoRedoHandlers } from './undoredo'
import { ZoomFitHandlers } from './zoomfit'
import { PanZoomHandlers } from './panzoom'

export const InteractionCoreHandlers: Record<
  InteractionActions,
  (
    payload?: InteractionEvent['payload'],
    options?: InteractionEvent['options']
  ) => void
> = {
  ...TransactionHandlers,
  ...PrimaryToolHandlers,
  ...ElementHandlers,
  ...UndoRedoHandlers,
  ...ZoomFitHandlers,
  ...PanZoomHandlers
}
