import InputSystem from '@asra/input-system'
import Factory from '@asra/factory'

class SystemEventManager {
  private inputSystem: InputSystem

  constructor(inputSystem: InputSystem) {
    this.inputSystem = inputSystem
    this._init()
  }

  _init() {
    this.inputSystem.on('HOVER', this._handleHover)
    this.inputSystem.on('DRAG_START', this._handleDragStart)
    this.inputSystem.on('DRAG_UPDATE', this._handleDragUpdate)
    this.inputSystem.on('DRAG_END', this._handleDragEnd)
    this.inputSystem.on('UNDO', this._handleUndo)
    this.inputSystem.on('REDO', this._handleRedo)
  }

  _handleUndo() {
    Factory.transact.undo()
  }

  _handleRedo() {
    Factory.transact.redo()
  }

  _handleDragStart() {
    // console.log('drag start')
  }

  _handleDragUpdate() {
    // console.log('drag update')
  }

  _handleDragEnd() {
    // console.log('drag end')
  }

  _handleHover() {
    // console.log('hover')
  }
}

export default SystemEventManager
