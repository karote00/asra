import { SystemContextSnapshot, DetailType } from '@asyra/utils'
import { InteractionRegistry, type DecisionResult } from './registry'
import { startTransaction, endTransaction } from '@asyra/reactive-events'

/**
 * @deprecated Use `@asyra/feature-system` as the active runtime owner for execute/session/cancel.
 * This package is kept for compatibility only.
 */
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

    startTransaction()

    const result = this.registry.decide(
      eventName,
      systemContextSnapshot,
      detail
    )

    this.dispatchDecision(result)

    endTransaction()
  }

  startSession(
    eventName: string,
    systemContextSnapshot: SystemContextSnapshot,
    detail?: DetailType
  ) {
    if (this._previousSession) {
      this.cancelPreviousSession()
    }

    startTransaction()

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
    this.dispatchDecision(result)

    endTransaction()

    this._previousSession = null
  }

  private cancelPreviousSession() {
    if (this._previousSession) {
      endTransaction()
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

  dispose() {
    this._previousSession = null
  }

  reset() {
    this.dispose()
  }
}

export { InteractionCore }
export type { DecisionResult } from './registry'

/**
 * @deprecated Use `@asyra/feature-system` runtime APIs instead.
 */
const interactionCore = new InteractionCore()
export default interactionCore
