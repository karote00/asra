import { SystemContextSnapshot, DetailType } from '@asyra/utils'
import { InteractionRegistry, type DecisionResult } from './registry'

class InteractionCore {
  private _previousSession: DecisionResult | null = null
  public registry: InteractionRegistry

  constructor() {
    this.registry = new InteractionRegistry()
  }

  executeAction(
    eventName: string,
    systemContextSnapshot: SystemContextSnapshot,
    detail?: DetailType
  ) {
    if (this._previousSession) {
      this.cancelPreviousSession()
    }

    const result = this.registry.decide(
      eventName,
      systemContextSnapshot,
      detail
    )

    this.dispatchDecision(result)
  }

  startSession(
    eventName: string,
    systemContextSnapshot: SystemContextSnapshot,
    detail?: DetailType
  ) {
    if (this._previousSession) {
      this.cancelPreviousSession()
    }

    const startTransactionResult: DecisionResult = {
      type: 'INTERACTION_START_TRANSACTION'
    }
    this.dispatchDecision(startTransactionResult)

    const result = this.registry.decide(
      eventName,
      systemContextSnapshot,
      detail
    )
    this.dispatchDecision(result)
  }

  updateSession(
    eventName: string,
    systemContextSnapshot: SystemContextSnapshot,
    detail?: DetailType
  ) {
    const result = this.registry.decide(
      eventName,
      systemContextSnapshot,
      detail
    )
    this._previousSession = result
    this.dispatchDecision(result)
  }

  endSession(
    eventName: string,
    systemContextSnapshot: SystemContextSnapshot,
    detail?: DetailType
  ) {
    const result = this.registry.decide(
      eventName,
      systemContextSnapshot,
      detail
    )
    this._previousSession = result

    const endTransactionResult: DecisionResult = {
      type: 'INTERACTION_END_TRANSACTION'
    }
    this.dispatchDecision(endTransactionResult)

    this.dispatchDecision(result)

    this._previousSession = null
  }

  private cancelPreviousSession() {
    if (this._previousSession) {
      const endTransactionResult: DecisionResult = {
        type: 'INTERACTION_END_TRANSACTION'
      }
      this.dispatchDecision(endTransactionResult)
    }
    this._previousSession = null
  }

  private dispatchDecision(result: DecisionResult | null) {
    if (!result) {
      return
    }

    if (result.handler) {
      result.handler(result.payload, result.options)
    }
  }
}

export { InteractionCore }
export type { DecisionResult } from './registry'

const interactionCore = new InteractionCore()
export default interactionCore
