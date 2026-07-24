import type { SharedDelivery, SharedPublication } from '@asyra/factory'
import type {
  ProviderAwarenessDisconnect,
  ProviderAwarenessMessage,
  ProviderIdentity
} from '@asyra/collaboration'
import { isRecord } from '@asyra/utils'
import { isNonBlankString } from './wire-values'

export const CollaborationMessageTypes = {
  HELLO: 'hello',
  SEND_PUBLICATION: 'send-publication',
  SEND_AWARENESS: 'send-awareness',
  READY: 'ready',
  RESPONSE: 'response',
  PUBLICATION: 'publication',
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

export interface SendAwarenessRequest {
  readonly type: typeof CollaborationMessageTypes.SEND_AWARENESS
  readonly requestId: string
  readonly message: ProviderAwarenessMessage
}

export type CollaborationRequestMessage =
  | SendPublicationRequest
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

const isJsonTransportValueInternal = (
  value: unknown,
  ancestors: Set<object>
): boolean => {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return true
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) && !Object.is(value, -0)
  }
  if (typeof value !== 'object') return false

  const objectValue = value as object
  if (ancestors.has(objectValue)) return false
  ancestors.add(objectValue)
  try {
    if (Array.isArray(value)) {
      const keys = Reflect.ownKeys(value)
      if (keys.length !== value.length + 1) return false
      return keys.every((key) => {
        if (key === 'length') return true
        if (typeof key !== 'string') return false
        const index = Number(key)
        if (
          !Number.isInteger(index) ||
          index < 0 ||
          index >= value.length ||
          String(index) !== key
        ) {
          return false
        }
        const descriptor = Object.getOwnPropertyDescriptor(value, key)
        return (
          descriptor?.enumerable === true &&
          'value' in descriptor &&
          isJsonTransportValueInternal(descriptor.value, ancestors)
        )
      })
    }

    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) return false
    return Reflect.ownKeys(value).every((key) => {
      if (typeof key !== 'string') return false
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      return (
        descriptor?.enumerable === true &&
        'value' in descriptor &&
        isJsonTransportValueInternal(descriptor.value, ancestors)
      )
    })
  } finally {
    ancestors.delete(objectValue)
  }
}

export const isJsonTransportValue = (value: unknown): boolean =>
  isJsonTransportValueInternal(value, new Set())

export const encodeCollaborationMessage = (value: unknown): string => {
  if (!isJsonTransportValue(value)) {
    throw new TypeError(
      '[collaboration] message contains a value that JSON cannot preserve'
    )
  }
  return JSON.stringify(value)
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
