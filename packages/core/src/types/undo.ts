export interface UndoActionAPIs {
  undo: () => void
  redo: () => void
}

export type UndoAPIs = UndoActionAPIs
