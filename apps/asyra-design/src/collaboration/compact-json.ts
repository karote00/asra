const COMPACT_JSON_MARKER = 'collaboration-compact-json-v1'
const COMPACT_JSON_MIN_LENGTH = 32 * 1024
const COMPACT_ARRAY_TAG = 0
const COMPACT_OBJECT_TAG = 1
const COMPACT_STRING_REFERENCE_TAG = 2
const COMPACT_STRING_MIN_LENGTH = 8

const collectValueStringCounts = (
  value: unknown,
  counts: Map<string, number>
): void => {
  if (typeof value === 'string') {
    counts.set(value, (counts.get(value) ?? 0) + 1)
    return
  }
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    value.forEach((child) => collectValueStringCounts(child, counts))
    return
  }
  Object.values(value).forEach((child) =>
    collectValueStringCounts(child, counts)
  )
}

const encodeCompactJsonValue = (value: unknown): string => {
  const valueStringCounts = new Map<string, number>()
  collectValueStringCounts(value, valueStringCounts)
  const dictionary: string[] = []
  const dictionaryIndices = new Map<string, number>()
  const intern = (text: string): number => {
    const existing = dictionaryIndices.get(text)
    if (existing !== undefined) return existing
    const index = dictionary.length
    dictionary.push(text)
    dictionaryIndices.set(text, index)
    return index
  }
  const encodeValue = (child: unknown): unknown => {
    if (typeof child === 'string') {
      if (
        child.length >= COMPACT_STRING_MIN_LENGTH &&
        (valueStringCounts.get(child) ?? 0) > 1
      ) {
        return [COMPACT_STRING_REFERENCE_TAG, intern(child)]
      }
      return child
    }
    if (!child || typeof child !== 'object') return child
    if (Array.isArray(child)) {
      return [COMPACT_ARRAY_TAG, ...child.map(encodeValue)]
    }
    const encoded: unknown[] = [COMPACT_OBJECT_TAG]
    Object.entries(child).forEach(([key, nestedValue]) => {
      encoded.push(intern(key), encodeValue(nestedValue))
    })
    return encoded
  }
  const encodedValue = encodeValue(value)
  return JSON.stringify([COMPACT_JSON_MARKER, dictionary, encodedValue])
}

const decodeCompactJsonValue = (
  value: unknown,
  dictionary: readonly string[]
): unknown => {
  if (!value || typeof value !== 'object') return value
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError('[collaboration] invalid compact JSON value')
  }
  const tag = value[0]
  if (tag === COMPACT_ARRAY_TAG) {
    return value
      .slice(1)
      .map((child) => decodeCompactJsonValue(child, dictionary))
  }
  if (tag === COMPACT_STRING_REFERENCE_TAG) {
    const index = value[1]
    if (
      value.length !== 2 ||
      !Number.isInteger(index) ||
      Number(index) < 0 ||
      Number(index) >= dictionary.length
    ) {
      throw new TypeError('[collaboration] invalid compact JSON string')
    }
    return dictionary[Number(index)]
  }
  if (tag !== COMPACT_OBJECT_TAG || (value.length - 1) % 2 !== 0) {
    throw new TypeError('[collaboration] invalid compact JSON object')
  }

  const decoded: Record<string, unknown> = {}
  const decodedKeys = new Set<string>()
  for (let index = 1; index < value.length; index += 2) {
    const keyIndex = value[index]
    if (
      !Number.isInteger(keyIndex) ||
      Number(keyIndex) < 0 ||
      Number(keyIndex) >= dictionary.length
    ) {
      throw new TypeError('[collaboration] invalid compact JSON key')
    }
    const key = dictionary[Number(keyIndex)]
    if (decodedKeys.has(key)) {
      throw new TypeError('[collaboration] duplicate compact JSON key')
    }
    decodedKeys.add(key)
    Object.defineProperty(decoded, key, {
      configurable: true,
      enumerable: true,
      value: decodeCompactJsonValue(value[index + 1], dictionary),
      writable: true
    })
  }
  return decoded
}

export const encodeCompactJsonIfSmaller = (
  value: unknown,
  plain: string
): string => {
  if (plain.length < COMPACT_JSON_MIN_LENGTH) return plain
  const compact = encodeCompactJsonValue(value)
  return compact.length < plain.length ? compact : plain
}

export const decodeCompactJson = (encoded: string): unknown => {
  const value: unknown = JSON.parse(encoded)
  if (
    !Array.isArray(value) ||
    value.length !== 3 ||
    value[0] !== COMPACT_JSON_MARKER
  ) {
    return value
  }
  const dictionary = value[1]
  if (
    !Array.isArray(dictionary) ||
    !dictionary.every((entry) => typeof entry === 'string') ||
    new Set(dictionary).size !== dictionary.length
  ) {
    throw new TypeError('[collaboration] invalid compact JSON dictionary')
  }
  return decodeCompactJsonValue(value[2], dictionary)
}
