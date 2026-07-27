import type { CanonicalElementBatchResult } from '@asyra/core'
import { describe, expect, it, vi } from 'vitest'
import { createAsyraDesignAiProgressiveDeliveryCoordinator } from '../progressive-delivery'
import {
  createAsyraDesignAiTransactionRunner,
  type AsyraDesignAiTransactionBoundary
} from '../transaction'

type DeliveryPlan = Parameters<
  CanonicalElementBatchResult['deliveryHandle']['setDeliveryPlan']
>[0]

const createDeliveryHandle = (
  calls: string[]
): CanonicalElementBatchResult['deliveryHandle'] => ({
  artifact: null,
  artifactId: 'artifact-7',
  transactionId: 7,
  setDeliveryPlan: vi.fn((plan: DeliveryPlan) => {
    calls.push(
      `plan:${plan.slices
        .map(({ orderedIds }) => orderedIds.join(','))
        .join('|')}`
    )
  }),
  deliverSlice: vi.fn((sliceId) => {
    calls.push(`deliver:${sliceId}`)
  })
})

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

  it('flushes staged compositions before the caller continues', async () => {
    const calls: string[] = []
    const coordinator = createAsyraDesignAiProgressiveDeliveryCoordinator()
    const handle = createDeliveryHandle(calls)
    const signal = new AbortController().signal

    calls.push('action:composition')
    coordinator.stage({
      assertNotAborted: () => undefined,
      deliveryHandle: handle,
      signal,
      slices: [
        { orderedIds: ['group-1', 'child-1'] },
        { orderedIds: ['child-2'] }
      ],
      yieldToHost: async () => {
        calls.push('yield')
      }
    })
    await coordinator.flush()
    calls.push('action:following')

    expect(calls).toEqual([
      'action:composition',
      'plan:group-1,child-1|child-2',
      'deliver:ai-composition:7:1',
      'yield',
      'deliver:ai-composition:7:2',
      'yield',
      'action:following'
    ])
    expect(handle.setDeliveryPlan).toHaveBeenCalledOnce()
    expect(handle.deliverSlice).toHaveBeenCalledTimes(2)
  })

  it('stops after an aborted yield and resets delivery ownership for the next stage', async () => {
    const calls: string[] = []
    const coordinator = createAsyraDesignAiProgressiveDeliveryCoordinator()
    const handle = createDeliveryHandle(calls)
    const nextHandle = createDeliveryHandle(calls)
    const abortController = new AbortController()
    const failure = new Error('aborted progressive action')

    coordinator.stage({
      assertNotAborted: () => {
        if (abortController.signal.aborted) {
          throw failure
        }
      },
      deliveryHandle: handle,
      signal: abortController.signal,
      slices: [
        { orderedIds: ['group-1', 'child-1'] },
        { orderedIds: ['child-2'] }
      ],
      yieldToHost: async () => {
        abortController.abort()
      }
    })
    await expect(coordinator.flush()).rejects.toBe(failure)

    expect(handle.deliverSlice).toHaveBeenCalledOnce()

    coordinator.stage({
      assertNotAborted: () => undefined,
      deliveryHandle: nextHandle,
      signal: new AbortController().signal,
      slices: [{ orderedIds: ['next-group', 'next-child'] }],
      yieldToHost: async () => undefined
    })
    await expect(coordinator.flush()).resolves.toBeUndefined()
    expect(nextHandle.deliverSlice).toHaveBeenCalledOnce()
  })
})
