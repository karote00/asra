import {
  COLLABORATION_PROTOCOL_VERSION,
  type SharedOperationEnvelope,
  type SharedOperationOrigin
} from './operation-envelope'
import {
  isCanonicalOperationApply,
  OperationRegistry,
  type CanonicalOperationApply
} from './operation-registry'
import type { Factory } from '@asyra/factory'
import type { ConflictAcceptedOperation } from './conflict-policy'

export type ValidationRejectionCode =
  | 'malformed-envelope'
  | 'invalid-operation-id'
  | 'invalid-transaction-id'
  | 'invalid-document-id'
  | 'invalid-actor-id'
  | 'actor-mismatch'
  | 'document-mismatch'
  | 'unsupported-protocol'
  | 'unsupported-schema'
  | 'unsupported-origin'
  | 'invalid-channel'
  | 'invalid-event-name'
  | 'unregistered-operation'
  | 'invalid-payload'
  | 'invalid-compensation'
  | 'compensation-forward-unavailable'
  | 'compensation-forward-actor-mismatch'
  | 'compensation-target-not-forward'
  | 'compensation-forward-not-applied'
  | 'operation-identity-collision'

export interface RemoteValidationRejection {
  readonly status: 'rejected'
  readonly owner: 'validation'
  readonly code: ValidationRejectionCode
  readonly operationId?: string
}

export interface ValidatedRemoteOperation {
  readonly status: 'validated'
  readonly envelope: SharedOperationEnvelope
}

export interface RecordedOperationOutcome {
  readonly status:
    | 'validated'
    | 'accepted'
    | 'repaired'
    | 'rejected'
    | 'apply-failed'
  readonly operationId: string
  readonly applied: boolean
  readonly code?: string
}

export interface DuplicateOperationOutcome {
  readonly status: 'duplicate'
  readonly operationId: string
  readonly recordedOutcome: RecordedOperationOutcome
}

export type RemoteValidationResult =
  | ValidatedRemoteOperation
  | DuplicateOperationOutcome
  | RemoteValidationRejection

interface StoredOutcome {
  readonly fingerprint: string
  readonly actorId: string
  readonly origin: SharedOperationOrigin
  outcome: RecordedOperationOutcome
}

const freezeOutcome = <T extends object>(value: T): Readonly<T> =>
  Object.freeze({ ...value })

export class OperationOutcomeRegistry {
  private readonly outcomes = new Map<string, StoredOutcome>()

  recordLocal(envelope: SharedOperationEnvelope): void {
    const fingerprint = stableSerialize(envelope)
    const existing = this.outcomes.get(envelope.operationId)
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw new Error(
          '[collaboration] local operation identity collides with a recorded outcome'
        )
      }
      return
    }
    this.outcomes.set(envelope.operationId, {
      fingerprint,
      actorId: envelope.actorId,
      origin: envelope.origin,
      outcome: freezeOutcome({
        status: 'accepted',
        operationId: envelope.operationId,
        applied: true
      })
    })
  }

  inspect(
    operationId: string,
    fingerprint: string
  ): DuplicateOperationOutcome | RemoteValidationRejection | undefined {
    const existing = this.outcomes.get(operationId)
    if (!existing) return undefined
    if (existing.fingerprint !== fingerprint) {
      return rejection('operation-identity-collision', operationId)
    }
    return Object.freeze({
      status: 'duplicate',
      operationId,
      recordedOutcome: existing.outcome
    })
  }

  reserve(envelope: SharedOperationEnvelope, fingerprint: string): void {
    this.outcomes.set(envelope.operationId, {
      fingerprint,
      actorId: envelope.actorId,
      origin: envelope.origin,
      outcome: freezeOutcome({
        status: 'validated',
        operationId: envelope.operationId,
        applied: false
      })
    })
  }

  lookup(operationId: string):
    | Readonly<{
        actorId: string
        origin: SharedOperationOrigin
        outcome: RecordedOperationOutcome
      }>
    | undefined {
    const existing = this.outcomes.get(operationId)
    return existing
      ? Object.freeze({
          actorId: existing.actorId,
          origin: existing.origin,
          outcome: existing.outcome
        })
      : undefined
  }

  record(
    envelope: SharedOperationEnvelope,
    outcome: RecordedOperationOutcome
  ): void {
    const existing = this.outcomes.get(envelope.operationId)
    const fingerprint = stableSerialize(envelope)
    if (!existing || existing.fingerprint !== fingerprint) {
      throw new Error(
        '[collaboration] operation outcome does not match its reservation'
      )
    }
    if (outcome.operationId !== envelope.operationId) {
      throw new Error(
        '[collaboration] recorded outcome operationId does not match envelope'
      )
    }
    if (
      outcome.applied &&
      outcome.status !== 'accepted' &&
      outcome.status !== 'repaired'
    ) {
      throw new Error(
        '[collaboration] only accepted or repaired outcomes can be applied'
      )
    }
    existing.outcome = freezeOutcome(outcome) as RecordedOperationOutcome
  }
}

