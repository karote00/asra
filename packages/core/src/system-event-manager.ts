import InputSystem from '@asra/input-system'
import Factory from '@asra/factory'

class SystemEventManager {
  private inputSystem: InputSystem

  constructor(inputSystem: InputSystem) {
    this.inputSystem = inputSystem
    this._init()
  }

  _init() {
    this.inputSystem.on('UNDO', this._handleUndo)
    this.inputSystem.on('REDO', this._handleRedo)
  }

  _handleUndo() {
    Factory.transact.undo()
  }

  _handleRedo() {
    Factory.transact.redo()
  }
}

export default SystemEventManager
