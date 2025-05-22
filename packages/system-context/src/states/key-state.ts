import { KeySnapshot } from '@asra/utils'

const InitModifiers = {
  meta: false,
  ctrl: false,
  alt: false,
  shift: false,
  pressedKeys: []
}

export class KeyState {
  private _state: KeySnapshot

  constructor() {
    this._state = {
      ...InitModifiers
    }
  }

  set(keySnapshot: KeySnapshot) {
    this._state = { ...keySnapshot, pressedKeys: [...keySnapshot.pressedKeys] }
  }

  get current() {
    return this._state
  }
}

export default new KeyState()
