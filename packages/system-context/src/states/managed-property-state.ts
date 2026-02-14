import { BehaviorSubject } from 'rxjs'

export interface ManagedProperty<T> {
  key: string
  state: BehaviorSubject<T>
}

export class ManagedPropertyState {
  private properties = new Map<string, ManagedProperty<unknown>>()

  register<T>(
    key: string,
    defaultValue: T,
    options?: { silent?: boolean }
  ): BehaviorSubject<T> {
    if (this.properties.has(key)) {
      if (!options?.silent) {
        console.warn(
          `[ManagedPropertyState] Property "${key}" already registered, returning existing`
        )
      }
      return this.getProperty<T>(key)!.state
    }

    const state = new BehaviorSubject<T>(defaultValue)
    this.properties.set(key, { key, state } as ManagedProperty<unknown>)

    return state
  }

  get<T>(key: string): T | undefined {
    const prop = this.properties.get(key)
    return prop?.state.getValue() as T | undefined
  }

  set<T>(key: string, value: T): void {
    const prop = this.properties.get(key)
    if (prop) {
      prop.state.next(value)
    } else {
      console.warn(`[ManagedPropertyState] Property "${key}" not found`)
    }
  }

  setIfRegistered<T>(key: string, value: T): void {
    const prop = this.properties.get(key)
    if (prop) {
      prop.state.next(value)
    }
  }

  getProperty<T>(key: string): ManagedProperty<T> | undefined {
    return this.properties.get(key) as ManagedProperty<T> | undefined
  }

  getObservable<T>(key: string): BehaviorSubject<T> | undefined {
    const prop = this.properties.get(key)
    return prop?.state as BehaviorSubject<T> | undefined
  }

  has(key: string): boolean {
    return this.properties.has(key)
  }

  getAllKeys(): string[] {
    return Array.from(this.properties.keys())
  }
}

export default new ManagedPropertyState()
