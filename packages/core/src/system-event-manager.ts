import type InputSystem from '@asra/input-system'
import factory from '@asra/factory'
import { Events } from './combinations'

class SystemEventManager {
  private inputSystem: InputSystem

  constructor(inputSystem: InputSystem) {
    this.inputSystem = inputSystem
    this._init()
  }

  _init() {
    this.inputSystem.on(Events.HOVER, this._handleHover)
    this.inputSystem.on(Events.DRAG_START, this._handleDragStart)
    this.inputSystem.on(Events.DRAG_UPDATE, this._handleDragUpdate)
    this.inputSystem.on(Events.DRAG_END, this._handleDragEnd)
    this.inputSystem.on(Events.UNDO, this._handleUndo)
    this.inputSystem.on(Events.REDO, this._handleRedo)
  }

  _handleUndo() {
    factory.transact.undo()
  }

  _handleRedo() {
    factory.transact.redo()
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
