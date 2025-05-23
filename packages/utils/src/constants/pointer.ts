export enum MouseButton {
  LEFT = 'left',
  RIGHT = 'right',
  MIDDLE = 'middle',
  NONE = 'none'
}

export const MouseButtonList = [
  MouseButton.LEFT,
  MouseButton.RIGHT,
  MouseButton.MIDDLE,
  MouseButton.NONE
]

export enum PointerKey {
  LEFT_MOUSE_DOWN = 'leftMouseDown',
  LEFT_MOUSE_UP = 'leftMouseUp',
  LEFT_MOUSE_MOVE = 'leftMouseMove',
  RIGHT_MOUSE_DOWN = 'rightMouseDown',
  RIGHT_MOUSE_UP = 'rightMouseUp',
  MOUSE_DOUBLE_CLICK = 'mouseDoubleClick',
  WHEEL = 'wheel'
}

export type WheelKey = 'wheel'

export const DefaultPointerEventData = {
  clientX: 0,
  clientY: 0,
  deltaX: 0,
  deltaY: 0,
  deltaZ: 0,
  button: MouseButton.NONE
}
