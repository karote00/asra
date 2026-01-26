import {
  endSession,
  executeAction,
  startSession,
  updateSession
} from '@asyra/reactive-events'
import { InputSystemEvents, DetailType } from '@asyra/utils'
import { InteractionCoreAPIs, SystemContextRequests } from '../types'

export const createInteractionCoreAPIs = (
  systemContextRequests: SystemContextRequests
): InteractionCoreAPIs => {
  return {
    executeAction(eventName: InputSystemEvents, detail?: DetailType) {
      const systemContextSnapshot =
        systemContextRequests.getSystemContextSnapshot()
      executeAction(eventName, systemContextSnapshot, detail)
    },
    startSession(eventName: InputSystemEvents, detail?: DetailType) {
      const systemContextSnapshot =
        systemContextRequests.getSystemContextSnapshot()
      startSession(eventName, systemContextSnapshot, detail)
    },
    updateSession(eventName: InputSystemEvents, detail?: DetailType) {
      const systemContextSnapshot =
        systemContextRequests.getSystemContextSnapshot()
      updateSession(eventName, systemContextSnapshot, detail)
    },
    endSession(eventName: InputSystemEvents, detail?: DetailType) {
      const systemContextSnapshot =
        systemContextRequests.getSystemContextSnapshot()
      endSession(eventName, systemContextSnapshot, detail)
    }
  }
}
