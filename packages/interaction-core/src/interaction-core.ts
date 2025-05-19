import { SystemSnapshot } from '@asra/utils'
import { decideInteraction } from './decider'

class InteractionCore {
  decide(snapshot: SystemSnapshot) {
    decideInteraction(snapshot)
  }
}

export { InteractionCore }

const interactionCore = new InteractionCore()
export default interactionCore
