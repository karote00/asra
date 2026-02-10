import { IPersistenceProvider, CoreData } from './persistence'

/**
 * LocalStorage Persistence Provider
 * Simple key-value storage using browser's localStorage
 * Best for: Small to medium-sized apps, quick prototyping
 */
export class LocalStoragePersistence implements IPersistenceProvider {
  readonly name = 'LocalStorage'
  private readonly storageKey = 'FILE'

  async save(data: CoreData): Promise<void> {
    try {
      const serialized = JSON.stringify(data)
      localStorage.setItem(this.storageKey, serialized)
    } catch (error) {
      console.error('[LocalStoragePersistence] Save failed:', error)
      throw error
    }
  }

  async load(): Promise<CoreData | null> {
    try {
      const serialized = localStorage.getItem(this.storageKey)
      if (!serialized) {
        return null
      }
      return JSON.parse(serialized)
    } catch (error) {
      console.error('[LocalStoragePersistence] Load failed:', error)
      return null
    }
  }

  async clear(): Promise<void> {
    try {
      localStorage.removeItem(this.storageKey)
    } catch (error) {
      console.error('[LocalStoragePersistence] Clear failed:', error)
      throw error
    }
  }
}

/**
 * Memory Persistence Provider
 * In-memory storage (doesn't persist across page reloads)
 * Best for: Testing, demo apps, ephemeral canvases
 */
export class MemoryPersistence implements IPersistenceProvider {
  readonly name = 'Memory'
  private data: CoreData | null = null

  async save(data: CoreData): Promise<void> {
    this.data = data
  }

  async load(): Promise<CoreData | null> {
    return this.data
  }

  async clear(): Promise<void> {
    this.data = null
  }
}

/**
 * Provider collection for easy access
 */
export const providers = {
  localStorage: new LocalStoragePersistence(),
  memory: new MemoryPersistence()
}
