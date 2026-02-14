import {
  getSessionManager,
  getFeatureRegistry,
  setCorePackages
} from '@asyra/feature-system'
import type { CorePackages } from '@asyra/feature-system'

/**
 * Integrate feature-system with core
 * Connects session manager to input-system events
 */
export function initFeatureSystem(coreDeps: CorePackages): void {
  // Set core packages for feature system to use
  // This will trigger registration of all pending features
  setCorePackages(coreDeps)
}

/**
 * Get feature registry instance
 */
export { getFeatureRegistry }

/**
 * Get session manager instance
 */
export { getSessionManager }
