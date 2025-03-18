import { createEventStream } from '../event-bus'
import { EventTypes } from '../types'

export const endTransaction$ = (reloadAction?: () => void) =>
  createEventStream(EventTypes.END_TRANSACTION, reloadAction)
