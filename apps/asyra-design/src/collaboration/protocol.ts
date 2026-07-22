import type { SharedPublication } from '@asyra/factory'
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

export const isSharedPublication = (
  value: unknown
): value is SharedPublication =>
  isRecord(value) &&
  isNonBlankString(value.publicationId) &&
  Array.isArray(value.deliveries) &&
  value.deliveries.every(isRecord)

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

const isOptionalString = (value: unknown): value is string | undefined =>
  value === undefined || typeof value === 'string'

export const parseCollaborationClientMessage = (
  value: unknown
): CollaborationClientMessage | undefined => {
  if (!isRecord(value) || !isNonBlankString(value.type)) return
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
  if (!isRecord(value) || !isNonBlankString(value.type)) return
  switch (value.type) {
    case CollaborationMessageTypes.READY:
      return { type: value.type }
    case CollaborationMessageTypes.RESPONSE:
      if (!isNonBlankString(value.requestId) || typeof value.ok !== 'boolean') {
        return
      }
      return value.ok
        ? { type: value.type, requestId: value.requestId, ok: true }
        : isFailurePayload(value.error)
          ? {
              type: value.type,
              requestId: value.requestId,
              ok: false,
              error: value.error
            }
          : undefined
    case CollaborationMessageTypes.PUBLICATION:
      return isSharedPublication(value.publication) &&
        isOptionalString(value.fromActorId)
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
        isOptionalString(value.publicationId)
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
