const COMPACT_BINARY_MAGIC = new Uint8Array([
  0x41, 0x53, 0x59, 0x52, 0x41, 0x01
])
const COMPACT_BINARY_MIN_TEXT_BYTES = 32 * 1024
const REPEATED_STRING_MIN_LENGTH = 4
const DICTIONARY_PREFIX_CHECKPOINT_INTERVAL = 64

const enum ValueTag {
  NULL = 0,
  FALSE = 1,
  TRUE = 2,
  FLOAT64 = 3,
  INTEGER = 4,
  STRING = 5,
  STRING_REFERENCE = 6,
  ARRAY = 7,
  OBJECT = 8
}

const enum StringEncoding {
  UTF8 = 0,
  UTF16 = 1
}

interface BinaryDictionary {
  readonly entries: readonly string[]
  readonly indices: ReadonlyMap<string, number>
}

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder('utf-8', {
  fatal: true,
  ignoreBOM: true
})

const varUintByteLength = (value: number): number => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError('[collaboration] invalid binary transport integer')
  }
  let remaining = value
  let length = 1
  while (remaining >= 0x80) {
    remaining = Math.floor(remaining / 0x80)
    length += 1
  }
  return length
}

const utf8ByteLength = (value: string): number => {
  let length = 0
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code <= 0x7f) {
      length += 1
      continue
    }
    if (code <= 0x7ff) {
      length += 2
      continue
    }
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1)
      if (next >= 0xdc00 && next <= 0xdfff) {
        length += 4
        index += 1
        continue
      }
      length += 3
      continue
    }
    length += 3
  }
  return length
}

const isWellFormedUtf16 = (value: string): boolean => {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1)
      if (next < 0xdc00 || next > 0xdfff) return false
      index += 1
      continue
    }
    if (code >= 0xdc00 && code <= 0xdfff) return false
  }
  return true
}

const encodedStringByteLength = (value: string): number => {
  const valueByteLength = isWellFormedUtf16(value)
    ? utf8ByteLength(value)
    : value.length * 2
  return 1 + varUintByteLength(valueByteLength) + valueByteLength
}

const commonPrefixLength = (left: string, right: string): number => {
  const maximum = Math.min(left.length, right.length)
  let length = 0
  while (
    length < maximum &&
    left.charCodeAt(length) === right.charCodeAt(length)
  ) {
    length += 1
  }
  return length
}

const dictionaryPrefixBase = (index: number, previous: string): string =>
  index % DICTIONARY_PREFIX_CHECKPOINT_INTERVAL === 0 ? '' : previous

const dictionaryEntryByteLength = (
  entry: string,
  previous: string,
  index: number
): number => {
  const prefixLength = commonPrefixLength(
    dictionaryPrefixBase(index, previous),
    entry
  )
  return (
    varUintByteLength(prefixLength) +
    encodedStringByteLength(entry.slice(prefixLength))
  )
}

interface BinaryObjectEntry {
  readonly key: string
  readonly value: unknown
}

const readArrayValues = (value: unknown[]): unknown[] => {
  const keys = Reflect.ownKeys(value)
  if (keys.length !== value.length + 1) {
    throw new TypeError('[collaboration] invalid binary transport array')
  }
  const values = new Array<unknown>(value.length)
  for (const key of keys) {
    if (key === 'length') continue
    if (typeof key !== 'string') {
      throw new TypeError('[collaboration] invalid binary transport key')
    }
    const index = Number(key)
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= value.length ||
      String(index) !== key
    ) {
      throw new TypeError('[collaboration] invalid binary transport array')
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor?.enumerable || !('value' in descriptor)) {
      throw new TypeError('[collaboration] invalid binary transport property')
    }
    values[index] = descriptor.value
  }
  return values
}

const readObjectEntries = (value: object): BinaryObjectEntry[] => {
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError('[collaboration] invalid binary transport object')
  }
  return Reflect.ownKeys(value).map((key) => {
    if (typeof key !== 'string') {
      throw new TypeError('[collaboration] invalid binary transport key')
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor?.enumerable || !('value' in descriptor)) {
      throw new TypeError('[collaboration] invalid binary transport property')
    }
    return { key, value: descriptor.value }
  })
}

