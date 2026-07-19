import type { SharedDelivery, SharedDeliveryOrigin } from '@asyra/factory'
import type { OperationDefinition } from './operation-registry'
import { OperationRegistry } from './operation-registry'

export const COLLABORATION_PROTOCOL_VERSION = 1 as const

export type LocalOperationRejectionCode =
  | 'unregistered-operation'
  | 'invalid-payload'
  | 'invalid-compensation'
  | 'invalid-identity'

export class LocalOperationRejection extends Error {
  readonly code: LocalOperationRejectionCode
  readonly channel: string
  readonly eventName: string

  constructor(
    code: LocalOperationRejectionCode,
    delivery: Pick<SharedDelivery, 'channel' | 'eventName'>,
    message: string
  ) {
    super(message)
    this.name = 'LocalOperationRejection'
    this.code = code
    this.channel = delivery.channel
    this.eventName = delivery.eventName
  }
}

export interface SharedOperationEnvelope<TPayload = unknown> {
  readonly operationId: string
  readonly transactionId: string
  readonly documentId: string
  readonly actorId: string
  readonly protocolVersion: typeof COLLABORATION_PROTOCOL_VERSION
  readonly schemaVersion: number
  readonly origin: SharedDeliveryOrigin
  readonly channel: string
  readonly eventName: string
  readonly payload: TPayload
  readonly compensatesOperationId?: string
}

export interface OperationIdentitySource {
  operationId(actorId: string, deliveryId: string): string
  transactionId(actorId: string, transactionId: number): string
}

const requireIdentityPart = (name: string, value: string): string => {
  if (!value.trim()) {
    throw new Error(`[collaboration] ${name} is required for operation identity`)
  }
  return encodeURIComponent(value)
}

export const createOperationIdentitySource = (
  sessionId: string
): OperationIdentitySource => {
  const session = requireIdentityPart('sessionId', sessionId)
  const prefix = (actorId: string): string =>
    `${requireIdentityPart('actorId', actorId)}:${session}`

  return Object.freeze({
    operationId: (actorId: string, deliveryId: string): string =>
      `${prefix(actorId)}:${requireIdentityPart('deliveryId', deliveryId)}`,
    transactionId: (actorId: string, transactionId: number): string => {
      if (!Number.isSafeInteger(transactionId) || transactionId < 0) {
        throw new Error(
          '[collaboration] transactionId must be a non-negative safe integer'
        )
      }
      return `${prefix(actorId)}:${transactionId}`
    }
  })
}

const cloneValue = <T>(
  value: T,
  seen = new WeakMap<object, unknown>()
): T => {
  if (value === null || typeof value !== 'object') return value
  const source = value as object
  const existing = seen.get(source)
  if (existing) return existing as T

  const clone: object = Array.isArray(value)
    ? []
    : Object.create(Object.getPrototypeOf(value))
  seen.set(source, clone)
  Reflect.ownKeys(source).forEach((key) => {
    if (Array.isArray(source) && key === 'length') return
    const descriptor = Object.getOwnPropertyDescriptor(source, key)
    if (!descriptor) return
    Object.defineProperty(clone, key, {
      value: cloneValue(Reflect.get(source, key), seen),
      enumerable: descriptor.enumerable,
      configurable: true,
      writable: true
    })
  })
  if (Array.isArray(source) && Array.isArray(clone)) {
    clone.length = source.length
  }
  return clone as T
}

const freezeValue = <T>(value: T, seen = new WeakSet<object>()): T => {
  if (value === null || typeof value !== 'object') return value
  const object = value as object
  if (seen.has(object)) return value
  seen.add(object)
  Reflect.ownKeys(object).forEach((key) =>
    freezeValue(Reflect.get(object, key), seen)
  )
  return Object.freeze(value)
}

const validateCompensation = (delivery: SharedDelivery): void => {
  const hasCompensation = delivery.compensatesDeliveryId !== undefined
  if (
    (delivery.kind === 'compensation' && !hasCompensation) ||
    (delivery.kind === 'forward' && hasCompensation)
  ) {
    throw new LocalOperationRejection(
      'invalid-compensation',
      delivery,
      '[collaboration] compensation must name exactly one forwarded delivery'
    )
  }
}

const requireDefinition = <TPayload>(
  registry: OperationRegistry,
  delivery: SharedDelivery<TPayload>
): OperationDefinition<TPayload> => {
  const definition = registry.resolve<TPayload>(
    delivery.channel,
    delivery.eventName
  )
  if (!definition) {
    throw new LocalOperationRejection(
      'unregistered-operation',
      delivery,
      `[collaboration] unregistered operation ${delivery.channel}/${delivery.eventName}`
    )
  }
  return definition
}

export interface CreateSharedOperationEnvelopeInput<TPayload> {
  delivery: SharedDelivery<TPayload>
  identity: Readonly<{ documentId: string; actorId: string }>
  identitySource: OperationIdentitySource
  registry: OperationRegistry
}

export const createSharedOperationEnvelope = <TPayload>({
  delivery,
  identity,
  identitySource,
  registry
}: CreateSharedOperationEnvelopeInput<TPayload>): SharedOperationEnvelope<TPayload> => {
  validateCompensation(delivery)
  const definition = requireDefinition(registry, delivery)
  const payload = cloneValue(delivery.payload)
  if (!definition.validate(payload)) {
    throw new LocalOperationRejection(
      'invalid-payload',
      delivery,
      `[collaboration] invalid payload for ${delivery.channel}/${delivery.eventName}`
    )
  }

  let operationId: string
  let transactionId: string
  let compensatesOperationId: string | undefined
  try {
    operationId = identitySource.operationId(
      identity.actorId,
      delivery.deliveryId
    )
    transactionId = identitySource.transactionId(
      identity.actorId,
      delivery.transactionId
    )
    compensatesOperationId = delivery.compensatesDeliveryId
      ? identitySource.operationId(
          identity.actorId,
          delivery.compensatesDeliveryId
        )
      : undefined
    requireIdentityPart('operationId', operationId)
    requireIdentityPart('transactionId', transactionId)
    requireIdentityPart('documentId', identity.documentId)
    requireIdentityPart('actorId', identity.actorId)
  } catch (error) {
    throw new LocalOperationRejection(
      'invalid-identity',
      delivery,
      error instanceof Error ? error.message : '[collaboration] invalid identity'
    )
  }

  return freezeValue({
    operationId,
    transactionId,
    documentId: identity.documentId,
    actorId: identity.actorId,
    protocolVersion: COLLABORATION_PROTOCOL_VERSION,
    schemaVersion: definition.schemaVersion,
    origin: delivery.origin,
    channel: delivery.channel,
    eventName: delivery.eventName,
    payload,
    ...(compensatesOperationId ? { compensatesOperationId } : {})
  })
}
