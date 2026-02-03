import type {
  FeatureDefinition,
  FeatureAPI,
  FeatureBuilder
} from '../types/feature'
import { FeatureRegistry } from './feature-registry'
import { SessionManager } from './session-manager'
import { createFeatureBuilder } from '../builders/feature-builder'

const featureRegistry = new FeatureRegistry()
const sessionManager = new SessionManager()

/**
 * Define a new feature
 * @param name - Unique feature name
 * @param definition - Feature definition with api and setup
 * @returns Feature with public API
 * @example
 * ```typescript
 * const transactionFeature = defineFeature('transaction', ({ packages }) => ({
 *   api: {
 *     start: () => packages.factory.startTransaction(),
 *     end: () => packages.factory.endTransaction()
 *   },
 *   define: ({ on }) => {
 *     on('execute', () => { ... })
 *   }
 * }))
 * ```
 */
export function defineFeature<API>(
  name: string,
  definition: FeatureDefinition<API>
): { api: FeatureAPI<API> } {
  const builder = createFeatureBuilder({
    name,
    packages: {}, // Will be properly injected via core integration
    sessionManager,
    featureRegistry
  })

  // Execute feature's define block
  definition.define(builder)

  // Register feature
  const api = featureRegistry.register(name, definition)

  // Return public API wrapper
  return {
    api: api as FeatureAPI<API>
  }
}

/**
 * Import a feature's API
 * @param featureName - Name of feature to import
 * @returns Feature's public API
 * @example
 * ```typescript
 * const transactionFeature = importFeature('transaction')
 * transactionFeature.start()
 * ```
 */
export function importFeature(featureName: string): FeatureAPI {
  const api = featureRegistry.getAPI(featureName)
  if (!api) {
    throw new Error(`Feature "${featureName}" not found`)
  }
  return api
}

/**
 * Register a feature (for initialization)
 * @param feature - Feature from defineFeature()
 * @deprecated Features are auto-registered by defineFeature()
 */
export function registerFeature(feature: { api: FeatureAPI }): void {
  // Feature already registered by defineFeature()
  // This is included for explicit initialization control if needed
}

/**
 * Unregister a feature
 * @param featureName - Name of feature to unregister
 * @returns True if feature was removed
 */
export function unregisterFeature(featureName: string): boolean {
  return featureRegistry.unregister(featureName)
}

/**
 * Get feature registry instance
 * @internal
 */
export function getFeatureRegistry(): FeatureRegistry {
  return featureRegistry
}

/**
 * Get session manager instance
 * @internal
 */
export function getSessionManager(): SessionManager {
  return sessionManager
}

// Export core components
export { FeatureRegistry } from './feature-registry'
export { SessionManager } from './session-manager'
