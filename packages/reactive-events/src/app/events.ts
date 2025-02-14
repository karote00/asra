import { UNDO } from '@asra/utils'
import { EventTypes } from '../types'

export interface StartTransactionEvent {
  type: EventTypes.START_TRANSACTION
}

export interface UpdateTransactionEvent {
  type: EventTypes.UPDATE_TRANSACTION
  eventName: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any & { undoable: UNDO }
}

export interface EndTransactionEvent {
  type: EventTypes.END_TRANSACTION
}

export interface UndoRedoStatusEvent {
  type: EventTypes.UNDOREDO_STATUS
  status: UNDO
}

export interface FileLoadCompleteEvent {
  type: EventTypes.FILE_LOAD_COMPLETE
}

export type AppEvent =
  | FileLoadCompleteEvent
  | StartTransactionEvent
  | UpdateTransactionEvent
  | EndTransactionEvent
  | UndoRedoStatusEvent
