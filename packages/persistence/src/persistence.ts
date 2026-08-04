import type { CoreRawData } from '@asyra/utils'

/**
 * Read-only source used to hydrate one Core document.
 */
export interface DocumentLoadSource {
  /**
   * Source name for diagnostics.
   */
  readonly name: string

  /**
   * Load raw document data, or a nullish value when no document exists.
   */
  load(): Promise<unknown | null>
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
export interface IPersistenceProvider extends DocumentLoadSource {
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
   * Clear all persisted data
   */
  clear(): Promise<void>
}
