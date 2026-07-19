import * as Y from 'yjs'
import type { SharedOperationEnvelope } from './operation-envelope'

export const YJS_OPERATION_LOG_NAME = 'asyra:collaboration:operations:v1'

export const LOCAL_YJS_OPERATION_ORIGIN = Object.freeze({
  kind: 'local-operation'
})

export type YjsAppendFailureCode =
  | 'unsupported-envelope-value'
  | 'yjs-append-failed'

export class YjsAppendFailure extends Error {
  readonly code: YjsAppendFailureCode
  readonly operationId: string
  readonly cause?: unknown

  constructor(
    code: YjsAppendFailureCode,
    operationId: string,
    message: string,
    cause?: unknown
  ) {
    super(message)
    this.name = 'YjsAppendFailure'
    this.code = code
    this.operationId = operationId
    this.cause = cause
  }
}

export interface YjsBinaryUpdate {
  readonly operationId: string
  readonly update: Uint8Array
}

const assertTransportValue = (
  value: unknown,
  path: string,
  seen: WeakSet<object>
): void => {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return
  }
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return
    throw new Error(`${path} must contain only finite numbers`)
  }
  if (typeof value !== 'object') {
    throw new Error(`${path} contains unsupported ${typeof value}`)
  }

  if (seen.has(value)) {
    throw new Error(`${path} contains a circular value`)
  }
  seen.add(value)

  if (!Array.isArray(value)) {
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error(`${path} contains a non-plain object`)
    }
  }

  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === 'symbol') {
      throw new Error(`${path} contains a symbol key`)
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor?.enumerable) continue
    assertTransportValue(
      Reflect.get(value, key),
      `${path}.${key}`,
      seen
    )
  }
  seen.delete(value)
}

const encodeEnvelope = (envelope: SharedOperationEnvelope): string => {
  try {
    assertTransportValue(envelope, 'envelope', new WeakSet())
    return JSON.stringify(envelope)
  } catch (error) {
    throw new YjsAppendFailure(
      'unsupported-envelope-value',
      envelope.operationId,
      error instanceof Error
        ? `[collaboration] ${error.message}`
        : '[collaboration] envelope is not transport-safe',
      error
    )
  }
}

const operationLog = (document: Y.Doc): Y.Array<string> =>
  document.getArray<string>(YJS_OPERATION_LOG_NAME)

export const appendOperationToYDoc = (
  document: Y.Doc,
  envelope: SharedOperationEnvelope
): YjsBinaryUpdate => {
  const encodedEnvelope = encodeEnvelope(envelope)
  const previousState = Y.encodeStateVector(document)

  try {
    document.transact(() => {
      operationLog(document).push([encodedEnvelope])
    }, LOCAL_YJS_OPERATION_ORIGIN)
  } catch (error) {
    throw new YjsAppendFailure(
      'yjs-append-failed',
      envelope.operationId,
      '[collaboration] failed to append operation to Y.Doc',
      error
    )
  }

  return Object.freeze({
    operationId: envelope.operationId,
    update: Y.encodeStateAsUpdate(document, previousState)
  })
}

export const readOperationLog = (
  document: Y.Doc
): readonly SharedOperationEnvelope[] =>
  operationLog(document).toArray().map((entry) => JSON.parse(entry))

export type InboundYjsUpdateSource = 'provider' | 'persistence'

const INBOUND_PROVIDER_YJS_ORIGIN = Object.freeze({
  kind: 'inbound-provider-update'
})
const INBOUND_PERSISTENCE_YJS_ORIGIN = Object.freeze({
  kind: 'inbound-persistence-update'
})

export const inboundYjsOrigin = (source: InboundYjsUpdateSource): object =>
  source === 'provider'
    ? INBOUND_PROVIDER_YJS_ORIGIN
    : INBOUND_PERSISTENCE_YJS_ORIGIN

export type InboundYjsDecodeFailureCode =
  | 'malformed-binary'
  | 'non-operation-content'
  | 'non-append-update'
  | 'malformed-operation-entry'

export class InboundYjsDecodeFailure extends Error {
  readonly code: InboundYjsDecodeFailureCode
  readonly source: InboundYjsUpdateSource
  readonly cause?: unknown

  constructor(
    code: InboundYjsDecodeFailureCode,
    source: InboundYjsUpdateSource,
    message: string,
    cause?: unknown
  ) {
    super(message)
    this.name = 'InboundYjsDecodeFailure'
    this.code = code
    this.source = source
    this.cause = cause
  }
}

export interface DecodedInboundYjsUpdate {
  readonly source: InboundYjsUpdateSource
  readonly operations: readonly unknown[]
}

const freezeDecodedValue = <T>(
  value: T,
  seen = new WeakSet<object>()
): T => {
  if (value === null || typeof value !== 'object') return value
  const object = value as object
  if (seen.has(object)) return value
  seen.add(object)
  Reflect.ownKeys(object).forEach((key) =>
    freezeDecodedValue(Reflect.get(object, key), seen)
  )
  return Object.freeze(value)
}

const decodeOperationEntry = (
  entry: unknown,
  source: InboundYjsUpdateSource
): unknown => {
  if (typeof entry !== 'string') {
    throw new InboundYjsDecodeFailure(
      'malformed-operation-entry',
      source,
      '[collaboration] Yjs operation entry must be encoded text'
    )
  }
  try {
    const decoded: unknown = JSON.parse(entry)
    if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
      throw new Error('operation entry must decode to an object')
    }
    return freezeDecodedValue(decoded)
  } catch (error) {
    throw new InboundYjsDecodeFailure(
      'malformed-operation-entry',
      source,
      '[collaboration] Yjs operation entry could not be decoded',
      error
    )
  }
}

export const applyInboundYjsUpdate = (
  document: Y.Doc,
  update: Uint8Array,
  source: InboundYjsUpdateSource
): DecodedInboundYjsUpdate => {
  const log = operationLog(document) as Y.Array<unknown>
  const origin = inboundYjsOrigin(source)
  const insertedEntries: unknown[] = []
  let changedNonOperationContent = false
  let deletedOperationContent = false

  const observeLog = (event: Y.YArrayEvent<unknown>): void => {
    event.changes.delta.forEach((change) => {
      if (change.insert) insertedEntries.push(...change.insert)
      if (change.delete) deletedOperationContent = true
    })
  }
  const observeTransaction = (transaction: Y.Transaction): void => {
    if (transaction.origin !== origin) return
    for (const changedType of transaction.changed.keys()) {
      if (changedType !== log) changedNonOperationContent = true
    }
  }

  log.observe(observeLog)
  document.on('afterTransaction', observeTransaction)
  try {
    Y.applyUpdate(document, update.slice(), origin)
  } catch (error) {
    throw new InboundYjsDecodeFailure(
      'malformed-binary',
      source,
      '[collaboration] inbound Yjs update could not be applied',
      error
    )
  } finally {
    log.unobserve(observeLog)
    document.off('afterTransaction', observeTransaction)
  }

  if (changedNonOperationContent) {
    throw new InboundYjsDecodeFailure(
      'non-operation-content',
      source,
      '[collaboration] inbound update changed a non-operation Yjs type'
    )
  }
  if (deletedOperationContent) {
    throw new InboundYjsDecodeFailure(
      'non-append-update',
      source,
      '[collaboration] inbound operation log updates must be append-only'
    )
  }

  return Object.freeze({
    source,
    operations: Object.freeze(
      insertedEntries.map((entry) => decodeOperationEntry(entry, source))
    )
  })
}
