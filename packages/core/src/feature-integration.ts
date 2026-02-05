// @ts-ignore - feature-system will be available after build
import {
  getSessionManager,
  getFeatureRegistry,
  setCorePackages,
  setAppKeyCombinations
} from '@asyra/feature-system'

// Type imports - will be connected properly after core integration
type CoreDeps = any
type SystemContextSnapshot = any

/**
 * Integrate feature-system with core
 * Connects session manager to input-system events
 */
export function initFeatureSystem(coreDeps: {
  inputSystem: any
  systemContext: any
  interactionCore: any
  core?: any
}): void {
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

/**
 * Set app-level key combinations for feature system
 */
export { setAppKeyCombinations }
