import { describe, expect, it, vi } from 'vitest'
import * as publicApi from '..'
import {
  AI_REDACTED_VALUE,
  createAiAgentRuntime,
  type AiActionBatch,
  type AiActionDefinition,
  type AiExecutionContext,
  type AiTransactionRunner,
  type CreateAiAgentRuntimeInput
} from '..'

const actionBatch = (actions: AiActionBatch['actions']): AiActionBatch => ({
  actions,
  batchId: 'batch-1',
  explanation: 'Resolve the requested edits'
})

const transactionEvidence = (): {
  readonly run: ReturnType<typeof vi.fn>
  readonly runner: AiTransactionRunner
} => {
  const run = vi.fn()
  return {
    run,
    runner: {
      run: async <T>(label: string, execute: () => Promise<T>) => {
        run(label)
        return execute()
      }
    }
  }
}

const runtimeInput = (
  actionDefinitions: readonly AiActionDefinition[],
  providerOutput: AiActionBatch,
  overrides: Partial<CreateAiAgentRuntimeInput> = {}
): CreateAiAgentRuntimeInput => ({
  actionDefinitions,
  confirmationHandler: {
    confirm: vi.fn(async () => true)
  },
  contextProvider: {
    getContext: vi.fn(async () => Object.freeze({ workspaceId: 'workspace-1' }))
  },
  permissionPolicy: {
    evaluate: vi.fn(async () => 'allow' as const)
  },
  provider: {
    requestActionBatch: vi.fn(async () => providerOutput)
  },
  transactionRunner: transactionEvidence().runner,
  ...overrides
})

const serverAction = (
  execute: AiActionDefinition['execute']
): AiActionDefinition => ({
  description: 'Insert one server-prepared composition',
  execute,
  inputSchema: {
    type: 'object'
  },
  name: 'insert_composition'
})

