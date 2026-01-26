import {
  subscribeToEndSession,
  subscribeToExecuteAction,
  subscribeToStartSession,
  subscribeToUpdateSession
} from '@asyra/reactive-events'
import interactionCore from './interaction-core'

export const initInteractionCoreSubscribes = () => {
  subscribeToExecuteAction(({ payload }) => {
    const { eventName, systemContextSnapshot, detail } = payload
    interactionCore.executeAction(eventName, systemContextSnapshot, detail)
  })

  subscribeToStartSession(({ payload }) => {
    const { eventName, systemContextSnapshot, detail } = payload
    interactionCore.startSession(eventName, systemContextSnapshot, detail)
  })

  subscribeToUpdateSession(({ payload }) => {
    const { eventName, systemContextSnapshot, detail } = payload
    interactionCore.updateSession(eventName, systemContextSnapshot, detail)
  })

  subscribeToEndSession(({ payload }) => {
    const { eventName, systemContextSnapshot, detail } = payload
    interactionCore.endSession(eventName, systemContextSnapshot, detail)
  })
}
