export function isPlainRecord(
  input: unknown
): input is Readonly<Record<string, unknown>> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false
  const prototype = Object.getPrototypeOf(input)
  return prototype === Object.prototype || prototype === null
}

export function hasExactOwnKeys(
  input: unknown,
  expected: readonly string[]
): input is Readonly<Record<string, unknown>> {
  if (!isPlainRecord(input)) return false
  const keys = Object.keys(input)
  return (
    keys.length === expected.length &&
    expected.every((key) => Object.prototype.hasOwnProperty.call(input, key))
  )
}
