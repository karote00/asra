import { describe, expect, it, vi } from 'vitest'
import {
  createAiAgentRuntime,
  type AiActionBatch,
  type AiActionDefinition,
  type AiTransactionRunner
} from '..'

const action = (
  execute = vi.fn(async () => null)
): AiActionDefinition<{ readonly width: number }> => ({
  description: 'Resize an element',
  execute,
  inputSchema: {
    type: 'object'
  },
  name: 'resize'
})

const runBatch = async (
  providerOutput: AiActionBatch,
  definition: AiActionDefinition = action()
) => {
  const permission = vi.fn(async () => 'allow' as const)
  const confirm = vi.fn(async () => true)
  const transactionRun = vi.fn()
  const transactionRunner: AiTransactionRunner = {
    run: async <T>(label: string, execute: () => Promise<T>) => {
      transactionRun(label)
      return execute()
    }
  }
  const runtime = createAiAgentRuntime({
    actionDefinitions: [definition],
    confirmationHandler: {
      confirm
    },
    contextProvider: {
      getContext: vi.fn(async () => Object.freeze({}))
    },
    permissionPolicy: {
      evaluate: permission
    },
    provider: {
      requestActionBatch: vi.fn(async () => providerOutput)
    },
    transactionRunner
  })
  const result = await runtime.run({
    intent: 'resolve the action batch',
    signal: new AbortController().signal
  })
  await runtime.dispose()
  return {
    confirm,
    permission,
    result,
    transactionRun
  }
}

describe('complete server-prepared AiActionBatch resolution', () => {
  it.each([
    [
      {
        actions: [],
        batchId: 'batch-1'
      },
      'AI_ACTION_BATCH_EMPTY'
    ],
    [
      {
        actions: [
          {
            arguments: {
              width: 100
            },
            id: 'duplicate',
            name: 'resize',
            summary: {
              kind: 'resize'
            }
          },
          {
            arguments: {
              width: 200
            },
            id: 'duplicate',
            name: 'resize',
            summary: {
              kind: 'resize'
            }
          }
        ],
        batchId: 'batch-1'
      },
      'AI_ACTION_BATCH_DUPLICATE_ACTION_ID'
    ]
  ] as const)(
    'rejects an invalid complete envelope before downstream work',
    async (providerOutput, code) => {
      const execute = vi.fn(async () => null)
      const evidence = await runBatch(providerOutput, action(execute))

      expect(evidence.result).toMatchObject({
        code,
        stage: 'resolution',
        status: 'failed'
      })
      expect(execute).not.toHaveBeenCalled()
      expect(evidence.permission).not.toHaveBeenCalled()
      expect(evidence.confirm).not.toHaveBeenCalled()
      expect(evidence.transactionRun).not.toHaveBeenCalled()
    }
  )

  it.each([
    null,
    [],
    {},
    {
      actions: [],
      batchId: ''
    },
    {
      actions: [],
      explanation: 42,
      batchId: 'batch-1'
    },
    {
      actions: new Array(1),
      batchId: 'batch-1'
    },
    {
      actions: [
        {
          arguments: {},
          id: '',
          name: 'resize',
          summary: {}
        }
      ],
      batchId: 'batch-1'
    },
    {
      actions: [
        {
          arguments: {},
          id: 'action-1',
          name: '',
          summary: {}
        }
      ],
      batchId: 'batch-1'
    },
    {
      actions: [
        {
          id: 'action-1',
          name: 'resize',
          summary: {}
        }
      ],
      batchId: 'batch-1'
    },
    {
      actions: [
        {
          arguments: {},
          id: 'action-1',
          name: 'resize'
        }
      ],
      batchId: 'batch-1'
    }
  ] as const)(
    'contains malformed action-batch envelopes without downstream work',
    async (providerOutput) => {
      const execute = vi.fn(async () => null)
      const evidence = await runBatch(
        providerOutput as AiActionBatch,
        action(execute)
      )

      expect(evidence.result).toMatchObject({
        code: 'AI_ACTION_BATCH_MALFORMED',
        stage: 'provider',
        status: 'failed'
      })
      expect(execute).not.toHaveBeenCalled()
      expect(evidence.permission).not.toHaveBeenCalled()
      expect(evidence.confirm).not.toHaveBeenCalled()
      expect(evidence.transactionRun).not.toHaveBeenCalled()
    }
  )
})
