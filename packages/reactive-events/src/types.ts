// Render
export enum RenderEventTypes {
  RENDER_IS_READY = 'renderIsReady'
}

// File
export enum FileEventTypes {
  FILE_LOAD_COMPLETE = 'fileLoadComplete'
}

// SceneTree
export enum SceneTreeEventTypes {
  SCENE_TREE_LOAD_COMPLETE = 'sceneTreeLoadComplete',
  SCENE_TREE_CHANGED = 'sceneTreeChanged'
}

// Element
export enum ElementEventTypes {
  ADD_ELEMENT = 'addElement',
  REMOVE_ELEMENT = 'removeElement',
  UPDATE_ELEMENT = 'updateElement'
}

// Undo
export enum UndoRedoEventTypes {
  UNDOREDO_STATUS = 'UNDOREDO_STATUS'
}

// Transaction
export enum TransactionEventTypes {
  START_TRANSACTION = 'startTransaction',
  UPDATE_TRANSACTION = 'updateTransaction',
  END_TRANSACTION = 'endTransaction'
}

// Selection
export enum SelectionEventTypes {
  SELECT_ELEMENTS = 'selectElements'
}

// Properties
export enum PropsEventTypes {
  ADD_PROPERTY = 'addProperty',
  REMOVE_PROPERTY = 'removeProperty',
  PROP_CHANGE_COMPLETE = 'propChangeComplete'
}

export const EventTypes = {
  ...RenderEventTypes,
  ...FileEventTypes,
  ...SceneTreeEventTypes,
  ...ElementEventTypes,
  ...UndoRedoEventTypes,
  ...TransactionEventTypes,
  ...SelectionEventTypes,
  ...PropsEventTypes
} as const

export type EventTypes = (typeof EventTypes)[keyof typeof EventTypes]
