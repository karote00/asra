import { MouseButton, MouseSnapshot } from '@asra/utils'

const InitPosition = { x: 0, y: 0 }
const InitModifiers = {
  meta: false,
  ctrl: false,
  alt: false,
  shift: false
}

export class MouseState {
  private _state: MouseSnapshot

  constructor() {
    this._state = {
      position: InitPosition,
      delta: InitPosition,
      button: MouseButton.NONE,
      down: false,
      dragging: false,
      modifiers: InitModifiers
    }
  }

  set(mouseSnapshot: MouseSnapshot) {
    this._state.position = { ...mouseSnapshot.position }
    this._state.delta = { ...mouseSnapshot.delta }
    this._state.modifiers = { ...mouseSnapshot.modifiers }
    this._state.button = mouseSnapshot.button
    this._state.down = mouseSnapshot.down
    this._state.dragging = mouseSnapshot.dragging
  }

  get current() {
    return this._state
  }
}

export default new MouseState()
