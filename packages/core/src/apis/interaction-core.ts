import {
  endSession,
  executeAction,
  startSession,
  updateSession
} from '@asra/reactive-events'
import { InputSystemEvents, DetailType } from '@asra/utils'
import { InteractionCoreAPIs, SystemContextRequestAPIs } from '../types'

export const createInteractionCoreAPIs = (
  systemContextRequests: SystemContextRequestAPIs
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
