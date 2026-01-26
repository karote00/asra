import { DefaultPosition, MouseButton, MouseSnapshot } from '@asyra/utils'

export class MouseState {
  private _state: MouseSnapshot

  constructor() {
    this._state = {
      dragStart: DefaultPosition,
      position: DefaultPosition,
      delta: DefaultPosition,
      button: MouseButton.NONE,
      down: false,
      dragging: false
    }
  }

  set(mouseSnapshot: MouseSnapshot) {
    if (mouseSnapshot.dragStart) {
      this._state.dragStart = { ...mouseSnapshot.dragStart }
    }
    this._state.position = { ...mouseSnapshot.position }
    this._state.delta = { ...mouseSnapshot.delta }
    this._state.button = mouseSnapshot.button
    this._state.down = mouseSnapshot.down
    this._state.dragging = mouseSnapshot.dragging
  }

  get current() {
    return this._state
  }
}

export default new MouseState()
