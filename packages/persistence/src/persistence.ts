import type { CoreRawData } from '@asyra/utils'

// Re-export CoreRawData from utils
export type { CoreRawData }

// Type alias for backwards compatibility
export type CoreData = CoreRawData

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
  save(data: CoreRawData): Promise<void>

  /**
   * Load data from persistence layer
   * @returns Saved data or null if no saved data exists
   */
  load(): Promise<CoreRawData | null>

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
export type SaveHook = (data: CoreRawData) => CoreRawData

/**
 * Load hook for data transformations
 * Users can register hooks to process data after loading:
 * - Decompression
 * - Decryption
 * - Migration (version upgrades)
 * - Validation
 */
export type LoadHook = (data: CoreRawData) => CoreRawData
