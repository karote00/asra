import { describe, expect, it, vi } from 'vitest'
import {
  AI_REDACTED_VALUE,
  AiProviderError,
  createAiAgentRuntime,
  type AiActionDefinition,
  type AiRuntimeProgressUpdate,
  type CreateAiAgentRuntimeInput
} from '..'

const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}

const candidatePlan = () => ({
  actions: [
    {
      arguments: {
        elementId: 'shape-1',
        secretToken: 'provider-action-secret',
        visible: false
      },
      id: 'action-1',
      name: 'set_element_visibility'
    }
  ],
  explanation: 'Create a visible result without private reasoning.',
  planId: 'plan-1'
})

const visibilityAction = (
  execute = vi.fn(async () => ({
    apiKey: 'executor-secret',
    changed: true
  }))
): AiActionDefinition<{
  elementId: string
  secretToken: string
  visible: boolean
}> => ({
  description: 'Set element visibility.',
  execute,
  name: 'set_element_visibility',
  schema: {
    parse: (value) => {
      if (
        typeof value === 'object' &&
        value !== null &&
        'elementId' in value &&
        typeof value.elementId === 'string' &&
        'secretToken' in value &&
        typeof value.secretToken === 'string' &&
        'visible' in value &&
        typeof value.visible === 'boolean'
      ) {
        return {
          success: true,
          value: {
            elementId: value.elementId,
            secretToken: value.secretToken,
            visible: value.visible
          }
        }
      }
      return {
        issues: [
          {
            code: 'invalid_arguments',
            message: 'Invalid visibility arguments.',
            path: []
          }
        ],
        success: false
      }
    },
    providerSchema: {
      additionalProperties: false,
      properties: {
        elementId: { type: 'string' },
        secretToken: { type: 'string' },
        visible: { type: 'boolean' }
      },
      required: ['elementId', 'secretToken', 'visible'],
      type: 'object'
    }
  }
})

const runtimeInput = (
  overrides: Partial<CreateAiAgentRuntimeInput> = {}
): CreateAiAgentRuntimeInput => ({
  actionDefinitions: [visibilityAction()],
  confirmationHandler: {
    confirm: vi.fn(async () => true)
  },
  contextProvider: {
    getContext: vi.fn(async () => ({
      accessToken: 'context-secret',
      app: 'test'
    }))
  },
  permissionPolicy: {
    evaluate: vi.fn(async () => 'allow' as const)
  },
  provider: {
    generateActionPlan: vi.fn(async () => candidatePlan())
  },
  transactionRunner: {
    run: async <T>(_label: string, execute: () => Promise<T>) => execute()
  },
  ...overrides
})

const phases = (updates: readonly AiRuntimeProgressUpdate[]) =>
  updates.map((update) => update.phase)

