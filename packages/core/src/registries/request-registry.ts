/**
 * Request Registry for user-defined requests
 * Simple API: pass requestName and request implementation, register it
 *
 * Users define requests in app layer and register them for use by framework
 * Framework provides base requests (systemContext, props, etc.)
 * Users can compose custom requests using base requests
 *
 * Example:
 * ```typescript
 * // App layer:
 * const myRequest = {
 *   getData: () => { ... }
 * }
 * requestRegistry.register('MY_REQUEST', myRequest)
 *
 * // Access requests:
 * const registered = requestRegistry.getAll()
 * ```
 */

interface _RequestRegistration<T = unknown> {
  requestName: string
  request: T
}

export class RequestRegistry {
  private requests = new Map<string, unknown>()

  register<T = unknown>(requestName: string, request: T): void {
    this.requests.set(requestName, request)
  }

  get<T = unknown>(requestName: string): T | undefined {
    return this.requests.get(requestName) as T | undefined
  }

  has(requestName: string): boolean {
    return this.requests.has(requestName)
  }

  getAll(): Map<string, unknown> {
    return new Map(this.requests)
  }

  getNames(): string[] {
    return Array.from(this.requests.keys())
  }

  clear(): void {
    this.requests.clear()
  }
}

export const requestRegistry = new RequestRegistry()
