/**
 * Feature APIs that can be reused across multiple features
 *
 * This folder contains common APIs extracted from features for reuse.
 * As the framework evolves, some of these may move to core packages if needed.
 *
 * Features should ONLY import from this folder, NOT directly from contexts
 * or external packages (except through these common APIs).
 */

export { transactionApis } from './transaction'
export { selectionApis } from './selection'
export { elementApis } from './element'
export { viewportApis } from './viewport'
export { systemContextApis } from './system-context'
export { historyApis } from './history'
