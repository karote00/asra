import {
  endSession,
  executeAction,
  requestSystemContextSnapshot,
  startSession,
  updateSession
} from '@asra/reactive-events'
import { InputSystemEvents, DetailType } from '@asra/utils'
import { InteractionCoreAPIs } from '../types'

export const createInteractionCoreAPIs = (): InteractionCoreAPIs => {
  return {
    async executeAction(eventName: InputSystemEvents, detail?: DetailType) {
      const systemContextSnapshot = await requestSystemContextSnapshot()
      executeAction(eventName, systemContextSnapshot, detail)
    },
    async startSession(eventName: InputSystemEvents, detail?: DetailType) {
      const systemContextSnapshot = await requestSystemContextSnapshot()
      startSession(eventName, systemContextSnapshot, detail)
    },
    async updateSession(eventName: InputSystemEvents, detail?: DetailType) {
      const systemContextSnapshot = await requestSystemContextSnapshot()
      updateSession(eventName, systemContextSnapshot, detail)
    },
    async endSession(eventName: InputSystemEvents, detail?: DetailType) {
      const systemContextSnapshot = await requestSystemContextSnapshot()
      endSession(eventName, systemContextSnapshot, detail)
    }
  }
}