type DictionaryCollectFrame =
  | {
      readonly kind: 'value'
      readonly value: unknown
    }
  | {
      readonly kind: 'property'
      readonly entry: BinaryObjectEntry
    }
  | {
      readonly kind: 'leave'
      readonly value: object
    }

const collectDictionary = (value: unknown): BinaryDictionary => {
  const keys: string[] = []
  const keySet = new Set<string>()
  const valueStringCounts = new Map<string, number>()
  const ancestors = new Set<object>()
  const frames: DictionaryCollectFrame[] = [{ kind: 'value', value }]
  while (frames.length > 0) {
    const frame = frames.pop()
    if (!frame) {
      throw new TypeError('[collaboration] invalid binary traversal state')
    }
    if (frame.kind === 'leave') {
      ancestors.delete(frame.value)
      continue
    }
    if (frame.kind === 'property') {
      if (!keySet.has(frame.entry.key)) {
        keySet.add(frame.entry.key)
        keys.push(frame.entry.key)
      }
      frames.push({ kind: 'value', value: frame.entry.value })
      continue
    }
    const child = frame.value
    if (typeof child === 'string') {
      valueStringCounts.set(child, (valueStringCounts.get(child) ?? 0) + 1)
      continue
    }
    if (
      child === null ||
      typeof child === 'boolean' ||
      typeof child === 'number'
    ) {
      continue
    }
    if (typeof child !== 'object') {
      throw new TypeError('[collaboration] invalid binary transport value')
    }
    if (ancestors.has(child)) {
      throw new TypeError('[collaboration] cyclic binary transport value')
    }
    ancestors.add(child)
    frames.push({ kind: 'leave', value: child })
    if (Array.isArray(child)) {
      const values = readArrayValues(child)
      for (let index = values.length - 1; index >= 0; index -= 1) {
        frames.push({ kind: 'value', value: values[index] })
      }
      continue
    }
    const entries = readObjectEntries(child)
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index]
      if (!entry) {
        throw new TypeError('[collaboration] invalid binary traversal state')
      }
      frames.push({ kind: 'property', entry })
    }
  }

  const entries = [...keys]
  valueStringCounts.forEach((count, text) => {
    if (
      count > 1 &&
      text.length >= REPEATED_STRING_MIN_LENGTH &&
      !keySet.has(text)
    ) {
      entries.push(text)
    }
  })
  return {
    entries,
    indices: new Map(entries.map((entry, index) => [entry, index]))
  }
}

const encodeInteger = (value: number): number =>
  value >= 0 ? value * 2 : -value * 2 - 1

const canEncodeInteger = (value: number): boolean =>
  Number.isSafeInteger(value) &&
  !Object.is(value, -0) &&
  Math.abs(value) <= Number.MAX_SAFE_INTEGER / 2

const valueByteLength = (
  value: unknown,
  dictionary: BinaryDictionary
): number => {
  let byteLength = 0
  const values: unknown[] = [value]
  while (values.length > 0) {
    const child = values.pop()
    if (child === null || typeof child === 'boolean') {
      byteLength += 1
      continue
    }
    if (typeof child === 'number') {
      if (!Number.isFinite(child)) {
        throw new TypeError(
          '[collaboration] non-finite binary transport number'
        )
      }
      byteLength += canEncodeInteger(child)
        ? 1 + varUintByteLength(encodeInteger(child))
        : 9
      continue
    }
    if (typeof child === 'string') {
      const reference = dictionary.indices.get(child)
      byteLength +=
        reference === undefined
          ? 1 + encodedStringByteLength(child)
          : 1 + varUintByteLength(reference)
      continue
    }
    if (!child || typeof child !== 'object') {
      throw new TypeError('[collaboration] invalid binary transport value')
    }
    if (Array.isArray(child)) {
      const children = readArrayValues(child)
      byteLength += 1 + varUintByteLength(children.length)
      for (let index = children.length - 1; index >= 0; index -= 1) {
        values.push(children[index])
      }
      continue
    }
    const entries = readObjectEntries(child)
    byteLength += 1 + varUintByteLength(entries.length)
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index]
      if (!entry) {
        throw new TypeError('[collaboration] invalid binary traversal state')
      }
      const keyIndex = dictionary.indices.get(entry.key)
      if (keyIndex === undefined) {
        throw new TypeError('[collaboration] missing binary transport key')
      }
      byteLength += varUintByteLength(keyIndex)
      values.push(entry.value)
    }
    if (!Number.isSafeInteger(byteLength)) {
      throw new TypeError(
        '[collaboration] binary transport byte length exceeds safe range'
      )
    }
  }
  return byteLength
}

