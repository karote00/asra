export const deepFreeze = <T>(value: T, seen = new WeakSet<object>()): T => {
  if (value === null || typeof value !== 'object') return value

  const object = value as object
  if (seen.has(object)) return value

  seen.add(object)
  Reflect.ownKeys(object).forEach((key) =>
    deepFreeze(Reflect.get(object, key), seen)
  )
  return Object.freeze(value)
}
