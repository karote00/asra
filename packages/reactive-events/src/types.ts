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
  UPDATE_ELEMENT_DATA = 'updateElementData',
  CHANGE_ELEMENT_DATA = 'changeElementData'
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
  UPDATE_PROPERTY = 'updateProperty',
  PROP_CHANGE_COMPLETE = 'propChangeComplete'
}

export enum UIContextEventTypes {
  REQUEST_ELEMENT_SELECTION = 'requestElementSelection',
  FINISH_REQUEST_ELEMENT_SELECTION = 'finishRequestElementSelection'
}

export const EventTypes = {
  ...RenderEventTypes,
  ...FileEventTypes,
  ...SceneTreeEventTypes,
  ...ElementEventTypes,
  ...UndoRedoEventTypes,
  ...TransactionEventTypes,
  ...SelectionEventTypes,
  ...PropsEventTypes,
  ...UIContextEventTypes
} as const

export type EventTypes = (typeof EventTypes)[keyof typeof EventTypes]
