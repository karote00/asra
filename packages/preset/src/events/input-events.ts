export const InputSystemEvents = {
  INPUT_DRAG: 'input.drag',
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
  INPUT_SHORTCUT_DELETE: 'input.shortcut.delete',
  INPUT_SHORTCUT_SELECT_ELEMENTS: 'input.shortcut.selectElements'
} as const

export type InputSystemEventName =
  (typeof InputSystemEvents)[keyof typeof InputSystemEvents]
