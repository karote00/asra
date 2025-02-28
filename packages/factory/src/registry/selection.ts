import * as Y from 'yjs'
import { SelectionYjsChange } from '@asra/utils'
import doc from '../data'
import { UNDO_CAPTURE_TIMEOUT } from './constants'

export const elementSelectionChange =
  doc.getArray<SelectionYjsChange>('selectionChange')
export const elementSelectionChangeManager = new Y.UndoManager(
  elementSelectionChange,
  {
    captureTimeout: UNDO_CAPTURE_TIMEOUT
  }
)
