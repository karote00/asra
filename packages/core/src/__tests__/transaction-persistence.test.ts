import { describe, expect, it, vi } from 'vitest'
import {
  Factory,
  TransactionRollbackError,
  TransactionValidationError
} from '@asyra/factory'
import {
  EventTypes,
  TransactionEventTypes,
  subscribeToUserActionCompleted
} from '@asyra/reactive-events'
import type { IPersistenceProvider } from '@asyra/persistence'
import type {
  GroupRawData,
  SceneTreeRawData,
  TransactionStatusPayload
} from '@asyra/utils'
import { Core } from '../core'

const createHarness = (factory = new Factory()) => {
  const props = {
    save: vi.fn(() => ({})),
    load: vi.fn(),
    validateLoadData: vi.fn(() => ({ data: {}, diagnostics: [] }))
  }
  const sceneTree = {
    save: vi.fn<() => SceneTreeRawData>(() => ({
      workspace: '',
      workspaceList: [],
      elements: {}
    })),
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

  return {
    core,
    factory,
    commit,
    props,
    provider,
    sceneTree,
    systemContext
  }
}

describe('Core transaction persistence acknowledgement', () => {
  it('persists exact committed action, undo, and redo snapshots in FIFO order', async () => {
    const { core, factory, commit, provider, sceneTree } = createHarness()
    const save = vi.fn<IPersistenceProvider['save']>(async () => undefined)
    let workspace = 'action-state'
    sceneTree.save.mockImplementation(() => ({
      workspace,
      workspaceList: [workspace],
      elements: {}
    }))
    core.setPersistence(provider(save))

    commit('first')
    workspace = 'undo-state'
    factory.undo()
    workspace = 'redo-state'
    factory.redo()

    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(3))
    expect(
      save.mock.calls.map(
        ([data]) => (data.sceneTree as { workspace: string }).workspace
      )
    ).toEqual(['action-state', 'undo-state', 'redo-state'])
    expect(sceneTree.save).toHaveBeenCalledTimes(3)
  })

  it('never saves discarded, rolled-back, or rollback-failed outcomes', async () => {
    const { core, factory, props, provider, sceneTree, systemContext } =
      createHarness()
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
    factory.registerTransactionInverter('custom.rollback-failed', () => {
      throw new Error('inverse failed')
    })
    factory.startTransaction()
    factory.updateTransaction({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: 'custom.rollback-failed',
      payload: { id: 'rollback-failed', before: 0, after: 1 }
    })
    expect(() => factory.endTransaction({ outcome: 'rollback' })).toThrow(
      TransactionRollbackError
    )

    await Promise.resolve()
    await Promise.resolve()
    expect(sceneTree.save).not.toHaveBeenCalled()
    expect(props.save).not.toHaveBeenCalled()
    expect(systemContext.saveManagedProperties).not.toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
  })

  it('reports persistence-skipped when no provider is configured', async () => {
    const { factory, commit, props, sceneTree, systemContext } = createHarness()
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
    expect(sceneTree.save).not.toHaveBeenCalled()
    expect(props.save).not.toHaveBeenCalled()
    expect(systemContext.saveManagedProperties).not.toHaveBeenCalled()
    dispose()
  })

  it('does not capture or persist a remote committed transaction', async () => {
    const { core, factory, props, provider, sceneTree, systemContext } =
      createHarness()
    const save = vi.fn<IPersistenceProvider['save']>(async () => undefined)
    const saveHook = vi.fn((data) => data)
    const statuses: TransactionStatusPayload[] = []
    core.registerSaveHook(saveHook)
    core.setPersistence(provider(save))
    const dispose = factory.subscribeToTransactionStatus((status) => {
      statuses.push(status)
    })

    factory.runRemoteTransaction(() => {
      factory.updateTransaction({
        type: TransactionEventTypes.UPDATE_TRANSACTION,
        eventName: EventTypes.UPDATE_COMPUTED_DATA,
        payload: { id: 'remote', before: 0, after: 1 }
      })
    })
    await Promise.resolve()
    await Promise.resolve()

    expect(statuses).toContainEqual(
      expect.objectContaining({ origin: 'remote', status: 'committed' })
    )
    expect(sceneTree.save).not.toHaveBeenCalled()
    expect(props.save).not.toHaveBeenCalled()
    expect(systemContext.saveManagedProperties).not.toHaveBeenCalled()
    expect(saveHook).not.toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
    expect(
      statuses.some(
        ({ origin, status }) =>
          origin === 'remote' &&
          ['persisted', 'persistence-failed', 'persistence-skipped'].includes(
            status
          )
      )
    ).toBe(false)

    dispose()
  })

  it('does not capture or persist a validation-rejected transaction', async () => {
    const { core, factory, commit, props, provider, sceneTree, systemContext } =
      createHarness()
    const save = vi.fn<IPersistenceProvider['save']>(async () => undefined)
    const saveHook = vi.fn((data) => data)
    core.registerSaveHook(saveHook)
    core.setPersistence(provider(save))
    factory.registerTransactionValidator('reject-persistence', () => ({
      valid: false,
      code: 'invalid-persistence-state',
      message: 'Reject persistence capture'
    }))

    expect(() => commit('validation-rejected')).toThrow(
      TransactionValidationError
    )
    await Promise.resolve()
    await Promise.resolve()

    expect(sceneTree.save).not.toHaveBeenCalled()
    expect(props.save).not.toHaveBeenCalled()
    expect(systemContext.saveManagedProperties).not.toHaveBeenCalled()
    expect(saveHook).not.toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
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

  it('persists the state snapshot captured by each committed transaction', async () => {
    const { core, commit, provider, sceneTree } = createHarness()
    const save = vi.fn<IPersistenceProvider['save']>(async () => undefined)
    let workspace = 'first'
    sceneTree.save.mockImplementation(() => ({
      workspace,
      workspaceList: [workspace],
      elements: {}
    }))
    core.setPersistence(provider(save))

    commit('first')
    workspace = 'second'
    commit('second')
    workspace = 'uncommitted-preview'

    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2))
    expect(
      save.mock.calls.map(
        ([data]) => (data.sceneTree as { workspace: string }).workspace
      )
    ).toEqual(['first', 'second'])
  })

  it('captures each local commit before a completion observer commits reentrantly', async () => {
    const factory = new Factory({ bridgeToReactiveEvents: true })
    const { core, commit, provider, sceneTree } = createHarness(factory)
    const save = vi.fn<IPersistenceProvider['save']>(async () => undefined)
    let workspace = 'outer'
    let nested = false
    sceneTree.save.mockImplementation(() => ({
      workspace,
      workspaceList: [workspace],
      elements: {}
    }))
    core.setPersistence(provider(save))
    const completionSubscription = subscribeToUserActionCompleted(() => {
      if (nested) return
      nested = true
      workspace = 'nested'
      commit('nested')
    })

    try {
      commit('outer')

      await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2))
      expect(
        save.mock.calls.map(
          ([data]) => (data.sceneTree as { workspace: string }).workspace
        )
      ).toEqual(['outer', 'nested'])
    } finally {
      completionSubscription.unsubscribe()
    }
  })

  it('attributes snapshot capture separately from the provider save boundary', async () => {
    const { core, commit, provider } = createHarness()
    const save = vi.fn<IPersistenceProvider['save']>(async () => undefined)
    const runtimeGlobal = globalThis as typeof globalThis & {
      __asyraBrowserDragPhaseSink?: (name: string, durationMs: number) => void
    }
    const previousSink = runtimeGlobal.__asyraBrowserDragPhaseSink
    const phases: string[] = []
    runtimeGlobal.__asyraBrowserDragPhaseSink = (name) => phases.push(name)
    core.setPersistence(provider(save))

    try {
      commit('persistence-attribution')

      await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1))
      await vi.waitFor(() =>
        expect(phases).toEqual(
          expect.arrayContaining([
            'core:persistence-capture:system-context',
            'core:persistence-capture:scene-tree',
            'core:persistence-capture:props',
            'core:persistence-capture:detach',
            'core:persistence-capture',
            'core:persistence-save'
          ])
        )
      )
    } finally {
      runtimeGlobal.__asyraBrowserDragPhaseSink = previousSink
    }
  })

  it('deeply detaches a queued snapshot from later nested runtime mutations', async () => {
    const { core, commit, provider, sceneTree } = createHarness()
    const children = ['child-before-commit']
    const save = vi.fn<IPersistenceProvider['save']>(async () => undefined)
    sceneTree.save.mockImplementation(() => ({
      workspace: 'workspace',
      workspaceList: ['workspace'],
      elements: {
        workspace: {
          id: 'workspace',
          name: 'Workspace',
          type: 'workspace',
          visible: true,
          lock: false,
          children
        }
      }
    }))
    core.setPersistence(provider(save))

    commit('nested-snapshot')
    children.push('child-after-commit')

    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    const snapshot = save.mock.calls[0][0]
    const workspace = snapshot.sceneTree.elements.workspace as GroupRawData
    expect(workspace.children).toEqual(['child-before-commit'])
  })

  it('captures one full detached snapshot when no save hooks are registered', async () => {
    const { core, commit, provider } = createHarness()
    const save = vi.fn<IPersistenceProvider['save']>(async () => undefined)
    const structuredCloneSpy = vi.spyOn(globalThis, 'structuredClone')
    core.setPersistence(provider(save))

    try {
      commit('single-snapshot')

      await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1))
      expect(structuredCloneSpy).toHaveBeenCalledTimes(1)
    } finally {
      structuredCloneSpy.mockRestore()
    }
  })

  it('keeps save hooks isolated by detached snapshots on both boundaries', async () => {
    const { core, commit, provider, sceneTree } = createHarness()
    const runtimeChildren = ['child-before-commit']
    let hookChildren: string[] | undefined
    const save = vi.fn<IPersistenceProvider['save']>(async () => undefined)
    const structuredCloneSpy = vi.spyOn(globalThis, 'structuredClone')
    const runtimeGlobal = globalThis as typeof globalThis & {
      __asyraBrowserDragPhaseSink?: (name: string, durationMs: number) => void
    }
    const previousSink = runtimeGlobal.__asyraBrowserDragPhaseSink
    const phases: string[] = []
    runtimeGlobal.__asyraBrowserDragPhaseSink = (name) => phases.push(name)
    sceneTree.save.mockImplementation(() => ({
      workspace: 'workspace',
      workspaceList: ['workspace'],
      elements: {
        workspace: {
          id: 'workspace',
          name: 'Workspace',
          type: 'workspace',
          visible: true,
          lock: false,
          children: runtimeChildren
        }
      }
    }))
    core.registerSaveHook((data) => {
      const workspace = data.sceneTree.elements.workspace as GroupRawData
      hookChildren = workspace.children
      hookChildren.push('child-added-by-hook')
      return data
    })
    core.setPersistence(provider(save))

    try {
      commit('hook-snapshots')
      runtimeChildren.push('child-added-after-commit')
      hookChildren?.push('child-added-after-hook')

      await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1))
      const snapshot = save.mock.calls[0][0]
      const workspace = snapshot.sceneTree.elements.workspace as GroupRawData
      expect(workspace.children).toEqual([
        'child-before-commit',
        'child-added-by-hook'
      ])
      expect(runtimeChildren).toEqual([
        'child-before-commit',
        'child-added-after-commit'
      ])
      expect(structuredCloneSpy).toHaveBeenCalledTimes(2)
      expect(phases).toContain('core:persistence-capture:save-hooks')
    } finally {
      structuredCloneSpy.mockRestore()
      runtimeGlobal.__asyraBrowserDragPhaseSink = previousSink
    }
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