class BinaryWriter {
  private offset = 0

  constructor(private readonly output: Uint8Array) {}

  get written(): number {
    return this.offset
  }

  writeByte(value: number): void {
    this.output[this.offset] = value
    this.offset += 1
  }

  writeBytes(value: Uint8Array): void {
    this.output.set(value, this.offset)
    this.offset += value.byteLength
  }

  writeFloat64(value: number): void {
    new DataView(
      this.output.buffer,
      this.output.byteOffset + this.offset,
      8
    ).setFloat64(0, value, true)
    this.offset += 8
  }

  writeString(value: string): void {
    if (isWellFormedUtf16(value)) {
      const byteLength = utf8ByteLength(value)
      this.writeByte(StringEncoding.UTF8)
      this.writeVarUint(byteLength)
      const target = this.output.subarray(this.offset, this.offset + byteLength)
      const result = textEncoder.encodeInto(value, target)
      if (result.read !== value.length || result.written !== byteLength) {
        throw new TypeError('[collaboration] binary string encoding failed')
      }
      this.offset += byteLength
      return
    }
    const byteLength = value.length * 2
    this.writeByte(StringEncoding.UTF16)
    this.writeVarUint(byteLength)
    for (let index = 0; index < value.length; index += 1) {
      const code = value.charCodeAt(index)
      this.writeByte(code & 0xff)
      this.writeByte(code >>> 8)
    }
  }

  writeVarUint(value: number): void {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new TypeError('[collaboration] invalid binary transport integer')
    }
    let remaining = value
    while (remaining >= 0x80) {
      this.writeByte((remaining % 0x80) | 0x80)
      remaining = Math.floor(remaining / 0x80)
    }
    this.writeByte(remaining)
  }
}

type BinaryWriteFrame =
  | {
      readonly kind: 'value'
      readonly value: unknown
    }
  | {
      readonly kind: 'property'
      readonly entry: BinaryObjectEntry
    }

const writeValue = (
  writer: BinaryWriter,
  value: unknown,
  dictionary: BinaryDictionary
): void => {
  const frames: BinaryWriteFrame[] = [{ kind: 'value', value }]
  while (frames.length > 0) {
    const frame = frames.pop()
    if (!frame) {
      throw new TypeError('[collaboration] invalid binary traversal state')
    }
    if (frame.kind === 'property') {
      const keyIndex = dictionary.indices.get(frame.entry.key)
      if (keyIndex === undefined) {
        throw new TypeError('[collaboration] missing binary transport key')
      }
      writer.writeVarUint(keyIndex)
      frames.push({ kind: 'value', value: frame.entry.value })
      continue
    }
    const child = frame.value
    if (child === null) {
      writer.writeByte(ValueTag.NULL)
      continue
    }
    if (child === false) {
      writer.writeByte(ValueTag.FALSE)
      continue
    }
    if (child === true) {
      writer.writeByte(ValueTag.TRUE)
      continue
    }
    if (typeof child === 'number') {
      if (!Number.isFinite(child)) {
        throw new TypeError(
          '[collaboration] non-finite binary transport number'
        )
      }
      if (canEncodeInteger(child)) {
        writer.writeByte(ValueTag.INTEGER)
        writer.writeVarUint(encodeInteger(child))
      } else {
        writer.writeByte(ValueTag.FLOAT64)
        writer.writeFloat64(child)
      }
      continue
    }
    if (typeof child === 'string') {
      const reference = dictionary.indices.get(child)
      if (reference === undefined) {
        writer.writeByte(ValueTag.STRING)
        writer.writeString(child)
      } else {
        writer.writeByte(ValueTag.STRING_REFERENCE)
        writer.writeVarUint(reference)
      }
      continue
    }
    if (!child || typeof child !== 'object') {
      throw new TypeError('[collaboration] invalid binary transport value')
    }
    if (Array.isArray(child)) {
      const values = readArrayValues(child)
      writer.writeByte(ValueTag.ARRAY)
      writer.writeVarUint(values.length)
      for (let index = values.length - 1; index >= 0; index -= 1) {
        frames.push({ kind: 'value', value: values[index] })
      }
      continue
    }
    const entries = readObjectEntries(child)
    writer.writeByte(ValueTag.OBJECT)
    writer.writeVarUint(entries.length)
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index]
      if (!entry) {
        throw new TypeError('[collaboration] invalid binary traversal state')
      }
      frames.push({ kind: 'property', entry })
    }
  }
}

