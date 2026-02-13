let hasWarned = false
function warnDeprecated() {
  if (hasWarned) {
    return
  }
  hasWarned = true
  console.warn(
    '[interaction-core] Deprecated: feature-system now manages input decisions and sessions.'
  )
}

import interactionCore, { InteractionCore } from './interaction-core'
import { initInteractionCoreSubscribes } from './subscribes'

initInteractionCoreSubscribes()
warnDeprecated()

export { InteractionCore }
export * from './registry'
export default interactionCore
