import { Events } from '../combinations'
import { HandlerDeps, UndoActionAPIs } from '../types'

export class UndoHandler {
  constructor(
    private inputSystem: HandlerDeps['inputSystem'],
    private deps: UndoActionAPIs
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
