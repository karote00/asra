/**
 * Feature Registry types
 * Defines how features are registered and queried
 */

import type { FeatureDefinition, FeatureAPI } from './feature'

/**
 * Feature entry stored in registry
 */
export interface FeatureEntry {
  definition: FeatureDefinition
  api: FeatureAPI
  registeredAt: number
}

/**
 * Feature registry map
 */
export type FeatureRegistryMap = Map<string, FeatureEntry>
