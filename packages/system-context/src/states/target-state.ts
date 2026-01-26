import { TargetSnapshot } from '@asyra/utils'

export class TargetState {
  private _state: TargetSnapshot

  constructor() {
    this._state = {
      hoveredElementId: null,
      selectedElementIds: [],
      activeElementId: null
    }
  }

  updateHoveredElementId(elementId: string | null) {
    this._state.hoveredElementId = elementId
  }

  get current() {
    return this._state
  }
}

export default new TargetState()
