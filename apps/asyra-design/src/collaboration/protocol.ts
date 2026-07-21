import type {
  ProviderIdentity,
  ProviderAcknowledgement,
  ProviderAwarenessDisconnect,
  ProviderAwarenessMessage
} from '@asyra/collaboration'
import { isRecord } from '@asyra/utils'

export const CollaborationMessageTypes = {
  HELLO: 'hello',
  SEND_UPDATE: 'send-update',
  REQUEST_SYNC: 'request-sync',
  EXCHANGE_STATE_VECTOR: 'exchange-state-vector',
  SEND_SYNC_UPDATE: 'send-sync-update',
  SEND_AWARENESS: 'send-awareness',
  READY: 'ready',
  RESPONSE: 'response',
  UPDATE: 'update',
  ACKNOWLEDGEMENT: 'acknowledgement',
  AWARENESS: 'awareness',
  AWARENESS_DISCONNECT: 'awareness-disconnect',
  FAILURE: 'failure',
  CONNECTION_ERROR: 'connection-error'
} as const

export interface CollaborationHelloMessage {
  readonly type: typeof CollaborationMessageTypes.HELLO
  readonly identity: ProviderIdentity
}

export type CollaborationRequestMessage =
  | {
      readonly type: typeof CollaborationMessageTypes.SEND_UPDATE
      readonly requestId: string
      readonly operationId: string
      readonly update: string
    }
  | {
      readonly type:
        | typeof CollaborationMessageTypes.REQUEST_SYNC
        | typeof CollaborationMessageTypes.EXCHANGE_STATE_VECTOR
      readonly requestId: string
      readonly stateVector: string
    }
  | {
      readonly type: typeof CollaborationMessageTypes.SEND_SYNC_UPDATE
      readonly requestId: string
      readonly update: string
    }
  | {
      readonly type: typeof CollaborationMessageTypes.SEND_AWARENESS
      readonly requestId: string
      readonly message: ProviderAwarenessMessage
    }

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

export type CollaborationServerMessage =
  | { readonly type: typeof CollaborationMessageTypes.READY }
  | {
      readonly type: typeof CollaborationMessageTypes.RESPONSE
      readonly requestId: string
      readonly ok: true
      readonly result?: unknown
    }
  | {
      readonly type: typeof CollaborationMessageTypes.RESPONSE
      readonly requestId: string
      readonly ok: false
      readonly error: CollaborationFailurePayload
    }
  | {
      readonly type: typeof CollaborationMessageTypes.UPDATE
      readonly operationId: string
      readonly update: string
      readonly fromActorId?: string
    }
  | ({
      readonly type: typeof CollaborationMessageTypes.ACKNOWLEDGEMENT
    } & ProviderAcknowledgement)
  | ({
      readonly type: typeof CollaborationMessageTypes.AWARENESS
    } & ProviderAwarenessMessage)
  | ({
      readonly type: typeof CollaborationMessageTypes.AWARENESS_DISCONNECT
    } & ProviderAwarenessDisconnect)
  | {
      readonly type:
        | typeof CollaborationMessageTypes.FAILURE
        | typeof CollaborationMessageTypes.CONNECTION_ERROR
      readonly code: string
      readonly message: string
      readonly operationId?: string
    }

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const isOptionalString = (value: unknown): value is string | undefined =>
  value === undefined || typeof value === 'string'

const isBase64 = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length % 4 === 0 &&
  /^(?:[A-Za-z\d+/]{4})*(?:[A-Za-z\d+/]{2}==|[A-Za-z\d+/]{3}=)?$/.test(value)

const isProviderIdentity = (value: unknown): value is ProviderIdentity =>
  isRecord(value) &&
  isNonEmptyString(value.documentId) &&
  isNonEmptyString(value.roomId) &&
  isNonEmptyString(value.actorId) &&
  (value.connectionMetadata === undefined || isRecord(value.connectionMetadata))