export interface PreparedCompactBinaryEncoding {
  readonly byteLength: number
}

class PreparedCompactBinaryEncodingImplementation implements PreparedCompactBinaryEncoding {
  constructor(
    readonly value: unknown,
    readonly dictionary: BinaryDictionary,
    readonly byteLength: number
  ) {}
}

const compactBinaryDictionaryByteLength = (
  dictionary: BinaryDictionary
): number => {
  let previousDictionaryEntry = ''
  return dictionary.entries.reduce((total, entry, index) => {
    const entryByteLength = dictionaryEntryByteLength(
      entry,
      previousDictionaryEntry,
      index
    )
    previousDictionaryEntry = entry
    return total + entryByteLength
  }, 0)
}

const compactBinaryHeaderByteLength = (
  dictionary: BinaryDictionary,
  dictionaryByteLength: number
): number =>
  COMPACT_BINARY_MAGIC.byteLength +
  varUintByteLength(dictionary.entries.length) +
  dictionaryByteLength

export const prepareCompactBinaryEncoding = (
  value: unknown
): PreparedCompactBinaryEncoding => {
  const dictionary = collectDictionary(value)
  const dictionaryByteLength = compactBinaryDictionaryByteLength(dictionary)
  const byteLength =
    compactBinaryHeaderByteLength(dictionary, dictionaryByteLength) +
    valueByteLength(value, dictionary)
  return new PreparedCompactBinaryEncodingImplementation(
    value,
    dictionary,
    byteLength
  )
}

export const encodePreparedCompactBinary = (
  preparedEncoding: PreparedCompactBinaryEncoding
): Uint8Array => {
  if (
    !(preparedEncoding instanceof PreparedCompactBinaryEncodingImplementation)
  ) {
    throw new TypeError('[collaboration] invalid prepared binary encoding')
  }
  const output = new Uint8Array(preparedEncoding.byteLength)
  const writer = new BinaryWriter(output)
  writer.writeBytes(COMPACT_BINARY_MAGIC)
  writer.writeVarUint(preparedEncoding.dictionary.entries.length)
  let previousDictionaryEntry = ''
  preparedEncoding.dictionary.entries.forEach((entry, index) => {
    const prefixLength = commonPrefixLength(
      dictionaryPrefixBase(index, previousDictionaryEntry),
      entry
    )
    writer.writeVarUint(prefixLength)
    writer.writeString(entry.slice(prefixLength))
    previousDictionaryEntry = entry
  })
  writeValue(writer, preparedEncoding.value, preparedEncoding.dictionary)
  if (writer.written !== output.byteLength) {
    throw new TypeError('[collaboration] binary transport length mismatch')
  }
  return output
}

export const encodeCompactBinary = (value: unknown): Uint8Array =>
  encodePreparedCompactBinary(prepareCompactBinaryEncoding(value))

class BinaryReader {
  private offset = 0

  constructor(private readonly input: Uint8Array) {}

  get remaining(): number {
    return this.input.byteLength - this.offset
  }

  readByte(): number {
    if (this.remaining < 1) {
      throw new TypeError('[collaboration] truncated binary transport value')
    }
    const value = this.input[this.offset]
    this.offset += 1
    return value
  }

  readBytes(byteLength: number): Uint8Array {
    if (
      !Number.isSafeInteger(byteLength) ||
      byteLength < 0 ||
      byteLength > this.remaining
    ) {
      throw new TypeError('[collaboration] truncated binary transport value')
    }
    const value = this.input.subarray(this.offset, this.offset + byteLength)
    this.offset += byteLength
    return value
  }

