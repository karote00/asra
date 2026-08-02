import { describe, expect, it, vi } from 'vitest'
import {
  AI_REDACTED_VALUE,
  AiConfirmationError,
  confirmAiActionBatch,
  type AiConfirmationHandler,
  type PermissionReadyAiActionBatch
} from '..'

const permissionReadyActionBatch = (
  confirmationRequired: boolean
): {
  readonly execute: ReturnType<typeof vi.fn>
  readonly batch: PermissionReadyAiActionBatch
} => {
  const execute = vi.fn(async () => null)
  return {
    execute,
    batch: Object.freeze({
      batchId: 'batch-1',
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
          permission: confirmationRequired ? 'confirm' : 'allow',
          summary: Object.freeze({
            affectedCount: 1,
            authorization: 'Bearer summary-secret',
            actionKind: 'resize'
          })
        })
      ])
    })
  }
}

describe('AI complete action-batch confirmation', () => {
  it('uses the explicit allow-only bypass without invoking the handler', async () => {
    const { execute, batch } = permissionReadyActionBatch(false)
    const confirm = vi.fn(async () => true)

    const confirmed = await confirmAiActionBatch(
      batch,
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
    const { execute, batch } = permissionReadyActionBatch(true)
    const controller = new AbortController()
    const confirm = vi
      .fn<AiConfirmationHandler['confirm']>()
      .mockResolvedValue(true)

    const confirmed = await confirmAiActionBatch(
      batch,
      {
        confirm
      },
      controller.signal
    )

    expect(confirm).toHaveBeenCalledOnce()
    const [preview, options] = confirm.mock.calls[0]
    expect(options.signal).toBe(controller.signal)
    expect(preview).toEqual({
      batchId: 'batch-1',
      explanation: AI_REDACTED_VALUE,
      actions: [
        {
          id: 'action-1',
          name: 'resize',
          permission: 'confirm',
          summary: {
            affectedCount: 1,
            authorization: AI_REDACTED_VALUE,
            actionKind: 'resize'
          }
        }
      ]
    })
    expect('execute' in preview.actions[0]).toBe(false)
    expect('arguments' in preview.actions[0]).toBe(false)
    expect(Object.isFrozen(preview)).toBe(true)
    expect(Object.isFrozen(preview.actions)).toBe(true)
    expect(Object.isFrozen(preview.actions[0].summary)).toBe(true)
    expect(confirmed.confirmation).toBe('accepted')
    expect(confirmed.preview).toBe(preview)
    expect(execute).not.toHaveBeenCalled()
  })

  it('returns stable cancellation without exposing an executable prefix', async () => {
    const { execute, batch } = permissionReadyActionBatch(true)

    await expect(
      confirmAiActionBatch(
        batch,
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
    const { batch } = permissionReadyActionBatch(true)
    const preAborted = new AbortController()
    preAborted.abort()
    const confirm = vi.fn(async () => true)

    await expect(
      confirmAiActionBatch(
        batch,
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
    const pending = confirmAiActionBatch(
      batch,
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
    const { batch } = permissionReadyActionBatch(true)
    let failure: AiConfirmationError | undefined

    try {
      await confirmAiActionBatch(
        batch,
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
      confirmAiActionBatch(
        batch,
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
