import type {
  FactoryMutationDeliveryPlan,
  FactoryMutationSharedRecordEvidence,
  SharedDelivery,
  SharedDeliveryBatch,
  SharedPublication
} from '@asyra/factory'
import type {
  ProviderAwarenessDisconnect,
  ProviderAwarenessMessage,
  ProviderIdentity
} from '@asyra/collaboration'
import { isRecord } from '@asyra/utils'
import {
  createCompactBinaryEncodePlan,
  decodeCompactBinary,
  encodeCompactBinary,
  encodeCompactBinaryPlan,
  encodeCompactBinaryIfSmaller
} from './compact-binary'
import { decodeCompactJson, encodeCompactJsonIfSmaller } from './compact-json'
import { isNonBlankString } from './wire-values'

export const CollaborationMessageTypes = {
  HELLO: 'hello',
  SEND_PUBLICATION: 'send-publication',
  SEND_PUBLICATIONS: 'send-publications',
  SEND_AWARENESS: 'send-awareness',
  FRAME_CONSUMED: 'frame-consumed',
  PEER_APPLIED: 'peer-applied',
  SOURCE_FRAME_ADMITTED: 'source-frame-admitted',
  READY: 'ready',
  RESPONSE: 'response',
  PUBLICATION: 'publication',
  PUBLICATIONS: 'publications',
  AWARENESS: 'awareness',
  AWARENESS_DISCONNECT: 'awareness-disconnect',
  FAILURE: 'failure',
  CONNECTION_ERROR: 'connection-error'
} as const

export interface CollaborationHelloMessage {
  readonly type: typeof CollaborationMessageTypes.HELLO
  readonly identity: ProviderIdentity
}

export interface SendPublicationRequest {
  readonly type: typeof CollaborationMessageTypes.SEND_PUBLICATION
  readonly requestId: string
  readonly publication: SharedPublication
}

export interface SendPublicationsRequest {
  readonly type: typeof CollaborationMessageTypes.SEND_PUBLICATIONS
  readonly requestId: string
  readonly publications: readonly SharedPublication[]
}

export interface SendAwarenessRequest {
  readonly type: typeof CollaborationMessageTypes.SEND_AWARENESS
  readonly requestId: string
  readonly message: ProviderAwarenessMessage
}

export interface FrameConsumedRequest {
  readonly type: typeof CollaborationMessageTypes.FRAME_CONSUMED
  readonly requestId: string
  readonly frameId: string
  readonly publicationId: string
  readonly frameByteLength: number
}

export interface PeerAppliedRequest {
  readonly type: typeof CollaborationMessageTypes.PEER_APPLIED
  readonly requestId: string
  readonly publicationId: string
  readonly fromActorId: string
}

export type CollaborationRequestMessage =
  | SendPublicationRequest
  | SendPublicationsRequest
  | SendAwarenessRequest
  | FrameConsumedRequest
  | PeerAppliedRequest

type WithoutRequestId<T> = T extends CollaborationRequestMessage
  ? Omit<T, 'requestId'>
  : never

export type CollaborationRequestInput =
  WithoutRequestId<CollaborationRequestMessage>

export type CollaborationClientMessage =
  | CollaborationHelloMessage
  | CollaborationRequestMessage

export interface CollaborationFailurePayload {
  readonly code: string
  readonly message: string
}

export interface ReadyMessage {
  readonly type: typeof CollaborationMessageTypes.READY
}

export interface SuccessfulResponseMessage {
  readonly type: typeof CollaborationMessageTypes.RESPONSE
  readonly requestId: string
  readonly ok: true
}

export interface FailedResponseMessage {
  readonly type: typeof CollaborationMessageTypes.RESPONSE
  readonly requestId: string
  readonly ok: false
  readonly error: CollaborationFailurePayload
}

export interface SourceFrameAdmittedMessage {
  readonly type: typeof CollaborationMessageTypes.SOURCE_FRAME_ADMITTED
  readonly requestId: string
  readonly frameId: string
  readonly publicationId: string
  readonly frameByteLength: number
}

export interface PublicationMessage {
  readonly type: typeof CollaborationMessageTypes.PUBLICATION
  readonly publication: SharedPublication
  readonly fromActorId?: string
}

export interface PublicationsMessage {
  readonly type: typeof CollaborationMessageTypes.PUBLICATIONS
  readonly publications: readonly SharedPublication[]
  readonly fromActorId?: string
}

export type AwarenessMessage = Readonly<
  {
    type: typeof CollaborationMessageTypes.AWARENESS
  } & ProviderAwarenessMessage
>

export type AwarenessDisconnectMessage = Readonly<
  {
    type: typeof CollaborationMessageTypes.AWARENESS_DISCONNECT
  } & ProviderAwarenessDisconnect
>

interface ProviderFailureMessage {
  readonly code: string
  readonly message: string
  readonly publicationId?: string
}

export interface FailureMessage extends ProviderFailureMessage {
  readonly type: typeof CollaborationMessageTypes.FAILURE
}

export interface ConnectionErrorMessage extends ProviderFailureMessage {
  readonly type: typeof CollaborationMessageTypes.CONNECTION_ERROR
}

export type CollaborationServerMessage =
  | ReadyMessage
  | SuccessfulResponseMessage
  | FailedResponseMessage
  | SourceFrameAdmittedMessage
  | PublicationMessage
  | PublicationsMessage
  | AwarenessMessage
  | AwarenessDisconnectMessage
  | FailureMessage
  | ConnectionErrorMessage

const sharedDeliveryOrigins = new Set<SharedDelivery['origin']>([
  'action',
  'automation',
  'remote',
  'undo',
  'redo',
  'load-migration',
  'rollback-compensation'
])

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0

const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0

const areJsonTransportValuesEqual = (
  left: unknown,
  right: unknown
): boolean => {
  const pairs: (readonly [unknown, unknown])[] = [[left, right]]
  while (pairs.length > 0) {
    const pair = pairs.pop()
    if (!pair) return false
    const [leftValue, rightValue] = pair
    if (Object.is(leftValue, rightValue)) continue
    if (
      !leftValue ||
      !rightValue ||
      typeof leftValue !== 'object' ||
      typeof rightValue !== 'object' ||
      Array.isArray(leftValue) !== Array.isArray(rightValue)
    ) {
      return false
    }
    if (Array.isArray(leftValue) && Array.isArray(rightValue)) {
      if (leftValue.length !== rightValue.length) return false
      for (let index = leftValue.length - 1; index >= 0; index -= 1) {
        pairs.push([leftValue[index], rightValue[index]])
      }
      continue
    }
    const leftEntries = Object.entries(leftValue)
    const rightEntries = Object.entries(rightValue)
    if (leftEntries.length !== rightEntries.length) return false
    for (let index = leftEntries.length - 1; index >= 0; index -= 1) {
      const leftEntry = leftEntries[index]
      const rightEntry = rightEntries[index]
      if (!leftEntry || !rightEntry || leftEntry[0] !== rightEntry[0]) {
        return false
      }
      pairs.push([leftEntry[1], rightEntry[1]])
    }
  }
  return true
}

const isStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((item) => isNonBlankString(item))

const isSharedRecordEvidence = (
  value: unknown
): value is FactoryMutationSharedRecordEvidence =>
  isRecord(value) &&
  isNonBlankString(value.recordId) &&
  isNonBlankString(value.deliveryId) &&
  isNonNegativeInteger(value.occurrence) &&
  isStringArray(value.orderedIds) &&
  isRecord(value.payload) &&
  Array.isArray(value.inverseEvents) &&
  isJsonTransportValue(value)