const rejection = (
  code: ValidationRejectionCode,
  operationId?: string
): RemoteValidationRejection =>
  Object.freeze({
    status: 'rejected',
    owner: 'validation',
    code,
    ...(operationId ? { operationId } : {})
  })

const requiredKeys = new Set([
  'operationId',
  'transactionId',
  'documentId',
  'actorId',
  'protocolVersion',
  'schemaVersion',
  'origin',
  'channel',
  'eventName',
  'payload',
  'compensatesOperationId'
])

const cloneJsonValue = (
  value: unknown,
  seen = new WeakSet<object>()
): unknown => {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value
  }
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return value
    throw new Error('number must be finite')
  }
  if (typeof value !== 'object') throw new Error('unsupported value')
  if (seen.has(value)) throw new Error('circular value')
  seen.add(value)

  if (Array.isArray(value)) {
    const result: unknown[] = []
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, index)
      if (!descriptor || !('value' in descriptor)) {
        throw new Error('array must contain data values')
      }
      result.push(cloneJsonValue(descriptor.value, seen))
    }
    seen.delete(value)
    return result
  }
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error('non-plain object')
  }
  const result: Record<string, unknown> = {}
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') throw new Error('symbol key')
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor?.enumerable) continue
    if (!('value' in descriptor)) throw new Error('accessor value')
    Object.defineProperty(result, key, {
      value: cloneJsonValue(descriptor.value, seen),
      enumerable: true,
      configurable: true,
      writable: true
    })
  }
  seen.delete(value)
  return result
}

const freezeDeep = <T>(value: T, seen = new WeakSet<object>()): T => {
  if (value === null || typeof value !== 'object') return value
  const object = value as object
  if (seen.has(object)) return value
  seen.add(object)
  Reflect.ownKeys(object).forEach((key) =>
    freezeDeep(Reflect.get(object, key), seen)
  )
  return Object.freeze(value)
}

const stableSerialize = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) {
    const items: string[] = []
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, index)
      if (!descriptor || !('value' in descriptor)) {
        throw new Error('array must contain data values')
      }
      items.push(stableSerialize(descriptor.value))
    }
    return `[${items.join(',')}]`
  }
  return `{${Object.keys(value)
    .sort()
    .map((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (!descriptor || !('value' in descriptor)) {
        throw new Error('object must contain data values')
      }
      return `${JSON.stringify(key)}:${stableSerialize(descriptor.value)}`
    })
    .join(',')}}`
}

const stringField = (
  candidate: Record<string, unknown>,
  field: string
): string | undefined => {
  const descriptor = Object.getOwnPropertyDescriptor(candidate, field)
  const value =
    descriptor && 'value' in descriptor ? descriptor.value : undefined
  return typeof value === 'string' && value.trim() ? value : undefined
}

