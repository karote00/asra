import { describe, expect, it, vi } from 'vitest'
import { Core } from '../core.js'

const createCoreForTest = () => {
  const inputRegistry = {
    registerKeyCombinations: vi.fn(),
    unregister: vi.fn()
  }
  const subscribeToSharedPublication = vi.fn(() => vi.fn())
  const subscribeToTransactionStatus = vi.fn(() => vi.fn())
  const observeSharedDataChannel = vi.fn(() => vi.fn())
  const runRemoteTransaction = vi.fn((mutate: () => void) => mutate())
  const runRemoteTransactionProgressively = vi.fn(
    async (
      slices: readonly (() => void)[],
      settle: (index: number) => Promise<void>
    ) => {
      for (const [index, slice] of slices.entries()) {
        slice()
        if (index < slices.length - 1) await settle(index)
      }
    }
  )
  const sceneElement = {
    save: vi.fn(() => ({
      id: 'element-1',
      type: 'rect',
      name: 'Rectangle',
      parentId: 'workspace-1',
      visible: true,
      lock: false,
      props: {}
    })),
    getAllComputedData: vi.fn(() => ({
      x: 10,
      y: 20,
      width: 30,
      height: 40
    })),
    props: {
      getCanonicalRootPropertyIds: vi.fn(() => [
        'property-position',
        'property-dimension'
      ])
    }
  }
  const prepareElementDataMutation = vi.fn(() => ({
    kind: 'prepared-element-data-mutation'
  }))
  const applyPreparedElementMutation = vi.fn(() => ({
    orderedElementIds: ['element-1']
  }))
  const projectLocalComputedDataFromPropertyIds = vi.fn()
  const core = new Core({
    inputSystem: { registry: inputRegistry } as never,
    factory: {
      registerTransactionReplayHandler: vi.fn(() => vi.fn()),
      subscribeToCommitCapture: vi.fn(() => vi.fn()),
      subscribeToTransactionStatus,
      subscribeToSharedPublication,
      observeSharedDataChannel,
      getUndoHistoryDepth: vi.fn(() => 3),
      runRemoteTransaction,
      runRemoteTransactionProgressively
    } as never,
    props: { save: vi.fn(() => ({ property: {} })) } as never,
    render: {
      setEngineProvider: vi.fn(() => vi.fn()),
      requestRender: vi.fn(),
      getViewportPosition: vi.fn(() => ({ x: 1, y: 2 })),
      getViewportScale: vi.fn(() => 2),
      getMousePosInWorkspace: vi.fn(() => ({ x: 3, y: 4 })),
      workspaceToCanvas: vi.fn(() => ({ x: 9, y: 10 })),
      getElementIdAtClientPos: vi.fn(() => 'element-1'),
      workspaceToElementLocal: vi.fn(() => ({ x: 5, y: 6 })),
      elementLocalToWorkspace: vi.fn(() => ({ x: 7, y: 8 })),
      elementSourceToWorkspace: vi.fn(() => ({ x: 11, y: 12 })),
      workspaceToElementSource: vi.fn(() => ({ x: 13, y: 14 })),
      getProjectedElementCount: vi.fn(() => 1),
      subscribeToFrameComplete: vi.fn(() => vi.fn()),
      getElementById: vi.fn(() => ({ label: 'element-1' }))
    } as never,
    sceneTree: {
      workspace: 'workspace-1',
      workspaceList: ['workspace-1'],
      getElementById: vi.fn((id: string) =>
        id === 'element-1' ? sceneElement : undefined
      ),
      getAllElements: vi.fn(() => new Map([['element-1', sceneElement]])),
      save: vi.fn(() => ({
        workspace: 'workspace-1',
        workspaceList: ['workspace-1'],
        elements: {}
      })),
      prepareElementDataMutation,
      applyPreparedElementMutation,
      projectLocalComputedDataFromPropertyIds
    } as never,
    selection: {
      getElementSelectionIds: vi.fn(() => ['element-1'])
    } as never,
    systemContext: {
      getSystemContextSnapshot: vi.fn(() => ({ primaryTool: 'select' }))
    } as never
  })
  core.applyCanonicalChanges = vi.fn()
  return {
    core,
    inputRegistry,
    prepareElementDataMutation,
    applyPreparedElementMutation,
    projectLocalComputedDataFromPropertyIds,
    runRemoteTransaction,
    runRemoteTransactionProgressively,
    subscribeToSharedPublication,
    subscribeToTransactionStatus,
    observeSharedDataChannel
  }
}