  readFloat64(): number {
    const bytes = this.readBytes(8)
    const value = new DataView(
      bytes.buffer,
      bytes.byteOffset,
      bytes.byteLength
    ).getFloat64(0, true)
    if (!Number.isFinite(value)) {
      throw new TypeError('[collaboration] non-finite binary transport number')
    }
    return value
  }

  readString(): string {
    const encoding = this.readByte()
    const byteLength = this.readVarUint()
    const bytes = this.readBytes(byteLength)
    if (encoding === StringEncoding.UTF8) {
      return textDecoder.decode(bytes)
    }
    if (encoding !== StringEncoding.UTF16 || byteLength % 2 !== 0) {
      throw new TypeError('[collaboration] invalid binary string encoding')
    }
    let value = ''
    const codeUnits = new Uint16Array(Math.min(byteLength / 2, 8_192))
    for (
      let byteOffset = 0;
      byteOffset < byteLength;
      byteOffset += codeUnits.length * 2
    ) {
      const chunkLength = Math.min(
        codeUnits.length,
        (byteLength - byteOffset) / 2
      )
      for (let index = 0; index < chunkLength; index += 1) {
        const sourceOffset = byteOffset + index * 2
        codeUnits[index] =
          (bytes[sourceOffset] ?? 0) | ((bytes[sourceOffset + 1] ?? 0) << 8)
      }
      value += String.fromCharCode(...codeUnits.subarray(0, chunkLength))
    }
    if (isWellFormedUtf16(value)) {
      throw new TypeError(
        '[collaboration] non-canonical binary string encoding'
      )
    }
    return value
  }

  readVarUint(): number {
    const startedAt = this.offset
    let result = 0
    let multiplier = 1
    while (true) {
      const byte = this.readByte()
      const digit = byte & 0x7f
      const contribution = digit * multiplier
      if (!Number.isSafeInteger(contribution)) {
        throw new TypeError('[collaboration] invalid binary transport integer')
      }
      result += contribution
      if (!Number.isSafeInteger(result)) {
        throw new TypeError('[collaboration] invalid binary transport integer')
      }
      if ((byte & 0x80) === 0) {
        if (this.offset - startedAt !== varUintByteLength(result)) {
          throw new TypeError(
            '[collaboration] non-canonical binary transport integer'
          )
        }
        return result
      }
      if (multiplier > Number.MAX_SAFE_INTEGER / 0x80) {
        throw new TypeError('[collaboration] invalid binary transport integer')
      }
      multiplier *= 0x80
    }
  }
}

interface ArrayDecodeFrame {
  readonly kind: 'array'
  readonly value: unknown[]
  index: number
}

interface ObjectDecodeFrame {
  readonly kind: 'object'
  readonly value: Record<string, unknown>
  readonly keys: Set<string>
  remaining: number
}

type DecodeFrame = ArrayDecodeFrame | ObjectDecodeFrame

interface DecodedNode {
  readonly value: unknown
  readonly frame?: DecodeFrame
}

const readNode = (
  reader: BinaryReader,
  dictionary: readonly string[]
): DecodedNode => {
  const tag = reader.readByte()
  if (tag === ValueTag.NULL) return { value: null }
  if (tag === ValueTag.FALSE) return { value: false }
  if (tag === ValueTag.TRUE) return { value: true }
  if (tag === ValueTag.FLOAT64) return { value: reader.readFloat64() }
  if (tag === ValueTag.INTEGER) {
    const encoded = reader.readVarUint()
    return {
      value: encoded % 2 === 0 ? encoded / 2 : -(encoded + 1) / 2
    }
  }
  if (tag === ValueTag.STRING) {
    return { value: reader.readString() }
  }
  if (tag === ValueTag.STRING_REFERENCE) {
    const index = reader.readVarUint()
    if (index >= dictionary.length) {
      throw new TypeError('[collaboration] invalid binary string reference')
    }
    return { value: dictionary[index] }
  }
  if (tag === ValueTag.ARRAY) {
    const length = reader.readVarUint()
    if (length > reader.remaining) {
      throw new TypeError('[collaboration] invalid binary array length')
    }
    const output = new Array<unknown>(length)
    return {
      value: output,
      ...(length > 0
        ? {
            frame: {
              kind: 'array' as const,
              value: output,
              index: 0
            }
          }
        : {})
    }
  }
  if (tag === ValueTag.OBJECT) {
    const size = reader.readVarUint()
    if (size > Math.floor(reader.remaining / 2)) {
      throw new TypeError('[collaboration] invalid binary object size')
    }
    const output: Record<string, unknown> = {}
    return {
      value: output,
      ...(size > 0
        ? {
            frame: {
              kind: 'object' as const,
              value: output,
              keys: new Set<string>(),
              remaining: size
            }
          }
        : {})
    }
  }
  throw new TypeError('[collaboration] invalid binary transport tag')
}

