import {
  getFeature,
  getFeatureRegistry,
  unregisterFeature,
  type FeatureTaskActiveError
} from '@asyra/feature-system'
import { describe, expect, it, vi } from 'vitest'
import { FeatureNames } from '../../../constants'
import { AI_AGENT_FEATURE_PRIORITY, registerAiAgentFeature } from '..'

describe.sequential('AI agent Feature lifecycle', () => {
  it('registers one explicit exclusive programmatic task Feature', () => {
    registerAiAgentFeature({
      providerEnabled: false
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

  it('returns unavailable before runtime work when the provider is disabled', async () => {
    const run = vi.fn()
    registerAiAgentFeature({
      providerEnabled: false,
      runtime: { run }
    })

    const api = getFeature(FeatureNames.AI_AGENT) as {
      execute(intent: string): Promise<unknown>
    }

    await expect(api.execute('create a rectangle')).resolves.toEqual({
      status: 'unavailable',
      reason: 'provider-disabled'
    })
    expect(run).not.toHaveBeenCalled()
    expect(unregisterFeature(FeatureNames.AI_AGENT)).toBe(true)
  })

  it('passes normalized intent and the Feature-owned signal to the runtime', async () => {
    const externalController = new AbortController()
    const run = vi.fn(async ({ intent, signal }) => ({
      status: 'executed',
      intent,
      signal
    }))
    registerAiAgentFeature({
      providerEnabled: true,
      runtime: { run }
    })

    const api = getFeature(FeatureNames.AI_AGENT) as {
      execute(
        intent: string,
        options?: { signal?: AbortSignal }
      ): Promise<Record<string, unknown>>
    }
    const result = await api.execute('  create a rectangle  ', {
      signal: externalController.signal
    })

    expect(result).toMatchObject({
      status: 'executed',
      intent: 'create a rectangle'
    })
    expect(result.signal).toBeInstanceOf(AbortSignal)
    expect(result.signal).not.toBe(externalController.signal)
    expect(run).toHaveBeenCalledOnce()
    expect(unregisterFeature(FeatureNames.AI_AGENT)).toBe(true)
  })

  it('rejects empty intent without starting a Feature task', async () => {
    const run = vi.fn()
    registerAiAgentFeature({
      providerEnabled: true,
      runtime: { run }
    })

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
      async ({ intent, signal }: { intent: string; signal: AbortSignal }) => {
        markStarted?.()
        await new Promise<void>((resolve) => {
          signal.addEventListener('abort', () => resolve(), { once: true })
        })
        return {
          status: 'cancelled',
          reason: signal.aborted ? 'aborted' : 'active',
          intent
        }
      }
    )
    registerAiAgentFeature({
      providerEnabled: true,
      runtime: { run }
    })

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
    await expect(first).resolves.toEqual({
      status: 'cancelled',
      reason: 'aborted',
      intent: 'first'
    })
    expect(run).toHaveBeenCalledOnce()
    expect(unregisterFeature(FeatureNames.AI_AGENT)).toBe(true)
  })
})