const isSharedDelivery = (value: unknown): value is SharedDelivery =>
  isRecord(value) &&
  isNonBlankString(value.deliveryId) &&
  isNonBlankString(value.artifactId) &&
  isNonBlankString(value.batchId) &&
  isPositiveInteger(value.transactionId) &&
  sharedDeliveryOrigins.has(value.origin as SharedDelivery['origin']) &&
  (value.kind === 'forward' || value.kind === 'compensation') &&
  isNonBlankString(value.channel) &&
  isNonBlankString(value.eventName) &&
  Object.prototype.hasOwnProperty.call(value, 'payload') &&
  isNonBlankString(value.recordId) &&
  isSharedRecordEvidence(value.record) &&
  value.recordId === value.record.recordId &&
  value.deliveryId === value.record.deliveryId &&
  areJsonTransportValuesEqual(value.payload, value.record.payload) &&
  (value.sharedDelivery === 'transaction-end' ||
    value.sharedDelivery === 'immediate') &&
  (value.compensatesDeliveryId === undefined ||
    isNonBlankString(value.compensatesDeliveryId))

const isSharedDeliveryBatch = (
  value: unknown
): value is SharedDeliveryBatch => {
  if (
    !isRecord(value) ||
    !isNonBlankString(value.batchId) ||
    !isNonBlankString(value.sliceId) ||
    !isNonBlankString(value.artifactId) ||
    !isPositiveInteger(value.transactionId) ||
    !sharedDeliveryOrigins.has(value.origin as SharedDelivery['origin']) ||
    (value.kind !== 'forward' && value.kind !== 'compensation') ||
    !isNonBlankString(value.channel) ||
    (value.sharedDelivery !== 'transaction-end' &&
      value.sharedDelivery !== 'immediate') ||
    !Array.isArray(value.deliveries) ||
    value.deliveries.length === 0 ||
    !Array.isArray(value.records) ||
    !Array.isArray(value.changes) ||
    value.deliveries.length !== value.records.length ||
    value.deliveries.length !== value.changes.length
  ) {
    return false
  }
  const { changes, deliveries, records } = value
  return (
    deliveries.every((delivery, index) => {
      const record = records[index]
      return (
        isSharedDelivery(delivery) &&
        isSharedRecordEvidence(record) &&
        delivery.batchId === value.batchId &&
        delivery.artifactId === value.artifactId &&
        delivery.transactionId === value.transactionId &&
        delivery.origin === value.origin &&
        delivery.kind === value.kind &&
        delivery.channel === value.channel &&
        delivery.sharedDelivery === value.sharedDelivery &&
        areJsonTransportValuesEqual(delivery.record, record) &&
        areJsonTransportValuesEqual(delivery.payload, changes[index])
      )
    }) &&
    (value.compensatesBatchId === undefined ||
      isNonBlankString(value.compensatesBatchId))
  )
}

const isDeliveryPlan = (
  value: unknown
): value is FactoryMutationDeliveryPlan => {
  if (
    !isRecord(value) ||
    (value.mode !== 'atomic' && value.mode !== 'progressive') ||
    !Array.isArray(value.slices)
  ) {
    return false
  }
  const sliceIds = new Set<string>()
  return value.slices.every((slice) => {
    if (
      !isRecord(slice) ||
      !isNonBlankString(slice.sliceId) ||
      !isStringArray(slice.orderedIds) ||
      sliceIds.has(slice.sliceId)
    ) {
      return false
    }
    sliceIds.add(slice.sliceId)
    return true
  })
}

export const isSharedPublication = (
  value: unknown
): value is SharedPublication => {
  if (
    !isRecord(value) ||
    !isNonBlankString(value.publicationId) ||
    !isNonBlankString(value.artifactId) ||
    !isPositiveInteger(value.transactionId) ||
    !sharedDeliveryOrigins.has(value.origin as SharedDelivery['origin']) ||
    !Array.isArray(value.deliveries) ||
    value.deliveries.length === 0 ||
    !Array.isArray(value.batches) ||
    value.batches.length === 0 ||
    !isDeliveryPlan(value.deliveryPlan)
  ) {
    return false
  }
  const sliceIds = new Set(
    value.deliveryPlan.slices.map(({ sliceId }) => sliceId)
  )
  const batchIds = new Set<string>()
  const deliveryIds = new Set<string>()
  const recordIds = new Set<string>()
  for (const batch of value.batches) {
    if (
      !isSharedDeliveryBatch(batch) ||
      batchIds.has(batch.batchId) ||
      batch.artifactId !== value.artifactId ||
      batch.transactionId !== value.transactionId ||
      batch.origin !== value.origin ||
      !sliceIds.has(batch.sliceId)
    ) {
      return false
    }
    batchIds.add(batch.batchId)
    for (const delivery of batch.deliveries) {
      if (
        deliveryIds.has(delivery.deliveryId) ||
        recordIds.has(delivery.recordId)
      ) {
        return false
      }
      deliveryIds.add(delivery.deliveryId)
      recordIds.add(delivery.recordId)
    }
  }
  const batchDeliveries = value.batches.flatMap((batch) => batch.deliveries)
  return (
    value.deliveries.length === batchDeliveries.length &&
    value.deliveries.every(
      (delivery, index) =>
        isSharedDelivery(delivery) &&
        delivery.artifactId === value.artifactId &&
        delivery.transactionId === value.transactionId &&
        delivery.origin === value.origin &&
        areJsonTransportValuesEqual(delivery, batchDeliveries[index])
    )
  )
}

type JsonTransportTraversalFrame =
  | {
      readonly kind: 'value'
      readonly depth: number
      readonly value: unknown
    }
  | {
      readonly kind: 'leave'
      readonly value: object
    }

interface JsonTransportAnalysis {
  readonly maximumDepth: number
}

const MAX_RECURSIVE_JSON_TRANSPORT_DEPTH = 256

const analyzeJsonTransportValue = (
  value: unknown
): JsonTransportAnalysis | null => {
  const ancestors = new Set<object>()
  const frames: JsonTransportTraversalFrame[] = [
    { depth: 0, kind: 'value', value }
  ]
  let maximumDepth = 0
  while (frames.length > 0) {
    const frame = frames.pop()
    if (!frame) return null
    if (frame.kind === 'leave') {
      ancestors.delete(frame.value)
      continue
    }
    maximumDepth = Math.max(maximumDepth, frame.depth)
    const child = frame.value
    if (
      child === null ||
      typeof child === 'string' ||
      typeof child === 'boolean'
    ) {
      continue
    }
    if (typeof child === 'number') {
      if (!Number.isFinite(child) || Object.is(child, -0)) return null
      continue
    }
    if (typeof child !== 'object' || ancestors.has(child)) return null
    ancestors.add(child)
    frames.push({ kind: 'leave', value: child })

    if (Array.isArray(child)) {
      const keys = Reflect.ownKeys(child)
      if (keys.length !== child.length + 1) return null
      const values = new Array<unknown>(child.length)
      for (const key of keys) {
        if (key === 'length') continue
        if (typeof key !== 'string') return null
        const index = Number(key)
        if (
          !Number.isInteger(index) ||
          index < 0 ||
          index >= child.length ||
          String(index) !== key
        ) {
          return null
        }
        const descriptor = Object.getOwnPropertyDescriptor(child, key)
        if (!descriptor?.enumerable || !('value' in descriptor)) return null
        values[index] = descriptor.value
      }
      for (let index = values.length - 1; index >= 0; index -= 1) {
        frames.push({
          depth: frame.depth + 1,
          kind: 'value',
          value: values[index]
        })
      }
      continue
    }

    const prototype = Object.getPrototypeOf(child)
    if (prototype !== Object.prototype && prototype !== null) return null
    const keys = Reflect.ownKeys(child)
    for (let index = keys.length - 1; index >= 0; index -= 1) {
      const key = keys[index]
      if (typeof key !== 'string') return null
      const descriptor = Object.getOwnPropertyDescriptor(child, key)
      if (!descriptor?.enumerable || !('value' in descriptor)) return null
      frames.push({
        depth: frame.depth + 1,
        kind: 'value',
        value: descriptor.value
      })
    }
  }
  return { maximumDepth }
}

