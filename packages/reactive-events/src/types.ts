// Core
export enum CoreEventTypes {
  CORE_ADD_ELEMENT = 'coreAddElement'
}

// Render
export enum RenderEventTypes {
  INIT_RENDER = 'initRender',
  EMIT_INIT_RENDER = 'emitInitRender',
  RENDER_IS_READY = 'renderIsReady'
}

// File
export enum FileEventTypes {
  FILE_LOAD_COMPLETE = 'fileLoadComplete'
}

// SceneTree
export enum SceneTreeEventTypes {
  SCENE_TREE_INIT = 'sceneTreeInit',
  SCENE_TREE_LOAD_DATA = 'sceneTreeLoadData',
  SCENE_TREE_LOAD_COMPLETE = 'sceneTreeLoadComplete',
  SCENE_TREE_SAVE_DATA = 'sceneTreeSaveData',
  FINISH_SCENE_TREE_SAVE_DATA = 'finishSceneTreeSaveData',
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
  UNDO = 'undo',
  REDO = 'redo',
  UPDATE_UNDOREDO_STATUS = 'updateUndoRedoStatus'
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
  PROPS_LOAD_DATA = 'propsLoadData',
  PROPS_SAVE_DATA = 'propsSaveData',
  FINISH_PROPS_SAVE_DATA = 'finishPropsSaveData',
  ADD_PROPERTY = 'addProperty',
  REMOVE_PROPERTY = 'removeProperty',
  UPDATE_PROPERTY = 'updateProperty'
}

// UI-Context
export enum UIContextEventTypes {
  REQUEST_ELEMENT_SELECTION = 'requestElementSelection',
  FINISH_REQUEST_ELEMENT_SELECTION = 'finishRequestElementSelection'
}

// Viewport
export enum ViewportEventTypes {
  REQUEST_VIEWPORT_POSITION = 'requestViewportPosition',
  FINISH_REQUEST_VIEWPORT_POSITION = 'finishRequestViewportPosition',
  REQUEST_VIEWPORT_SCALE = 'requestViewportScale',
  FINISH_REQUEST_VIEWPORT_SCALE = 'finishRequestViewportScale',
  ZOOM_FIT = 'zoomFit',
  EMIT_ZOOM_FIT = 'emitZoomFit',
  PAN_TO = 'panTo',
  ZOOM_TO_CENTER = 'zoomToCenter',
  REQUEST_RENDER_ZOOM = 'requestRenderZoom',
  FINISH_REQUEST_RENDER_ZOOM = 'finishRequestRenderZoom'
}

// PrimaryTool
export enum PrimaryToolEventTypes {
  SWITCH_PRIMARY_TOOL = 'switchPrimaryTool',
  EMIT_SWITCH_PRIMARY_TOOL = 'emitSwitchPrimaryTool',
  REQUEST_CURRENT_PRIMARY_TOOL = 'requestCurrentPrimaryTool',
  FINISH_REQUEST_CURRENT_PRIMARY_TOOL = 'finishRequestCurrentPrimaryTool'
}

// MouseState
export enum MouseStateEventTypes {
  UPDATE_MOUSE_STATE = 'updateMouseState'
}

// InputSystem
export enum InputSystemEventTypes {
  SWITCH_INPUT_SYSTEM_WATCHED_ELEMENT = 'switchInputSystemWatchedElement'
}

// InteractionCore
export enum InteractionCoreEventTypes {
  EXECUTE_ACTION = 'executeAction',
  START_SESSION = 'startSession',
  UPDATE_SESSION = 'updateSession',
  END_SESSION = 'endSession',
  DECIDE_TO_SWITCH_PRIMARY_TOOL = 'decideToSwitchPrimaryTool',
  DECIDE_TO_CREATE_ELEMENT = 'decideToCreateElement',
  DECIDE_TO_UNDOREDO = 'decideToUndoRedo',
  DECIDE_TO_ZOOM_FIT = 'decideToZoomFit',
  DECIDE_TO_PAN_ZOOM = 'decideToPanZoom'
}

// SystemContext
export enum SystemContextEventTypes {
  REQUEST_SYSTEM_CONTEXT_SNAPSHOT = 'requestSystemContextSnapshot',
  FINISH_REQUEST_SYSTEM_CONTEXT_SNAPSHOT = 'finishRequestSystemContextSnapshot'
}

// KeyState
export enum KeyStateEventTypes {
  UPDATE_KEY_STATE = 'updateKeyState'
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
  ...UIContextEventTypes,
  ...ViewportEventTypes,
  ...PrimaryToolEventTypes,
  ...MouseStateEventTypes,
  ...InputSystemEventTypes,
  ...InteractionCoreEventTypes,
  ...SystemContextEventTypes,
  ...KeyStateEventTypes
} as const

export type EventTypes = (typeof EventTypes)[keyof typeof EventTypes]
