let hasWarned = false
function warnDeprecated() {
  if (hasWarned) {
    return
  }
  hasWarned = true
  console.warn(
    '[interaction-core] Deprecated (compatibility-only). Use @asyra/feature-system for execute/session/cancel runtime flow.'
  )
}

import interactionCore, { InteractionCore } from './interaction-core'
import { initInteractionCoreSubscribes } from './subscribes'

initInteractionCoreSubscribes()
warnDeprecated()

export { InteractionCore }
export * from './registry'
export default interactionCore