export const isJsonTransportValue = (value: unknown): boolean =>
  analyzeJsonTransportValue(value) !== null

const PUBLICATION_FRAME_MAGIC = new Uint8Array([
  0x41, 0x53, 0x59, 0x52, 0x41, 0x50
])
const PUBLICATION_FRAME_FIXED_HEADER_BYTES = 44
const PUBLICATION_FRAME_DEFAULT_SOFT_TARGET_BYTES = 1024 * 1024
export const PUBLICATION_FRAME_VERSION_OFFSET =
  PUBLICATION_FRAME_MAGIC.byteLength
export const PUBLICATION_FRAME_VERSION = 1

const publicationFrameKinds = {
  [CollaborationMessageTypes.SEND_PUBLICATION]: 1,
  [CollaborationMessageTypes.SEND_PUBLICATIONS]: 2,
  [CollaborationMessageTypes.PUBLICATION]: 3,
  [CollaborationMessageTypes.PUBLICATIONS]: 4
} as const

type PublicationFrameMessageType = keyof typeof publicationFrameKinds

export type PublicationFrameMessage =
  | SendPublicationRequest
  | SendPublicationsRequest
  | PublicationMessage
  | PublicationsMessage

export interface PublicationFrameHeader {
  readonly version: number
  readonly messageType: PublicationFrameMessageType
  readonly requestId?: string
  readonly fromActorId?: string
  readonly publicationId: string
  readonly publicationIndex: number
  readonly publicationCount: number
  readonly chunkIndex: number
  readonly chunkCount: number
  readonly payloadByteLength: number
  readonly frameByteLength: number
  readonly frameId: string
}

export interface EncodePublicationMessageFramesOptions {
  readonly softTargetBytes?: number
}

interface PublicationWireBatchMetadata {
  readonly batchId: string
  readonly sliceId: string
  readonly artifactId: string
  readonly transactionId: number
  readonly origin: SharedDeliveryBatch['origin']
  readonly kind: SharedDeliveryBatch['kind']
  readonly channel: string
  readonly sharedDelivery: SharedDeliveryBatch['sharedDelivery']
  readonly compensatesBatchId?: string
}

interface PublicationWireUnit {
  readonly batch: PublicationWireBatchMetadata
  readonly delivery: SharedDelivery
}

interface PublicationWireMetadata {
  readonly artifactId: string
  readonly transactionId: number
  readonly origin: SharedPublication['origin']
  readonly deliveryPlan: FactoryMutationDeliveryPlan
}

interface PublicationWireChunk extends PublicationWireMetadata {
  readonly units: readonly PublicationWireUnit[]
}

const PUBLICATION_PAYLOAD_MAGIC = new Uint8Array([0x41, 0x53, 0x59, 0x55])
const PUBLICATION_PAYLOAD_VERSION = 1
const PUBLICATION_PAYLOAD_FIXED_BYTES = 16
const PUBLICATION_PAYLOAD_UNIT_LENGTH_BYTES = 4
const PUBLICATION_FRAME_STRING_UTF8 = 0
const PUBLICATION_FRAME_STRING_UTF16 = 1
const publicationFrameTextEncoder = new TextEncoder()
const publicationFrameTextDecoder = new TextDecoder('utf-8', {
  fatal: true,
  ignoreBOM: true
})

const asPublicationFrameBytes = (
  input: ArrayBuffer | ArrayBufferView
): Uint8Array =>
  ArrayBuffer.isView(input)
    ? new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
    : new Uint8Array(input)

const publicationFrameMessageTypeFromCode = (
  value: number
): PublicationFrameMessageType | undefined =>
  (
    Object.entries(publicationFrameKinds) as (readonly [
      PublicationFrameMessageType,
      number
    ])[]
  ).find(([, code]) => code === value)?.[0]

const isWellFormedPublicationFrameString = (value: string): boolean => {
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

const publicationFrameStringBytes = (value: string | undefined): Uint8Array => {
  if (!value) return new Uint8Array()
  if (isWellFormedPublicationFrameString(value)) {
    const utf8 = publicationFrameTextEncoder.encode(value)
    const encoded = new Uint8Array(1 + utf8.byteLength)
    encoded[0] = PUBLICATION_FRAME_STRING_UTF8
    encoded.set(utf8, 1)
    return encoded
  }
  const encoded = new Uint8Array(1 + value.length * 2)
  encoded[0] = PUBLICATION_FRAME_STRING_UTF16
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    encoded[1 + index * 2] = code & 0xff
    encoded[2 + index * 2] = code >>> 8
  }
  return encoded
}

const decodePublicationFrameString = (bytes: Uint8Array): string => {
  if (bytes.byteLength === 0) return ''
  const encoding = bytes[0]
  const valueBytes = bytes.subarray(1)
  if (encoding === PUBLICATION_FRAME_STRING_UTF8) {
    return publicationFrameTextDecoder.decode(valueBytes)
  }
  if (
    encoding !== PUBLICATION_FRAME_STRING_UTF16 ||
    valueBytes.byteLength % 2 !== 0
  ) {
    throw new TypeError(
      '[collaboration] invalid publication frame string encoding'
    )
  }
  let value = ''
  const codeUnits = new Uint16Array(Math.min(valueBytes.byteLength / 2, 8_192))
  for (
    let byteOffset = 0;
    byteOffset < valueBytes.byteLength;
    byteOffset += codeUnits.length * 2
  ) {
    const chunkLength = Math.min(
      codeUnits.length,
      (valueBytes.byteLength - byteOffset) / 2
    )
    for (let index = 0; index < chunkLength; index += 1) {
      const sourceOffset = byteOffset + index * 2
      codeUnits[index] =
        (valueBytes[sourceOffset] ?? 0) |
        ((valueBytes[sourceOffset + 1] ?? 0) << 8)
    }
    value += String.fromCharCode(...codeUnits.subarray(0, chunkLength))
  }
  if (isWellFormedPublicationFrameString(value)) {
    throw new TypeError(
      '[collaboration] non-canonical publication frame string encoding'
    )
  }
  return value
}

const publicationFrameId = (
  messageType: PublicationFrameMessageType,
  requestId: string | undefined,
  fromActorId: string | undefined,
  publicationId: string,
  publicationIndex: number,
  chunkIndex: number
): string => {
  let identityKind = 'anonymous'
  if (requestId !== undefined) {
    identityKind = 'request'
  } else if (fromActorId !== undefined) {
    identityKind = 'actor'
  }
  const identity = requestId ?? fromActorId ?? ''
  const lengthPrefixed = (value: string): string =>
    `${String(value.length)}:${value}`
  return [
    messageType,
    identityKind,
    lengthPrefixed(identity),
    lengthPrefixed(publicationId),
    publicationIndex,
    chunkIndex
  ].join('|')
}