const basicEnvelope = (
  decoded: unknown
): SharedOperationEnvelope | RemoteValidationRejection => {
  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
    return rejection('malformed-envelope')
  }
  const candidate = decoded as Record<string, unknown>
  const candidateKeys = Reflect.ownKeys(candidate)
  if (
    candidateKeys.some((key) => {
      if (typeof key !== 'string' || !requiredKeys.has(key)) return true
      const descriptor = Object.getOwnPropertyDescriptor(candidate, key)
      return !descriptor?.enumerable || !('value' in descriptor)
    })
  ) {
    return rejection('malformed-envelope')
  }

  const operationId = stringField(candidate, 'operationId')
  if (!operationId) return rejection('invalid-operation-id')
  const transactionId = stringField(candidate, 'transactionId')
  if (!transactionId) return rejection('invalid-transaction-id', operationId)
  const documentId = stringField(candidate, 'documentId')
  if (!documentId) return rejection('invalid-document-id', operationId)
  const actorId = stringField(candidate, 'actorId')
  if (!actorId) return rejection('invalid-actor-id', operationId)
  const channel = stringField(candidate, 'channel')
  if (!channel) return rejection('invalid-channel', operationId)
  const eventName = stringField(candidate, 'eventName')
  if (!eventName) return rejection('invalid-event-name', operationId)

  let payload: unknown
  try {
    payload = cloneJsonValue(
      Object.getOwnPropertyDescriptor(candidate, 'payload')?.value
    )
  } catch {
    return rejection('invalid-payload', operationId)
  }

  const dataField = (field: string): unknown =>
    Object.getOwnPropertyDescriptor(candidate, field)?.value

  return {
    operationId,
    transactionId,
    documentId,
    actorId,
    protocolVersion: dataField('protocolVersion') as 1,
    schemaVersion: dataField('schemaVersion') as number,
    origin: dataField('origin') as SharedOperationOrigin,
    channel,
    eventName,
    payload,
    ...(dataField('compensatesOperationId') !== undefined
      ? {
          compensatesOperationId: dataField('compensatesOperationId') as string
        }
      : {})
  }
}

const allowedOrigins = new Set<SharedOperationOrigin>([
  'action',
  'automation',
  'undo',
  'redo',
  'rollback-compensation'
])

export interface ValidateRemoteOperationInput {
  decoded: unknown
  documentId: string
  authenticatedActorId?: string
  registry: OperationRegistry
  outcomes: OperationOutcomeRegistry
}

export const validateRemoteOperation = ({
  decoded,
  documentId,
  authenticatedActorId,
  registry,
  outcomes
}: ValidateRemoteOperationInput): RemoteValidationResult => {
  if (decoded && typeof decoded === 'object' && !Array.isArray(decoded)) {
    const rawOperationId = stringField(
      decoded as Record<string, unknown>,
      'operationId'
    )
    if (rawOperationId) {
      const rawActorId = stringField(
        decoded as Record<string, unknown>,
        'actorId'
      )
      if (
        authenticatedActorId !== undefined &&
        rawActorId !== authenticatedActorId
      ) {
        return rejection('actor-mismatch', rawOperationId)
      }
      try {
        const identityResult = outcomes.inspect(
          rawOperationId,
          stableSerialize(decoded)
        )
        if (identityResult) return identityResult
      } catch {
        // The ordinary structural validation below owns malformed values.
      }
    }
  }
  const candidate = basicEnvelope(decoded)
  if ('status' in candidate) return candidate
  const fingerprint = stableSerialize(candidate)
  const previous = outcomes.inspect(candidate.operationId, fingerprint)
  if (previous) return previous

  if (candidate.documentId !== documentId) {
    return rejection('document-mismatch', candidate.operationId)
  }
  if (
    authenticatedActorId !== undefined &&
    candidate.actorId !== authenticatedActorId
  ) {
    return rejection('actor-mismatch', candidate.operationId)
  }
  if (candidate.protocolVersion !== COLLABORATION_PROTOCOL_VERSION) {
    return rejection('unsupported-protocol', candidate.operationId)
  }
  if (!allowedOrigins.has(candidate.origin)) {
    return rejection('unsupported-origin', candidate.operationId)
  }

  const isCompensation = candidate.origin === 'rollback-compensation'
  const rawCompensationId = candidate.compensatesOperationId
  let compensationId: string | undefined
  if (isCompensation) {
    if (
      typeof rawCompensationId !== 'string' ||
      !rawCompensationId.trim() ||
      rawCompensationId === candidate.operationId
    ) {
      return rejection('invalid-compensation', candidate.operationId)
    }
    compensationId = rawCompensationId
  } else if (rawCompensationId !== undefined) {
    return rejection('invalid-compensation', candidate.operationId)
  }

  const definition = registry.resolve(candidate.channel, candidate.eventName)
  if (!definition) {
    return rejection('unregistered-operation', candidate.operationId)
  }
  if (candidate.schemaVersion !== definition.schemaVersion) {
    return rejection('unsupported-schema', candidate.operationId)
  }
  let validPayload: boolean
  try {
    validPayload = definition.validate(candidate.payload)
  } catch {
    validPayload = false
  }
  if (!validPayload) {
    return rejection('invalid-payload', candidate.operationId)
  }

  if (compensationId !== undefined) {
    const forward = outcomes.lookup(compensationId)
    if (!forward) {
      return rejection(
        'compensation-forward-unavailable',
        candidate.operationId
      )
    }
    if (forward.actorId !== candidate.actorId) {
      return rejection(
        'compensation-forward-actor-mismatch',
        candidate.operationId
      )
    }
    if (forward.origin === 'rollback-compensation') {
      return rejection('compensation-target-not-forward', candidate.operationId)
    }
    if (
      !forward.outcome.applied ||
      (forward.outcome.status !== 'accepted' &&
        forward.outcome.status !== 'repaired')
    ) {
      return rejection(
        'compensation-forward-not-applied',
        candidate.operationId
      )
    }
  }

  const immutableEnvelope = freezeDeep(candidate)
  outcomes.reserve(immutableEnvelope, fingerprint)
  return Object.freeze({ status: 'validated', envelope: immutableEnvelope })
}

