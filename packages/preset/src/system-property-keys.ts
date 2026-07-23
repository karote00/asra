export const ViewportSystemPropertyKeys = Object.freeze({
  ZOOM: 'zoom',
  VIEWPORT_POSITION: 'viewportPosition'
} as const)

export const InputSystemPropertyKeys = Object.freeze({
  PRIMARY_TOOL: 'primaryTool',
  SYSTEM_MODE: 'systemMode',
  SYSTEM_FEATURE_FLAGS: 'systemFeatureFlags',
  SYSTEM_PERMISSIONS: 'systemPermissions',
  MOUSE_DRAG_START: 'mouseDragStart',
  MOUSE_POSITION: 'mousePosition',
  MOUSE_DELTA: 'mouseDelta',
  MOUSE_BUTTON: 'mouseButton',
  MOUSE_DOWN: 'mouseDown',
  MOUSE_DRAGGING: 'mouseDragging',
  KEY_SHIFT: 'keyShift',
  KEY_CTRL: 'keyCtrl',
  KEY_ALT: 'keyAlt',
  KEY_META: 'keyMeta'
} as const)

export const SelectionSystemPropertyKeys = Object.freeze({
  HOVERED_ELEMENT_ID: 'hoveredElementId',
  SELECTED_ELEMENT_IDS: 'selectedElementIds',
  ACTIVE_ELEMENT_ID: 'activeElementId'
} as const)

export const VectorEditingSystemPropertyKeys = Object.freeze({
  PATH_EDITING_VECTOR_ID: 'pathEditingVectorId',
  PATH_EDITING_MODE: 'pathEditingMode',
  PATH_EDITING_START_NEW_SUBPATH: 'pathEditingStartNewSubpath',
  SELECTED_VECTOR_POINT: 'selectedVectorPoint',
  HOVERED_VECTOR_POINT: 'hoveredVectorPoint',
  SELECTED_VECTOR_SEGMENT: 'selectedVectorSegment',
  HOVERED_VECTOR_SEGMENT: 'hoveredVectorSegment',
  HOVERED_VECTOR_SEGMENT_INSERT_POINT: 'hoveredVectorSegmentInsertPoint',
  PATH_EDITING_CONTINUATION: 'pathEditingContinuation'
} as const)

export const PresetSystemPropertyKeys = Object.freeze({
  ...ViewportSystemPropertyKeys,
  ...InputSystemPropertyKeys,
  ...SelectionSystemPropertyKeys,
  ...VectorEditingSystemPropertyKeys
} as const)

export type PresetSystemPropertyKey =
  (typeof PresetSystemPropertyKeys)[keyof typeof PresetSystemPropertyKeys]

export const PRESET_SYSTEM_PROPERTY_KEYS: readonly PresetSystemPropertyKey[] =
  Object.freeze(Object.values(PresetSystemPropertyKeys))
