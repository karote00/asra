import { subscribeToDecideAction } from '@asra/reactive-events'
import interactionCore from './interaction-core'

export const initInteractionCoreSubscribes = () => {
  subscribeToDecideAction(({ payload }) => {
    interactionCore.decide(payload.systemSnapshot)
  })
}
