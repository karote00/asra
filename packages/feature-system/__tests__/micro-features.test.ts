import { describe, expect, it, vi } from 'vitest'
import { withTransaction } from '../src'

describe('withTransaction', () => {
  it('commits after synchronous success', () => {
    const startTransaction = vi.fn()
    const endTransaction = vi.fn()
    const run = withTransaction({
      factory: { startTransaction, endTransaction }
    })

    expect(run(() => 'result')).toBe('result')
    expect(startTransaction).toHaveBeenCalledOnce()
    expect(endTransaction).toHaveBeenCalledOnce()
    expect(endTransaction).toHaveBeenCalledWith()
  })

  it('rolls back and rethrows a synchronous failure', () => {
    const failure = new Error('sync failure')
    const endTransaction = vi.fn()
    const run = withTransaction({
      factory: { startTransaction: vi.fn(), endTransaction }
    })

    expect(() =>
      run(() => {
        throw failure
      })
    ).toThrow(failure)
    expect(endTransaction).toHaveBeenCalledOnce()
    expect(endTransaction).toHaveBeenCalledWith({
      outcome: 'rollback',
      failure: {
        kind: 'explicit',
        message: 'sync failure',
        cause: failure
      }
    })
  })

  it('waits for asynchronous success before committing', async () => {
    let resolveResult: ((value: string) => void) | undefined
    const endTransaction = vi.fn()
    const run = withTransaction({
      factory: { startTransaction: vi.fn(), endTransaction }
    })
    const pending = run(
      () =>
        new Promise<string>((resolve) => {
          resolveResult = resolve
        })
    )

    expect(endTransaction).not.toHaveBeenCalled()
    resolveResult?.('result')

    await expect(pending).resolves.toBe('result')
    expect(endTransaction).toHaveBeenCalledOnce()
    expect(endTransaction).toHaveBeenCalledWith()
  })

  it('rolls back and rethrows an asynchronous rejection', async () => {
    const failure = new Error('async failure')
    const endTransaction = vi.fn()
    const run = withTransaction({
      factory: { startTransaction: vi.fn(), endTransaction }
    })

    const pending = run(() => Promise.reject(failure))

    await expect(pending).rejects.toBe(failure)
    expect(endTransaction).toHaveBeenCalledOnce()
    expect(endTransaction).toHaveBeenCalledWith({
      outcome: 'rollback',
      failure: {
        kind: 'explicit',
        message: 'async failure',
        cause: failure
      }
    })
  })
})
