import { PrimaryToolType } from '@asra/utils'

export class PrimaryToolState {
  private _state: PrimaryToolType = PrimaryToolType.SELECT

  set(tool: PrimaryToolType) {
    this._state = tool
  }

  get current() {
    return this._state
  }
}

export default new PrimaryToolState()