const buildPublicationFrame = (
  header: Omit<
    PublicationFrameHeader,
    'frameByteLength' | 'frameId' | 'payloadByteLength' | 'version'
  >,
  payload: Uint8Array
): ArrayBuffer => {
  const requestIdBytes = publicationFrameStringBytes(header.requestId)
  const publicationIdBytes = publicationFrameStringBytes(header.publicationId)
  const fromActorIdBytes = publicationFrameStringBytes(header.fromActorId)
  const headerByteLength =
    PUBLICATION_FRAME_FIXED_HEADER_BYTES +
    requestIdBytes.byteLength +
    publicationIdBytes.byteLength +
    fromActorIdBytes.byteLength
  const bytes = new Uint8Array(headerByteLength + payload.byteLength)
  bytes.set(PUBLICATION_FRAME_MAGIC, 0)
  bytes[PUBLICATION_FRAME_VERSION_OFFSET] = PUBLICATION_FRAME_VERSION
  bytes[PUBLICATION_FRAME_VERSION_OFFSET + 1] =
    publicationFrameKinds[header.messageType]
  const view = new DataView(bytes.buffer)
  view.setUint32(8, headerByteLength, true)
  view.setUint32(12, payload.byteLength, true)
  view.setUint32(16, header.publicationIndex, true)
  view.setUint32(20, header.publicationCount, true)
  view.setUint32(24, header.chunkIndex, true)
  view.setUint32(28, header.chunkCount, true)
  view.setUint32(32, requestIdBytes.byteLength, true)
  view.setUint32(36, publicationIdBytes.byteLength, true)
  view.setUint32(40, fromActorIdBytes.byteLength, true)
  let offset = PUBLICATION_FRAME_FIXED_HEADER_BYTES
  bytes.set(requestIdBytes, offset)
  offset += requestIdBytes.byteLength
  bytes.set(publicationIdBytes, offset)
  offset += publicationIdBytes.byteLength
  bytes.set(fromActorIdBytes, offset)
  bytes.set(payload, headerByteLength)
  return bytes.buffer
}

