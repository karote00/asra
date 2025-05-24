import {
  SystemContextSnapshot,
  InputSystemEvents,
  DetailType,
  InteractionEvent,
  InteractionActions
} from '@asra/utils'
import { decideInteraction } from './decider'
import { decideSwitchPrimaryTool } from '@asra/reactive-events'

class InteractionCore {
  private _previousSession: InteractionEvent | null = null

  executeAction(
    eventName: InputSystemEvents,
    systemContextSnapshot: SystemContextSnapshot,
    detail?: DetailType
  ) {
    console.log(eventName, systemContextSnapshot, detail)
    const action = decideInteraction(eventName, systemContextSnapshot, detail)
    console.log('decidee action')
    console.log(action)
    if (action) {
      if (this._previousSession) {
        this.cancelPreviousAction()
      }

      this.emitAction(action)

      this._previousSession = action
    }
  }

  startSession(
    eventName: InputSystemEvents,
    systemContextSnapshot: SystemContextSnapshot,
    detail?: DetailType
  ) {
    const action = decideInteraction(eventName, systemContextSnapshot, detail)
    if (action) {
      if (this._previousSession) {
        this.cancelPreviousAction()
      }
    }

    this._previousSession = action
  }

  updateSession(
    eventName: InputSystemEvents,
    systemContextSnapshot: SystemContextSnapshot,
    detail?: DetailType
  ) {
    const action = decideInteraction(eventName, systemContextSnapshot, detail)
    this._previousSession = action
  }

  endSession(
    eventName: InputSystemEvents,
    systemContextSnapshot: SystemContextSnapshot,
    detail?: DetailType
  ) {
    const action = decideInteraction(eventName, systemContextSnapshot, detail)
    this._previousSession = null
  }

  emitAction(action: InteractionEvent) {
    console.log('executeAction', action)
    switch (action.type) {
      case InteractionActions.ACTION_SWITCH_PRIMARY_TOOL:
        decideSwitchPrimaryTool(action.payload.primaryTool)
        break
    }
  }

  cancelPreviousAction() {
    this._previousSession = null
  }
}

export { InteractionCore }

const interactionCore = new InteractionCore()
export default interactionCore
