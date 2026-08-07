import { describe, expect, it, vi } from 'vitest'
import { subscribeToBrowserDragPhases } from '@asyra/utils'
import {
  createAiTransactionRunner,
  type AiTransactionBoundary
} from '../transaction'
import { documentInteractionLock } from '../document-interaction-lock'

describe('Design App AI transaction adapter', () => {
  it('measures the complete common transaction without changing its result', async () => {
    const phaseNames: string[] = []
    const unsubscribe = subscribeToBrowserDragPhases((name) =>
      phaseNames.push(name)
    )
    const runner = createAiTransactionRunner({
      runTransaction: async <T>(execute: () => Promise<T>) => execute()
    })

    try {
      await expect(
        runner.run('AI-assisted action', async () => 'complete')
      ).resolves.toBe('complete')
    } finally {
      unsubscribe()
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
    const boundary: AiTransactionBoundary = async <T>(
      execute: () => Promise<T>
    ) => {
      boundaryCalls()
      return execute()
    }
    const runner = createAiTransactionRunner({
      runTransaction: boundary
    })
    const execute = vi.fn(async () => 'complete')

    await expect(runner.run('AI-assisted action', execute)).resolves.toBe(
      'complete'
    )

    expect(boundaryCalls).toHaveBeenCalledOnce()
    expect(execute).toHaveBeenCalledOnce()
  })

  it('uses the fixed App interaction lock when no test dependency is supplied', async () => {
    const runner = createAiTransactionRunner({
      runTransaction: async <T>(execute: () => Promise<T>) => {
        expect(documentInteractionLock.isActive()).toBe(true)
        return execute()
      }
    })

    expect(documentInteractionLock.isActive()).toBe(false)
    await expect(
      runner.run('AI-assisted action', async () => 'complete')
    ).resolves.toBe('complete')
    expect(documentInteractionLock.isActive()).toBe(false)
  })

  it('preserves callback rejection for the common rollback owner', async () => {
    const failure = new Error('executor failure')
    const timeline: string[] = []
    let interactionLocked = false
    const boundary: AiTransactionBoundary = async <T>(
      execute: () => Promise<T>
    ) => {
      timeline.push('transaction:start')
      expect(interactionLocked).toBe(true)
      try {
        return await execute()
      } catch (error) {
        expect(interactionLocked).toBe(true)
        timeline.push('transaction:rollback')
        throw error
      }
    }
    const release = vi.fn()
    const runner = createAiTransactionRunner({
      interactionLock: {
        acquire: vi.fn(() => {
          interactionLocked = true
          timeline.push('lock:acquire')
          return () => {
            expect(timeline.at(-1)).toBe('transaction:rollback')
            interactionLocked = false
            timeline.push('lock:release')
            release()
          }
        })
      },
      runTransaction: boundary
    })

    await expect(
      runner.run('AI-assisted action', async () => {
        expect(interactionLocked).toBe(true)
        timeline.push('transaction:execute')
        throw failure
      })
    ).rejects.toBe(failure)
    expect(release).toHaveBeenCalledOnce()
    expect(interactionLocked).toBe(false)
    expect(timeline).toEqual([
      'lock:acquire',
      'transaction:start',
      'transaction:execute',
      'transaction:rollback',
      'lock:release'
    ])
  })

  it('holds the interaction lock through commit and history correlation', async () => {
    const timeline: string[] = []
    let currentActionId: number | null = 20
    const correlateCommittedAction = vi.fn(() => {
      timeline.push('history:correlate')
      return true
    })
    const boundary: AiTransactionBoundary = async <T>(
      execute: () => Promise<T>
    ) => {
      timeline.push('transaction:start')
      const result = await execute()
      currentActionId = 21
      timeline.push('transaction:commit')
      return result
    }
    const runner = createAiTransactionRunner({
      history: {
        correlateCommittedAction,
        getCurrentActionId: () => currentActionId
      },
      interactionLock: {
        acquire: () => {
          timeline.push('lock:acquire')
          return () => timeline.push('lock:release')
        }
      },
      runTransaction: boundary
    })

    await runner.run('AI-assisted action', async () => {
      timeline.push('transaction:execute')
      return 'complete'
    })

    expect(correlateCommittedAction).toHaveBeenCalledOnce()
    expect(correlateCommittedAction).toHaveBeenCalledWith(21)
    expect(timeline).toEqual([
      'lock:acquire',
      'transaction:start',
      'transaction:execute',
      'transaction:commit',
      'history:correlate',
      'lock:release'
    ])
  })

  it('does not correlate a zero-mutation transaction', async () => {
    const correlateCommittedAction = vi.fn(() => true)
    const runner = createAiTransactionRunner({
      history: {
        correlateCommittedAction,
        getCurrentActionId: () => 20
      },
      runTransaction: async <T>(execute: () => Promise<T>) => execute()
    })

    await runner.run('AI-assisted action', async () => 'no-change')

    expect(correlateCommittedAction).not.toHaveBeenCalled()
  })
})
