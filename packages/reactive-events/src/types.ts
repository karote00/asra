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
  CHANGE_COMPUTED_DATA = 'changeComputedData',
  CHANGE_COMPUTED_DATA_BATCH = 'changeComputedDataBatch'
}

// Selection
export enum SelectionEventTypes {
  SELECT_ELEMENTS = 'selectElements',
  SELECT_VECTOR_POINTS = 'selectVectorPoints',
  SELECT_VECTOR_SEGMENTS = 'selectVectorSegments'
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
  END_TRANSACTION = 'endTransaction',
  USER_ACTION_COMPLETED = 'userActionCompleted'
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

/**
 * Renderer Events
 *
 * These events are published by the render engine's native event handlers.
 * They represent the render engine's feedback about what's happening in the rendered scene.
 *
 * IMPORTANT: Distinction between input.* and renderer.* events:
 * - input.* events: Raw user input actions (mouse move, click, keyboard) from DOM
 * - renderer.* events: Render engine feedback (element hover, visibility change) from rendering layer
 *
 * Example: User moves mouse over a rectangle:
 *   1. input.mouse.move fires (raw action)
 *   2. Render engine detects rectangle under cursor
 *   3. render.pointer.hover fires (engine feedback with elementId)
 */
export enum RendererEventTypes {
  POINTER_HOVER = 'render.pointer.hover',
  POINTER_LEAVE = 'render.pointer.leave',
  POINTER_DOWN = 'render.pointer.down',
  POINTER_MOVE = 'render.pointer.move',
  POINTER_UP = 'render.pointer.up',
  POINTER_CAPTURE_START = 'render.pointer.capture.start',
  POINTER_CAPTURE_END = 'render.pointer.capture.end'
}

// InputSystem
export enum InputSystemEventTypes {
  SWITCH_INPUT_SYSTEM_WATCHED_ELEMENT = 'switchInputSystemWatchedElement'
}

export const EventTypes = {
  ...RenderEventTypes,
  ...FileEventTypes,
  ...SceneTreeEventTypes,
  ...ElementEventTypes,
  ...SelectionEventTypes,
  ...UndoRedoEventTypes,
  ...TransactionEventTypes,
  ...PropsEventTypes,
  ...InputSystemEventTypes,
  ...RendererEventTypes
} as const

export type EventTypes = (typeof EventTypes)[keyof typeof EventTypes]
