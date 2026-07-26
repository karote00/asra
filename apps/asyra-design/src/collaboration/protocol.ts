import type { SharedDelivery, SharedPublication } from '@asyra/factory'
import type {
  ProviderAwarenessDisconnect,
  ProviderAwarenessMessage,
  ProviderIdentity
} from '@asyra/collaboration'
import { isRecord } from '@asyra/utils'
import {
  decodeCompactBinary,
  encodeCompactBinary,
  encodeCompactBinaryIfSmaller
} from './compact-binary'
import { decodeCompactJson, encodeCompactJsonIfSmaller } from './compact-json'
import { isNonBlankString } from './wire-values'

export const CollaborationMessageTypes = {
  HELLO: 'hello',
  SEND_PUBLICATION: 'send-publication',
  SEND_PUBLICATIONS: 'send-publications',
  SEND_AWARENESS: 'send-awareness',
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

export type CollaborationRequestMessage =
  | SendPublicationRequest
  | SendPublicationsRequest
  | SendAwarenessRequest

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

const isSharedDelivery = (value: unknown): value is SharedDelivery =>
  isRecord(value) &&
  isNonBlankString(value.deliveryId) &&
  isPositiveInteger(value.transactionId) &&
  sharedDeliveryOrigins.has(value.origin as SharedDelivery['origin']) &&
  (value.kind === 'forward' || value.kind === 'compensation') &&
  isNonBlankString(value.channel) &&
  isNonBlankString(value.eventName) &&
  Object.prototype.hasOwnProperty.call(value, 'payload') &&
  (value.sharedDelivery === 'transaction-end' ||
    value.sharedDelivery === 'immediate') &&
  (value.compensatesDeliveryId === undefined ||
    isNonBlankString(value.compensatesDeliveryId))

export const isSharedPublication = (
  value: unknown
): value is SharedPublication =>
  isRecord(value) &&
  isNonBlankString(value.publicationId) &&
  isPositiveInteger(value.transactionId) &&
  sharedDeliveryOrigins.has(value.origin as SharedDelivery['origin']) &&
  Array.isArray(value.deliveries) &&
  value.deliveries.every(
    (delivery) =>
      isSharedDelivery(delivery) &&
      delivery.transactionId === value.transactionId &&
      delivery.origin === value.origin
  )

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

export type EncodedCollaborationMessage = string | Uint8Array
export type EncodedCollaborationMessageInput =
  | string
  | ArrayBuffer
  | ArrayBufferView

export const encodeCollaborationMessage = (
  value: unknown
): EncodedCollaborationMessage => {
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
): unknown =>
  typeof encoded === 'string'
    ? decodeCompactJson(encoded)
    : decodeCompactBinary(encoded)

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
