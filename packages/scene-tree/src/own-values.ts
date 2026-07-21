export const setOwnEnumerableValue = (
  target: object,
  key: PropertyKey,
  value: unknown
): void => {
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true
  })
}
