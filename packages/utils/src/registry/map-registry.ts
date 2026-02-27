export interface RegistrySetOptions<K, V> {
  override?: boolean
  onDuplicate?: (key: K, current: V, next: V) => void
}

export interface RegistryRegisterOptions<K, V> {
  onDuplicate?: (key: K, current: V, next: V) => void
  duplicateErrorMessage?: string | ((key: K, current: V, next: V) => string)
}

export class MapRegistry<K, V> {
  private readonly map: Map<K, V>

  constructor(initial?: Iterable<readonly [K, V]>) {
    this.map = new Map(initial)
  }

  set(key: K, value: V, options: RegistrySetOptions<K, V> = {}): boolean {
    const exists = this.map.has(key)
    const shouldOverride = options.override ?? true

    if (exists && !shouldOverride) {
      return false
    }

    if (exists && options.onDuplicate) {
      const current = this.map.get(key) as V
      options.onDuplicate(key, current, value)
    }

    this.map.set(key, value)
    return true
  }

  register(key: K, value: V, options: RegistryRegisterOptions<K, V> = {}): V {
    const exists = this.map.has(key)

    if (!exists) {
      this.map.set(key, value)
      return value
    }

    const current = this.map.get(key) as V
    options.onDuplicate?.(key, current, value)
    const message = (() => {
      if (typeof options.duplicateErrorMessage === 'function') {
        return options.duplicateErrorMessage(key, current, value)
      }
      return (
        options.duplicateErrorMessage ??
        `Registry key "${String(key)}" is already registered`
      )
    })()
    throw new Error(message)
  }

  get(key: K): V | undefined {
    return this.map.get(key)
  }

  has(key: K): boolean {
    return this.map.has(key)
  }

  delete(key: K): boolean {
    return this.map.delete(key)
  }

  clear(): void {
    this.map.clear()
  }

  keys(): K[] {
    return Array.from(this.map.keys())
  }

  values(): V[] {
    return Array.from(this.map.values())
  }

  entries(): [K, V][] {
    return Array.from(this.map.entries())
  }

  cloneMap(): Map<K, V> {
    return new Map(this.map)
  }

  size(): number {
    return this.map.size
  }
}
