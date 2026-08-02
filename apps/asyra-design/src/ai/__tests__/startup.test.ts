import { describe, expect, it, vi } from 'vitest'
import { createAiStartup } from '../startup'

describe('AI startup', () => {
  it('always composes the single server action-batch provider route', () => {
    const provider = {
      requestActionBatch: vi.fn()
    }
    const confirmation = {
      dispose: vi.fn(),
      requestConfirmation: vi.fn()
    }
    const history = {
      correlateCommittedAction: vi.fn(),
      dispose: vi.fn(),
      getCurrentActionId: vi.fn(() => null)
    }
    const createProvider = vi.fn(() => provider)

    const startup = createAiStartup({
      createConfirmation: vi.fn(() => confirmation as never),
      createHistory: vi.fn(() => history as never),
      createProvider
    })

    expect(createProvider).toHaveBeenCalledWith()
    expect(startup).not.toHaveProperty('mode')
    expect(startup.runtime).toMatchObject({
      dispose: expect.any(Function),
      run: expect.any(Function)
    })
    expect(startup).not.toHaveProperty('runtimeOptions')
    expect(startup).not.toHaveProperty('providerEnabled')

    void startup.runtime.dispose()
    void startup.confirmation.dispose()
    startup.history.dispose()
  })

  it('disposes startup-owned resources when provider construction fails', () => {
    const disposeConfirmation = vi.fn(async () => undefined)
    const disposeHistory = vi.fn()

    expect(() =>
      createAiStartup({
        createConfirmation: vi.fn(
          () =>
            ({
              dispose: disposeConfirmation,
              requestConfirmation: vi.fn()
            }) as never
        ),
        createHistory: vi.fn(
          () =>
            ({
              dispose: disposeHistory
            }) as never
        ),
        createProvider: vi.fn(() => {
          throw new Error('provider construction failed')
        })
      })
    ).toThrow('provider construction failed')

    expect(disposeHistory).toHaveBeenCalledOnce()
    expect(disposeConfirmation).toHaveBeenCalledOnce()
  })
})
