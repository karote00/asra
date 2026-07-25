import {
  createAiAgentRuntime,
  type AiAgentRuntime,
  type CreateAiAgentRuntimeInput
} from '@asyra/ai-agent-runtime'

export interface ComposeAiAgentRuntimeOptions {
  enabled: boolean
  createRuntimeInput?: () => CreateAiAgentRuntimeInput
}

export type AiRuntimeComposition =
  | {
      readonly enabled: false
      readonly runtime: null
      dispose(): Promise<void>
    }
  | {
      readonly enabled: true
      readonly runtime: AiAgentRuntime
      dispose(): Promise<void>
    }

export const composeAiAgentRuntime = (
  options: ComposeAiAgentRuntimeOptions
): AiRuntimeComposition => {
  if (!options.enabled) {
    return Object.freeze({
      enabled: false,
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
    runtime,
    dispose: () => runtime.dispose()
  })
}
