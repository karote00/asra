import type { SharedOperationEnvelope } from './operation-envelope'
import type { ValidatedRemoteOperation } from './inbound-pipeline'
import { OperationRegistry } from './operation-registry'

export type ConflictPolicyDecision =
  | Readonly<{ decision: 'not-applicable' | 'accept' }>
  | Readonly<{ decision: 'reject'; code: string }>
  | Readonly<{ decision: 'repair'; payload: unknown }>

export interface ConflictPolicyContext {
  readonly envelope: SharedOperationEnvelope
}

export interface AppConflictPolicy {
  readonly id: string
  decide(
    context: ConflictPolicyContext
  ): ConflictPolicyDecision | Promise<ConflictPolicyDecision>
}

export interface EntityInvariantDescriptor {
  readonly entityId: string
  readonly intent: 'create' | 'update' | 'delete'
}

export interface FrameworkInvariantConfiguration {
  readonly entity?: Readonly<{
    describe(
      envelope: SharedOperationEnvelope
    ): EntityInvariantDescriptor | undefined
    exists(entityId: string): boolean
  }>
  readonly hierarchy?: Readonly<{
    evaluate(
      envelope: SharedOperationEnvelope
    ): ConflictPolicyDecision | Promise<ConflictPolicyDecision>
  }>
  readonly property?: Readonly<{
    evaluate(
      envelope: SharedOperationEnvelope
    ): ConflictPolicyDecision | Promise<ConflictPolicyDecision>
  }>
}

export interface ConflictAcceptedOperation {
  readonly status: 'accepted' | 'repaired'
  readonly receivedEnvelope: SharedOperationEnvelope
  readonly envelope: SharedOperationEnvelope
}

export interface ConflictRejectedOperation {
  readonly status: 'rejected'
  readonly owner: 'permission' | 'framework' | 'app'
  readonly code: string
  readonly operationId: string
  readonly policyId?: string
}

export type ConflictPipelineOutcome =
  | ConflictAcceptedOperation
  | ConflictRejectedOperation

type ExecutablePolicyDecision =
  | ConflictPolicyDecision
  | Readonly<{
      decision: 'require-app-resolution'
      code: string
    }>

interface ExecutablePolicy {
  readonly id: string
  readonly owner: 'framework' | 'app'
  decide(
    context: ConflictPolicyContext
  ): ExecutablePolicyDecision | Promise<ExecutablePolicyDecision>
}

const FRAMEWORK_POLICY_IDS = Object.freeze([
  'framework:entity-existence',
  'framework:hierarchy-membership-order',
  'framework:property-validation'
])

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
  owner: ConflictRejectedOperation['owner'],
  code: string,
  operationId: string,
  policyId?: string
): ConflictRejectedOperation =>
  Object.freeze({
    status: 'rejected',
    owner,
    code,
    operationId,
    ...(policyId ? { policyId } : {})
  })

const frameworkPolicies = (
  invariants: FrameworkInvariantConfiguration
): readonly ExecutablePolicy[] => {
  const entity = invariants.entity
    ? Object.freeze({
        describe: invariants.entity.describe,
        exists: invariants.entity.exists
      })
    : undefined
  const hierarchy = invariants.hierarchy
    ? Object.freeze({ evaluate: invariants.hierarchy.evaluate })
    : undefined
  const property = invariants.property
    ? Object.freeze({ evaluate: invariants.property.evaluate })
    : undefined

  return [
    Object.freeze({
      id: FRAMEWORK_POLICY_IDS[0],
      owner: 'framework' as const,
      decide: ({
        envelope
      }: ConflictPolicyContext): ExecutablePolicyDecision => {
        const descriptor = entity?.describe(envelope)
        if (!descriptor) return { decision: 'not-applicable' }
        const exists = entity?.exists(descriptor.entityId) ?? false
        if (descriptor.intent === 'create' && exists) {
          return {
            decision: 'require-app-resolution',
            code: 'unresolved-entity-create-conflict'
          }
        }
        if (descriptor.intent === 'update' && !exists) {
          return { decision: 'reject', code: 'entity-missing' }
        }
        return { decision: 'accept' }
      }
    }),
    Object.freeze({
      id: FRAMEWORK_POLICY_IDS[1],
      owner: 'framework' as const,
      decide: ({ envelope }: ConflictPolicyContext) =>
        hierarchy?.evaluate(envelope) ?? {
          decision: 'not-applicable' as const
        }
    }),
    Object.freeze({
      id: FRAMEWORK_POLICY_IDS[2],
      owner: 'framework' as const,
      decide: ({ envelope }: ConflictPolicyContext) =>
        property?.evaluate(envelope) ?? {
          decision: 'not-applicable' as const
        }
    })
  ]
}

