import { DefaultKeySnapshot, KeySnapshot } from '@asra/utils'

export class KeyState {
  private _state: KeySnapshot

  constructor() {
    this._state = {
      ...DefaultKeySnapshot
    }
  }

  set(keySnapshot: KeySnapshot) {
    this._state = { ...keySnapshot }
  }

  get current() {
    return this._state
  }
}

export default new KeyState()