export interface RemoteCanonicalApplyAcceptedOutcome {
  readonly status: 'accepted' | 'repaired'
  readonly operationId: string
  readonly applied: boolean
}

export interface RemoteCanonicalApplyFailedOutcome {
  readonly status: 'apply-failed'
  readonly operationId: string
  readonly code:
    | 'canonical-apply-failed'
    | 'async-handler-not-supported'
    | 'invalid-canonical-apply-handler'
  readonly error: unknown
}

export type RemoteCanonicalApplyOutcome =
  | RemoteCanonicalApplyAcceptedOutcome
  | RemoteCanonicalApplyFailedOutcome

export interface RunRemoteCanonicalApplyInput {
  readonly operation: ConflictAcceptedOperation
  readonly factory: Factory
  readonly apply: CanonicalOperationApply
  readonly outcomes: OperationOutcomeRegistry
}

export const runRemoteCanonicalApply = ({
  operation,
  factory,
  apply,
  outcomes
}: RunRemoteCanonicalApplyInput): RemoteCanonicalApplyOutcome => {
  if (!isCanonicalOperationApply(apply)) {
    const error = new Error(
      '[collaboration] canonical apply handler must use defineCanonicalOperationApply'
    )
    const result = Object.freeze({
      status: 'apply-failed' as const,
      operationId: operation.receivedEnvelope.operationId,
      code: 'invalid-canonical-apply-handler' as const,
      error
    })
    outcomes.record(operation.receivedEnvelope, {
      status: 'apply-failed',
      operationId: operation.receivedEnvelope.operationId,
      applied: false,
      code: result.code
    })
    return result
  }
  try {
    const applied = factory.runRemoteTransaction(() =>
      apply(operation.envelope)
    )
    const result = Object.freeze({
      status: operation.status,
      operationId: operation.envelope.operationId,
      applied: applied !== false
    })
    outcomes.record(operation.receivedEnvelope, {
      status: operation.status,
      operationId: operation.receivedEnvelope.operationId,
      applied: result.applied
    })
    return result
  } catch (error) {
    const code: RemoteCanonicalApplyFailedOutcome['code'] =
      factory.isRemoteAsyncHandlerError(error)
        ? 'async-handler-not-supported'
        : 'canonical-apply-failed'
    const result = Object.freeze({
      status: 'apply-failed' as const,
      operationId: operation.receivedEnvelope.operationId,
      code,
      error
    })
    outcomes.record(operation.receivedEnvelope, {
      status: 'apply-failed',
      operationId: operation.receivedEnvelope.operationId,
      applied: false,
      code
    })
    return result
  }
}
