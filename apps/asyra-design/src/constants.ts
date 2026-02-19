export const CANVAS_BACKGROUND_COLOR = 0x141414
export const ROW_HEIGHT = 8 // 32 / 4 = 8 for tailwind
export const COLUMN_WIDTH = 60 // 240 / 4 = 60 for tailwind
export const MOUSE_MOVEMENT_THRESHOLD = 3 // pixels - significant movement threshold for canvas operations

export const InputSystemEvents = {
  INPUT_DRAG_START: 'input.drag.start',
  INPUT_DRAG_UPDATE: 'input.drag.update',
  INPUT_DRAG_END: 'input.drag.end',
  INPUT_DOUBLE_CLICK: 'input.double.click',
  INPUT_MOUSE_MOVE: 'input.mouse.move',
  INPUT_WHEEL_SCROLL: 'input.wheel.scroll',
  INPUT_SHORTCUT_ARROW: 'input.shortcut.arrow',
  INPUT_SHORTCUT_UNDOREDO: 'input.shortcut.undoredo',
  INPUT_SHORTCUT_ZOOM_PRESET: 'input.shortcut.zoomPreset',
  INPUT_SHORTCUT_SWITCH_PRIMARY_TOOL: 'input.shortcut.switchPrimaryTool',
  INPUT_SHORTCUT_ENTER: 'input.shortcut.enter',
  INPUT_SHORTCUT_CANCEL: 'input.shortcut.cancel',
  INPUT_SHORTCUT_SELECT_ELEMENTS: 'input.shortcut.selectElements'
} as const

export type InputSystemEvents =
  (typeof InputSystemEvents)[keyof typeof InputSystemEvents]

export const PrimaryToolType = {
  SELECT: 'select',
  RECTANGLE: 'rect',
  OVAL: 'oval',
  PEN: 'pen'
} as const

export type PrimaryToolType =
  (typeof PrimaryToolType)[keyof typeof PrimaryToolType]
