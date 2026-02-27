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
warnDeprecated()

/**
 * @deprecated Use `@asyra/feature-system` as runtime owner for execute/session/cancel.
 */
export { InteractionCore }
/**
 * @deprecated Use `@asyra/feature-system` registration/runtime APIs.
 */
export * from './registry'
/**
 * @deprecated Use `@asyra/feature-system` as runtime owner for execute/session/cancel.
 */
export default interactionCore
