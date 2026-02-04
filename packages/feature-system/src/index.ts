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
  importFeature,
  registerFeature,
  unregisterFeature,
  getFeatureRegistry,
  getSessionManager,
  setCorePackagesAndProcessRegistrations
} from './core/feature'

export { FeatureRegistry } from './core/feature-registry'
export { SessionManager } from './core/session-manager'

export * from './types'
export type { FeatureKeyMap } from './types/feature'

export * from './utils'

export type {
  FeatureDefinition,
  FeatureAPI,
  FeatureBuilder,
  SessionConfig,
  ActiveSession
} from './types/feature'
