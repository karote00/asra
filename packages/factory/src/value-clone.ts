import { isDetachedTransactionValue } from '@asyra/reactive-events'

export const cloneValue = <T>(
  value: T,
  seen = new WeakMap<object, unknown>()
): T => {
  if (value === null || typeof value !== 'object') {
    return value
  }

  const source = value as object
  const existing = seen.get(source)
  if (existing) {
    return existing as T
  }

  const clone: object = Array.isArray(value)
    ? []
    : Object.create(Object.getPrototypeOf(value))
  seen.set(source, clone)
  Reflect.ownKeys(source).forEach((key) => {
    if (Array.isArray(source) && key === 'length') {
      return
    }
    const descriptor = Object.getOwnPropertyDescriptor(source, key)
    if (!descriptor) {
      return
    }
    const snapshot =
      'value' in descriptor ? descriptor.value : Reflect.get(source, key)
    Object.defineProperty(clone, key, {
      value: cloneValue(snapshot, seen),
      enumerable: descriptor.enumerable,
      configurable: true,
      writable: true
    })
  })
  if (Array.isArray(source) && Array.isArray(clone)) {
    clone.length = source.length
  }

  return clone as T
}

const deeplyFrozenValues = new WeakSet<object>()

export const adoptDeeplyFrozenValue = <T>(value: T): T => {
  if (value === null || typeof value !== 'object') {
    return value
  }
  if (!Object.isFrozen(value)) {
    throw new Error('Factory can only adopt an already-frozen owner value')
  }
  deeplyFrozenValues.add(value as object)
  return value
}

export const freezeTrustedValue = <T>(value: T): T => {
  if (value === null || typeof value !== 'object') {
    return value
  }
  Object.freeze(value)
  deeplyFrozenValues.add(value as object)
  return value
}

export const isDeeplyFrozenValue = (value: unknown): boolean =>
  value === null ||
  typeof value !== 'object' ||
  deeplyFrozenValues.has(value) ||
  isDetachedTransactionValue(value)

export const deepFreezeValue = <T>(
  value: T,
  seen = new WeakSet<object>()
): T => {
  if (value === null || typeof value !== 'object') {
    return value
  }

  const object = value as object
  if (deeplyFrozenValues.has(object) || seen.has(object)) {
    return value
  }
  seen.add(object)
  Reflect.ownKeys(object).forEach((key) => {
    deepFreezeValue(Reflect.get(object, key), seen)
  })
  Object.freeze(value)
  deeplyFrozenValues.add(object)
  return value
}

export const cloneAndDeepFreezeValue = <T>(value: T): T =>
  deepFreezeValue(cloneValue(value))