describe('server-prepared AiActionBatch resolution boundary', () => {
  it('exposes the action-batch contract without any product Plan API', async () => {
    const runtime = createAiAgentRuntime(
      runtimeInput([serverAction(vi.fn(async () => null))], actionBatch([]))
    )
    expect(runtime).toHaveProperty('resolveAiActionBatch')
    expect(publicApi).not.toHaveProperty('resolveAiActionBatch')
    expect(publicApi).not.toHaveProperty('resolveAiExecutionPlan')
    expect(publicApi).not.toHaveProperty('generateActionPlan')
    expect(publicApi).not.toHaveProperty('confirmAiPlan')
    expect(publicApi).not.toHaveProperty('runAiPlanTransaction')
    expect(publicApi).not.toHaveProperty('AI_PLAN_TRANSACTION_LABEL')
    await runtime.dispose()
  })

  it('resolves batchId while preserving arguments without traversing poison nested getters or proxies', async () => {
    const nestedGetter = vi.fn(() => {
      throw new Error('Runtime traversed nested items.')
    })
    const nestedProxyTrap = vi.fn(() => {
      throw new Error('Runtime traversed nested geometry.')
    })
    const nestedGeometry = new Proxy(
      {},
      {
        getOwnPropertyDescriptor: nestedProxyTrap,
        getPrototypeOf: nestedProxyTrap,
        ownKeys: nestedProxyTrap,
        preventExtensions: nestedProxyTrap
      }
    )
    const rawArguments: Record<string, unknown> = {
      compactGeometry: nestedGeometry
    }
    Object.defineProperty(rawArguments, 'items', {
      enumerable: true,
      get: nestedGetter
    })
    const summaryTrap = vi.fn(() => {
      throw new Error('Runtime traversed the server-bounded summary.')
    })
    const summary = new Proxy(
      {},
      {
        getOwnPropertyDescriptor: summaryTrap,
        getPrototypeOf: summaryTrap,
        ownKeys: summaryTrap,
        preventExtensions: summaryTrap
      }
    ) as AiActionBatch['actions'][number]['summary']
    const execute = vi.fn(
      async (_arguments: unknown, _context: AiExecutionContext) =>
        Object.freeze({ inserted: true })
    )
    const batch = actionBatch([
      {
        arguments: rawArguments,
        id: 'action-1',
        name: 'insert_composition',
        summary
      }
    ])

    const runtime = createAiAgentRuntime(
      runtimeInput([serverAction(execute)], batch)
    )
    const resolved = runtime.resolveAiActionBatch(batch, {
      signal: new AbortController().signal
    })

    expect(resolved.batchId).toBe('batch-1')
    expect(resolved.actions[0]?.arguments).toBe(rawArguments)
    expect(nestedGetter).not.toHaveBeenCalled()
    expect(nestedProxyTrap).not.toHaveBeenCalled()
    expect(summaryTrap).not.toHaveBeenCalled()
    expect(Object.isFrozen(rawArguments)).toBe(false)
    await runtime.dispose()
  })

  it('preserves the same arguments identity through permission and execution with a summary-only preview', async () => {
    const rawArguments = {
      compactGeometry: Object.freeze({
        coordinateCount: 12_919
      })
    }
    const execute = vi.fn(
      async (_arguments: unknown, _context: AiExecutionContext) =>
        Object.freeze({ inserted: true })
    )
    let permissionArguments: unknown
    let confirmationPreview: unknown
    const confirm = vi.fn(async (preview) => {
      confirmationPreview = preview
      return true
    })
    const transaction = transactionEvidence()
    const runtime = createAiAgentRuntime(
      runtimeInput(
        [serverAction(execute)],
        actionBatch([
          {
            arguments: rawArguments,
            id: 'action-1',
            name: 'insert_composition',
            summary: {
              affectedCount: 7_076,
              authorization: 'Bearer summary-secret',
              kind: 'insert-composition'
            }
          }
        ]),
        {
          confirmationHandler: {
            confirm
          },
          permissionPolicy: {
            evaluate: vi.fn(async ({ action }) => {
              permissionArguments = action.arguments
              return 'confirm' as const
            })
          },
          transactionRunner: transaction.runner
        }
      )
    )

    const result = await runtime.run({
      intent: 'draw the requested composition',
      signal: new AbortController().signal
    })

    expect(result.status).toBe('executed')
    if (result.status !== 'executed') {
      throw new Error('Expected the resolved action batch to execute.')
    }
    expect(result.batchId).toBe('batch-1')
    expect(permissionArguments).toBe(rawArguments)
    expect(execute).toHaveBeenCalledOnce()
    expect(execute.mock.calls[0]?.[0]).toBe(rawArguments)
    expect(result.preview).toBe(confirmationPreview)
    expect(result.preview).toEqual({
      actions: [
        {
          id: 'action-1',
          name: 'insert_composition',
          permission: 'confirm',
          summary: {
            affectedCount: 7_076,
            authorization: AI_REDACTED_VALUE,
            kind: 'insert-composition'
          }
        }
      ],
      batchId: 'batch-1',
      explanation: 'Resolve the requested edits'
    })
    expect(JSON.stringify(result.preview)).not.toMatch(
      /arguments|compactGeometry|coordinateCount/
    )
    expect(transaction.run).toHaveBeenCalledOnce()

    await runtime.dispose()
  })

  it('rejects an unknown action without traversing any action arguments', async () => {
    const poisonTrap = vi.fn(() => {
      throw new Error('Runtime traversed unknown action arguments.')
    })
    const poisonArguments = new Proxy(
      {},
      {
        getOwnPropertyDescriptor: poisonTrap,
        getPrototypeOf: poisonTrap,
        ownKeys: poisonTrap,
        preventExtensions: poisonTrap
      }
    )
    const execute = vi.fn(async () => null)
    const permission = vi.fn(async () => 'allow' as const)
    const transaction = transactionEvidence()
    const runtime = createAiAgentRuntime(
      runtimeInput(
        [serverAction(execute)],
        actionBatch([
          {
            arguments: {},
            id: 'action-1',
            name: 'insert_composition',
            summary: {
              kind: 'insert-composition'
            }
          },
          {
            arguments: poisonArguments,
            id: 'action-2',
            name: 'unknown_action',
            summary: {
              kind: 'unknown'
            }
          }
        ]),
        {
          permissionPolicy: {
            evaluate: permission
          },
          transactionRunner: transaction.runner
        }
      )
    )

    const result = await runtime.run({
      intent: 'reject the unknown action',
      signal: new AbortController().signal
    })

    expect(result).toMatchObject({
      code: 'AI_ACTION_BATCH_UNKNOWN_ACTION',
      stage: 'resolution',
      status: 'failed'
    })
    expect(poisonTrap).not.toHaveBeenCalled()
    expect(permission).not.toHaveBeenCalled()
    expect(transaction.run).not.toHaveBeenCalled()
    expect(execute).not.toHaveBeenCalled()

    await runtime.dispose()
  })
})
