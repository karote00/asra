import {
  SystemContextSnapshot,
  InputSystemEvents,
  DetailType,
  InteractionEvent,
  InteractionActions
} from '@asyra/utils'
import { InteractionCoreHandlers } from './handlers'
import { InteractionRegistry } from './registry'

class InteractionCore {
  private _previousSession: InteractionEvent | null = null
  public registry: InteractionRegistry

  constructor() {
    this.registry = new InteractionRegistry()
  }

  executeAction(
    eventName: InputSystemEvents,
    systemContextSnapshot: SystemContextSnapshot,
    detail?: DetailType
  ) {
    if (this._previousSession) {
      this.cancelPreviousSession()
    }

    const interaction = this.registry.decide(
      eventName,
      systemContextSnapshot,
      detail
    )

    this.dispatchSession(interaction)
  }

  startSession(
    eventName: InputSystemEvents,
    systemContextSnapshot: SystemContextSnapshot,
    detail?: DetailType
  ) {
    if (this._previousSession) {
      this.cancelPreviousSession()
    }

    this.dispatchSession({
      type: InteractionActions.INTERACTION_START_TRANSACTION
    })

    const interaction = this.registry.decide(
      eventName,
      systemContextSnapshot,
      detail
    )
    this.dispatchSession(interaction)
  }

  updateSession(
    eventName: InputSystemEvents,
    systemContextSnapshot: SystemContextSnapshot,
    detail?: DetailType
  ) {
    const interaction = this.registry.decide(
      eventName,
      systemContextSnapshot,
      detail
    )
    this._previousSession = interaction
    this.dispatchSession(interaction)
  }

  endSession(
    eventName: InputSystemEvents,
    systemContextSnapshot: SystemContextSnapshot,
    detail?: DetailType
  ) {
    const interaction = this.registry.decide(
      eventName,
      systemContextSnapshot,
      detail
    )
    this.dispatchSession(interaction)
    this.cancelPreviousSession()

    this.dispatchSession({
      type: InteractionActions.INTERACTION_END_TRANSACTION
    })
  }

  dispatchSession(interaction: InteractionEvent | null) {
    if (!interaction) {
      return
    }

    const handler = InteractionCoreHandlers[interaction.type]
    if (handler) {
      handler(interaction.payload, interaction.options)
    }

    this._previousSession = interaction
  }

  cancelPreviousSession() {
    this._previousSession = null
  }
}

export { InteractionCore }

const interactionCore = new InteractionCore()

export default interactionCore
