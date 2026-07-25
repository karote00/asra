import type { AiJsonValue } from './types'

export const AI_REDACTED_VALUE = '[REDACTED]'

export interface AiRedactionOptions {
  readonly additionalSecretKeys?: readonly string[]
}

const normalizeKey = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '')

const DEFAULT_SECRET_KEY_PATTERN =
  /(?:authorization|apikey|accesstoken|refreshtoken|token|secret|password|cookie)/
const AUTHORIZATION_VALUE_PATTERN = /^(?:basic|bearer)\s+\S+$/i

const createSecretKeySet = (
  keys: readonly string[] | undefined
): ReadonlySet<string> =>
  new Set(
    (keys ?? []).map((key) => normalizeKey(key)).filter((key) => key.length > 0)
  )

const isSecretKey = (
  key: string,
  additionalSecretKeys: ReadonlySet<string>
): boolean => {
  const normalized = normalizeKey(key)
  return (
    additionalSecretKeys.has(normalized) ||
    DEFAULT_SECRET_KEY_PATTERN.test(normalized)
  )
}

const redactValue = (
  value: unknown,
  additionalSecretKeys: ReadonlySet<string>,
  ancestors: WeakSet<object>
): AiJsonValue => {
  if (value === null || typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'string') {
    return AUTHORIZATION_VALUE_PATTERN.test(value) ? AI_REDACTED_VALUE : value
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : AI_REDACTED_VALUE
  }

  if (typeof value !== 'object') {
    return AI_REDACTED_VALUE
  }

  if (ancestors.has(value)) {
    return AI_REDACTED_VALUE
  }

  ancestors.add(value)
  try {
    if (Array.isArray(value)) {
      const result: AiJsonValue[] = []
      for (let index = 0; index < value.length; index += 1) {
        result.push(
          index in value
            ? redactValue(value[index], additionalSecretKeys, ancestors)
            : AI_REDACTED_VALUE
        )
      }
      return Object.freeze(result)
    }

    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      return AI_REDACTED_VALUE
    }

    const result: Record<string, AiJsonValue> = {}
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string') {
        continue
      }

      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (!descriptor?.enumerable) {
        continue
      }

      const redacted =
        isSecretKey(key, additionalSecretKeys) || !('value' in descriptor)
          ? AI_REDACTED_VALUE
          : redactValue(descriptor.value, additionalSecretKeys, ancestors)
      Object.defineProperty(result, key, {
        configurable: true,
        enumerable: true,
        value: redacted,
        writable: true
      })
    }

    return Object.freeze(result)
  } finally {
    ancestors.delete(value)
  }
}

export const redactAiValue = (
  value: unknown,
  options: AiRedactionOptions = {}
): AiJsonValue =>
  redactValue(
    value,
    createSecretKeySet(options.additionalSecretKeys),
    new WeakSet<object>()
  )
