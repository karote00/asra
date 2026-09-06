import { describe, expect, it, vi } from 'vitest'
import {
  RegistrationGraph,
  RegistrationRelationError
} from '../registration-graph.js'

describe('Registration graph terminal runtime disposal', () => {
  it('releases resources while locked without reopening composition or rebuilding relations', () => {
    let open = true
    const graph = new RegistrationGraph({ isCompositionOpen: () => open }),
      calls: string[] = [],
      detach = vi.fn(),
      preflight = vi.fn()
    const target = { kind: 'property', key: 'p' },
      source = { kind: 'component', key: 'c' }
    graph.registerNode({
      ref: target,
      resources: [{ key: 'p', dispose: () => calls.push('p') }]
    })
    graph.registerNode({
      ref: source,
      handlers: { preflightUnregister: preflight, detachRelation: detach },
      resources: [
        { key: 'c1', dispose: () => calls.push('c1') },
        { key: 'c2', dispose: () => calls.push('c2') }
      ]
    })
    graph.defineRelation(source, {
      name: 'uses-p',
      target,
      onTargetUnregister: 'detach'
    })
    open = false
    expect(() => graph.unregister(source)).toThrow('permanently closed')
    graph.disposeRuntime()
    expect(calls).toEqual(['c2', 'c1', 'p'])
    expect(detach).not.toHaveBeenCalled()
    expect(preflight).not.toHaveBeenCalled()
    expect(graph.getRegistrations()).toEqual([])
    expect(graph.getRelations()).toEqual([])
    open = true
    expect(() => graph.registerNode({ ref: source })).toThrow(
      'permanently closed'
    )
    graph.disposeRuntime()
    expect(calls).toHaveLength(3)
  })

  it('attempts every resource and preserves one terminal structured failure', () => {
    const graph = new RegistrationGraph(),
      first = vi.fn(),
      last = vi.fn()
    const cause = new Error('resource failure')
    graph.registerNode({
      ref: { kind: 'test', key: 'node' },
      resources: [
        { key: 'first', dispose: first },
        {
          key: 'bad',
          dispose: () => {
            throw cause
          }
        },
        { key: 'last', dispose: last }
      ]
    })
    let failure: unknown
    try {
      graph.disposeRuntime()
    } catch (error) {
      failure = error
    }
    expect(failure).toBeInstanceOf(RegistrationRelationError)
    expect(failure).toMatchObject({
      code: 'UNREGISTER_FAILED',
      result: {
        operation: 'dispose-runtime',
        cleanupFailures: [{ key: 'bad', cause }],
        pendingCleanup: ['bad']
      }
    })
    expect(first).toHaveBeenCalledOnce()
    expect(last).toHaveBeenCalledOnce()
    expect(() => graph.disposeRuntime()).toThrow(failure as Error)
    expect(first).toHaveBeenCalledOnce()
    expect(last).toHaveBeenCalledOnce()
    expect(graph.getRegistrations()).toEqual([])
  })

  it('does not repeat resources already released by a pending ordinary unregister', () => {
    const graph = new RegistrationGraph(),
      completed = vi.fn(),
      pending = vi.fn().mockImplementationOnce(() => {
        throw new Error('retry')
      })
    const ref = { kind: 'test', key: 'partial' }
    graph.registerNode({
      ref,
      resources: [
        { key: 'pending', dispose: pending },
        { key: 'completed', dispose: completed }
      ]
    })
    expect(() => graph.unregister(ref)).toThrow()
    graph.disposeRuntime()
    expect(completed).toHaveBeenCalledOnce()
    expect(pending).toHaveBeenCalledTimes(2)
    expect(graph.hasPendingCleanup(ref)).toBe(false)
  })

  it('does not retire an independent graph', () => {
    const first = new RegistrationGraph(),
      other = new RegistrationGraph()
    const ref = { kind: 'test', key: 'retained' }
    other.registerNode({ ref })
    first.disposeRuntime()
    expect(other.getRegistration(ref)).toBeDefined()
    other.disposeRuntime()
  })

  it('rejects reentrant terminal disposal while a resource cleanup is active', () => {
    const graph = new RegistrationGraph()
    let rejection: unknown
    graph.registerNode({
      ref: { kind: 'test', key: 'reentrant' },
      resources: [
        {
          key: 'callback',
          dispose: () => {
            try {
              graph.disposeRuntime()
            } catch (error) {
              rejection = error
            }
          }
        }
      ]
    })
    graph.disposeRuntime()
    expect(rejection).toMatchObject({ code: 'COMPOSITION_CLOSED' })
  })
})
