import { describe, expect, it, vi } from 'vitest'
import {
  createAsyraDesignAiTransactionRunner,
  type AsyraDesignAiTransactionBoundary
} from '../transaction'

describe('Asyra Design AI transaction adapter', () => {
  it('measures the complete common transaction without changing its result', async () => {
    const runtimeGlobal = globalThis as typeof globalThis & {
      __asyraBrowserDragPhaseSink?: (name: string, durationMs: number) => void
    }
    const previous = runtimeGlobal.__asyraBrowserDragPhaseSink
    const phaseNames: string[] = []
    runtimeGlobal.__asyraBrowserDragPhaseSink = (name) => phaseNames.push(name)
    const runner = createAsyraDesignAiTransactionRunner(
      async <T>(execute: () => Promise<T>) => execute()
    )

    try {
      await expect(
        runner.run('AI-assisted action', async () => 'complete')
      ).resolves.toBe('complete')
    } finally {
      runtimeGlobal.__asyraBrowserDragPhaseSink = previous
    }

    expect(phaseNames).toEqual(
      expect.arrayContaining([
        'ai-app:transaction',
        'ai-app:transaction-execute'
      ])
    )
  })

  it('forwards one async callback through the common transaction boundary', async () => {
    const boundaryCalls = vi.fn()
    const boundary: AsyraDesignAiTransactionBoundary = async <T>(
      execute: () => Promise<T>
    ) => {
      boundaryCalls()
      return execute()
    }
    const runner = createAsyraDesignAiTransactionRunner(boundary)
    const execute = vi.fn(async () => 'complete')

    await expect(runner.run('AI-assisted action', execute)).resolves.toBe(
      'complete'
    )

    expect(boundaryCalls).toHaveBeenCalledOnce()
    expect(execute).toHaveBeenCalledOnce()
  })

  it('preserves callback rejection for the common rollback owner', async () => {
    const failure = new Error('executor failure')
    const boundary: AsyraDesignAiTransactionBoundary = async <T>(
      execute: () => Promise<T>
    ) => execute()
    const runner = createAsyraDesignAiTransactionRunner(boundary)

    await expect(
      runner.run('AI-assisted action', async () => {
        throw failure
      })
    ).rejects.toBe(failure)
  })

  it('correlates only a newly committed canonical action with the active turn', async () => {
    let currentActionId: number | null = 20
    const correlateCommittedAction = vi.fn(() => true)
    const boundary: AsyraDesignAiTransactionBoundary = async <T>(
      execute: () => Promise<T>
    ) => {
      const result = await execute()
      currentActionId = 21
      return result
    }
    const runner = createAsyraDesignAiTransactionRunner(boundary, {
      correlateCommittedAction,
      getCurrentActionId: () => currentActionId
    })

    await runner.run('AI-assisted action', async () => 'complete')

    expect(correlateCommittedAction).toHaveBeenCalledOnce()
    expect(correlateCommittedAction).toHaveBeenCalledWith(21)
  })

  it('does not correlate a zero-mutation transaction', async () => {
    const correlateCommittedAction = vi.fn(() => true)
    const runner = createAsyraDesignAiTransactionRunner(
      async <T>(execute: () => Promise<T>) => execute(),
      {
        correlateCommittedAction,
        getCurrentActionId: () => 20
      }
    )

    await runner.run('AI-assisted action', async () => 'no-change')

    expect(correlateCommittedAction).not.toHaveBeenCalled()
  })
})
