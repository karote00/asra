import {
  EventTypes,
  defineEvent,
  type EventDefinition,
  type UserActionCompletedPayload
} from '@asyra/reactive-events'
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

  USER_ACTION_COMPLETED: EventTypes.USER_ACTION_COMPLETED,

  POINTER_HOVER: 'render.pointer.hover',
  POINTER_LEAVE: 'render.pointer.leave'
} as const

export type PresetEventName =
  (typeof PresetEventNames)[keyof typeof PresetEventNames]

export type PresetEventDefinitions = {
  [K in keyof typeof PresetEventNames]: EventDefinition<unknown, unknown>
}

const InputEventDefinitions = {
  INPUT_DRAG: defineEvent(InputSystemEvents.INPUT_DRAG),
  INPUT_DRAG_START: defineEvent(InputSystemEvents.INPUT_DRAG_START),
  INPUT_DRAG_UPDATE: defineEvent(InputSystemEvents.INPUT_DRAG_UPDATE),
  INPUT_DRAG_END: defineEvent(InputSystemEvents.INPUT_DRAG_END),
  INPUT_DOUBLE_CLICK: defineEvent(InputSystemEvents.INPUT_DOUBLE_CLICK),
  INPUT_MOUSE_MOVE: defineEvent(InputSystemEvents.INPUT_MOUSE_MOVE),
  INPUT_WHEEL_SCROLL: defineEvent(InputSystemEvents.INPUT_WHEEL_SCROLL),
  INPUT_SHORTCUT_ARROW: defineEvent(InputSystemEvents.INPUT_SHORTCUT_ARROW),
  INPUT_SHORTCUT_UNDOREDO: defineEvent(
    InputSystemEvents.INPUT_SHORTCUT_UNDOREDO
  ),
  INPUT_SHORTCUT_ZOOM_PRESET: defineEvent(
    InputSystemEvents.INPUT_SHORTCUT_ZOOM_PRESET
  ),
  INPUT_SHORTCUT_SWITCH_PRIMARY_TOOL: defineEvent(
    InputSystemEvents.INPUT_SHORTCUT_SWITCH_PRIMARY_TOOL
  ),
  INPUT_SHORTCUT_ENTER: defineEvent(InputSystemEvents.INPUT_SHORTCUT_ENTER),
  INPUT_SHORTCUT_CANCEL: defineEvent(InputSystemEvents.INPUT_SHORTCUT_CANCEL),
  INPUT_SHORTCUT_SELECT_ELEMENTS: defineEvent(
    InputSystemEvents.INPUT_SHORTCUT_SELECT_ELEMENTS
  )
}

const RenderEventDefinitions = {
  INIT_RENDER: defineEvent(PresetEventNames.INIT_RENDER),
  EMIT_INIT_RENDER: defineEvent(PresetEventNames.EMIT_INIT_RENDER)
}

const SceneTreeEventDefinitions = {
  SCENE_TREE_INIT: defineEvent(PresetEventNames.SCENE_TREE_INIT),
  SCENE_TREE_LOAD_DATA: defineEvent(PresetEventNames.SCENE_TREE_LOAD_DATA),
  SCENE_TREE_LOAD_COMPLETE: defineEvent(
    PresetEventNames.SCENE_TREE_LOAD_COMPLETE
  ),
  SCENE_TREE_SAVE_DATA: defineEvent(PresetEventNames.SCENE_TREE_SAVE_DATA),
  FINISH_SCENE_TREE_SAVE_DATA: defineEvent(
    PresetEventNames.FINISH_SCENE_TREE_SAVE_DATA
  ),
  SCENE_TREE_CHANGED: defineEvent(PresetEventNames.SCENE_TREE_CHANGED)
}

const ElementEventDefinitions = {
  ADD_ELEMENT: defineEvent(PresetEventNames.ADD_ELEMENT),
  FINISH_ADD_ELEMENT: defineEvent(PresetEventNames.FINISH_ADD_ELEMENT),
  REMOVE_ELEMENT: defineEvent(PresetEventNames.REMOVE_ELEMENT),
  UPDATE_COMPUTED_DATA: defineEvent(PresetEventNames.UPDATE_COMPUTED_DATA),
  CHANGE_COMPUTED_DATA: defineEvent(PresetEventNames.CHANGE_COMPUTED_DATA)
}

const SelectionEventDefinitions = {
  SELECT_ELEMENTS: defineEvent(PresetEventNames.SELECT_ELEMENTS)
}

const PropertyEventDefinitions = {
  PROPS_LOAD_DATA: defineEvent(PresetEventNames.PROPS_LOAD_DATA),
  PROPS_SAVE_DATA: defineEvent(PresetEventNames.PROPS_SAVE_DATA),
  FINISH_PROPS_SAVE_DATA: defineEvent(PresetEventNames.FINISH_PROPS_SAVE_DATA),
  ADD_PROPERTY: defineEvent(PresetEventNames.ADD_PROPERTY),
  REMOVE_PROPERTY: defineEvent(PresetEventNames.REMOVE_PROPERTY),
  UPDATE_PROPERTY: defineEvent(PresetEventNames.UPDATE_PROPERTY)
}

const SystemContextEventDefinitions = {
  UPDATE_MOUSE_STATE: defineEvent(PresetEventNames.UPDATE_MOUSE_STATE),
  UPDATE_TARGET_STATE: defineEvent(PresetEventNames.UPDATE_TARGET_STATE),
  UPDATE_HOVERED_ELEMENT_ID: defineEvent(
    PresetEventNames.UPDATE_HOVERED_ELEMENT_ID
  ),
  UPDATE_KEY_STATE: defineEvent(PresetEventNames.UPDATE_KEY_STATE)
}

const InputSystemEventDefinitions = {
  SWITCH_INPUT_SYSTEM_WATCHED_ELEMENT: defineEvent(
    PresetEventNames.SWITCH_INPUT_SYSTEM_WATCHED_ELEMENT
  )
}

const UserActionEventDefinitions = {
  USER_ACTION_COMPLETED: defineEvent<UserActionCompletedPayload>(
    PresetEventNames.USER_ACTION_COMPLETED
  )
}

const RendererEventDefinitions = {
  POINTER_HOVER: defineEvent(PresetEventNames.POINTER_HOVER),
  POINTER_LEAVE: defineEvent(PresetEventNames.POINTER_LEAVE)
}

export const PresetEventDefinitions: PresetEventDefinitions = {
  ...InputEventDefinitions,
  ...RenderEventDefinitions,
  ...SceneTreeEventDefinitions,
  ...ElementEventDefinitions,
  ...SelectionEventDefinitions,
  ...PropertyEventDefinitions,
  ...SystemContextEventDefinitions,
  ...InputSystemEventDefinitions,
  ...UserActionEventDefinitions,
  ...RendererEventDefinitions
}