const readValue = (
  reader: BinaryReader,
  dictionary: readonly string[]
): unknown => {
  const root = readNode(reader, dictionary)
  if (!root.frame) return root.value
  const frames: DecodeFrame[] = [root.frame]
  while (frames.length > 0) {
    const frame = frames[frames.length - 1]
    if (!frame) {
      throw new TypeError('[collaboration] invalid binary container state')
    }
    let attach: (value: unknown) => void
    if (frame.kind === 'array') {
      const index = frame.index
      frame.index += 1
      attach = (value) => {
        frame.value[index] = value
      }
    } else {
      const keyIndex = reader.readVarUint()
      if (keyIndex >= dictionary.length) {
        throw new TypeError('[collaboration] invalid binary object key')
      }
      const key = dictionary[keyIndex]
      if (frame.keys.has(key)) {
        throw new TypeError('[collaboration] duplicate binary object key')
      }
      frame.keys.add(key)
      frame.remaining -= 1
      attach = (value) => {
        Object.defineProperty(frame.value, key, {
          configurable: true,
          enumerable: true,
          value,
          writable: true
        })
      }
    }
    const child = readNode(reader, dictionary)
    attach(child.value)
    if (child.frame) frames.push(child.frame)
    while (frames.length > 0) {
      const current = frames[frames.length - 1]
      if (!current) break
      const complete =
        current.kind === 'array'
          ? current.index >= current.value.length
          : current.remaining === 0
      if (!complete) break
      frames.pop()
    }
  }
  return root.value
}

const asUint8Array = (input: ArrayBuffer | ArrayBufferView): Uint8Array =>
  ArrayBuffer.isView(input)
    ? new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
    : new Uint8Array(input)

export const decodeCompactBinary = (
  input: ArrayBuffer | ArrayBufferView
): unknown => {
  const reader = new BinaryReader(asUint8Array(input))
  const magic = reader.readBytes(COMPACT_BINARY_MAGIC.byteLength)
  if (magic.some((byte, index) => byte !== COMPACT_BINARY_MAGIC[index])) {
    throw new TypeError('[collaboration] invalid binary transport marker')
  }
  const dictionarySize = reader.readVarUint()
  if (dictionarySize > Math.floor(reader.remaining / 3)) {
    throw new TypeError('[collaboration] invalid binary dictionary size')
  }
  const dictionary: string[] = []
  const entries = new Set<string>()
  let previousDictionaryEntry = ''
  for (let index = 0; index < dictionarySize; index += 1) {
    const prefixBase = dictionaryPrefixBase(index, previousDictionaryEntry)
    const prefixLength = reader.readVarUint()
    if (prefixLength > prefixBase.length) {
      throw new TypeError('[collaboration] invalid binary dictionary prefix')
    }
    const entry = prefixBase.slice(0, prefixLength) + reader.readString()
    if (commonPrefixLength(prefixBase, entry) !== prefixLength) {
      throw new TypeError(
        '[collaboration] non-canonical binary dictionary prefix'
      )
    }
    if (entries.has(entry)) {
      throw new TypeError('[collaboration] duplicate binary dictionary entry')
    }
    entries.add(entry)
    dictionary.push(entry)
    previousDictionaryEntry = entry
  }
  const value = readValue(reader, dictionary)
  if (reader.remaining !== 0) {
    throw new TypeError('[collaboration] trailing binary transport data')
  }
  return value
}

export const encodeCompactBinaryIfSmaller = (
  value: unknown,
  text: string
): string | Uint8Array => {
  const textByteLength = utf8ByteLength(text)
  if (textByteLength < COMPACT_BINARY_MIN_TEXT_BYTES) return text
  const binary = encodeCompactBinary(value)
  return binary.byteLength < textByteLength ? binary : text
}
