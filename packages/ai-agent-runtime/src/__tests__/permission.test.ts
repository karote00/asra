import { describe, expect, it, vi } from 'vitest'
import {
  AiPermissionError,
  evaluateAiActionBatchPermissions,
  type AiPermissionPolicy,
  type ResolvedAiActionBatch
} from '..'

const resolvedActionBatch = (): {
  readonly executeFirst: ReturnType<typeof vi.fn>
  readonly executeSecond: ReturnType<typeof vi.fn>
  readonly batch: ResolvedAiActionBatch
} => {
  const executeFirst = vi.fn(async () => null)
  const executeSecond = vi.fn(async () => null)
  return {
    executeFirst,
    executeSecond,
    batch: Object.freeze({
      batchId: 'batch-1',
      explanation: 'Apply two actions',
      actions: Object.freeze([
        Object.freeze({
          id: 'action-1',
          name: 'resize',
          arguments: Object.freeze({
            width: 120
          }),
          execute: executeFirst,
          summary: Object.freeze({
            affectedCount: 1,
            actionKind: 'resize'
          })
        }),
        Object.freeze({
          id: 'action-2',
          name: 'select',
          arguments: Object.freeze({
            elementIds: Object.freeze(['shape-1'])
          }),
          execute: executeSecond,
          summary: Object.freeze({
            affectedCount: 1,
            actionKind: 'selection'
          })
        })
      ])
    })
  }
}

describe('AI app permission preflight', () => {
  it('evaluates every action in order and marks one complete confirmation handoff', async () => {
    const { executeFirst, executeSecond, batch } = resolvedActionBatch()
    const context = Object.freeze({
      workspaceId: 'workspace-1'
    })
    const evaluate = vi
      .fn<AiPermissionPolicy['evaluate']>()
      .mockResolvedValueOnce('allow')
      .mockResolvedValueOnce('confirm')

    const ready = await evaluateAiActionBatchPermissions(batch, context, {
      evaluate
    })

    expect(evaluate).toHaveBeenCalledTimes(2)
    expect(evaluate.mock.calls.map(([input]) => input.action.id)).toEqual([
      'action-1',
      'action-2'
    ])
    expect(evaluate.mock.calls[0][0].context).toBe(context)
    expect('execute' in evaluate.mock.calls[0][0].action).toBe(false)
    expect(ready).toMatchObject({
      batchId: 'batch-1',
      confirmationRequired: true,
      actions: [
        {
          id: 'action-1',
          permission: 'allow'
        },
        {
          id: 'action-2',
          permission: 'confirm'
        }
      ]
    })
    expect(Object.isFrozen(ready)).toBe(true)
    expect(Object.isFrozen(ready.actions)).toBe(true)
    expect(executeFirst).not.toHaveBeenCalled()
    expect(executeSecond).not.toHaveBeenCalled()
  })

  it('preserves the explicit allow-only confirmation bypass', async () => {
    const { batch } = resolvedActionBatch()
    const ready = await evaluateAiActionBatchPermissions(
      batch,
      {},
      {
        evaluate: vi.fn(async (): Promise<'allow'> => 'allow')
      }
    )

    expect(ready.confirmationRequired).toBe(false)
    expect(ready.actions.map(({ permission }) => permission)).toEqual([
      'allow',
      'allow'
    ])
  })

  it('evaluates the complete batch but rejects all actions when any decision denies', async () => {
    const { executeFirst, executeSecond, batch } = resolvedActionBatch()
    const evaluate = vi
      .fn<AiPermissionPolicy['evaluate']>()
      .mockResolvedValueOnce('allow')
      .mockResolvedValueOnce('deny')

    await expect(
      evaluateAiActionBatchPermissions(
        batch,
        {},
        {
          evaluate
        }
      )
    ).rejects.toEqual(
      expect.objectContaining({
        code: 'AI_PERMISSION_DENIED',
        deniedActionIds: ['action-2'],
        stage: 'permission'
      })
    )
    expect(evaluate).toHaveBeenCalledTimes(2)
    expect(executeFirst).not.toHaveBeenCalled()
    expect(executeSecond).not.toHaveBeenCalled()
  })

  it('contains malformed or throwing app policy behavior without raw errors', async () => {
    const { batch } = resolvedActionBatch()

    await expect(
      evaluateAiActionBatchPermissions(
        batch,
        {},
        {
          evaluate: vi.fn(async () => 'model-allow' as never)
        }
      )
    ).rejects.toEqual(
      expect.objectContaining({
        code: 'AI_PERMISSION_POLICY_FAILED',
        message: 'App permission policy failed.'
      })
    )

    let failure: AiPermissionError | undefined
    try {
      await evaluateAiActionBatchPermissions(
        batch,
        {},
        {
          evaluate: vi.fn(async () => {
            throw new Error('Bearer backend-authorization-secret')
          })
        }
      )
    } catch (error) {
      failure = error as AiPermissionError
    }

    expect(failure).toMatchObject({
      code: 'AI_PERMISSION_POLICY_FAILED',
      message: 'App permission policy failed.'
    })
    expect(JSON.stringify(failure)).not.toContain(
      'backend-authorization-secret'
    )
  })
})
