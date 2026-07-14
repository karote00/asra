/**
 * @asyra/feature-system
 * Feature System framework for design tools
 *
 * Provides a modular, composable way to define features with:
 * - Self-contained feature definitions
 * - Public API for feature composition
 * - Priority-based session coordination
 * - Auto-wiring of events and handlers
 */

// Main API
export {
  defineFeature,
  getFeature,
  unregisterFeature,
  getFeatureRegistry,
  getSessionManager,
  setCorePackages
} from './core/feature'

export { FeatureRegistry } from './core/feature-registry'
export {
  FeatureHandlerTimeoutError,
  SessionManager
} from './core/session-manager'
export { InteractionQueue, interactionQueue } from './core/interaction-queue'

export * from './types'

export * from './utils'

export type {
  FeatureDefinition,
  FeatureAPI,
  ActiveSession
} from './types/feature'
export type { CorePackages } from './types/core-packages'
