import { describe, expect, it, vi } from 'vitest'
import {
  AiPermissionError,
  evaluateAiPlanPermissions,
  type AiPermissionPolicy,
  type AiPreparedPlan
} from '..'

const preparedPlan = (): {
  readonly executeFirst: ReturnType<typeof vi.fn>
  readonly executeSecond: ReturnType<typeof vi.fn>
  readonly plan: AiPreparedPlan
} => {
  const executeFirst = vi.fn(async () => null)
  const executeSecond = vi.fn(async () => null)
  return {
    executeFirst,
    executeSecond,
    plan: Object.freeze({
      planId: 'plan-1',
      explanation: 'Apply two actions',
      actions: Object.freeze([
        Object.freeze({
          id: 'action-1',
          name: 'resize',
          arguments: Object.freeze({
            width: 120
          }),
          execute: executeFirst
        }),
        Object.freeze({
          id: 'action-2',
          name: 'select',
          arguments: Object.freeze({
            elementIds: Object.freeze(['shape-1'])
          }),
          execute: executeSecond
        })
      ])
    })
  }
}

describe('AI app permission preflight', () => {
  it('evaluates every action in order and marks one complete confirmation handoff', async () => {
    const { executeFirst, executeSecond, plan } = preparedPlan()
    const context = Object.freeze({
      workspaceId: 'workspace-1'
    })
    const evaluate = vi
      .fn<AiPermissionPolicy['evaluate']>()
      .mockResolvedValueOnce('allow')
      .mockResolvedValueOnce('confirm')

    const ready = await evaluateAiPlanPermissions(plan, context, {
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
      planId: 'plan-1',
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
    const { plan } = preparedPlan()
    const ready = await evaluateAiPlanPermissions(
      plan,
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

  it('evaluates the complete plan but rejects all actions when any decision denies', async () => {
    const { executeFirst, executeSecond, plan } = preparedPlan()
    const evaluate = vi
      .fn<AiPermissionPolicy['evaluate']>()
      .mockResolvedValueOnce('allow')
      .mockResolvedValueOnce('deny')

    await expect(
      evaluateAiPlanPermissions(
        plan,
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
    const { plan } = preparedPlan()

    await expect(
      evaluateAiPlanPermissions(
        plan,
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
      await evaluateAiPlanPermissions(
        plan,
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
