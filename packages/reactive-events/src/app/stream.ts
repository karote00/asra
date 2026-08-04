import { createEventStream } from '../event-bus.js'
import { EventTypes } from '../types.js'

export const endTransaction$ = (reloadAction?: () => void) =>
  createEventStream(EventTypes.END_TRANSACTION, reloadAction)
