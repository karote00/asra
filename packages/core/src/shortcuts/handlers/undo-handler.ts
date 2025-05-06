import InputSystem from '@asra/input-system'
import { Events } from '../../combinations'

interface UndoHandlerDeps {
  undo: () => void
  redo: () => void
}

export class UndoHandler {
  constructor(
    private inputSystem: InputSystem,
    private deps: UndoHandlerDeps
  ) {
    this.init()
  }

  init() {
    this.inputSystem.on(Events.UNDO, this._handleUndo)
    this.inputSystem.on(Events.REDO, this._handleRedo)
  }

  _handleUndo = () => {
    this.deps.undo()
  }

  _handleRedo = () => {
    this.deps.redo()
  }
}
