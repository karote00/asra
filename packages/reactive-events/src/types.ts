// Core
export enum CoreEventTypes {
  CORE_ADD_ELEMENT = 'coreAddElement'
}

// Render
export enum RenderEventTypes {
  INIT_RENDER = 'initRender',
  FINISH_INIT_RENDER = 'finishInitRender',
  RENDER_IS_READY = 'renderIsReady',
  ZOOM_FIT = 'zoomFit',
  REQUEST_RENDER_ZOOM = 'requestRenderZoom',
  FINISH_REQUEST_RENDER_ZOOM = 'finishRequestRenderZoom'
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
  FINISH_ADD_ELEMENT = 'finishAddElement',
  REMOVE_ELEMENT = 'removeElement',
  UPDATE_COMPUTED_DATA = 'updateComputedData',
  CHANGE_COMPUTED_DATA = 'changeComputedData'
}

// Undo
export enum UndoRedoEventTypes {
  UNDOREDO_STATUS = 'UNDOREDO_STATUS'
}

// Transaction
export enum TransactionEventTypes {
  UNDO = 'undo',
  REDO = 'redo',
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
  ...CoreEventTypes,
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
