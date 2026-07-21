import type { SharedOperationEnvelope } from './envelope'
import { OperationRegistry } from './registry'
import type { ValidatedRemoteOperation } from './validation'

export interface NotApplicableConflictDecision {
  readonly decision: 'not-applicable'
}

export interface AcceptConflictDecision {
  readonly decision: 'accept'
}

export interface RejectConflictDecision {
  readonly decision: 'reject'
  readonly code: string
}

export interface RepairConflictDecision {
  readonly decision: 'repair'
  readonly payload: unknown
}

export type ConflictPolicyDecision =
  | NotApplicableConflictDecision
  | AcceptConflictDecision
  | RejectConflictDecision
  | RepairConflictDecision

export interface ConflictPolicyContext {
  readonly envelope: SharedOperationEnvelope
}

export interface AppConflictPolicy {
  readonly id: string
  decide(
    context: ConflictPolicyContext
  ): ConflictPolicyDecision | Promise<ConflictPolicyDecision>
}

export interface AcceptedOperation {
  readonly status: 'accepted' | 'repaired'
  readonly receivedEnvelope: SharedOperationEnvelope
  readonly envelope: SharedOperationEnvelope
}

export interface RejectedOperation {
  readonly status: 'rejected'
  readonly owner: 'permission' | 'app'
  readonly code: string
  readonly operationId: string
  readonly policyId?: string
}

export type ConflictOutcome = AcceptedOperation | RejectedOperation

const deepFreeze = <T>(value: T, seen = new WeakSet<object>()): T => {
  if (value === null || typeof value !== 'object') return value
  const object = value as object
  if (seen.has(object)) return value
  seen.add(object)
  Reflect.ownKeys(object).forEach((key) =>
    deepFreeze(Reflect.get(object, key), seen)
  )
  return Object.freeze(value)
}

const cloneEnvelope = (
  envelope: SharedOperationEnvelope
): SharedOperationEnvelope => deepFreeze(structuredClone(envelope))

const reject = (
  owner: RejectedOperation['owner'],
  code: string,
  operationId: string,
  policyId?: string
): RejectedOperation =>
  Object.freeze({
    status: 'rejected',
    owner,
    code,
    operationId,
    ...(policyId ? { policyId } : {})
  })

const isDecision = (value: unknown): value is ConflictPolicyDecision => {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<ConflictPolicyDecision>
  if (
    candidate.decision === 'not-applicable' ||
    candidate.decision === 'accept' ||
    candidate.decision === 'repair'
  ) {
    return true
  }
  return (
    candidate.decision === 'reject' &&
    'code' in candidate &&
    typeof candidate.code === 'string' &&
    candidate.code.trim().length > 0
  )
}

export interface CreateConflictPolicyInput {
  readonly operationRegistry: OperationRegistry
  readonly permissionPolicy: (
    envelope: SharedOperationEnvelope
  ) => boolean | Promise<boolean>
  readonly appPolicies?: readonly AppConflictPolicy[]
}

export class ConflictPolicy {
  private readonly policies: readonly AppConflictPolicy[]

  constructor(
    private readonly operationRegistry: OperationRegistry,
    private readonly permissionPolicy: CreateConflictPolicyInput['permissionPolicy'],
    appPolicies: readonly AppConflictPolicy[]
  ) {
    const ids = new Set<string>()
    this.policies = Object.freeze(
      appPolicies.map((policy) => {
        if (!policy.id.trim()) {
          throw new Error('[collaboration] app policy id is required')
        }
        if (ids.has(policy.id)) {
          throw new Error(
            `[collaboration] duplicate conflict policy ${policy.id}`
          )
        }
        ids.add(policy.id)
        return Object.freeze({ id: policy.id, decide: policy.decide })
      })
    )
  }

  policyIds(): readonly string[] {
    return Object.freeze(this.policies.map((policy) => policy.id))
  }

  async decide(operation: ValidatedRemoteOperation): Promise<ConflictOutcome> {
    const receivedEnvelope = cloneEnvelope(operation.envelope)
    let envelope = receivedEnvelope
    let repaired = false

    let permitted: boolean
    try {
      permitted = await this.permissionPolicy(receivedEnvelope)
    } catch {
      return reject(
        'permission',
        'permission-error',
        receivedEnvelope.operationId
      )
    }
    if (!permitted) {
      return reject('permission', 'unauthorized', receivedEnvelope.operationId)
    }

    for (const policy of this.policies) {
      let decision: ConflictPolicyDecision
      try {
        decision = await policy.decide(Object.freeze({ envelope }))
      } catch {
        return reject(
          'app',
          'policy-error',
          receivedEnvelope.operationId,
          policy.id
        )
      }
      if (!isDecision(decision)) {
        return reject(
          'app',
          'invalid-policy-decision',
          receivedEnvelope.operationId,
          policy.id
        )
      }
      if (
        decision.decision === 'not-applicable' ||
        decision.decision === 'accept'
      ) {
        continue
      }
      if (decision.decision === 'reject') {
        return reject(
          'app',
          decision.code,
          receivedEnvelope.operationId,
          policy.id
        )
      }
      if (decision.decision !== 'repair') continue

      let payload: unknown
      try {
        payload = deepFreeze(structuredClone(decision.payload))
      } catch {
        return reject(
          'app',
          'invalid-repair',
          receivedEnvelope.operationId,
          policy.id
        )
      }
      const definition = this.operationRegistry.resolve(
        envelope.channel,
        envelope.eventName
      )
      let validRepair = false
      try {
        validRepair = definition?.validate(payload) === true
      } catch {
        validRepair = false
      }
      if (!validRepair) {
        return reject(
          'app',
          'invalid-repair',
          receivedEnvelope.operationId,
          policy.id
        )
      }
      envelope = deepFreeze({ ...envelope, payload })
      repaired = true
    }

    return Object.freeze({
      status: repaired ? 'repaired' : 'accepted',
      receivedEnvelope,
      envelope
    })
  }
}

export const createConflictPolicy = ({
  operationRegistry,
  permissionPolicy,
  appPolicies = []
}: CreateConflictPolicyInput): ConflictPolicy =>
  new ConflictPolicy(operationRegistry, permissionPolicy, appPolicies)
