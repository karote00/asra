import type { Factory } from '@asyra/factory'
import type { AcceptedOperation } from './conflict'
import {
  isCanonicalOperationApply,
  type CanonicalOperationApply
} from './registry'
import { OperationOutcomeRegistry } from './outcomes'

export interface OperationApplyAcceptedOutcome {
  readonly status: 'accepted' | 'repaired'
  readonly operationId: string
  readonly applied: boolean
}

export interface OperationApplyFailedOutcome {
  readonly status: 'apply-failed'
  readonly operationId: string
  readonly code:
    | 'canonical-apply-failed'
    | 'async-handler-not-supported'
    | 'invalid-canonical-apply-handler'
  readonly error: unknown
}

export type OperationApplyOutcome =
  | OperationApplyAcceptedOutcome
  | OperationApplyFailedOutcome

export interface ApplyOperationInput {
  readonly operation: AcceptedOperation
  readonly factory: Factory
  readonly apply: CanonicalOperationApply
  readonly outcomes: OperationOutcomeRegistry
}

export const applyOperation = ({
  operation,
  factory,
  apply,
  outcomes
}: ApplyOperationInput): OperationApplyOutcome => {
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
    const code: OperationApplyFailedOutcome['code'] =
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
