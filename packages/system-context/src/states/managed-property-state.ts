import { BehaviorSubject } from 'rxjs'
import { isRecord } from '@asyra/utils'

export type ManagedPropertyValidator<T> = (value: unknown) => value is T

export interface ManagedPropertyRegistrationOptions<T> {
  silent?: boolean
  validate?: ManagedPropertyValidator<T>
  /**
   * Runtime-only property flag.
   * - true: property is not persisted by save()/load()
   * - false: property is included in save()/load()
   */
  runtime?: boolean
}

export interface ManagedProperty<T> {
  key: string
  state: BehaviorSubject<T>
  validate: (value: unknown) => boolean
  runtime: boolean
}

export interface ManagedPropertyLoadDiagnostic {
  key: string
  path: string
  message: string
}

const createValidatorFromDefault = <T>(
  defaultValue: T
): ManagedPropertyValidator<T> => {
  if (Array.isArray(defaultValue)) {
    return ((value: unknown): value is T => Array.isArray(value)) as
      | ManagedPropertyValidator<T>
      | never
  }

  if (defaultValue === null) {
    // Null defaults cannot infer a stable runtime type. Keep permissive behavior
    // unless a custom validator is explicitly provided by registration options.
    return ((_: unknown): _ is T => true) as ManagedPropertyValidator<T>
  }

  if (defaultValue === undefined) {
    return ((_: unknown): _ is T => true) as ManagedPropertyValidator<T>
  }

  if (typeof defaultValue === 'number') {
    return ((value: unknown): value is T =>
      typeof value === 'number' && Number.isFinite(value)) as
      | ManagedPropertyValidator<T>
      | never
  }

  if (typeof defaultValue === 'object') {
    return ((value: unknown): value is T => isRecord(value)) as
      | ManagedPropertyValidator<T>
      | never
  }

  const expectedType = typeof defaultValue
  return ((value: unknown): value is T => typeof value === expectedType) as
    | ManagedPropertyValidator<T>
    | never
}

export class ManagedPropertyState {
  private properties = new Map<string, ManagedProperty<unknown>>()

  register<T>(
    key: string,
    defaultValue: T,
    options?: ManagedPropertyRegistrationOptions<T>
  ): BehaviorSubject<T> {
    const silent = options?.silent ?? true

    if (this.properties.has(key)) {
      if (!silent) {
        console.warn(
          `[ManagedPropertyState] Property "${key}" already registered, returning existing`
        )
      }
      const existing = this.getProperty<T>(key)
      if (existing) {
        return existing.state
      }
    }

    const state = new BehaviorSubject<T>(defaultValue)
    const validate =
      options?.validate ?? createValidatorFromDefault(defaultValue)
    const runtime = options?.runtime ?? true
    this.properties.set(key, {
      key,
      state,
      validate: (value: unknown) => validate(value),
      runtime
    } as ManagedProperty<unknown>)

    return state
  }

  get<T>(key: string): T | undefined {
    const prop = this.properties.get(key)
    return prop?.state.getValue() as T | undefined
  }

  set<T>(key: string, value: T): void {
    const prop = this.properties.get(key)
    if (prop) {
      if (!prop.validate(value)) {
        console.warn(
          `[ManagedPropertyState] Rejected invalid value for "${key}" during runtime set`
        )
        return
      }
      prop.state.next(value)
    } else {
      console.warn(`[ManagedPropertyState] Property "${key}" not found`)
    }
  }

  setIfRegistered<T>(key: string, value: T): void {
    const prop = this.properties.get(key)
    if (prop) {
      if (!prop.validate(value)) {
        return
      }
      prop.state.next(value)
    }
  }

  validateLoadData(data: unknown): {
    data: Record<string, unknown>
    diagnostics: ManagedPropertyLoadDiagnostic[]
  } {
    const diagnostics: ManagedPropertyLoadDiagnostic[] = []
    const sanitized: Record<string, unknown> = {}

    if (data === undefined) {
      return { data: sanitized, diagnostics }
    }

    if (!isRecord(data)) {
      diagnostics.push({
        key: '__root__',
        path: 'systemContext',
        message: 'Expected object map for managed properties'
      })
      return { data: sanitized, diagnostics }
    }

    Object.entries(data).forEach(([key, value]) => {
      const prop = this.properties.get(key)
      if (!prop) {
        diagnostics.push({
          key,
          path: `systemContext.${key}`,
          message: 'Ignored unregistered managed property during load'
        })
        return
      }

      if (prop.runtime) {
        diagnostics.push({
          key,
          path: `systemContext.${key}`,
          message: 'Ignored runtime-only managed property during load'
        })
        return
      }

      if (!prop.validate(value)) {
        diagnostics.push({
          key,
          path: `systemContext.${key}`,
          message: 'Ignored invalid managed property value during load'
        })
        return
      }

      sanitized[key] = value
    })

    return { data: sanitized, diagnostics }
  }

  load(data: unknown): ManagedPropertyLoadDiagnostic[] {
    const { data: sanitized, diagnostics } = this.validateLoadData(data)
    Object.entries(sanitized).forEach(([key, value]) => {
      this.setIfRegistered(key, value)
    })
    return diagnostics
  }

  save(): Record<string, unknown> {
    const result: Record<string, unknown> = {}
    this.properties.forEach((property, key) => {
      if (property.runtime) {
        return
      }
      result[key] = property.state.getValue()
    })
    return result
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
