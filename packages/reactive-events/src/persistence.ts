/**
 * Core data structure for framework save/load
 */
export interface CoreData {
  version: string
  sceneTree: unknown
  props: unknown
  [key: string]: unknown
}

/**
 * Persistence Provider Interface
 * Allows users to swap persistence strategies:
 * - LocalStorage (default for web apps)
 * - IndexedDB (offline-first, large data)
 * - File (downloads/uploads)
 * - Cloud sync (for SaaS apps)
 * - Custom backends (Firebase, Supabase, etc.)
 */
export interface IPersistenceProvider {
  /**
   * Provider name for identification
   */
  readonly name: string

  /**
   * Save data to persistence layer
   * @param data - Framework data to save
   */
  save(data: CoreData): Promise<void>

  /**
   * Load data from persistence layer
   * @returns Saved data or null if no saved data exists
   */
  load(): Promise<CoreData | null>

  /**
   * Clear all persisted data
   */
  clear(): Promise<void>
}

/**
 * Save hook for data transformations
 * Users can register hooks to process data before saving:
 * - Compression
 * - Encryption
 * - Metadata addition
 * - Validation
 */
export type SaveHook = (data: CoreData) => CoreData

/**
 * Load hook for data transformations
 * Users can register hooks to process data after loading:
 * - Decompression
 * - Decryption
 * - Migration (version upgrades)
 * - Validation
 */
export type LoadHook = (data: CoreData) => CoreData
