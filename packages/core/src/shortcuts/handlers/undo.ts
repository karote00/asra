import { Events } from '../../combinations'
import { HandlerDeps, UndoAPIs } from '../../types/core-apis'

export class UndoHandler {
  constructor(
    private inputSystem: HandlerDeps['inputSystem'],
    private deps: UndoAPIs
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
