import { describe, expect, it, vi } from 'vitest'
import { Factory } from '@asyra/factory'
import { EventTypes, TransactionEventTypes } from '@asyra/reactive-events'
import type { IPersistenceProvider } from '@asyra/persistence'
import type {
  GroupRawData,
  SceneTreeRawData,
  TransactionStatusPayload
} from '@asyra/utils'
import { Core } from '../core.js'

const createHarness = (factory = new Factory()) => {
  const props = {
    save: vi.fn(() => ({})),
    load: vi.fn(),
    validateLoadData: vi.fn(() => ({ data: {}, diagnostics: [] })),
    applyValidatedLoad: vi.fn()
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
    })),
    preflightLoadPropertyRelations: vi.fn(),
    applyValidatedLoad: vi.fn()
  }
  const systemContext = {
    loadManagedProperties: vi.fn(() => []),
    saveManagedProperties: vi.fn(() => ({})),
    validateManagedProperties: vi.fn(() => ({
      data: {},
      diagnostics: []
    })),
    applyValidatedManagedProperties: vi.fn()
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

  const commit = (
    id: string,
    eventName: string = EventTypes.UPDATE_PROPERTY
  ) => {
    factory.startTransaction()
    factory.updateTransaction({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName,
      payload: { id, before: 0, after: 1 }
    })
    factory.endTransaction()
  }

  const provider = (
    save: IPersistenceProvider['save'] = vi.fn(async () => undefined),
    load: IPersistenceProvider['load'] = vi.fn(async () => null)
  ): IPersistenceProvider => ({
    name: 'TestPersistence',
    save,
    load,
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

describe('Core transaction and serialization boundary', () => {
  it('does not subscribe to Factory commit capture for persistence', () => {
    const factory = new Factory()
    const subscribe = vi.spyOn(factory, 'subscribeToCommitCapture')

    createHarness(factory)

    expect(subscribe).not.toHaveBeenCalled()
  })

  it('does not capture, clone, save, or report durability for action, Undo, Redo, or selection commits', async () => {
    const { core, factory, commit, props, provider, sceneTree, systemContext } =
      createHarness()
    const save = vi.fn<IPersistenceProvider['save']>(async () => undefined)
    const statuses: TransactionStatusPayload[] = []
    const structuredCloneSpy = vi.spyOn(globalThis, 'structuredClone')
    core.setPersistence(provider(save))
    const dispose = factory.subscribeToTransactionStatus((status) => {
      statuses.push(status)
    })

    try {
      commit('action')
      factory.undo()
      factory.redo()
      commit('selection', EventTypes.SELECT_ELEMENTS)
      await Promise.resolve()
      await Promise.resolve()

      expect(sceneTree.save).not.toHaveBeenCalled()
      expect(props.save).not.toHaveBeenCalled()
      expect(systemContext.saveManagedProperties).not.toHaveBeenCalled()
      expect(structuredCloneSpy).not.toHaveBeenCalled()
      expect(save).not.toHaveBeenCalled()
      expect(
        statuses.some(({ status }) =>
          ['persisted', 'persistence-failed', 'persistence-skipped'].includes(
            status
          )
        )
      ).toBe(false)
    } finally {
      structuredCloneSpy.mockRestore()
      dispose()
    }
  })

  it('does not report persistence-skipped when no load source is configured', async () => {
    const { factory, commit } = createHarness()
    const statuses: TransactionStatusPayload[] = []
    const dispose = factory.subscribeToTransactionStatus((status) => {
      statuses.push(status)
    })

    commit('no-load-source')
    await Promise.resolve()
    await Promise.resolve()

    expect(
      statuses.some(({ status }) =>
        ['persisted', 'persistence-failed', 'persistence-skipped'].includes(
          status
        )
      )
    ).toBe(false)
    dispose()
  })

  it('uses a load-only source during startup without requiring write methods', async () => {
    const { core, props, sceneTree } = createHarness()
    const documentData = {
      version: '1.0.0',
      sceneTree: { workspace: '', workspaceList: [], elements: {} },
      props: {}
    }
    const load = vi.fn(async () => documentData)
    core.setLoadSource({ name: 'socket-bootstrap', load })
    core.setRenderer({
      init: vi.fn(async () => ({ canvas: null, instance: null })),
      destroy: vi.fn()
    } as never)

    await core.start(document.createElement('div'), { width: 1, height: 1 })

    expect(load).toHaveBeenCalledOnce()
    expect(props.validateLoadData).toHaveBeenCalledOnce()
    expect(sceneTree.validateLoadData).toHaveBeenCalledOnce()
  })

  it('keeps explicit serialization detached and does not call a provider writer', async () => {
    const { core, provider, sceneTree } = createHarness()
    const runtimeChildren = ['child-before-save']
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
          children: runtimeChildren
        }
      }
    }))
    core.registerSaveHook((data) => {
      const workspace = data.sceneTree.elements.workspace as GroupRawData
      workspace.children.push('child-added-by-hook')
      return data
    })
    core.setPersistence(provider(save))

    const serialized = await core.save()
    runtimeChildren.push('child-added-after-save')

    expect(
      (serialized.sceneTree.elements.workspace as GroupRawData).children
    ).toEqual(['child-before-save', 'child-added-by-hook'])
    expect(runtimeChildren).toEqual([
      'child-before-save',
      'child-added-after-save'
    ])
    expect(save).not.toHaveBeenCalled()
  })
})