const isAwarenessMessage = (
  value: unknown
): value is ProviderAwarenessMessage =>
  isRecord(value) &&
  isNonEmptyString(value.actorId) &&
  typeof value.clock === 'number' &&
  Number.isFinite(value.clock) &&
  Object.prototype.hasOwnProperty.call(value, 'state')

const isFailurePayload = (
  value: unknown
): value is CollaborationFailurePayload =>
  isRecord(value) &&
  isNonEmptyString(value.code) &&
  isNonEmptyString(value.message)

export const parseCollaborationClientMessage = (
  value: unknown
): CollaborationClientMessage | undefined => {
  if (!isRecord(value) || !isNonEmptyString(value.type)) return undefined

  switch (value.type) {
    case CollaborationMessageTypes.HELLO:
      return isProviderIdentity(value.identity)
        ? { type: value.type, identity: value.identity }
        : undefined
    case CollaborationMessageTypes.SEND_UPDATE:
      return isNonEmptyString(value.requestId) &&
        isNonEmptyString(value.operationId) &&
        isBase64(value.update)
        ? {
            type: value.type,
            requestId: value.requestId,
            operationId: value.operationId,
            update: value.update
          }
        : undefined
    case CollaborationMessageTypes.REQUEST_SYNC:
    case CollaborationMessageTypes.EXCHANGE_STATE_VECTOR:
      return isNonEmptyString(value.requestId) && isBase64(value.stateVector)
        ? {
            type: value.type,
            requestId: value.requestId,
            stateVector: value.stateVector
          }
        : undefined
    case CollaborationMessageTypes.SEND_SYNC_UPDATE:
      return isNonEmptyString(value.requestId) && isBase64(value.update)
        ? {
            type: value.type,
            requestId: value.requestId,
            update: value.update
          }
        : undefined
    case CollaborationMessageTypes.SEND_AWARENESS:
      return isNonEmptyString(value.requestId) &&
        isAwarenessMessage(value.message)
        ? {
            type: value.type,
            requestId: value.requestId,
            message: value.message
          }
        : undefined
    default:
      return undefined
  }
}

export const parseCollaborationServerMessage = (
  value: unknown
): CollaborationServerMessage | undefined => {
  if (!isRecord(value) || !isNonEmptyString(value.type)) return undefined

  switch (value.type) {
    case CollaborationMessageTypes.READY:
      return { type: value.type }
    case CollaborationMessageTypes.RESPONSE:
      if (!isNonEmptyString(value.requestId) || typeof value.ok !== 'boolean') {
        return undefined
      }
      if (!value.ok) {
        return isFailurePayload(value.error)
          ? {
              type: value.type,
              requestId: value.requestId,
              ok: false,
              error: value.error
            }
          : undefined
      }
      return {
        type: value.type,
        requestId: value.requestId,
        ok: true,
        ...(Object.prototype.hasOwnProperty.call(value, 'result')
          ? { result: value.result }
          : {})
      }
    case CollaborationMessageTypes.UPDATE:
      return isNonEmptyString(value.operationId) &&
        isBase64(value.update) &&
        isOptionalString(value.fromActorId)
        ? {
            type: value.type,
            operationId: value.operationId,
            update: value.update,
            ...(value.fromActorId ? { fromActorId: value.fromActorId } : {})
          }
        : undefined
    case CollaborationMessageTypes.ACKNOWLEDGEMENT:
      return isNonEmptyString(value.operationId) &&
        value.durability === 'durable'
        ? {
            type: value.type,
            operationId: value.operationId,
            durability: value.durability
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
      return isNonEmptyString(value.actorId) && value.reason === 'disconnect'
        ? {
            type: value.type,
            actorId: value.actorId,
            reason: value.reason
          }
        : undefined
    case CollaborationMessageTypes.FAILURE:
    case CollaborationMessageTypes.CONNECTION_ERROR:
      return isNonEmptyString(value.code) &&
        isNonEmptyString(value.message) &&
        isOptionalString(value.operationId)
        ? {
            type: value.type,
            code: value.code,
            message: value.message,
            ...(value.operationId ? { operationId: value.operationId } : {})
          }
        : undefined
    default:
      return undefined
  }
}
