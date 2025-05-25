const combinations: Record<string, string[]> = {
  UNDO: ['Meta', 'Z'],
  REDO: ['Meta', 'Shift', 'Z'],
  COPY: ['Meta', 'C'],
  PASTE: ['Meta', 'V'],
  CUT: ['Meta', 'X'],
  SELECT_ALL: ['Meta', 'A'],
  DELETE: ['Delete'],
  CANCEL: ['Escape'],
  SAVE: ['Meta', 'S'],
  SAVE_AS: ['Meta', 'Shift', 'S'],
  SWITCH_WINDOW: ['Alt', 'Tab'],
  MULTI_SELECT: ['Meta', 'LeftMouseDown'],
  RANGE_SELECT: ['Shift', 'LeftMouseDown'],
  PRECISE_DRAG: ['Alt', 'LeftMouseDown'],
  CONTEXT_MENU: ['Meta', 'RightMouseDown'],
  MOVE_UP: ['ArrowUp'],
  MOVE_DOWN: ['ArrowDown'],
  MOVE_LEFT: ['ArrowLeft'],
  MOVE_RIGHT: ['ArrowRight'],
  MOVE_UP_FAST: ['Shift', 'ArrowUp'],
  MOVE_DOWN_FAST: ['Shift', 'ArrowDown'],
  MOVE_LEFT_FAST: ['Shift', 'ArrowLeft'],
  MOVE_RIGHT_FAST: ['Shift', 'ArrowRight'],
  ZOOM: ['Meta', 'Wheel'],
  ZOOM_FIT: ['Meta', '1'],
  PAN: ['Wheel'],
  HOVER: ['LeftMouseMove'],
  DRAG_START: ['LeftMouseDown'],
  DRAG_UPDATE: ['LeftMouseDown', 'LeftMouseMove'],
  DRAG_END: ['LeftMouseUp'],
  RIGHT_CLICK: ['RightMouseUp'],
  DOUBLE_CLICK: ['MouseDoubleClick'],
  SWITCH_TO_SELECT_TOOL: ['V'],
  SWITCH_TO_RECTANGLE_TOOL: ['R']
}

export const Events = Object.keys(combinations).reduce(
  (acc, eventName) => {
    acc[eventName] = eventName
    return acc
  },
  {} as Record<string, string>
)

export default combinations
