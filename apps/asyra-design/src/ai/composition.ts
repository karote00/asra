import {
  createAiAgentRuntime,
  type AiAgentRuntime,
  type CreateAiAgentRuntimeInput
} from '@asyra/ai-agent-runtime'

export interface ComposeAiAgentRuntimeOptions {
  enabled: boolean
  providerEnabled?: boolean
  createRuntimeInput?: () => CreateAiAgentRuntimeInput
}

export type AiRuntimeComposition =
  | {
      readonly enabled: false
      readonly providerEnabled: false
      readonly runtime: null
      dispose(): Promise<void>
    }
  | {
      readonly enabled: true
      readonly providerEnabled: false
      readonly runtime: null
      dispose(): Promise<void>
    }
  | {
      readonly enabled: true
      readonly providerEnabled: true
      readonly runtime: AiAgentRuntime
      dispose(): Promise<void>
    }

export const composeAiAgentRuntime = (
  options: ComposeAiAgentRuntimeOptions
): AiRuntimeComposition => {
  if (!options.enabled) {
    return Object.freeze({
      enabled: false,
      providerEnabled: false,
      runtime: null,
      dispose: async () => undefined
    })
  }

  if (options.providerEnabled === false) {
    return Object.freeze({
      enabled: true,
      providerEnabled: false,
      runtime: null,
      dispose: async () => undefined
    })
  }

  if (!options.createRuntimeInput) {
    throw new Error('createRuntimeInput is required when AI is enabled')
  }

  const runtime = createAiAgentRuntime(options.createRuntimeInput())

  return Object.freeze({
    enabled: true,
    providerEnabled: true,
    runtime,
    dispose: () => runtime.dispose()
  })
}
