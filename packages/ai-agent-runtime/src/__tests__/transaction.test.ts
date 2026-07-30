import { describe, expect, it, vi } from 'vitest'
import {
  AiTransactionError,
  runAiActionBatchTransaction,
  type AiTransactionRunner
} from '..'

interface RunnerEvidence {
  commits: number
  rollbacks: number
  runCalls: ReturnType<typeof vi.fn>
  runner: AiTransactionRunner
}

const transactionRunner = (): RunnerEvidence => {
  const runCalls = vi.fn()
  const evidence: RunnerEvidence = {
    commits: 0,
    rollbacks: 0,
    runCalls,
    runner: {
      run: async <T>(label: string, execute: () => Promise<T>) => {
        runCalls(label)
        try {
          const result = await execute()
          evidence.commits += 1
          return result
        } catch (error) {
          evidence.rollbacks += 1
          throw error
        }
      }
    }
  }
  return evidence
}

describe('AI action-batch transaction boundary', () => {
  it('runs one complete callback inside one app-owned transaction', async () => {
    const evidence = transactionRunner()
    const execute = vi.fn(async () => {
      expect(evidence.runCalls).toHaveBeenCalledOnce()
      expect(evidence.commits).toBe(0)
      return {
        actionCount: 2
      }
    })

    await expect(
      runAiActionBatchTransaction(
        evidence.runner,
        new AbortController().signal,
        execute
      )
    ).resolves.toEqual({
      actionCount: 2
    })

    expect(evidence.runCalls).toHaveBeenCalledOnce()
    expect(evidence.runCalls).toHaveBeenCalledWith('AI-assisted action')
    expect(execute).toHaveBeenCalledOnce()
    expect(evidence.commits).toBe(1)
    expect(evidence.rollbacks).toBe(0)
  })

  it('does not open a transaction for pre-abort', async () => {
    const evidence = transactionRunner()
    const controller = new AbortController()
    controller.abort()
    const execute = vi.fn()

    await expect(
      runAiActionBatchTransaction(evidence.runner, controller.signal, execute)
    ).rejects.toEqual(
      expect.objectContaining({
        code: 'AI_TRANSACTION_ABORTED'
      })
    )
    expect(evidence.runCalls).not.toHaveBeenCalled()
    expect(execute).not.toHaveBeenCalled()
  })

  it('throws after an in-transaction abort so the app runner rolls back', async () => {
    const evidence = transactionRunner()
    const controller = new AbortController()
    const execute = vi.fn(async () => {
      controller.abort()
      return 'must not commit'
    })

    await expect(
      runAiActionBatchTransaction(evidence.runner, controller.signal, execute)
    ).rejects.toBeInstanceOf(AiTransactionError)

    expect(evidence.runCalls).toHaveBeenCalledOnce()
    expect(execute).toHaveBeenCalledOnce()
    expect(evidence.commits).toBe(0)
    expect(evidence.rollbacks).toBe(1)
  })

  it('lets the app runner roll back a callback failure without retrying', async () => {
    const evidence = transactionRunner()
    const failure = new Error('executor failed')
    const execute = vi.fn(async () => {
      throw failure
    })

    await expect(
      runAiActionBatchTransaction(
        evidence.runner,
        new AbortController().signal,
        execute
      )
    ).rejects.toBe(failure)

    expect(evidence.runCalls).toHaveBeenCalledOnce()
    expect(execute).toHaveBeenCalledOnce()
    expect(evidence.commits).toBe(0)
    expect(evidence.rollbacks).toBe(1)
  })
})
