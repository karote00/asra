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

const candidateActionBatch = () => ({
  actions: [
    {
      arguments: {
        elementId: 'shape-1',
        secretToken: 'provider-action-secret',
        visible: false
      },
      id: 'action-1',
      name: 'set_element_visibility',
      summary: {
        affectedCount: 1,
        actionKind: 'visibility'
      }
    }
  ],
  explanation: 'Create a visible result without private reasoning.',
  batchId: 'batch-1'
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
  inputSchema: {
    additionalProperties: false,
    properties: {
      elementId: { type: 'string' },
      secretToken: { type: 'string' },
      visible: { type: 'boolean' }
    },
    required: ['elementId', 'secretToken', 'visible'],
    type: 'object'
  },
  name: 'set_element_visibility'
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
    requestActionBatch: vi.fn(async () => candidateActionBatch())
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
      'provider',
      'resolution',
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
        phase: 'provider',
        summary: 'Requesting an action batch'
      },
      {
        attempt: 1,
        phase: 'resolution',
        summary: 'Resolving app actions'
      },
      {
        actionCount: 1,
        attempt: 1,
        phase: 'permission',
        batchId: 'batch-1',
        summary: 'Checking action permissions'
      },
      {
        actionCount: 1,
        attempt: 1,
        phase: 'execution',
        batchId: 'batch-1',
        summary: 'Applying changes'
      },
      {
        actionCount: 1,
        attempt: 1,
        outcome: 'executed',
        phase: 'settled',
        batchId: 'batch-1',
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

  it('emits confirmation only while a confirmation-required batch waits', async () => {
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
      batchId: 'batch-1',
      summary: 'Waiting for confirmation'
    })

    confirmation.resolve(true)
    await expect(settlement).resolves.toMatchObject({
      status: 'executed'
    })
    expect(phases(updates)).toEqual([
      'context',
      'provider',
      'resolution',
      'permission',
      'confirmation',
      'execution',
      'settled'
    ])
  })

  it('redacts a secret-shaped provider batch identity before observation', async () => {
    const updates: AiRuntimeProgressUpdate[] = []
    const runtime = createAiAgentRuntime(
      runtimeInput({
        provider: {
          requestActionBatch: vi.fn(async () => ({
            ...candidateActionBatch(),
            batchId: 'Bearer provider-batch-secret'
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
        .filter((update) => update.batchId !== undefined)
        .every((update) => update.batchId === AI_REDACTED_VALUE)
    ).toBe(true)
    expect(JSON.stringify(updates)).not.toContain('provider-batch-secret')
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
          requestActionBatch: vi.fn(async () => {
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
      'provider',
      'provider',
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
    const provider = deferred<ReturnType<typeof candidateActionBatch>>()
    const controller = new AbortController()
    const runtime = createAiAgentRuntime(
      runtimeInput({
        provider: {
          requestActionBatch: vi.fn(() => provider.promise)
        }
      })
    )

    const settlement = runtime.run({
      intent: 'wait for provider',
      progressObserver: (update) => updates.push(update),
      signal: controller.signal
    })
    await vi.waitFor(() => {
      expect(phases(updates)).toEqual(['context', 'provider'])
    })

    controller.abort('cancelled by user')
    await expect(settlement).resolves.toMatchObject({
      reason: 'aborted',
      status: 'cancelled'
    })
    const countAfterAbort = updates.length

    provider.resolve(candidateActionBatch())
    await Promise.resolve()
    expect(updates).toHaveLength(countAfterAbort)
    expect(phases(updates)).not.toContain('settled')
  })

  it('stops progress after runtime disposal and awaits the cancelled invocation', async () => {
    const updates: AiRuntimeProgressUpdate[] = []
    const provider = deferred<ReturnType<typeof candidateActionBatch>>()
    const runtime = createAiAgentRuntime(
      runtimeInput({
        provider: {
          requestActionBatch: vi.fn(() => provider.promise)
        }
      })
    )

    const settlement = runtime.run({
      intent: 'wait for disposal',
      progressObserver: (update) => updates.push(update),
      signal: new AbortController().signal
    })
    await vi.waitFor(() => {
      expect(phases(updates)).toEqual(['context', 'provider'])
    })

    await runtime.dispose()
    await expect(settlement).resolves.toMatchObject({
      reason: 'aborted',
      status: 'cancelled'
    })
    const countAfterDispose = updates.length

    provider.resolve(candidateActionBatch())
    await Promise.resolve()
    expect(updates).toHaveLength(countAfterDispose)
  })
})
