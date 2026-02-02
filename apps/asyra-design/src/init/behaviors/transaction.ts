/**
 * App-level transaction behaviors
 * Behaviors call framework APIs
 */

import core from '@asyra/core'

export const startTransactionBehavior = () => {
  core.deps.factory.startTransaction()
}

export const endTransactionBehavior = () => {
  core.deps.factory.endTransaction()
}
