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
  disposeFeatureSystem,
  beginFeatureSystemRuntime,
  FeatureUnregisterError,
  getFeature,
  invokeFeatureTask,
  cancelFeatureTask,
  unregisterFeature,
  getFeatureRegistry,
  getSessionManager,
  setCorePackages
} from './core/feature.js'

export { FeatureRegistry } from './core/feature-registry.js'
export {
  FeatureHandlerTimeoutError,
  SessionManager
} from './core/session-manager.js'
export {
  FeatureRuntimeClosedError,
  InteractionQueue,
  interactionQueue
} from './core/interaction-queue.js'
export {
  FeatureTaskActiveError,
  FeatureTaskNotFoundError
} from './core/feature-task-registry.js'

export * from './types/index.js'

export * from './utils/index.js'

export type {
  FeatureDefinition,
  FeatureAPI,
  ActiveSession
} from './types/feature.js'
export type { CorePackages } from './types/core-packages.js'
