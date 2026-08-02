import {
  getFeature,
  getFeatureRegistry,
  unregisterFeature,
  type FeatureTaskActiveError
} from '@asyra/feature-system'
import type { AiRuntimeResult } from '@asyra/ai-agent-runtime'
import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import { FeatureNames } from '../../../constants'
import {
  AI_AGENT_FEATURE_PRIORITY,
  registerAiAgentFeature,
  type AiAgentFeatureResult,
  type AiAgentFeatureTerminalResult
} from '..'

const executedResult: AiRuntimeResult = Object.freeze({
  actionResults: Object.freeze([]),
  audit: Object.freeze({
    actions: Object.freeze([]),
    batchId: 'batch-1',
    outcome: 'executed',
    retryCount: 0
  }),
  batchId: 'batch-1',
  preview: Object.freeze({
    actions: Object.freeze([]),
    batchId: 'batch-1'
  }),
  status: 'executed',
  transaction: Object.freeze({
    status: 'committed'
  })
})

const cancelledResult: AiRuntimeResult = Object.freeze({
  audit: Object.freeze({
    actions: Object.freeze([]),
    outcome: 'cancelled',
    retryCount: 0
  }),
  reason: 'aborted',
  status: 'cancelled'
})

describe.sequential('AI agent Feature lifecycle', () => {
  it('exposes only Runtime and explicit Feature terminal results', () => {
    expectTypeOf<AiAgentFeatureResult>().toEqualTypeOf<
      AiRuntimeResult | AiAgentFeatureTerminalResult
    >()
  })

  it('registers one explicit exclusive programmatic task Feature', () => {
    registerAiAgentFeature({
      run: vi.fn(async () => executedResult)
    })

    expect(FeatureNames.AI_AGENT).toBe('aiAgent')
    expect(
      getFeatureRegistry().getDefinition(FeatureNames.AI_AGENT)
    ).toMatchObject({
      priority: AI_AGENT_FEATURE_PRIORITY,
      exclusive: true,
      task: expect.any(Function)
    })

    expect(unregisterFeature(FeatureNames.AI_AGENT)).toBe(true)
  })

  it('passes normalized intent and the Feature-owned signal to the runtime', async () => {
    const externalController = new AbortController()
    const run = vi.fn(async () => executedResult)
    registerAiAgentFeature({ run })

    const api = getFeature(FeatureNames.AI_AGENT) as {
      execute(
        intent: string,
        options?: { signal?: AbortSignal }
      ): Promise<AiAgentFeatureResult>
    }
    const result = await api.execute('  create a rectangle  ', {
      signal: externalController.signal
    })

    expect(result).toBe(executedResult)
    expect(run).toHaveBeenCalledOnce()
    expect(run).toHaveBeenCalledWith({
      intent: 'create a rectangle',
      signal: expect.any(AbortSignal)
    })
    const runtimeSignal = run.mock.calls[0]?.[0].signal
    expect(runtimeSignal).toBeInstanceOf(AbortSignal)
    expect(runtimeSignal).not.toBe(externalController.signal)
    expect(unregisterFeature(FeatureNames.AI_AGENT)).toBe(true)
  })

  it('forwards detached turn metadata and progress while retaining Feature-owned cancellation', async () => {
    const progressObserver = vi.fn()
    const run = vi.fn(async () => executedResult)
    registerAiAgentFeature({ run })

    const api = getFeature(FeatureNames.AI_AGENT) as {
      execute(request: {
        intent: string
        metadata: Record<string, unknown>
        progressObserver: typeof progressObserver
      }): Promise<AiAgentFeatureResult>
    }
    await api.execute({
      intent: '  畫一個貓臉  ',
      metadata: {
        conversationId: 'conversation-1',
        turnId: 'conversation-1:turn:1'
      },
      progressObserver
    })

    expect(run).toHaveBeenCalledWith({
      intent: '畫一個貓臉',
      metadata: {
        conversationId: 'conversation-1',
        turnId: 'conversation-1:turn:1'
      },
      progressObserver,
      signal: expect.any(AbortSignal)
    })
    expect(unregisterFeature(FeatureNames.AI_AGENT)).toBe(true)
  })

  it('rejects empty intent without starting a Feature task', async () => {
    const run = vi.fn(async () => executedResult)
    registerAiAgentFeature({ run })

    const api = getFeature(FeatureNames.AI_AGENT) as {
      execute(intent: string): Promise<unknown>
    }

    await expect(api.execute('   ')).resolves.toEqual({
      status: 'failed',
      code: 'INVALID_INTENT',
      stage: 'feature'
    })
    expect(run).not.toHaveBeenCalled()
    expect(unregisterFeature(FeatureNames.AI_AGENT)).toBe(true)
  })

  it('uses Feature cancellation and rejects overlapping invocation', async () => {
    let markStarted: (() => void) | undefined
    const started = new Promise<void>((resolve) => {
      markStarted = resolve
    })
    const run = vi.fn(
      async ({ signal }: { intent: string; signal: AbortSignal }) => {
        markStarted?.()
        await new Promise<void>((resolve) => {
          signal.addEventListener('abort', () => resolve(), { once: true })
        })
        return cancelledResult
      }
    )
    registerAiAgentFeature({ run })

    const api = getFeature(FeatureNames.AI_AGENT) as {
      execute(intent: string): Promise<unknown>
      cancel(reason?: unknown): boolean
    }
    const first = api.execute('first')
    await started

    await expect(api.execute('second')).rejects.toEqual(
      expect.objectContaining<Partial<FeatureTaskActiveError>>({
        code: 'FEATURE_TASK_ACTIVE',
        featureName: FeatureNames.AI_AGENT
      })
    )
    expect(api.cancel('user-cancelled')).toBe(true)
    await expect(first).resolves.toBe(cancelledResult)
    expect(run).toHaveBeenCalledOnce()
    expect(unregisterFeature(FeatureNames.AI_AGENT)).toBe(true)
  })
})
