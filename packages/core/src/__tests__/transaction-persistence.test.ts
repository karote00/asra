import { describe, expect, it, vi } from 'vitest'
import { Factory } from '@asyra/factory'
import { EventTypes, TransactionEventTypes } from '@asyra/reactive-events'
import type { IPersistenceProvider } from '@asyra/persistence'
import type { TransactionStatusPayload } from '@asyra/utils'
import { Core } from '../core'

const createHarness = () => {
  const factory = new Factory()
  const props = {
    save: vi.fn(() => ({})),
    load: vi.fn(),
    validateLoadData: vi.fn(() => ({ data: {}, diagnostics: [] }))
  }
  const sceneTree = {
    save: vi.fn(() => ({ workspace: '', workspaceList: [], elements: {} })),
    load: vi.fn(),
    getAllElements: vi.fn(() => new Map()),
    validateLoadData: vi.fn(() => ({
      data: { workspace: '', workspaceList: [], elements: {} },
      diagnostics: []
    }))
  }
  const systemContext = {
    loadManagedProperties: vi.fn(() => []),
    saveManagedProperties: vi.fn(() => ({}))
  }
  const core = new Core({
    inputSystem: {} as never,
    factory,
    props: props as never,
    render: {
      init: vi.fn(),
      getViewportPosition: vi.fn(() => ({ x: 0, y: 0 })),
      getViewportScale: vi.fn(() => 1),
      registerLayer: vi.fn(),
      unregisterLayer: vi.fn(() => true)
    } as never,
    sceneTree: sceneTree as never,
    selection: {} as never,
    systemContext: systemContext as never
  })

  const commit = (id: string) => {
    factory.startTransaction()
    factory.updateTransaction({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.UPDATE_COMPUTED_DATA,
      payload: { id, before: 0, after: 1 }
    })
    factory.endTransaction()
  }

  const provider = (
    save: IPersistenceProvider['save'] = vi.fn(async () => undefined)
  ): IPersistenceProvider => ({
    name: 'TestPersistence',
    save,
    load: vi.fn(async () => null),
    clear: vi.fn(async () => undefined)
  })

  return { core, factory, commit, provider }
}

describe('Core transaction persistence acknowledgement', () => {
  it('persists committed action, undo, and redo in order', async () => {
    const { core, factory, commit, provider } = createHarness()
    const save = vi.fn(async () => undefined)
    core.setPersistence(provider(save))

    commit('first')
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    factory.undo()
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2))
    factory.redo()
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(3))
  })

  it('never saves discarded, rolled-back, or rollback-failed outcomes', async () => {
    const { core, factory, provider } = createHarness()
    const save = vi.fn(async () => undefined)
    core.setPersistence(provider(save))

    factory.startTransaction()
    factory.endTransaction()
    factory.startTransaction()
    factory.updateTransaction({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.UPDATE_COMPUTED_DATA,
      payload: { id: 'rollback', before: 0, after: 1 }
    })
    factory.endTransaction({ outcome: 'rollback' })

    await Promise.resolve()
    await Promise.resolve()
    expect(save).not.toHaveBeenCalled()
  })

  it('reports persistence-skipped when no provider is configured', async () => {
    const { factory, commit } = createHarness()
    const statuses: TransactionStatusPayload[] = []
    const dispose = factory.subscribeToTransactionStatus((status) => {
      statuses.push(status)
    })

    commit('skipped')

    await vi.waitFor(() =>
      expect(
        statuses.some((status) => status.status === 'persistence-skipped')
      ).toBe(true)
    )
    dispose()
  })

  it('serializes saves and continues after a persistence failure', async () => {
    const { core, factory, commit, provider } = createHarness()
    const statuses: TransactionStatusPayload[] = []
    let releaseFirst: (() => void) | undefined
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const save = vi
      .fn<IPersistenceProvider['save']>()
      .mockImplementationOnce(async () => {
        await firstGate
        throw new Error('first save failed')
      })
      .mockImplementationOnce(async () => undefined)
    core.setPersistence(provider(save))
    const dispose = factory.subscribeToTransactionStatus((status) => {
      statuses.push(status)
    })

    commit('first')
    commit('second')

    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    releaseFirst?.()
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2))
    await vi.waitFor(() =>
      expect(
        statuses
          .filter((status) =>
            ['persistence-failed', 'persisted'].includes(status.status)
          )
          .map((status) => status.status)
      ).toEqual(['persistence-failed', 'persisted'])
    )
    expect(
      (factory.transact as unknown as { undoStack: unknown[] }).undoStack
    ).toHaveLength(2)

    dispose()
  })

  it('keeps custom Core persistence bound to its injected Factory', async () => {
    const first = createHarness()
    const second = createHarness()
    const firstSave = vi.fn(async () => undefined)
    const secondSave = vi.fn(async () => undefined)
    first.core.setPersistence(first.provider(firstSave))
    second.core.setPersistence(second.provider(secondSave))

    first.commit('first-only')

    await vi.waitFor(() => expect(firstSave).toHaveBeenCalledTimes(1))
    expect(secondSave).not.toHaveBeenCalled()
  })
})