const inspectPublicationFrame = (
  input: ArrayBuffer | ArrayBufferView
): PublicationFrameHeader & { readonly payloadOffset: number } => {
  const bytes = asPublicationFrameBytes(input)
  if (bytes.byteLength < PUBLICATION_FRAME_FIXED_HEADER_BYTES) {
    throw new TypeError('[collaboration] truncated publication frame header')
  }
  if (PUBLICATION_FRAME_MAGIC.some((byte, index) => bytes[index] !== byte)) {
    throw new TypeError('[collaboration] invalid publication frame marker')
  }
  const version = bytes[PUBLICATION_FRAME_VERSION_OFFSET]
  if (version !== PUBLICATION_FRAME_VERSION) {
    throw new TypeError(
      `[collaboration] unsupported publication frame version: ${String(version)}`
    )
  }
  const messageType = publicationFrameMessageTypeFromCode(
    bytes[PUBLICATION_FRAME_VERSION_OFFSET + 1] ?? -1
  )
  if (!messageType) {
    throw new TypeError('[collaboration] invalid publication frame kind')
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const headerByteLength = view.getUint32(8, true)
  const payloadByteLength = view.getUint32(12, true)
  const publicationIndex = view.getUint32(16, true)
  const publicationCount = view.getUint32(20, true)
  const chunkIndex = view.getUint32(24, true)
  const chunkCount = view.getUint32(28, true)
  const requestIdByteLength = view.getUint32(32, true)
  const publicationIdByteLength = view.getUint32(36, true)
  const fromActorIdByteLength = view.getUint32(40, true)
  const expectedHeaderByteLength =
    PUBLICATION_FRAME_FIXED_HEADER_BYTES +
    requestIdByteLength +
    publicationIdByteLength +
    fromActorIdByteLength
  if (
    headerByteLength !== expectedHeaderByteLength ||
    headerByteLength > bytes.byteLength
  ) {
    throw new TypeError('[collaboration] truncated publication frame header')
  }
  const expectedFrameByteLength = headerByteLength + payloadByteLength
  if (expectedFrameByteLength > bytes.byteLength) {
    throw new TypeError('[collaboration] truncated publication frame payload')
  }
  if (expectedFrameByteLength < bytes.byteLength) {
    throw new TypeError('[collaboration] trailing publication frame data')
  }
  if (
    publicationCount === 0 ||
    publicationIndex >= publicationCount ||
    chunkCount === 0 ||
    chunkIndex >= chunkCount ||
    payloadByteLength === 0
  ) {
    throw new TypeError('[collaboration] invalid publication frame metadata')
  }
  let offset = PUBLICATION_FRAME_FIXED_HEADER_BYTES
  const decodeHeaderString = (byteLength: number): string => {
    const decoded = decodePublicationFrameString(
      bytes.subarray(offset, offset + byteLength)
    )
    offset += byteLength
    return decoded
  }
  const requestId = decodeHeaderString(requestIdByteLength)
  const publicationId = decodeHeaderString(publicationIdByteLength)
  const fromActorId = decodeHeaderString(fromActorIdByteLength)
  const clientFrame =
    messageType === CollaborationMessageTypes.SEND_PUBLICATION ||
    messageType === CollaborationMessageTypes.SEND_PUBLICATIONS
  if (
    !isNonBlankString(publicationId) ||
    (clientFrame && !isNonBlankString(requestId)) ||
    (!clientFrame && requestId.length > 0) ||
    (fromActorId.length > 0 && !isNonBlankString(fromActorId))
  ) {
    throw new TypeError('[collaboration] invalid publication frame identity')
  }
  return {
    version,
    messageType,
    ...(requestId ? { requestId } : {}),
    ...(fromActorId ? { fromActorId } : {}),
    publicationId,
    publicationIndex,
    publicationCount,
    chunkIndex,
    chunkCount,
    payloadByteLength,
    frameByteLength: bytes.byteLength,
    frameId: publicationFrameId(
      messageType,
      requestId || undefined,
      fromActorId || undefined,
      publicationId,
      publicationIndex,
      chunkIndex
    ),
    payloadOffset: headerByteLength
  }
}

export const inspectPublicationFrameHeader = (
  input: ArrayBuffer | ArrayBufferView
): PublicationFrameHeader => {
  const { payloadOffset: _payloadOffset, ...header } =
    inspectPublicationFrame(input)
  return header
}

export const isPublicationFrame = (
  input: ArrayBuffer | ArrayBufferView
): boolean => {
  const bytes = asPublicationFrameBytes(input)
  return (
    bytes.byteLength >= PUBLICATION_FRAME_MAGIC.byteLength &&
    PUBLICATION_FRAME_MAGIC.every((byte, index) => bytes[index] === byte)
  )
}

const publicationMessageParts = (
  message: PublicationFrameMessage
): {
  readonly messageType: PublicationFrameMessageType
  readonly requestId?: string
  readonly fromActorId?: string
  readonly publications: readonly SharedPublication[]
} => {
  switch (message.type) {
    case CollaborationMessageTypes.SEND_PUBLICATION:
      return {
        messageType: message.type,
        requestId: message.requestId,
        publications: [message.publication]
      }
    case CollaborationMessageTypes.SEND_PUBLICATIONS:
      return {
        messageType: message.type,
        requestId: message.requestId,
        publications: message.publications
      }
    case CollaborationMessageTypes.PUBLICATION:
      return {
        messageType: message.type,
        ...(message.fromActorId ? { fromActorId: message.fromActorId } : {}),
        publications: [message.publication]
      }
    case CollaborationMessageTypes.PUBLICATIONS:
      return {
        messageType: message.type,
        ...(message.fromActorId ? { fromActorId: message.fromActorId } : {}),
        publications: message.publications
      }
  }
}

const publicationWireUnits = (
  publication: SharedPublication
): readonly PublicationWireUnit[] =>
  publication.batches.flatMap((batch) =>
    batch.deliveries.map((delivery) => ({
      batch: {
        batchId: batch.batchId,
        sliceId: batch.sliceId,
        artifactId: batch.artifactId,
        transactionId: batch.transactionId,
        origin: batch.origin,
        kind: batch.kind,
        channel: batch.channel,
        sharedDelivery: batch.sharedDelivery,
        ...(batch.compensatesBatchId
          ? { compensatesBatchId: batch.compensatesBatchId }
          : {})
      },
      delivery
    }))
  )

const publicationWireMetadata = (
  publication: SharedPublication
): PublicationWireMetadata => ({
  artifactId: publication.artifactId,
  transactionId: publication.transactionId,
  origin: publication.origin,
  deliveryPlan: publication.deliveryPlan
})

const publicationFrameHeaderByteLength = (
  requestId: string | undefined,
  publicationId: string,
  fromActorId: string | undefined
): number =>
  PUBLICATION_FRAME_FIXED_HEADER_BYTES +
  publicationFrameStringBytes(requestId).byteLength +
  publicationFrameStringBytes(publicationId).byteLength +
  publicationFrameStringBytes(fromActorId).byteLength

const encodePublicationPayloadChunks = (
  publication: SharedPublication,
  softTargetBytes: number,
  headerByteLength: number
): readonly Uint8Array[] => {
  const units = publicationWireUnits(publication)
  if (units.length === 0) {
    throw new TypeError('[collaboration] publication has no wire records')
  }
  const metadataPlan = createCompactBinaryEncodePlan(
    publicationWireMetadata(publication)
  )
  const metadata = encodeCompactBinaryPlan(metadataPlan)
  const encodedUnits = units.map((unit) => {
    const plan = createCompactBinaryEncodePlan(unit)
    return encodeCompactBinaryPlan(plan)
  })
  const payloadByteLength = encodedUnits.reduce(
    (total, unit) =>
      total + PUBLICATION_PAYLOAD_UNIT_LENGTH_BYTES + unit.byteLength,
    PUBLICATION_PAYLOAD_FIXED_BYTES + metadata.byteLength
  )
  if (
    !Number.isSafeInteger(payloadByteLength) ||
    payloadByteLength > 0xffff_ffff
  ) {
    throw new TypeError(
      '[collaboration] publication payload exceeds wire range'
    )
  }
  const encoded = new Uint8Array(payloadByteLength)
  encoded.set(PUBLICATION_PAYLOAD_MAGIC, 0)
  encoded[4] = PUBLICATION_PAYLOAD_VERSION
  const view = new DataView(encoded.buffer)
  view.setUint32(8, metadata.byteLength, true)
  view.setUint32(12, encodedUnits.length, true)
  encoded.set(metadata, PUBLICATION_PAYLOAD_FIXED_BYTES)
  const itemRanges: { start: number; end: number }[] = []
  let itemOffset = PUBLICATION_PAYLOAD_FIXED_BYTES + metadata.byteLength
  for (const unit of encodedUnits) {
    const start = itemOffset
    view.setUint32(itemOffset, unit.byteLength, true)
    itemOffset += PUBLICATION_PAYLOAD_UNIT_LENGTH_BYTES
    encoded.set(unit, itemOffset)
    itemOffset += unit.byteLength
    itemRanges.push({ start, end: itemOffset })
  }
  if (itemOffset !== encoded.byteLength) {
    throw new TypeError('[collaboration] publication payload length mismatch')
  }
  if (itemRanges.length === 1) return [encoded]

  const payloadCapacity = Math.max(1, softTargetBytes - headerByteLength)
  const ranges: { start: number; end: number }[] = []
  let currentStart = 0
  let currentEnd = 0
  const flush = (): void => {
    if (currentEnd <= currentStart) return
    ranges.push({ start: currentStart, end: currentEnd })
    currentStart = currentEnd
  }

  const prefixByteLength = PUBLICATION_PAYLOAD_FIXED_BYTES + metadata.byteLength
  while (currentEnd < prefixByteLength) {
    const available = payloadCapacity - (currentEnd - currentStart)
    const consumed = Math.min(available, prefixByteLength - currentEnd)
    currentEnd += consumed
    if (currentEnd - currentStart === payloadCapacity) {
      flush()
    }
  }

  for (const range of itemRanges) {
    if (range.start !== currentEnd) {
      throw new TypeError(
        '[collaboration] invalid publication record encode plan'
      )
    }
    const currentByteLength = currentEnd - currentStart
    const recordByteLength = range.end - range.start
    if (
      currentByteLength > 0 &&
      currentByteLength + recordByteLength > payloadCapacity
    ) {
      flush()
    }
    if (recordByteLength > payloadCapacity) {
      flush()
      ranges.push(range)
      currentStart = range.end
      currentEnd = range.end
      continue
    }
    currentEnd += recordByteLength
  }
  flush()
  if (
    ranges.length === 0 ||
    ranges[0]?.start !== 0 ||
    ranges[ranges.length - 1]?.end !== encoded.byteLength ||
    ranges.some(
      (range, index) =>
        range.end <= range.start ||
        (index > 0 && ranges[index - 1]?.end !== range.start)
    )
  ) {
    throw new TypeError('[collaboration] invalid publication frame plan')
  }
  return ranges.map(({ start, end }) => encoded.subarray(start, end))
}

export const encodePublicationMessageFrames = (
  message: PublicationFrameMessage,
  options: EncodePublicationMessageFramesOptions = {}
): readonly ArrayBuffer[] => {
  const { messageType, requestId, fromActorId, publications } =
    publicationMessageParts(message)
  if (
    publications.length === 0 ||
    !publications.every((publication) => isSharedPublication(publication))
  ) {
    throw new TypeError('[collaboration] invalid shared publication')
  }
  const publicationIds = new Set<string>()
  for (const publication of publications) {
    if (publicationIds.has(publication.publicationId)) {
      throw new TypeError('[collaboration] duplicate publication identity')
    }
    publicationIds.add(publication.publicationId)
  }
  const softTargetBytes =
    options.softTargetBytes ?? PUBLICATION_FRAME_DEFAULT_SOFT_TARGET_BYTES
  if (!Number.isSafeInteger(softTargetBytes) || softTargetBytes <= 0) {
    throw new TypeError('[collaboration] invalid publication frame target')
  }
  return publications.flatMap((publication, publicationIndex) => {
    const headerByteLength = publicationFrameHeaderByteLength(
      requestId,
      publication.publicationId,
      fromActorId
    )
    const payloads = encodePublicationPayloadChunks(
      publication,
      softTargetBytes,
      headerByteLength
    )
    return payloads.map((payload, chunkIndex) =>
      buildPublicationFrame(
        {
          messageType,
          ...(requestId ? { requestId } : {}),
          ...(fromActorId ? { fromActorId } : {}),
          publicationId: publication.publicationId,
          publicationIndex,
          publicationCount: publications.length,
          chunkIndex,
          chunkCount: payloads.length
        },
        payload
      )
    )
  })
}

const isPublicationWireBatchMetadata = (
  value: unknown
): value is PublicationWireBatchMetadata =>
  isRecord(value) &&
  isNonBlankString(value.batchId) &&
  isNonBlankString(value.sliceId) &&
  isNonBlankString(value.artifactId) &&
  isPositiveInteger(value.transactionId) &&
  sharedDeliveryOrigins.has(value.origin as SharedDelivery['origin']) &&
  (value.kind === 'forward' || value.kind === 'compensation') &&
  isNonBlankString(value.channel) &&
  (value.sharedDelivery === 'transaction-end' ||
    value.sharedDelivery === 'immediate') &&
  (value.compensatesBatchId === undefined ||
    isNonBlankString(value.compensatesBatchId))

const isPublicationWireMetadata = (
  value: unknown
): value is PublicationWireMetadata =>
  isRecord(value) &&
  isNonBlankString(value.artifactId) &&
  isPositiveInteger(value.transactionId) &&
  sharedDeliveryOrigins.has(value.origin as SharedDelivery['origin']) &&
  isDeliveryPlan(value.deliveryPlan)

const isPublicationWireUnit = (
  value: unknown,
  metadata: PublicationWireMetadata
): value is PublicationWireUnit =>
  isRecord(value) &&
  isPublicationWireBatchMetadata(value.batch) &&
  isSharedDelivery(value.delivery) &&
  value.batch.artifactId === metadata.artifactId &&
  value.batch.transactionId === metadata.transactionId &&
  value.batch.origin === metadata.origin &&
  value.delivery.batchId === value.batch.batchId &&
  value.delivery.artifactId === value.batch.artifactId &&
  value.delivery.transactionId === value.batch.transactionId &&
  value.delivery.origin === value.batch.origin &&
  value.delivery.kind === value.batch.kind &&
  value.delivery.channel === value.batch.channel &&
  value.delivery.sharedDelivery === value.batch.sharedDelivery

const isPublicationWireChunk = (
  value: unknown
): value is PublicationWireChunk =>
  isRecord(value) &&
  isPublicationWireMetadata(value) &&
  Array.isArray(value.units) &&
  value.units.length > 0 &&
  value.units.every((unit) => isPublicationWireUnit(unit, value))

interface MutablePublicationBatch {
  readonly metadata: PublicationWireBatchMetadata
  readonly deliveries: SharedDelivery[]
}

const rebuildPublication = (
  publicationId: string,
  chunks: readonly PublicationWireChunk[]
): SharedPublication => {
  const first = chunks[0]
  if (!first) {
    throw new TypeError('[collaboration] missing publication frame chunks')
  }
  if (
    chunks.some(
      (chunk) =>
        chunk.artifactId !== first.artifactId ||
        chunk.transactionId !== first.transactionId ||
        chunk.origin !== first.origin ||
        !areJsonTransportValuesEqual(chunk.deliveryPlan, first.deliveryPlan)
    )
  ) {
    throw new TypeError('[collaboration] inconsistent publication frame chunks')
  }
  const batches: MutablePublicationBatch[] = []
  const batchesById = new Map<string, MutablePublicationBatch>()
  chunks
    .flatMap(({ units }) => units)
    .forEach(({ batch, delivery }) => {
      const existing = batchesById.get(batch.batchId)
      if (existing) {
        if (batches[batches.length - 1] !== existing) {
          throw new TypeError(
            '[collaboration] non-contiguous publication batch chunks'
          )
        }
        if (!areJsonTransportValuesEqual(existing.metadata, batch)) {
          throw new TypeError(
            '[collaboration] inconsistent publication batch chunks'
          )
        }
        existing.deliveries.push(delivery)
        return
      }
      const created = { metadata: batch, deliveries: [delivery] }
      batchesById.set(batch.batchId, created)
      batches.push(created)
    })
  const rebuiltBatches: SharedDeliveryBatch[] = batches.map(
    ({ metadata, deliveries }) => ({
      ...metadata,
      deliveries,
      records: deliveries.map(({ record }) => record),
      changes: deliveries.map(({ payload }) => payload)
    })
  )
  const publication: SharedPublication = {
    publicationId,
    artifactId: first.artifactId,
    transactionId: first.transactionId,
    origin: first.origin,
    deliveries: rebuiltBatches.flatMap(({ deliveries }) => deliveries),
    batches: rebuiltBatches,
    deliveryPlan: first.deliveryPlan
  }
  if (!isSharedPublication(publication)) {
    throw new TypeError('[collaboration] invalid decoded shared publication')
  }
  return publication
}

interface DecodedPublicationFramePart {
  readonly header: ReturnType<typeof inspectPublicationFrame>
  readonly payload: Uint8Array
}

const decodePublicationWirePayload = (
  bytes: Uint8Array
): PublicationWireChunk => {
  if (bytes.byteLength < PUBLICATION_PAYLOAD_FIXED_BYTES) {
    throw new TypeError('[collaboration] truncated publication wire payload')
  }
  if (PUBLICATION_PAYLOAD_MAGIC.some((byte, index) => bytes[index] !== byte)) {
    throw new TypeError('[collaboration] invalid publication wire payload')
  }
  if (bytes[4] !== PUBLICATION_PAYLOAD_VERSION) {
    throw new TypeError(
      `[collaboration] unsupported publication payload version: ${String(bytes[4])}`
    )
  }
  if (bytes[5] !== 0 || bytes[6] !== 0 || bytes[7] !== 0) {
    throw new TypeError('[collaboration] invalid publication wire payload')
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const metadataByteLength = view.getUint32(8, true)
  const unitCount = view.getUint32(12, true)
  if (metadataByteLength === 0 || unitCount === 0) {
    throw new TypeError('[collaboration] invalid publication wire payload')
  }
  let offset = PUBLICATION_PAYLOAD_FIXED_BYTES
  const metadataEnd = offset + metadataByteLength
  if (metadataEnd > bytes.byteLength) {
    throw new TypeError('[collaboration] truncated publication wire metadata')
  }
  const metadata = decodeCompactBinary(bytes.subarray(offset, metadataEnd))
  if (!isPublicationWireMetadata(metadata)) {
    throw new TypeError('[collaboration] invalid publication wire metadata')
  }
  offset = metadataEnd
  const units: PublicationWireUnit[] = []
  for (let index = 0; index < unitCount; index += 1) {
    if (offset + PUBLICATION_PAYLOAD_UNIT_LENGTH_BYTES > bytes.byteLength) {
      throw new TypeError('[collaboration] truncated publication wire unit')
    }
    const unitByteLength = view.getUint32(offset, true)
    offset += PUBLICATION_PAYLOAD_UNIT_LENGTH_BYTES
    const unitEnd = offset + unitByteLength
    if (unitByteLength === 0 || unitEnd > bytes.byteLength) {
      throw new TypeError('[collaboration] truncated publication wire unit')
    }
    const unit = decodeCompactBinary(bytes.subarray(offset, unitEnd))
    if (!isPublicationWireUnit(unit, metadata)) {
      throw new TypeError('[collaboration] invalid publication wire unit')
    }
    units.push(unit)
    offset = unitEnd
  }
  if (offset !== bytes.byteLength) {
    throw new TypeError('[collaboration] trailing publication wire payload')
  }
  const chunk = { ...metadata, units }
  if (!isPublicationWireChunk(chunk)) {
    throw new TypeError('[collaboration] invalid publication wire payload')
  }
  return chunk
}

const decodePublicationFrameParts = (
  inputs: readonly (ArrayBuffer | ArrayBufferView)[]
): readonly DecodedPublicationFramePart[] =>
  inputs.map((input) => {
    const header = inspectPublicationFrame(input)
    const bytes = asPublicationFrameBytes(input)
    const payload = bytes.subarray(
      header.payloadOffset,
      header.payloadOffset + header.payloadByteLength
    )
    return { header, payload }
  })

export interface DecodedPublicationFrame {
  readonly header: PublicationFrameHeader
  readonly publication: SharedPublication
}

const decodePublicationFromParts = (
  decoded: readonly DecodedPublicationFramePart[]
): DecodedPublicationFrame => {
  const first = decoded[0]
  if (
    !first ||
    decoded.length !== first.header.chunkCount ||
    decoded.some(
      ({ header }, chunkIndex) =>
        header.messageType !== first.header.messageType ||
        header.requestId !== first.header.requestId ||
        header.fromActorId !== first.header.fromActorId ||
        header.publicationId !== first.header.publicationId ||
        header.publicationIndex !== first.header.publicationIndex ||
        header.publicationCount !== first.header.publicationCount ||
        header.chunkCount !== first.header.chunkCount ||
        header.chunkIndex !== chunkIndex
    )
  ) {
    throw new TypeError('[collaboration] missing publication frame chunks')
  }
  const payloadByteLength = decoded.reduce(
    (total, { payload }) => total + payload.byteLength,
    0
  )
  if (!Number.isSafeInteger(payloadByteLength) || payloadByteLength === 0) {
    throw new TypeError('[collaboration] invalid publication frame payload')
  }
  const payload = new Uint8Array(payloadByteLength)
  let payloadOffset = 0
  for (const part of decoded) {
    payload.set(part.payload, payloadOffset)
    payloadOffset += part.payload.byteLength
  }
  const chunk = decodePublicationWirePayload(payload)
  const { payloadOffset: _payloadOffset, ...header } = first.header
  return {
    header,
    publication: rebuildPublication(first.header.publicationId, [chunk])
  }
}

export const decodePublicationFramePublication = (
  inputs: readonly (ArrayBuffer | ArrayBufferView)[]
): DecodedPublicationFrame => {
  if (inputs.length === 0) {
    throw new TypeError('[collaboration] missing publication frame chunks')
  }
  return decodePublicationFromParts(decodePublicationFrameParts(inputs))
}

export const decodePublicationMessageFrames = (
  inputs: readonly (ArrayBuffer | ArrayBufferView)[]
): PublicationFrameMessage => {
  if (inputs.length === 0) {
    throw new TypeError('[collaboration] missing publication frames')
  }
  const decoded = decodePublicationFrameParts(inputs)
  const first = decoded[0]
  if (!first) {
    throw new TypeError('[collaboration] missing publication frames')
  }
  if (
    decoded.some(
      ({ header }) =>
        header.messageType !== first.header.messageType ||
        header.requestId !== first.header.requestId ||
        header.fromActorId !== first.header.fromActorId ||
        header.publicationCount !== first.header.publicationCount
    )
  ) {
    throw new TypeError('[collaboration] inconsistent publication frames')
  }
  const publications: SharedPublication[] = []
  let cursor = 0
  for (
    let publicationIndex = 0;
    publicationIndex < first.header.publicationCount;
    publicationIndex += 1
  ) {
    const publicationFrames = decoded.slice(
      cursor,
      cursor + (decoded[cursor]?.header.chunkCount ?? 0)
    )
    const publicationHeader = publicationFrames[0]?.header
    if (
      !publicationHeader ||
      publicationHeader.publicationIndex !== publicationIndex ||
      publicationFrames.length !== publicationHeader.chunkCount ||
      publicationFrames.some(
        ({ header }, chunkIndex) =>
          header.publicationIndex !== publicationIndex ||
          header.publicationId !== publicationHeader.publicationId ||
          header.chunkCount !== publicationHeader.chunkCount ||
          header.chunkIndex !== chunkIndex
      )
    ) {
      throw new TypeError('[collaboration] missing publication frame chunks')
    }
    publications.push(decodePublicationFromParts(publicationFrames).publication)
    cursor += publicationFrames.length
  }
  if (cursor !== decoded.length) {
    throw new TypeError('[collaboration] trailing publication frames')
  }
  const publicationIds = new Set<string>()
  for (const publication of publications) {
    if (publicationIds.has(publication.publicationId)) {
      throw new TypeError('[collaboration] duplicate publication identity')
    }
    publicationIds.add(publication.publicationId)
  }
  switch (first.header.messageType) {
    case CollaborationMessageTypes.SEND_PUBLICATION:
      if (publications.length !== 1 || !first.header.requestId) {
        throw new TypeError('[collaboration] invalid publication request frame')
      }
      return {
        type: first.header.messageType,
        requestId: first.header.requestId,
        publication: publications[0] as SharedPublication
      }
    case CollaborationMessageTypes.SEND_PUBLICATIONS:
      if (!first.header.requestId) {
        throw new TypeError('[collaboration] invalid publication request frame')
      }
      return {
        type: first.header.messageType,
        requestId: first.header.requestId,
        publications
      }
    case CollaborationMessageTypes.PUBLICATION:
      if (publications.length !== 1) {
        throw new TypeError('[collaboration] invalid publication relay frame')
      }
      return {
        type: first.header.messageType,
        publication: publications[0] as SharedPublication,
        ...(first.header.fromActorId
          ? { fromActorId: first.header.fromActorId }
          : {})
      }
    case CollaborationMessageTypes.PUBLICATIONS:
      return {
        type: first.header.messageType,
        publications,
        ...(first.header.fromActorId
          ? { fromActorId: first.header.fromActorId }
          : {})
      }
  }
}

export type EncodedCollaborationMessage = string | Uint8Array
export type EncodedCollaborationMessageInput =
  | string
  | ArrayBuffer
  | ArrayBufferView

const collaborationControlMessageTypes = new Set<string>([
  CollaborationMessageTypes.HELLO,
  CollaborationMessageTypes.SEND_AWARENESS,
  CollaborationMessageTypes.FRAME_CONSUMED,
  CollaborationMessageTypes.PEER_APPLIED,
  CollaborationMessageTypes.SOURCE_FRAME_ADMITTED,
  CollaborationMessageTypes.READY,
  CollaborationMessageTypes.RESPONSE,
  CollaborationMessageTypes.AWARENESS,
  CollaborationMessageTypes.AWARENESS_DISCONNECT,
  CollaborationMessageTypes.FAILURE,
  CollaborationMessageTypes.CONNECTION_ERROR
])

export const encodeCollaborationControlMessage = (value: unknown): string => {
  if (!analyzeJsonTransportValue(value)) {
    throw new TypeError(
      '[collaboration] control message contains a value that JSON cannot preserve'
    )
  }
  const encoded = JSON.stringify(value)
  if (encoded === undefined) {
    throw new TypeError(
      '[collaboration] control message contains a value that JSON cannot preserve'
    )
  }
  return encoded
}

export const decodeCollaborationControlMessage = (encoded: string): unknown =>
  decodeCompactJson(encoded)

export const encodeCollaborationMessage = (
  value: unknown
): EncodedCollaborationMessage => {
  if (
    isRecord(value) &&
    (value.type === CollaborationMessageTypes.SEND_PUBLICATION ||
      value.type === CollaborationMessageTypes.SEND_PUBLICATIONS ||
      value.type === CollaborationMessageTypes.PUBLICATION ||
      value.type === CollaborationMessageTypes.PUBLICATIONS)
  ) {
    const frames = encodePublicationMessageFrames(
      value as unknown as PublicationFrameMessage
    )
    const frame = frames[0]
    if (!frame || frames.length !== 1) {
      throw new TypeError(
        '[collaboration] publication message requires framed transport'
      )
    }
    return new Uint8Array(frame)
  }
  if (
    isRecord(value) &&
    typeof value.type === 'string' &&
    collaborationControlMessageTypes.has(value.type)
  ) {
    return encodeCollaborationControlMessage(value)
  }
  const analysis = analyzeJsonTransportValue(value)
  if (!analysis) {
    throw new TypeError(
      '[collaboration] message contains a value that JSON cannot preserve'
    )
  }
  if (analysis.maximumDepth > MAX_RECURSIVE_JSON_TRANSPORT_DEPTH) {
    return encodeCompactBinary(value)
  }
  const plain = JSON.stringify(value)
  if (plain === undefined) {
    throw new TypeError(
      '[collaboration] message contains a value that JSON cannot preserve'
    )
  }
  const compactBinary = encodeCompactBinaryIfSmaller(value, plain)
  return compactBinary instanceof Uint8Array
    ? compactBinary
    : encodeCompactJsonIfSmaller(value, plain)
}

export const decodeCollaborationMessage = (
  encoded: EncodedCollaborationMessageInput
): unknown => {
  if (typeof encoded === 'string') {
    return decodeCollaborationControlMessage(encoded)
  }
  if (!isPublicationFrame(encoded)) {
    throw new TypeError(
      '[collaboration] binary collaboration message must be a publication frame'
    )
  }
  return decodePublicationMessageFrames([encoded])
}

const isProviderIdentity = (value: unknown): value is ProviderIdentity =>
  isRecord(value) &&
  isNonBlankString(value.documentId) &&
  isNonBlankString(value.roomId) &&
  isNonBlankString(value.actorId) &&
  (value.connectionMetadata === undefined || isRecord(value.connectionMetadata))

const isAwarenessMessage = (
  value: unknown
): value is ProviderAwarenessMessage =>
  isRecord(value) &&
  isNonBlankString(value.actorId) &&
  typeof value.clock === 'number' &&
  Number.isFinite(value.clock) &&
  Object.prototype.hasOwnProperty.call(value, 'state')

const isFailurePayload = (
  value: unknown
): value is CollaborationFailurePayload =>
  isRecord(value) &&
  isNonBlankString(value.code) &&
  isNonBlankString(value.message)

const isOptionalNonBlankString = (
  value: unknown
): value is string | undefined => value === undefined || isNonBlankString(value)

const isNonEmptyPublicationArray = (
  value: unknown
): value is readonly SharedPublication[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every((publication) => isSharedPublication(publication))

export const parseCollaborationClientMessage = (
  value: unknown
): CollaborationClientMessage | undefined => {
  if (
    !isJsonTransportValue(value) ||
    !isRecord(value) ||
    !isNonBlankString(value.type)
  ) {
    return
  }
  switch (value.type) {
    case CollaborationMessageTypes.HELLO:
      return isProviderIdentity(value.identity)
        ? { type: value.type, identity: value.identity }
        : undefined
    case CollaborationMessageTypes.SEND_PUBLICATION:
      return isNonBlankString(value.requestId) &&
        isSharedPublication(value.publication)
        ? {
            type: value.type,
            requestId: value.requestId,
            publication: value.publication
          }
        : undefined
    case CollaborationMessageTypes.SEND_PUBLICATIONS:
      return isNonBlankString(value.requestId) &&
        isNonEmptyPublicationArray(value.publications)
        ? {
            type: value.type,
            requestId: value.requestId,
            publications: value.publications
          }
        : undefined
    case CollaborationMessageTypes.SEND_AWARENESS:
      return isNonBlankString(value.requestId) &&
        isAwarenessMessage(value.message)
        ? {
            type: value.type,
            requestId: value.requestId,
            message: value.message
          }
        : undefined
    case CollaborationMessageTypes.FRAME_CONSUMED:
      return isNonBlankString(value.requestId) &&
        isNonBlankString(value.frameId) &&
        isNonBlankString(value.publicationId) &&
        isPositiveInteger(value.frameByteLength)
        ? {
            type: value.type,
            requestId: value.requestId,
            frameId: value.frameId,
            publicationId: value.publicationId,
            frameByteLength: value.frameByteLength
          }
        : undefined
    case CollaborationMessageTypes.PEER_APPLIED:
      return isNonBlankString(value.requestId) &&
        isNonBlankString(value.publicationId) &&
        isNonBlankString(value.fromActorId)
        ? {
            type: value.type,
            requestId: value.requestId,
            publicationId: value.publicationId,
            fromActorId: value.fromActorId
          }
        : undefined
  }
}

export const parseCollaborationServerMessage = (
  value: unknown
): CollaborationServerMessage | undefined => {
  if (
    !isJsonTransportValue(value) ||
    !isRecord(value) ||
    !isNonBlankString(value.type)
  ) {
    return
  }
  switch (value.type) {
    case CollaborationMessageTypes.READY:
      return { type: value.type }
    case CollaborationMessageTypes.RESPONSE:
      if (!isNonBlankString(value.requestId) || typeof value.ok !== 'boolean') {
        return
      }
      if (value.ok) {
        return { type: value.type, requestId: value.requestId, ok: true }
      }
      if (!isFailurePayload(value.error)) {
        return
      }
      return {
        type: value.type,
        requestId: value.requestId,
        ok: false,
        error: value.error
      }
    case CollaborationMessageTypes.SOURCE_FRAME_ADMITTED:
      return isNonBlankString(value.requestId) &&
        isNonBlankString(value.frameId) &&
        isNonBlankString(value.publicationId) &&
        isPositiveInteger(value.frameByteLength)
        ? {
            type: value.type,
            requestId: value.requestId,
            frameId: value.frameId,
            publicationId: value.publicationId,
            frameByteLength: value.frameByteLength
          }
        : undefined
    case CollaborationMessageTypes.PUBLICATION:
      return isSharedPublication(value.publication) &&
        isOptionalNonBlankString(value.fromActorId)
        ? {
            type: value.type,
            publication: value.publication,
            ...(value.fromActorId ? { fromActorId: value.fromActorId } : {})
          }
        : undefined
    case CollaborationMessageTypes.PUBLICATIONS:
      return isNonEmptyPublicationArray(value.publications) &&
        isOptionalNonBlankString(value.fromActorId)
        ? {
            type: value.type,
            publications: value.publications,
            ...(value.fromActorId ? { fromActorId: value.fromActorId } : {})
          }
        : undefined
    case CollaborationMessageTypes.AWARENESS:
      return isAwarenessMessage(value)
        ? {
            type: value.type,
            actorId: value.actorId,
            clock: value.clock,
            state: value.state
          }
        : undefined
    case CollaborationMessageTypes.AWARENESS_DISCONNECT:
      return isNonBlankString(value.actorId) && value.reason === 'disconnect'
        ? { type: value.type, actorId: value.actorId, reason: 'disconnect' }
        : undefined
    case CollaborationMessageTypes.FAILURE:
    case CollaborationMessageTypes.CONNECTION_ERROR:
      return isNonBlankString(value.code) &&
        isNonBlankString(value.message) &&
        isOptionalNonBlankString(value.publicationId)
        ? {
            type: value.type,
            code: value.code,
            message: value.message,
            ...(value.publicationId
              ? { publicationId: value.publicationId }
              : {})
          }
        : undefined
  }
}
