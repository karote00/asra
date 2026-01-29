import interactionCore, { InteractionCore } from './interaction-core'
import { initInteractionCoreSubscribes } from './subscribes'

initInteractionCoreSubscribes()

export { InteractionCore }
export * from './registry'
export * from './decider/behavior'
export default interactionCore
