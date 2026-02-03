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
  getSessionManager
} from './core/feature'

// Core implementations
export { FeatureRegistry } from './core/feature-registry'
export { SessionManager } from './core/session-manager'

// Types
export * from './types'

// Utils and Templates
export * from './utils'

// Re-export for convenience
export type {
  FeatureDefinition,
  FeatureAPI,
  FeatureBuilder,
  SessionConfig,
  ActiveSession
} from './types/feature'
