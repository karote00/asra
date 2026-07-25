import type {
  AiPermissionDecision,
  AiPermissionPolicy
} from '@asyra/ai-agent-runtime'

export type AsyraDesignAiPermissionRules = Readonly<
  Record<string, AiPermissionDecision>
>

export class AsyraDesignAiPermissionConfigurationError extends Error {
  readonly code = 'AI_PERMISSION_CONFIGURATION_INVALID' as const

  constructor() {
    super(
      'Asyra Design AI permission rules require non-empty action names and explicit allow, confirm, or deny decisions.'
    )
    this.name = 'AsyraDesignAiPermissionConfigurationError'
  }
}

const isDecision = (value: unknown): value is AiPermissionDecision =>
  value === 'allow' || value === 'confirm' || value === 'deny'

export const createAsyraDesignAiPermissionPolicy = (
  rules: AsyraDesignAiPermissionRules = {}
): AiPermissionPolicy => {
  const decisions = new Map<string, AiPermissionDecision>()

  for (const key of Reflect.ownKeys(rules)) {
    if (typeof key !== 'string') {
      throw new AsyraDesignAiPermissionConfigurationError()
    }

    const descriptor = Object.getOwnPropertyDescriptor(rules, key)
    if (
      !descriptor?.enumerable ||
      !('value' in descriptor) ||
      key.trim().length === 0 ||
      !isDecision(descriptor.value)
    ) {
      throw new AsyraDesignAiPermissionConfigurationError()
    }
    decisions.set(key, descriptor.value)
  }

  return Object.freeze({
    evaluate: async ({ action }) => decisions.get(action.name) ?? 'deny'
  })
}
