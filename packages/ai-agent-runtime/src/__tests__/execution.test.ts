import { describe, expect, it, vi } from 'vitest'
import {
  AI_REDACTED_VALUE,
  AiExecutionError,
  executeAiActions,
  type AiConfirmedPlan,
  type AiExecutionContext
} from '..'

const confirmedPlan = (
  executors: readonly ((
    args: unknown,
    context: AiExecutionContext
  ) => Promise<unknown>)[]
): AiConfirmedPlan =>
  Object.freeze({
    planId: 'plan-1',
    confirmationRequired: false,
    confirmation: 'bypassed',
    preview: Object.freeze({
      planId: 'plan-1',
      actions: Object.freeze([])
    }),
    actions: Object.freeze(
      executors.map((execute, index) =>
        Object.freeze({
          id: `action-${index + 1}`,
          name: `action_${index + 1}`,
          arguments: Object.freeze({
            index
          }),
          execute,
          permission: 'allow' as const
        })
      )
    )
  })

describe('AI registered action execution', () => {
  it('executes in order and returns detached redacted summaries', async () => {
    let releaseFirst: (() => void) | undefined
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const first = vi.fn(async (_args: unknown, context: AiExecutionContext) => {
      expect(Object.isFrozen(context)).toBe(true)
      await firstGate
      return {
        ok: true,
        token: 'executor-secret'
      }
    })
    const secondResult = {
      selectedCount: 2
    }
    const second = vi.fn(async () => secondResult)
    const signal = new AbortController().signal
    const pending = executeAiActions(confirmedPlan([first, second]), signal)

    await vi.waitFor(() => expect(first).toHaveBeenCalledOnce())
    expect(second).not.toHaveBeenCalled()
    releaseFirst?.()
    const batch = await pending
    secondResult.selectedCount = 99

    expect(first.mock.calls[0][0]).toEqual({
      index: 0
    })
    expect(first.mock.calls[0][1].signal).toBe(signal)
    expect(second).toHaveBeenCalledOnce()
    expect(batch).toEqual({
      actionResults: [
        {
          actionId: 'action-1',
          actionName: 'action_1',
          result: {
            ok: true,
            token: AI_REDACTED_VALUE
          }
        },
        {
          actionId: 'action-2',
          actionName: 'action_2',
          result: {
            selectedCount: 2
          }
        }
      ]
    })
    expect(Object.isFrozen(batch)).toBe(true)
    expect(Object.isFrozen(batch.actionResults)).toBe(true)
    expect(Object.isFrozen(batch.actionResults[0].result)).toBe(true)
  })

  it('does not invoke an executor for pre-abort', async () => {
    const controller = new AbortController()
    controller.abort()
    const execute = vi.fn(async () => null)

    await expect(
      executeAiActions(confirmedPlan([execute]), controller.signal)
    ).rejects.toEqual(
      expect.objectContaining({
        code: 'AI_EXECUTION_ABORTED',
        stage: 'execution'
      })
    )
    expect(execute).not.toHaveBeenCalled()
  })

  it('checks abort after awaited work and stops before the next action', async () => {
    const controller = new AbortController()
    const first = vi.fn(async () => {
      controller.abort()
      return {
        applied: true
      }
    })
    const second = vi.fn(async () => null)

    await expect(
      executeAiActions(confirmedPlan([first, second]), controller.signal)
    ).rejects.toBeInstanceOf(AiExecutionError)

    expect(first).toHaveBeenCalledOnce()
    expect(second).not.toHaveBeenCalled()
  })

  it('stops later actions and preserves executor rejection for rollback', async () => {
    const failure = new Error('app executor failed')
    const first = vi.fn(async () => {
      throw failure
    })
    const second = vi.fn(async () => null)

    await expect(
      executeAiActions(
        confirmedPlan([first, second]),
        new AbortController().signal
      )
    ).rejects.toBe(failure)

    expect(first).toHaveBeenCalledOnce()
    expect(second).not.toHaveBeenCalled()
  })

  it('does not invoke accessors while detaching executor summaries', async () => {
    const getter = vi.fn(() => 'executor-secret')
    const result: unknown[] = []
    Object.defineProperty(result, '0', {
      enumerable: true,
      get: getter
    })
    result.length = 1

    const batch = await executeAiActions(
      confirmedPlan([async () => result]),
      new AbortController().signal
    )

    expect(getter).not.toHaveBeenCalled()
    expect(batch.actionResults[0].result).toEqual([AI_REDACTED_VALUE])
  })
})