describe('Core app runtime facade', () => {
  it('owns app key-combination registration and exact cleanup', () => {
    const { core, inputRegistry } = createCoreForTest()
    const combinations = {
      'input.shortcut.save': [{ key: 's', ctrl: true }]
    } as never

    const dispose = core.registerInputKeyCombinations(combinations)

    expect(inputRegistry.registerKeyCombinations).toHaveBeenCalledWith(
      combinations
    )
    dispose()
    dispose()
    expect(inputRegistry.unregister).toHaveBeenCalledOnce()
    expect(inputRegistry.unregister).toHaveBeenCalledWith('input.shortcut.save')
  })

  it('exposes detached state queries and owner-backed element data updates', () => {
    const { core, prepareElementDataMutation, applyPreparedElementMutation } =
      createCoreForTest()

    expect(core.getElementData('element-1')).toMatchObject({
      id: 'element-1',
      type: 'rect'
    })
    expect(core.getElementComputedData('element-1')).toEqual({
      x: 10,
      y: 20,
      width: 30,
      height: 40
    })
    expect(core.getSelectedElementIds()).toEqual(['element-1'])
    expect(core.getSystemContextSnapshot()).toEqual({
      primaryTool: 'select'
    })
    expect(core.workspaceToCanvas({ x: 5, y: 6 })).toEqual({ x: 9, y: 10 })
    expect(core.elementSourceToWorkspace('element-1', { x: 1, y: 2 })).toEqual({
      x: 11,
      y: 12
    })
    expect(core.workspaceToElementSource('element-1', { x: 3, y: 4 })).toEqual({
      x: 13,
      y: 14
    })
    expect(core.getCanonicalOwnerSnapshot()).toEqual({
      props: { property: {} },
      sceneTree: {
        workspace: 'workspace-1',
        workspaceList: ['workspace-1'],
        elements: {}
      }
    })

    expect(
      core.updateElementData('element-1', { lock: true }, { undoable: true })
    ).toBe(true)
    expect(prepareElementDataMutation).toHaveBeenCalledWith([
      { elementId: 'element-1', values: { lock: true } }
    ])
    expect(applyPreparedElementMutation).toHaveBeenCalledWith(
      { kind: 'prepared-element-data-mutation' },
      { undoable: true }
    )
  })

  it('projects local computed data through element-owned canonical properties', () => {
    const { core, projectLocalComputedDataFromPropertyIds } =
      createCoreForTest()

    core.projectLocalComputedDataForElements(['element-1'])

    expect(projectLocalComputedDataFromPropertyIds).toHaveBeenCalledWith([
      'property-position',
      'property-dimension'
    ])
  })

  it('keeps Factory publication, status, delivery, and history access behind Core', () => {
    const {
      core,
      subscribeToSharedPublication,
      subscribeToTransactionStatus,
      observeSharedDataChannel
    } = createCoreForTest()
    const publicationSubscriber = vi.fn()
    const statusSubscriber = vi.fn()
    const channelSubscriber = vi.fn()

    core.subscribeToSharedPublication(publicationSubscriber)
    core.subscribeToTransactionStatus(statusSubscriber)
    core.observeSharedDataChannel('document', channelSubscriber)

    expect(subscribeToSharedPublication).toHaveBeenCalledWith(
      publicationSubscriber
    )
    expect(subscribeToTransactionStatus).toHaveBeenCalledWith(statusSubscriber)
    expect(observeSharedDataChannel).toHaveBeenCalledWith(
      'document',
      channelSubscriber
    )
    expect(core.getUndoHistoryDepth()).toBe(3)
  })

  it('applies ordered remote canonical slices through the injected Factory', async () => {
    const { core, runRemoteTransaction, runRemoteTransactionProgressively } =
      createCoreForTest()
    const first = [{ kind: 'element-data', changes: [] }] as never
    const second = [{ kind: 'hierarchy-moves', moves: [] }] as never

    await core.applyRemoteCanonicalChangeSlices({
      origin: 'action',
      slices: [first, second]
    })

    expect(runRemoteTransaction).not.toHaveBeenCalled()
    expect(runRemoteTransactionProgressively).toHaveBeenCalledOnce()
    expect(core.applyCanonicalChanges).toHaveBeenNthCalledWith(1, first)
    expect(core.applyCanonicalChanges).toHaveBeenNthCalledWith(2, second)
  })
})
