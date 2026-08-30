import {
  cancelFeatureTask,
  defineFeature,
  invokeFeatureTask
} from '@asyra/core'
import type {
  AiJsonValue,
  AiRuntimeProgressObserver,
  AiRuntimeResult
} from '@asyra/ai-agent-runtime'
import { FeatureNames } from '../../constants'

export const AI_AGENT_FEATURE_PRIORITY = 100

export interface AiAgentFeatureRunRequest {
  readonly intent: string
  readonly metadata?: AiJsonValue
  readonly progressObserver?: AiRuntimeProgressObserver
  readonly signal: AbortSignal
}

export interface AiAgentFeatureRuntime {
  run(request: AiAgentFeatureRunRequest): Promise<AiRuntimeResult>
}

export interface AiAgentFeatureExecuteOptions {
  readonly signal?: AbortSignal
}

export interface AiAgentFeatureExecuteRequest {
  readonly intent: string
  readonly metadata?: AiJsonValue
  readonly progressObserver?: AiRuntimeProgressObserver
}

export type AiAgentFeatureTerminalResult =
  | {
      readonly status: 'cancelled'
      readonly reason: 'aborted'
    }
  | {
      readonly status: 'failed'
      readonly code: 'INVALID_INTENT'
      readonly stage: 'feature'
    }

export type AiAgentFeatureResult =
  AiAgentFeatureTerminalResult | AiRuntimeResult

export interface AiAgentFeatureApi {
  execute(
    request: AiAgentFeatureExecuteRequest | string,
    options?: AiAgentFeatureExecuteOptions
  ): Promise<AiAgentFeatureResult>
  cancel(reason?: unknown): boolean
  [key: string]: unknown
}

interface AiAgentFeatureTaskInput {
  readonly intent: string
  readonly metadata?: AiJsonValue
  readonly progressObserver?: AiRuntimeProgressObserver
}

const AI_ABORTED_RESULT = Object.freeze({
  status: 'cancelled',
  reason: 'aborted'
} as const)

const AI_INVALID_INTENT_RESULT = Object.freeze({
  status: 'failed',
  code: 'INVALID_INTENT',
  stage: 'feature'
} as const)

export const registerAiAgentFeature = (runtime: AiAgentFeatureRuntime) => {
  const api: AiAgentFeatureApi = {
    execute: (request, executeOptions = {}) => {
      const normalizedRequest =
        typeof request === 'string'
          ? {
              intent: request
            }
          : request
      const normalizedIntent = normalizedRequest.intent.trim()
      if (!normalizedIntent) {
        return Promise.resolve(AI_INVALID_INTENT_RESULT)
      }

      return invokeFeatureTask<AiAgentFeatureTaskInput, AiAgentFeatureResult>(
        FeatureNames.AI_AGENT,
        {
          intent: normalizedIntent,
          ...(normalizedRequest.metadata === undefined
            ? {}
            : {
                metadata: normalizedRequest.metadata
              }),
          ...(normalizedRequest.progressObserver === undefined
            ? {}
            : {
                progressObserver: normalizedRequest.progressObserver
              })
        },
        executeOptions
      )
    },
    cancel: (reason) => cancelFeatureTask(FeatureNames.AI_AGENT, reason)
  }

  return defineFeature<
    AiAgentFeatureApi,
    Record<string, never>,
    AiAgentFeatureTaskInput,
    AiAgentFeatureResult
  >(FeatureNames.AI_AGENT, undefined, {
    priority: AI_AGENT_FEATURE_PRIORITY,
    exclusive: true,
    api,
    task: ({ intent, metadata, progressObserver }, { signal }) => {
      if (signal.aborted) {
        return AI_ABORTED_RESULT
      }
      return runtime.run({
        intent,
        ...(metadata === undefined ? {} : { metadata }),
        ...(progressObserver === undefined ? {} : { progressObserver }),
        signal
      })
    }
  })
}
