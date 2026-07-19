import type { CoreRawData } from '@asyra/utils'

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
   * @returns Raw saved data, or a nullish value if no saved data exists
   */
  load(): Promise<unknown | null>

  /**
   * Clear all persisted data
   */
  clear(): Promise<void>
}
