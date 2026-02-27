import { InputSystemEvents } from './input-events'

export const PresetEventNames = {
  ...InputSystemEvents,

  INIT_RENDER: 'initRender',
  EMIT_INIT_RENDER: 'emitInitRender',

  SCENE_TREE_INIT: 'sceneTreeInit',
  SCENE_TREE_LOAD_DATA: 'sceneTreeLoadData',
  SCENE_TREE_LOAD_COMPLETE: 'sceneTreeLoadComplete',
  SCENE_TREE_SAVE_DATA: 'sceneTreeSaveData',
  FINISH_SCENE_TREE_SAVE_DATA: 'finishSceneTreeSaveData',
  SCENE_TREE_CHANGED: 'sceneTreeChanged',

  ADD_ELEMENT: 'addElement',
  FINISH_ADD_ELEMENT: 'finishAddElement',
  REMOVE_ELEMENT: 'removeElement',
  UPDATE_COMPUTED_DATA: 'updateComputedData',
  CHANGE_COMPUTED_DATA: 'changeComputedData',

  SELECT_ELEMENTS: 'selectElements',

  PROPS_LOAD_DATA: 'propsLoadData',
  PROPS_SAVE_DATA: 'propsSaveData',
  FINISH_PROPS_SAVE_DATA: 'finishPropsSaveData',
  ADD_PROPERTY: 'addProperty',
  REMOVE_PROPERTY: 'removeProperty',
  UPDATE_PROPERTY: 'updateProperty',

  UPDATE_MOUSE_STATE: 'updateMouseState',
  UPDATE_TARGET_STATE: 'updateTargetState',
  UPDATE_HOVERED_ELEMENT_ID: 'updateHoveredElementId',
  UPDATE_KEY_STATE: 'updateKeyState',

  SWITCH_INPUT_SYSTEM_WATCHED_ELEMENT: 'switchInputSystemWatchedElement',

  POINTER_HOVER: 'render.pointer.hover',
  POINTER_LEAVE: 'render.pointer.leave'
} as const

export type PresetEventName =
  (typeof PresetEventNames)[keyof typeof PresetEventNames]
