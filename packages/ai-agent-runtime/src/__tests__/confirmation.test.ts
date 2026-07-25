import { describe, expect, it, vi } from 'vitest'
import {
  AI_REDACTED_VALUE,
  AiConfirmationError,
  confirmAiPlan,
  type AiConfirmationHandler,
  type AiPermissionReadyPlan
} from '..'

const permissionReadyPlan = (
  confirmationRequired: boolean
): {
  readonly execute: ReturnType<typeof vi.fn>
  readonly plan: AiPermissionReadyPlan
} => {
  const execute = vi.fn(async () => null)
  return {
    execute,
    plan: Object.freeze({
      planId: 'plan-1',
      explanation: 'Bearer explanation-secret',
      confirmationRequired,
      actions: Object.freeze([
        Object.freeze({
          id: 'action-1',
          name: 'resize',
          arguments: Object.freeze({
            authorization: 'Bearer argument-secret',
            width: 120
          }),
          execute,
          permission: confirmationRequired ? 'confirm' : 'allow'
        })
      ])
    })
  }
}

describe('AI complete-plan confirmation', () => {
  it('uses the explicit allow-only bypass without invoking the handler', async () => {
    const { execute, plan } = permissionReadyPlan(false)
    const confirm = vi.fn(async () => true)

    const confirmed = await confirmAiPlan(
      plan,
      {
        confirm
      },
      new AbortController().signal
    )

    expect(confirm).not.toHaveBeenCalled()
    expect(confirmed.confirmation).toBe('bypassed')
    expect(confirmed.actions[0].execute).toBe(execute)
    expect(execute).not.toHaveBeenCalled()
  })

  it('calls the handler once with one immutable redacted complete preview', async () => {
    const { execute, plan } = permissionReadyPlan(true)
    const controller = new AbortController()
    const confirm = vi
      .fn<AiConfirmationHandler['confirm']>()
      .mockResolvedValue(true)

    const confirmed = await confirmAiPlan(
      plan,
      {
        confirm
      },
      controller.signal
    )

    expect(confirm).toHaveBeenCalledOnce()
    const [preview, options] = confirm.mock.calls[0]
    expect(options.signal).toBe(controller.signal)
    expect(preview).toEqual({
      planId: 'plan-1',
      explanation: AI_REDACTED_VALUE,
      actions: [
        {
          id: 'action-1',
          name: 'resize',
          arguments: {
            authorization: AI_REDACTED_VALUE,
            width: 120
          },
          permission: 'confirm'
        }
      ]
    })
    expect('execute' in preview.actions[0]).toBe(false)
    expect(Object.isFrozen(preview)).toBe(true)
    expect(Object.isFrozen(preview.actions)).toBe(true)
    expect(Object.isFrozen(preview.actions[0].arguments)).toBe(true)
    expect(confirmed.confirmation).toBe('accepted')
    expect(confirmed.preview).toBe(preview)
    expect(execute).not.toHaveBeenCalled()
  })

  it('returns stable cancellation without exposing an executable prefix', async () => {
    const { execute, plan } = permissionReadyPlan(true)

    await expect(
      confirmAiPlan(
        plan,
        {
          confirm: vi.fn(async () => false)
        },
        new AbortController().signal
      )
    ).rejects.toEqual(
      expect.objectContaining({
        code: 'AI_CONFIRMATION_CANCELLED',
        stage: 'confirmation'
      })
    )
    expect(execute).not.toHaveBeenCalled()
  })

  it('bypasses the handler on pre-abort and settles an in-flight abort', async () => {
    const { plan } = permissionReadyPlan(true)
    const preAborted = new AbortController()
    preAborted.abort()
    const confirm = vi.fn(async () => true)

    await expect(
      confirmAiPlan(
        plan,
        {
          confirm
        },
        preAborted.signal
      )
    ).rejects.toEqual(
      expect.objectContaining({
        code: 'AI_CONFIRMATION_ABORTED'
      })
    )
    expect(confirm).not.toHaveBeenCalled()

    const controller = new AbortController()
    const removeListener = vi.spyOn(controller.signal, 'removeEventListener')
    const pending = confirmAiPlan(
      plan,
      {
        confirm: vi.fn(async () => new Promise<boolean>(() => undefined))
      },
      controller.signal
    )
    const rejection = expect(pending).rejects.toEqual(
      expect.objectContaining({
        code: 'AI_CONFIRMATION_ABORTED'
      })
    )

    controller.abort()
    await rejection

    expect(removeListener).toHaveBeenCalledOnce()
  })

  it('contains throwing or malformed handler output without raw errors', async () => {
    const { plan } = permissionReadyPlan(true)
    let failure: AiConfirmationError | undefined

    try {
      await confirmAiPlan(
        plan,
        {
          confirm: vi.fn(async () => {
            throw new Error('Bearer confirmation-secret')
          })
        },
        new AbortController().signal
      )
    } catch (error) {
      failure = error as AiConfirmationError
    }

    expect(failure).toMatchObject({
      code: 'AI_CONFIRMATION_HANDLER_FAILED',
      message: 'App confirmation handler failed.'
    })
    expect(JSON.stringify(failure)).not.toContain('confirmation-secret')

    await expect(
      confirmAiPlan(
        plan,
        {
          confirm: vi.fn(async () => 'accepted' as unknown as boolean)
        },
        new AbortController().signal
      )
    ).rejects.toEqual(
      expect.objectContaining({
        code: 'AI_CONFIRMATION_HANDLER_FAILED'
      })
    )
  })
})
