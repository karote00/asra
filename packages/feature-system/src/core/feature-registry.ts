import { MapRegistry } from '@asyra/utils'
import type { FeatureDefinition, FeatureAPI } from '../types/feature'
import type { FeatureEntry } from '../types/registry'

/**
 * Feature Registry
 * Manages feature registration and API lookup
 */
export class FeatureRegistry {
  private registry = new MapRegistry<string, FeatureEntry>()

  /**
   * Register a feature
   * @param name - Unique feature name
   * @param definition - Feature definition
   * @returns Feature public API
   */
  register(name: string, definition: FeatureDefinition): FeatureAPI {
    if (this.registry.has(name)) {
      throw new Error(`Feature "${name}" is already registered`)
    }

    const api = definition.api || {}
    const entry: FeatureEntry = {
      definition,
      api,
      registeredAt: Date.now()
    }

    this.registry.set(name, entry)

    return api
  }

  /**
   * Get feature's public API
   * @param name - Feature name
   * @returns Public API or undefined if not found
   */
  getAPI(name: string): FeatureAPI {
    const entry = this.registry.get(name)
    return entry?.api || ({} as FeatureAPI)
  }

  /**
   * Get feature definition
   * @param name - Feature name
   * @returns Feature definition or undefined if not found
   */
  getDefinition(name: string): FeatureDefinition | undefined {
    const entry = this.registry.get(name)
    return entry?.definition
  }

  /**
   * Check if feature is registered
   * @param name - Feature name
   * @returns True if registered
   */
  has(name: string): boolean {
    return this.registry.has(name)
  }

  /**
   * Unregister a feature
   * @param name - Feature name
   * @returns True if feature was removed
   */
  unregister(name: string): boolean {
    return this.registry.delete(name)
  }

  /**
   * Get all registered feature names
   * @returns Array of feature names
   */
  getFeatureNames(): string[] {
    return this.registry.keys()
  }

  /**
   * Get all features
   * @returns Map of feature name to feature entry
   */
  getAll(): Map<string, FeatureEntry> {
    return this.registry.cloneMap()
  }

  /**
   * Clear all registered features
   */
  clear(): void {
    this.registry.clear()
  }

  /**
   * Get count of registered features
   * @returns Number of features
   */
  size(): number {
    return this.registry.size()
  }
}
