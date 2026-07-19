import * as Y from 'yjs'
import type { SharedOperationEnvelope } from './operation-envelope'

const OPERATION_LOG_NAME = 'asyra:collaboration:operations:v1'

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
  document.getArray<string>(OPERATION_LOG_NAME)

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