describe('AI runtime operational progress', () => {
  it('emits ordered frozen operational phases with only safe detached metadata', async () => {
    const updates: AiRuntimeProgressUpdate[] = []
    const runtime = createAiAgentRuntime(runtimeInput())

    const result = await runtime.run({
      intent: 'hide the selected shape',
      metadata: {
        authorization: 'Bearer request-secret'
      },
      progressObserver: (update) => updates.push(update),
      signal: new AbortController().signal
    })

    expect(result.status).toBe('executed')
    expect(phases(updates)).toEqual([
      'context',
      'planning',
      'validation',
      'permission',
      'execution',
      'settled'
    ])
    expect(updates).toEqual([
      {
        attempt: 1,
        phase: 'context',
        summary: 'Understanding the request'
      },
      {
        attempt: 1,
        phase: 'planning',
        summary: 'Preparing an action plan'
      },
      {
        actionCount: 1,
        attempt: 1,
        phase: 'validation',
        planId: 'plan-1',
        summary: 'Validating app actions'
      },
      {
        actionCount: 1,
        attempt: 1,
        phase: 'permission',
        planId: 'plan-1',
        summary: 'Checking action permissions'
      },
      {
        actionCount: 1,
        attempt: 1,
        phase: 'execution',
        planId: 'plan-1',
        summary: 'Applying changes'
      },
      {
        actionCount: 1,
        attempt: 1,
        outcome: 'executed',
        phase: 'settled',
        planId: 'plan-1',
        summary: 'Completed'
      }
    ])
    expect(updates.every(Object.isFrozen)).toBe(true)

    const serialized = JSON.stringify(updates)
    expect(serialized).not.toContain('provider-action-secret')
    expect(serialized).not.toContain('context-secret')
    expect(serialized).not.toContain('executor-secret')
    expect(serialized).not.toContain('request-secret')
    expect(serialized).not.toContain('arguments')
    expect(serialized).not.toContain('chain-of-thought')
  })

  it('emits confirmation only while a confirmation-required plan waits', async () => {
    const updates: AiRuntimeProgressUpdate[] = []
    const confirmation = deferred<boolean>()
    const runtime = createAiAgentRuntime(
      runtimeInput({
        confirmationHandler: {
          confirm: vi.fn(() => confirmation.promise)
        },
        permissionPolicy: {
          evaluate: vi.fn(async () => 'confirm' as const)
        }
      })
    )

    const settlement = runtime.run({
      intent: 'delete the selected shape',
      progressObserver: (update) => updates.push(update),
      signal: new AbortController().signal
    })

    await vi.waitFor(() => {
      expect(phases(updates)).toContain('confirmation')
    })
    expect(updates.at(-1)).toEqual({
      actionCount: 1,
      attempt: 1,
      phase: 'confirmation',
      planId: 'plan-1',
      summary: 'Waiting for confirmation'
    })

    confirmation.resolve(true)
    await expect(settlement).resolves.toMatchObject({
      status: 'executed'
    })
    expect(phases(updates)).toEqual([
      'context',
      'planning',
      'validation',
      'permission',
      'confirmation',
      'execution',
      'settled'
    ])
  })

  it('redacts a secret-shaped provider plan identity before observation', async () => {
    const updates: AiRuntimeProgressUpdate[] = []
    const runtime = createAiAgentRuntime(
      runtimeInput({
        provider: {
          generateActionPlan: vi.fn(async () => ({
            ...candidatePlan(),
            planId: 'Bearer provider-plan-secret'
          }))
        }
      })
    )

    await runtime.run({
      intent: 'hide the selected shape',
      progressObserver: (update) => updates.push(update),
      signal: new AbortController().signal
    })

    expect(
      updates
        .filter((update) => update.planId !== undefined)
        .every((update) => update.planId === AI_REDACTED_VALUE)
    ).toBe(true)
    expect(JSON.stringify(updates)).not.toContain('provider-plan-secret')
  })

  it('contains observer exceptions without changing execution or terminal output', async () => {
    const execute = vi.fn(async () => ({ changed: true }))
    const progressObserver = vi.fn(() => {
      throw new Error('observer failure')
    })
    const runtime = createAiAgentRuntime(
      runtimeInput({
        actionDefinitions: [visibilityAction(execute)]
      })
    )

    const result = await runtime.run({
      intent: 'hide the selected shape',
      progressObserver,
      signal: new AbortController().signal
    })

    expect(result.status).toBe('executed')
    expect(execute).toHaveBeenCalledOnce()
    expect(progressObserver).toHaveBeenCalledTimes(6)
  })

  it('emits retry attempts and one stable failed settlement', async () => {
    const updates: AiRuntimeProgressUpdate[] = []
    const runtime = createAiAgentRuntime(
      runtimeInput({
        options: {
          retryPolicy: {
            maxAttempts: 2,
            shouldRetry: () => true
          }
        },
        provider: {
          generateActionPlan: vi.fn(async () => {
            throw new AiProviderError({
              code: 'AI_PROVIDER_TRANSPORT_FAILED',
              message: 'Bearer provider-secret',
              retryable: true
            })
          })
        }
      })
    )

    const result = await runtime.run({
      intent: 'fail safely',
      progressObserver: (update) => updates.push(update),
      signal: new AbortController().signal
    })

    expect(result).toMatchObject({
      retryCount: 1,
      status: 'failed'
    })
    expect(phases(updates)).toEqual([
      'context',
      'planning',
      'planning',
      'settled'
    ])
    expect(updates.at(-1)).toEqual({
      attempt: 2,
      outcome: 'failed',
      phase: 'settled',
      summary: 'Failed'
    })
    expect(JSON.stringify(updates)).not.toContain('provider-secret')
  })

  it('stops progress after caller abort while provider work is pending', async () => {
    const updates: AiRuntimeProgressUpdate[] = []
    const provider = deferred<ReturnType<typeof candidatePlan>>()
    const controller = new AbortController()
    const runtime = createAiAgentRuntime(
      runtimeInput({
        provider: {
          generateActionPlan: vi.fn(() => provider.promise)
        }
      })
    )

    const settlement = runtime.run({
      intent: 'wait for planning',
      progressObserver: (update) => updates.push(update),
      signal: controller.signal
    })
    await vi.waitFor(() => {
      expect(phases(updates)).toEqual(['context', 'planning'])
    })

    controller.abort('cancelled by user')
    await expect(settlement).resolves.toMatchObject({
      reason: 'aborted',
      status: 'cancelled'
    })
    const countAfterAbort = updates.length

    provider.resolve(candidatePlan())
    await Promise.resolve()
    expect(updates).toHaveLength(countAfterAbort)
    expect(phases(updates)).not.toContain('settled')
  })

  it('stops progress after runtime disposal and awaits the cancelled invocation', async () => {
    const updates: AiRuntimeProgressUpdate[] = []
    const provider = deferred<ReturnType<typeof candidatePlan>>()
    const runtime = createAiAgentRuntime(
      runtimeInput({
        provider: {
          generateActionPlan: vi.fn(() => provider.promise)
        }
      })
    )

    const settlement = runtime.run({
      intent: 'wait for disposal',
      progressObserver: (update) => updates.push(update),
      signal: new AbortController().signal
    })
    await vi.waitFor(() => {
      expect(phases(updates)).toEqual(['context', 'planning'])
    })

    await runtime.dispose()
    await expect(settlement).resolves.toMatchObject({
      reason: 'aborted',
      status: 'cancelled'
    })
    const countAfterDispose = updates.length

    provider.resolve(candidatePlan())
    await Promise.resolve()
    expect(updates).toHaveLength(countAfterDispose)
  })
})
