import {
  endSession,
  executeAction,
  startSession,
  updateSession
} from '@asyra/reactive-events'
import { DetailType } from '@asyra/utils'
import { InteractionCoreAPIs, SystemContextRequests } from '../types'

export const createInteractionCoreAPIs = (
  systemContextRequests: SystemContextRequests
): InteractionCoreAPIs => {
  return {
    executeAction(eventName: string, detail?: DetailType) {
      const systemContextSnapshot =
        systemContextRequests.getSystemContextSnapshot()
      executeAction(eventName, systemContextSnapshot, detail)
    },
    startSession(eventName: string, detail?: DetailType) {
      const systemContextSnapshot =
        systemContextRequests.getSystemContextSnapshot()
      startSession(eventName, systemContextSnapshot, detail)
    },
    updateSession(eventName: string, detail?: DetailType) {
      const systemContextSnapshot =
        systemContextRequests.getSystemContextSnapshot()
      updateSession(eventName, systemContextSnapshot, detail)
    },
    endSession(eventName: string, detail?: DetailType) {
      const systemContextSnapshot =
        systemContextRequests.getSystemContextSnapshot()
      endSession(eventName, systemContextSnapshot, detail)
    }
  }
}
