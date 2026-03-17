import type {
  FileLoadCompleteEvent,
  StartTransactionEvent,
  UpdateTransactionEvent,
  EndTransactionEvent,
  UserActionCompletedEvent,
  UpdateUndoRedoStatusEvent,
  RenderIsReadyEvent,
  UndoEvent,
  RedoEvent,
  RenderPointerHoverEvent,
  RenderPointerLeaveEvent,
  RenderPointerDownEvent,
  RenderPointerMoveEvent,
  RenderPointerUpEvent,
  RenderPointerCaptureStartEvent,
  RenderPointerCaptureEndEvent
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

export const subscribeToUserActionCompleted =
  createSubscribeEvent<UserActionCompletedEvent>(
    EventTypes.USER_ACTION_COMPLETED
  )

export const subscribeToUpdateUndoRedoStatus =
  createSubscribeEvent<UpdateUndoRedoStatusEvent>(
    EventTypes.UPDATE_UNDOREDO_STATUS
  )

export const subscribeToUndo = createSubscribeEvent<UndoEvent>(EventTypes.UNDO)

export const subscribeToRedo = createSubscribeEvent<RedoEvent>(EventTypes.REDO)

export const subscribeToRenderPointerHover =
  createSubscribeEvent<RenderPointerHoverEvent>(EventTypes.POINTER_HOVER)

export const subscribeToRenderPointerLeave =
  createSubscribeEvent<RenderPointerLeaveEvent>(EventTypes.POINTER_LEAVE)

export const subscribeToRenderPointerDown =
  createSubscribeEvent<RenderPointerDownEvent>(EventTypes.POINTER_DOWN)

export const subscribeToRenderPointerMove =
  createSubscribeEvent<RenderPointerMoveEvent>(EventTypes.POINTER_MOVE)

export const subscribeToRenderPointerUp =
  createSubscribeEvent<RenderPointerUpEvent>(EventTypes.POINTER_UP)

export const subscribeToRenderPointerCaptureStart =
  createSubscribeEvent<RenderPointerCaptureStartEvent>(
    EventTypes.POINTER_CAPTURE_START
  )

export const subscribeToRenderPointerCaptureEnd =
  createSubscribeEvent<RenderPointerCaptureEndEvent>(
    EventTypes.POINTER_CAPTURE_END
  )
