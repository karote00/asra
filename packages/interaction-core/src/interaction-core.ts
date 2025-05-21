import { SystemSnapshot } from '@asra/utils'
import { decideInteraction } from './decider'

class InteractionCore {
  decide(systemSnapshot: SystemSnapshot) {
    decideInteraction(systemSnapshot)
  }
}

export { InteractionCore }

const interactionCore = new InteractionCore()
export default interactionCore
