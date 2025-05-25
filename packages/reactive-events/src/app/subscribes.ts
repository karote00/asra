import type {
  FileLoadCompleteEvent,
  StartTransactionEvent,
  UpdateTransactionEvent,
  EndTransactionEvent,
  UpdateUndoRedoStatusEvent,
  RenderIsReadyEvent,
  UndoEvent,
  RedoEvent
} from './events'
import { createSubscribeEvent } from '../event-bus'
import { EventTypes } from '../types'

export const subscribeToRenderIsReady =
  createSubscribeEvent<RenderIsReadyEvent>(EventTypes.RENDER_IS_READY)

export const subscribeToFileLoadComplete =
  createSubscribeEvent<FileLoadCompleteEvent>(EventTypes.FILE_LOAD_COMPLETE)

export const subscribeToStartTransaction =
  createSubscribeEvent<StartTransactionEvent>(EventTypes.START_TRANSACTION)

export const subscribeToUpdateTransaction =
  createSubscribeEvent<UpdateTransactionEvent>(EventTypes.UPDATE_TRANSACTION)

export const subscribeToEndTransaction =
  createSubscribeEvent<EndTransactionEvent>(EventTypes.END_TRANSACTION)

export const subscribeToUpdateUndoRedoStatus =
  createSubscribeEvent<UpdateUndoRedoStatusEvent>(
    EventTypes.UPDATE_UNDOREDO_STATUS
  )

export const subscribeToUndo = createSubscribeEvent<UndoEvent>(EventTypes.UNDO)

export const subscribeToRedo = createSubscribeEvent<RedoEvent>(EventTypes.REDO)
