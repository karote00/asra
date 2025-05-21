import { SystemSnapshot } from '@asra/utils'
import { APIDeps, InteractionCoreAPIs } from '../types'

export const createInteractionCoreAPIs = (
  interactionCore: APIDeps['interactionCore']
): InteractionCoreAPIs => {
  return {
    decideAction(systemSnapshot: SystemSnapshot) {
      interactionCore.decide(systemSnapshot)
    }
  }
}
