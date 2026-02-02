/**
 * API Registry for user-defined APIs
 * Simple API: pass apiName and api implementation, register it
 *
 * Users define APIs in app layer and register them for use by framework
 * Framework provides base APIs (transaction, system, etc.)
 * Users can compose custom APIs using base APIs
 *
 * Example:
 * ```typescript
 * // App layer:
 * const myAPI = {
 *   doSomething: (data) => { ... }
 * }
 * apiRegistry.register('MY_API', myAPI)
 *
 * // Access APIs:
 * const registered = apiRegistry.getAll()
 * ```
 */

interface _APIRegistration<T = unknown> {
  apiName: string
  api: T
}

export class APIRegistry {
  private apis = new Map<string, unknown>()

  register<T = unknown>(apiName: string, api: T): void {
    this.apis.set(apiName, api)
  }

  get<T = unknown>(apiName: string): T | undefined {
    return this.apis.get(apiName) as T | undefined
  }

  has(apiName: string): boolean {
    return this.apis.has(apiName)
  }

  getAll(): Map<string, unknown> {
    return new Map(this.apis)
  }

  getNames(): string[] {
    return Array.from(this.apis.keys())
  }

  clear(): void {
    this.apis.clear()
  }
}

export const apiRegistry = new APIRegistry()
