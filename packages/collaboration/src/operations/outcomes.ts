import type { SharedOperationEnvelope, SharedOperationOrigin } from './envelope'
import type { RemoteValidationRejection } from './validation'

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

interface StoredOutcome {
  readonly fingerprint: string
  readonly actorId: string
  readonly origin: SharedOperationOrigin
  outcome: RecordedOperationOutcome
}

const freezeOutcome = <T extends object>(value: T): Readonly<T> =>
  Object.freeze({ ...value })

export const fingerprintOperation = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) {
    const items: string[] = []
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, index)
      if (!descriptor || !('value' in descriptor)) {
        throw new Error('array must contain data values')
      }
      items.push(fingerprintOperation(descriptor.value))
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
      return `${JSON.stringify(key)}:${fingerprintOperation(descriptor.value)}`
    })
    .join(',')}}`
}

const identityCollision = (operationId: string): RemoteValidationRejection =>
  Object.freeze({
    status: 'rejected',
    owner: 'validation',
    code: 'operation-identity-collision',
    operationId
  })

export class OperationOutcomeRegistry {
  private readonly outcomes = new Map<string, StoredOutcome>()

  recordLocal(envelope: SharedOperationEnvelope): void {
    const fingerprint = fingerprintOperation(envelope)
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
    if (!existing) return
    if (existing.fingerprint !== fingerprint) {
      return identityCollision(operationId)
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
    const fingerprint = fingerprintOperation(envelope)
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
