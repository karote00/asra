import { describe, expect, it, vi } from 'vitest'
import { createAiAgentRuntime, type CreateAiAgentRuntimeInput } from '..'

const createInput = (): CreateAiAgentRuntimeInput => ({
  provider: {
    requestActionBatch: vi.fn()
  },
  actionDefinitions: [],
  contextProvider: {
    getContext: vi.fn()
  },
  permissionPolicy: {
    evaluate: vi.fn()
  },
  confirmationHandler: {
    confirm: vi.fn()
  },
  transactionRunner: {
    run: vi.fn()
  }
})

describe('optional AI agent runtime composition', () => {
  it('constructs an inert isolated runtime without invoking app adapters', () => {
    const firstInput = createInput()
    const secondInput = createInput()

    const first = createAiAgentRuntime(firstInput)
    const second = createAiAgentRuntime(secondInput)

    expect(first).not.toBe(second)
    expect(firstInput.provider.requestActionBatch).not.toHaveBeenCalled()
    expect(firstInput.contextProvider.getContext).not.toHaveBeenCalled()
    expect(firstInput.permissionPolicy.evaluate).not.toHaveBeenCalled()
    expect(firstInput.confirmationHandler.confirm).not.toHaveBeenCalled()
    expect(firstInput.transactionRunner.run).not.toHaveBeenCalled()
    expect(secondInput.provider.requestActionBatch).not.toHaveBeenCalled()
  })

  it('disposes only explicitly owned resources and does so once', async () => {
    const borrowedDispose = vi.fn()
    const ownedDispose = vi.fn()
    const runtime = createAiAgentRuntime({
      ...createInput(),
      ownedResources: [{ dispose: ownedDispose }]
    })

    await runtime.dispose()
    await runtime.dispose()

    expect(ownedDispose).toHaveBeenCalledOnce()
    expect(borrowedDispose).not.toHaveBeenCalled()
  })

  it('keeps disposal state isolated between runtime instances', async () => {
    const firstDispose = vi.fn()
    const secondDispose = vi.fn()
    const first = createAiAgentRuntime({
      ...createInput(),
      ownedResources: [{ dispose: firstDispose }]
    })
    const second = createAiAgentRuntime({
      ...createInput(),
      ownedResources: [{ dispose: secondDispose }]
    })

    await first.dispose()

    expect(firstDispose).toHaveBeenCalledOnce()
    expect(secondDispose).not.toHaveBeenCalled()

    await second.dispose()

    expect(secondDispose).toHaveBeenCalledOnce()
  })

  it('attempts every owned cleanup once when one resource fails', async () => {
    const failure = new Error('owned cleanup failed')
    const failedDispose = vi.fn(() => {
      throw failure
    })
    const completedDispose = vi.fn()
    const runtime = createAiAgentRuntime({
      ...createInput(),
      ownedResources: [
        { dispose: failedDispose },
        { dispose: completedDispose }
      ]
    })

    await expect(runtime.dispose()).rejects.toBe(failure)
    await expect(runtime.dispose()).rejects.toBe(failure)

    expect(failedDispose).toHaveBeenCalledOnce()
    expect(completedDispose).toHaveBeenCalledOnce()
  })
})
