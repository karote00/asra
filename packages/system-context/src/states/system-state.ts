import { SystemMode } from '@asra/utils'

export class SystemState {
  private _mode: SystemMode = SystemMode.DESIGN

  set(mode: SystemMode) {
    this._mode = mode
  }

  get mode() {
    return this._mode
  }
}

export default new SystemState()
