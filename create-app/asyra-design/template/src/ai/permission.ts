import type {
  AiPermissionDecision,
  AiPermissionPolicy
} from '@asyra/ai-agent-runtime'

export type AiPermissionRules = Readonly<Record<string, AiPermissionDecision>>

export class AiPermissionConfigurationError extends Error {
  readonly code = 'AI_PERMISSION_CONFIGURATION_INVALID' as const

  constructor() {
    super(
      'AI permission rules require non-empty action names and explicit allow, confirm, or deny decisions.'
    )
    this.name = 'AiPermissionConfigurationError'
  }
}

const isDecision = (value: unknown): value is AiPermissionDecision =>
  value === 'allow' || value === 'confirm' || value === 'deny'

export const createAiPermissionPolicy = (
  rules: AiPermissionRules = {}
): AiPermissionPolicy => {
  const decisions = new Map<string, AiPermissionDecision>()

  for (const key of Reflect.ownKeys(rules)) {
    if (typeof key !== 'string') {
      throw new AiPermissionConfigurationError()
    }

    const descriptor = Object.getOwnPropertyDescriptor(rules, key)
    if (
      !descriptor?.enumerable ||
      !('value' in descriptor) ||
      key.trim().length === 0 ||
      !isDecision(descriptor.value)
    ) {
      throw new AiPermissionConfigurationError()
    }
    decisions.set(key, descriptor.value)
  }

  const policy: AiPermissionPolicy = {
    evaluate: async ({ action }) => decisions.get(action.name) ?? 'deny'
  }

  return Object.freeze(policy)
}