export interface CreateConflictPolicyPipelineInput {
  readonly operationRegistry: OperationRegistry
  readonly permissionPolicy: (
    envelope: SharedOperationEnvelope
  ) => boolean | Promise<boolean>
  readonly frameworkInvariants: FrameworkInvariantConfiguration
  readonly appPolicies?: readonly AppConflictPolicy[]
}

export class ConflictPolicyPipeline {
  private readonly policies: readonly ExecutablePolicy[]

  constructor(
    private readonly operationRegistry: OperationRegistry,
    private readonly permissionPolicy: CreateConflictPolicyPipelineInput['permissionPolicy'],
    invariants: FrameworkInvariantConfiguration,
    appPolicies: readonly AppConflictPolicy[]
  ) {
    const ids = new Set<string>(FRAMEWORK_POLICY_IDS)
    const app = appPolicies.map((policy): ExecutablePolicy => {
      if (!policy.id.trim()) {
        throw new Error('[collaboration] app policy id is required')
      }
      if (policy.id.startsWith('framework:')) {
        throw new Error(
          '[collaboration] app policy cannot use reserved framework id'
        )
      }
      if (ids.has(policy.id)) {
        throw new Error(
          `[collaboration] duplicate conflict policy ${policy.id}`
        )
      }
      ids.add(policy.id)
      return Object.freeze({
        id: policy.id,
        owner: 'app' as const,
        decide: policy.decide
      })
    })
    this.policies = Object.freeze([...frameworkPolicies(invariants), ...app])
  }

  policyIds(): readonly string[] {
    return Object.freeze(this.policies.map((policy) => policy.id))
  }

  async decide(
    operation: ValidatedRemoteOperation
  ): Promise<ConflictPipelineOutcome> {
    const receivedEnvelope = cloneEnvelope(operation.envelope)
    let envelope = receivedEnvelope
    let repaired = false
    let requiredAppResolution:
      | Readonly<{ code: string; policyId: string }>
      | undefined

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
      let decision: ExecutablePolicyDecision
      try {
        decision = await policy.decide(Object.freeze({ envelope }))
      } catch {
        return reject(
          policy.owner,
          'policy-error',
          receivedEnvelope.operationId,
          policy.id
        )
      }
      if (
        !decision ||
        ![
          'not-applicable',
          'accept',
          'reject',
          'repair',
          'require-app-resolution'
        ].includes(decision.decision) ||
        ((decision.decision === 'reject' ||
          decision.decision === 'require-app-resolution') &&
          !decision.code?.trim()) ||
        (decision.decision === 'require-app-resolution' &&
          policy.owner !== 'framework')
      ) {
        return reject(
          policy.owner,
          'invalid-policy-decision',
          receivedEnvelope.operationId,
          policy.id
        )
      }
      if (decision.decision === 'require-app-resolution') {
        requiredAppResolution = Object.freeze({
          code: decision.code,
          policyId: policy.id
        })
        continue
      }
      if (decision.decision === 'not-applicable') {
        continue
      }
      if (decision.decision === 'accept') {
        if (policy.owner === 'app') requiredAppResolution = undefined
        continue
      }
      if (decision.decision === 'reject') {
        return reject(
          policy.owner,
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
          policy.owner,
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
          policy.owner,
          'invalid-repair',
          receivedEnvelope.operationId,
          policy.id
        )
      }
      envelope = deepFreeze({ ...envelope, payload })
      repaired = true
      if (policy.owner === 'app') requiredAppResolution = undefined
    }

    if (requiredAppResolution) {
      return reject(
        'framework',
        requiredAppResolution.code,
        receivedEnvelope.operationId,
        requiredAppResolution.policyId
      )
    }

    return Object.freeze({
      status: repaired ? 'repaired' : 'accepted',
      receivedEnvelope,
      envelope
    })
  }
}

export const createConflictPolicyPipeline = ({
  operationRegistry,
  permissionPolicy,
  frameworkInvariants,
  appPolicies = []
}: CreateConflictPolicyPipelineInput): ConflictPolicyPipeline =>
  new ConflictPolicyPipeline(
    operationRegistry,
    permissionPolicy,
    frameworkInvariants,
    appPolicies
  )
