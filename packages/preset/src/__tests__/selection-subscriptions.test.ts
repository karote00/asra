import { describe, expect, it, vi } from 'vitest'
import {
  BaseSelection,
  propertyRegistry,
  renderSceneTreeStore,
  renderSelectionStore,
  uiContext
} from '@asyra/core'
import {
  EntityTypes,
  SCENE_TREE_ACTIONS,
  type SelectionChange
} from '@asyra/utils'
import { EventTypes, publishEvent } from '@asyra/reactive-events'
import { registerSelections } from '../selection/register-default-selections'
import { registerDefaultDataChannelObservers } from '../subscriptions/data-channel'
import type { PresetCoreAPIs, PresetDependencies } from '../types'
import { VECTOR_COMPONENT_DEFINITION } from '../components/vector'
import {
  SelectionActions,
  SelectionChannels,
  SelectionEventNames
} from '../selection/channels'

interface TestDataChannelObserver {
  onBatch?: (changes: readonly unknown[]) => void
  onChange?: (change: unknown) => void
}

const deliverObserverChanges = (
  observer: TestDataChannelObserver | undefined,
  changes: readonly unknown[]
): void => {
  if (observer?.onBatch) {
    observer.onBatch(changes)
    return
  }
  changes.forEach((change) => observer?.onChange?.(change))
}

const createDeps = (): PresetDependencies =>
  ({
    sceneTree: {
      getElementById: () => undefined,
      getAllElements: () => new Map(),
      currentWorkspace: undefined
    },
    systemContext: {
      getManagedProperty: () => undefined,
      getSystemContextSnapshot: () => ({
        primaryTool: 'select',
        mousePosition: { x: 0, y: 0 }
      })
    },
    render: {
      getElementById: () => undefined,
      getViewportPosition: () => ({ x: 0, y: 0 }),
      getViewportScale: () => 1,
      getMousePosInWorkspace: () => ({ x: 0, y: 0 }),
      zoomTo: () => undefined,
      panTo: () => undefined
    }
  }) as unknown as PresetDependencies

const VECTOR_TYPE = VECTOR_COMPONENT_DEFINITION.type

describe('Preset Selection Subscriptions', () => {
  it('rebuilds Render projection immediately after every observer registration', () => {
    const lifecycle: string[] = []
    const observers = new Map<string, { onChange: (change: unknown) => void }>()
    const core = {
      getSelection: () => undefined,
      registerDataChannelObserver: (registration: {
        name: string
        onChange: (change: unknown) => void
      }) => {
        observers.set(registration.name, registration)
        lifecycle.push(`register:${registration.name}`)
      },
      unregisterDataChannelObserver: (name: string) => {
        observers.delete(name)
        lifecycle.push(`unregister:${name}`)
      }
    } as unknown as PresetCoreAPIs
    const reload = vi
      .spyOn(renderSceneTreeStore, 'reload')
      .mockImplementation(() => {
        expect(observers.has('preset.render.sceneTree')).toBe(true)
        lifecycle.push('reload')
      })

    try {
      const disposeFirst = registerDefaultDataChannelObservers(
        core,
        createDeps(),
        undefined,
        { renderScene: true }
      )
      disposeFirst()

      const disposeSecond = registerDefaultDataChannelObservers(
        core,
        createDeps(),
        undefined,
        { renderScene: true }
      )

      expect(reload).toHaveBeenCalledTimes(2)
      expect(lifecycle).toEqual([
        'register:preset.render.sceneTree',
        'reload',
        'unregister:preset.render.sceneTree',
        'register:preset.render.sceneTree',
        'reload'
      ])

      disposeSecond()
    } finally {
      reload.mockRestore()
    }
  })

  it('propagates a file-load Render rebuild failure to the lifecycle caller', () => {
    const observers = new Map<string, { onChange: (change: unknown) => void }>()
    const core = {
      getSelection: () => undefined,
      registerDataChannelObserver: (registration: {
        name: string
        onChange: (change: unknown) => void
      }) => observers.set(registration.name, registration),
      unregisterDataChannelObserver: (name: string) => observers.delete(name)
    } as unknown as PresetCoreAPIs
    const reloadFailure = new Error('file-load Render rebuild failed')
    const reload = vi
      .spyOn(renderSceneTreeStore, 'reload')
      .mockImplementationOnce(() => undefined)
    let dispose: (() => void) | undefined

    try {
      dispose = registerDefaultDataChannelObservers(
        core,
        createDeps(),
        undefined,
        { renderScene: true }
      )
      reload.mockImplementation(() => {
        throw reloadFailure
      })

      expect(() =>
        publishEvent({ type: EventTypes.FILE_LOAD_COMPLETE })
      ).toThrow(reloadFailure)
    } finally {
      dispose?.()
      reload.mockRestore()
    }
  })

  it('clears Render projection state and visual nodes once when the render observer is disposed', () => {
    const observers = new Map<string, { onChange: (change: unknown) => void }>()
    const core = {
      getSelection: () => undefined,
      registerDataChannelObserver: (registration: {
        name: string
        onChange: (change: unknown) => void
      }) => observers.set(registration.name, registration),
      unregisterDataChannelObserver: (name: string) => observers.delete(name)
    } as unknown as PresetCoreAPIs
    const projectionStore =
      renderSceneTreeStore as typeof renderSceneTreeStore & {
        clearProjection: () => void
      }
    const clearProjection = vi
      .spyOn(projectionStore, 'clearProjection')
      .mockImplementation(() => undefined)
    const reload = vi
      .spyOn(renderSceneTreeStore, 'reload')
      .mockImplementation(() => undefined)

    try {
      const disposeRender = registerDefaultDataChannelObservers(
        core,
        createDeps(),
        undefined,
        { renderScene: true }
      )
      disposeRender()
      disposeRender()
      expect(clearProjection).toHaveBeenCalledTimes(1)

      const disposeSelection = registerDefaultDataChannelObservers(
        core,
        createDeps(),
        undefined,
        { selection: true }
      )
      disposeSelection()
      expect(clearProjection).toHaveBeenCalledTimes(1)
    } finally {
      reload.mockRestore()
      clearProjection.mockRestore()
    }
  })

  it('clears Render projection and visual nodes when registration rebuild rolls back', () => {
    const observers = new Map<string, { onChange: (change: unknown) => void }>()
    const core = {
      getSelection: () => undefined,
      registerDataChannelObserver: (registration: {
        name: string
        onChange: (change: unknown) => void
      }) => observers.set(registration.name, registration),
      unregisterDataChannelObserver: (name: string) => observers.delete(name)
    } as unknown as PresetCoreAPIs
    const projectionStore =
      renderSceneTreeStore as typeof renderSceneTreeStore & {
        clearProjection: () => void
      }
    const clearProjection = vi
      .spyOn(projectionStore, 'clearProjection')
      .mockImplementation(() => undefined)
    const reload = vi
      .spyOn(renderSceneTreeStore, 'reload')
      .mockImplementation(() => {
        throw new Error('authoritative rebuild failed')
      })

    try {
      expect(() =>
        registerDefaultDataChannelObservers(core, createDeps(), undefined, {
          renderScene: true
        })
      ).toThrow('authoritative rebuild failed')
      expect(observers.has('preset.render.sceneTree')).toBe(false)
      expect(clearProjection).toHaveBeenCalledTimes(1)
    } finally {
      reload.mockRestore()
      clearProjection.mockRestore()
    }
  })

  it('routes complete Scene Tree deltas and records Render projection outcomes', async () => {
    const observers = new Map<string, { onChange: (change: unknown) => void }>()
    const core = {
      getSelection: () => undefined,
      registerDataChannelObserver: (registration: {
        name: string
        onChange: (change: unknown) => void
      }) => observers.set(registration.name, registration),
      unregisterDataChannelObserver: (name: string) => observers.delete(name)
    } as unknown as PresetCoreAPIs
    const dependencies = createDeps()
    const add = vi.spyOn(renderSceneTreeStore, 'addElementById')
    const remove = vi.spyOn(renderSceneTreeStore, 'removeElement')
    const scalar = vi.spyOn(renderSceneTreeStore, 'updateElement')
    const batch = vi.spyOn(renderSceneTreeStore, 'updateElementBatch')
    const patch = vi.spyOn(renderSceneTreeStore, 'updateElementPatch')
    const move = vi.spyOn(renderSceneTreeStore, 'moveElements')
    const subtree = vi.spyOn(renderSceneTreeStore, 'applySubtreeChange')
    const reload = vi
      .spyOn(renderSceneTreeStore, 'reload')
      .mockImplementation(() => undefined)
    add.mockReturnValue({ status: 'applied', elementId: 'vector-1' })
    remove.mockReturnValue({ status: 'removed', elementId: 'vector-1' })
    scalar.mockReturnValue({ status: 'resynced', elementId: 'vector-1' })
    batch.mockReturnValue({ status: 'applied', elementId: 'vector-1' })
    patch.mockReturnValue({ status: 'failed', elementId: 'vector-1' })
    move.mockReturnValue({ status: 'applied', elementId: 'vector-1' })
    subtree.mockReturnValue({ status: 'removed', elementId: 'group-1' })

    const counters: string[] = []
    const runtimeGlobal = globalThis as typeof globalThis & {
      __asyraDiagnosticCounterSink?: (name: string) => void
    }
    const previousCounterSink = runtimeGlobal.__asyraDiagnosticCounterSink
    runtimeGlobal.__asyraDiagnosticCounterSink = (name) => {
      counters.push(name)
    }

    const dispose = registerDefaultDataChannelObservers(
      core,
      dependencies,
      undefined,
      { renderScene: true }
    )
    const observer = observers.get('preset.render.sceneTree')
    expect(observer).toBeDefined()

    try {
      const moves = [
        {
          elementId: 'vector-1',
          before: { parentId: 'workspace-1', index: 0 },
          after: { parentId: 'group-1', index: 0 }
        }
      ]
      const subtreeChange = {
        action: SCENE_TREE_ACTIONS.REMOVE_SUBTREE,
        undoAction: SCENE_TREE_ACTIONS.RESTORE_SUBTREE,
        eventName: EventTypes.CHANGE_SUBTREE,
        elementId: 'group-1',
        rootParentChildrenAfter: [],
        removed: [
          {
            elementId: 'group-1',
            parentId: 'workspace-1',
            index: 0,
            data: { id: 'group-1', type: EntityTypes.GROUP }
          }
        ]
      }
      const restoreSubtreeChange = {
        ...subtreeChange,
        action: SCENE_TREE_ACTIONS.RESTORE_SUBTREE,
        undoAction: SCENE_TREE_ACTIONS.REMOVE_SUBTREE
      }
      deliverObserverChanges(observer, [
        {
          action: SCENE_TREE_ACTIONS.ADD_ELEMENT,
          data: { id: 'vector-1', type: 'vector' },
          parentId: 'group-1',
          index: 1
        },
        {
          action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA,
          eventName: 'update-computed',
          id: 'vector-1',
          owner: 'computed',
          key: 'visible',
          before: true,
          after: false,
          options: { undoable: false }
        },
        {
          action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_BATCH,
          eventName: 'update-computed',
          id: 'vector-1',
          changes: [
            { owner: 'raw', key: 'x', before: 0, after: 10 },
            { owner: 'computed', key: 'y', before: 0, after: 20 }
          ],
          options: { undoable: false }
        },
        {
          action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_PATCH,
          eventName: 'update-computed-patch',
          id: 'vector-1',
          patch: {
            records: {
              points: {
                set: {
                  p1: { after: { id: 'p1', x: 0, y: 0 } }
                }
              }
            }
          },
          options: { undoable: false }
        },
        {
          action: SCENE_TREE_ACTIONS.REMOVE_ELEMENT,
          data: { id: 'vector-1', type: 'vector' },
          parentId: 'group-1',
          index: 1
        },
        {
          action: SCENE_TREE_ACTIONS.MOVE_ELEMENTS,
          eventName: EventTypes.MOVE_ELEMENTS,
          moves
        },
        subtreeChange,
        restoreSubtreeChange
      ])

      expect(add).toHaveBeenCalledWith('vector-1', 'group-1', 1)
      expect(scalar).toHaveBeenCalledWith(
        'vector-1',
        'computed',
        'visible',
        true,
        false,
        { undoable: false }
      )
      expect(batch).toHaveBeenCalledWith(
        'vector-1',
        [
          { owner: 'raw', key: 'x', before: 0, after: 10 },
          { owner: 'computed', key: 'y', before: 0, after: 20 }
        ],
        { undoable: false }
      )
      expect(patch).toHaveBeenCalledWith(
        'vector-1',
        {
          records: {
            points: {
              set: {
                p1: { after: { id: 'p1', x: 0, y: 0 } }
              }
            }
          }
        },
        { undoable: false }
      )
      expect(remove).toHaveBeenCalledWith(
        { id: 'vector-1', type: 'vector' },
        'group-1',
        1
      )
      expect(move).toHaveBeenCalledWith(moves)
      expect(subtree).toHaveBeenNthCalledWith(1, subtreeChange)
      expect(subtree).toHaveBeenNthCalledWith(2, restoreSubtreeChange)
      expect(counters).toEqual([
        'render-projection-outcome-applied',
        'render-projection-outcome-resynced',
        'render-projection-outcome-applied',
        'render-projection-outcome-failed',
        'render-projection-outcome-removed',
        'render-projection-outcome-applied',
        'render-projection-outcome-removed',
        'render-projection-outcome-removed'
      ])
    } finally {
      dispose()
      runtimeGlobal.__asyraDiagnosticCounterSink = previousCounterSink
      add.mockRestore()
      remove.mockRestore()
      scalar.mockRestore()
      batch.mockRestore()
      patch.mockRestore()
      move.mockRestore()
      subtree.mockRestore()
      reload.mockRestore()
    }
  })

  it('routes contiguous same-parent additions through one Render relationship batch', () => {
    const observers = new Map<string, { onChange: (change: unknown) => void }>()
    const core = {
      getSelection: () => undefined,
      registerDataChannelObserver: (registration: {
        name: string
        onChange: (change: unknown) => void
      }) => observers.set(registration.name, registration),
      unregisterDataChannelObserver: (name: string) => observers.delete(name)
    } as unknown as PresetCoreAPIs
    const addSingle = vi.spyOn(renderSceneTreeStore, 'addElementById')
    const addBatch = vi
      .spyOn(renderSceneTreeStore, 'addElementsById')
      .mockReturnValue([
        { status: 'applied', elementId: 'child-a' },
        { status: 'applied', elementId: 'child-b' }
      ])
    const reload = vi
      .spyOn(renderSceneTreeStore, 'reload')
      .mockImplementation(() => undefined)
    const dispose = registerDefaultDataChannelObservers(
      core,
      createDeps(),
      undefined,
      { renderScene: true }
    )
    const observer = observers.get('preset.render.sceneTree')

    try {
      deliverObserverChanges(observer, [
        {
          action: SCENE_TREE_ACTIONS.ADD_ELEMENT,
          data: { id: 'child-a', type: 'vector' },
          parentId: 'group-1',
          index: 0
        },
        {
          action: SCENE_TREE_ACTIONS.ADD_ELEMENT,
          data: { id: 'child-b', type: 'vector' },
          parentId: 'group-1',
          index: 1
        }
      ])

      expect(addBatch).toHaveBeenCalledOnce()
      expect(addBatch).toHaveBeenCalledWith([
        { elementId: 'child-a', parentId: 'group-1', index: 0 },
        { elementId: 'child-b', parentId: 'group-1', index: 1 }
      ])
      expect(addSingle).not.toHaveBeenCalled()
    } finally {
      dispose()
      addSingle.mockRestore()
      addBatch.mockRestore()
      reload.mockRestore()
    }
  })

  it('projects each formal Scene Tree batch without exposing later canonical additions', () => {
    interface Observer {
      onBatch?: (changes: readonly unknown[]) => void
      onChange?: (change: unknown) => void
    }
    const observers = new Map<string, Observer>()
    const core = {
      getSelection: () => undefined,
      registerDataChannelObserver: (
        registration: Observer & { name: string }
      ) => observers.set(registration.name, registration),
      unregisterDataChannelObserver: (name: string) => observers.delete(name)
    } as unknown as PresetCoreAPIs
    const dependencies = createDeps()
    const getAllElements = vi.fn(() => {
      throw new Error('formal batch projection must not scan canonical state')
    })
    dependencies.sceneTree.getAllElements = getAllElements
    const addSingle = vi
      .spyOn(renderSceneTreeStore, 'addElementById')
      .mockReturnValue({ status: 'applied', elementId: 'group-1' })
    const addBatch = vi
      .spyOn(renderSceneTreeStore, 'addElementsById')
      .mockImplementation((additions) =>
        additions.map(({ elementId }) => ({
          status: 'applied',
          elementId
        }))
      )
    const reload = vi
      .spyOn(renderSceneTreeStore, 'reload')
      .mockImplementation(() => undefined)
    propertyRegistry.register('flattenedElementIds', { defaultValue: [] })
    propertyRegistry.register('elementDataMap', { defaultValue: {} })
    uiContext.set('flattenedElementIds', [])
    uiContext.set('elementDataMap', {})
    const dispose = registerDefaultDataChannelObservers(
      core,
      dependencies,
      undefined,
      { renderScene: true, uiContext: true }
    )
    const renderObserver = observers.get('preset.render.sceneTree')
    const uiObserver = observers.get('preset.uiContext.sceneTree')
    const uiSet = vi.spyOn(uiContext, 'set')
    const firstBatch = [
      {
        action: SCENE_TREE_ACTIONS.ADD_ELEMENT,
        data: {
          children: [],
          id: 'group-1',
          parentId: 'workspace-1',
          type: EntityTypes.GROUP
        },
        index: 0,
        options: { sharedDelivery: 'transaction-end' },
        parentId: 'workspace-1'
      },
      {
        action: SCENE_TREE_ACTIONS.ADD_ELEMENT,
        data: {
          id: 'child-a',
          parentId: 'group-1',
          type: VECTOR_TYPE
        },
        index: 0,
        options: { sharedDelivery: 'transaction-end' },
        parentId: 'group-1'
      }
    ]
    const secondBatch = [
      {
        action: SCENE_TREE_ACTIONS.ADD_ELEMENT,
        data: {
          id: 'child-b',
          parentId: 'group-1',
          type: VECTOR_TYPE
        },
        index: 1,
        options: { sharedDelivery: 'transaction-end' },
        parentId: 'group-1'
      },
      {
        action: SCENE_TREE_ACTIONS.ADD_ELEMENT,
        data: {
          id: 'child-c',
          parentId: 'group-1',
          type: VECTOR_TYPE
        },
        index: 2,
        options: { sharedDelivery: 'transaction-end' },
        parentId: 'group-1'
      }
    ]

    try {
      expect(renderObserver?.onBatch).toBeTypeOf('function')
      expect(uiObserver?.onBatch).toBeTypeOf('function')

      renderObserver?.onBatch?.(firstBatch)
      uiObserver?.onBatch?.(firstBatch)

      expect(addSingle).toHaveBeenCalledTimes(2)
      expect(addBatch).not.toHaveBeenCalled()
      expect(uiSet.mock.calls.map(([property]) => property)).toEqual([
        'elementDataMap',
        'flattenedElementIds'
      ])
      expect(uiContext.get('flattenedElementIds')).toEqual([
        'group-1',
        'child-a'
      ])
      expect(uiContext.get('elementDataMap')).toEqual({
        'group-1': {
          children: ['child-a'],
          id: 'group-1',
          parentId: 'workspace-1',
          type: EntityTypes.GROUP
        },
        'child-a': {
          id: 'child-a',
          parentId: 'group-1',
          type: VECTOR_TYPE
        }
      })

      renderObserver?.onBatch?.(secondBatch)
      uiObserver?.onBatch?.(secondBatch)

      expect(uiContext.get('flattenedElementIds')).toEqual([
        'group-1',
        'child-a',
        'child-b',
        'child-c'
      ])
      expect(
        (uiContext.get<Record<string, { children?: string[] }>>(
          'elementDataMap'
        ) ?? {})['group-1']?.children
      ).toEqual(['child-a', 'child-b', 'child-c'])
      expect(addSingle).toHaveBeenCalledTimes(2)
      expect(addSingle).toHaveBeenNthCalledWith(1, 'group-1', 'workspace-1', 0)
      expect(addSingle).toHaveBeenNthCalledWith(2, 'child-a', 'group-1', 0)
      expect(addBatch).toHaveBeenCalledOnce()
      expect(addBatch).toHaveBeenCalledWith([
        { elementId: 'child-b', parentId: 'group-1', index: 1 },
        { elementId: 'child-c', parentId: 'group-1', index: 2 }
      ])
      expect(uiSet.mock.calls.map(([property]) => property)).toEqual([
        'elementDataMap',
        'flattenedElementIds',
        'elementDataMap',
        'flattenedElementIds'
      ])
      expect(getAllElements).not.toHaveBeenCalled()

      const beforePropertyMap =
        uiContext.get<Record<string, Record<string, unknown>>>(
          'elementDataMap'
        ) ?? {}
      const beforePropertyHierarchy = uiContext.get<string[]>(
        'flattenedElementIds'
      )
      uiSet.mockClear()
      uiObserver?.onBatch?.([
        {
          action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA,
          eventName: 'update-computed',
          id: 'child-a',
          owner: 'raw',
          key: 'name',
          before: undefined,
          after: 'Renamed child',
          options: { undoable: false }
        }
      ])

      const afterPropertyMap =
        uiContext.get<Record<string, Record<string, unknown>>>(
          'elementDataMap'
        ) ?? {}
      expect(uiSet.mock.calls.map(([property]) => property)).toEqual([
        'elementDataMap'
      ])
      expect(uiContext.get('flattenedElementIds')).toBe(beforePropertyHierarchy)
      expect(afterPropertyMap['group-1']).toBe(beforePropertyMap['group-1'])
      expect(afterPropertyMap['child-a']).toEqual({
        ...beforePropertyMap['child-a'],
        name: 'Renamed child'
      })

      uiSet.mockClear()
      uiObserver?.onBatch?.([
        {
          action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA,
          eventName: 'update-computed',
          id: 'child-a',
          owner: 'computed',
          key: 'x',
          before: 0,
          after: 10,
          options: { undoable: false }
        }
      ])
      expect(uiSet).not.toHaveBeenCalled()
    } finally {
      dispose()
      propertyRegistry.unregister('flattenedElementIds')
      propertyRegistry.unregister('elementDataMap')
      addSingle.mockRestore()
      addBatch.mockRestore()
      reload.mockRestore()
      uiSet.mockRestore()
    }
  })

  it('ignores a stale Render batch callback after its observer lifetime is disposed', () => {
    const observers = new Map<string, { onChange: (change: unknown) => void }>()
    const core = {
      getSelection: () => undefined,
      registerDataChannelObserver: (registration: {
        name: string
        onChange: (change: unknown) => void
      }) => observers.set(registration.name, registration),
      unregisterDataChannelObserver: (name: string) => observers.delete(name)
    } as unknown as PresetCoreAPIs
    const addSingle = vi.spyOn(renderSceneTreeStore, 'addElementById')
    const addBatch = vi.spyOn(renderSceneTreeStore, 'addElementsById')
    const reload = vi
      .spyOn(renderSceneTreeStore, 'reload')
      .mockImplementation(() => undefined)
    const clearProjection = vi
      .spyOn(renderSceneTreeStore, 'clearProjection')
      .mockImplementation(() => undefined)
    const dispose = registerDefaultDataChannelObservers(
      core,
      createDeps(),
      undefined,
      { renderScene: true }
    )
    const observer = observers.get('preset.render.sceneTree')

    try {
      dispose()
      deliverObserverChanges(observer, [
        {
          action: SCENE_TREE_ACTIONS.ADD_ELEMENT,
          data: { id: 'child-a', type: 'vector' },
          parentId: 'group-1',
          index: 0
        },
        {
          action: SCENE_TREE_ACTIONS.ADD_ELEMENT,
          data: { id: 'child-b', type: 'vector' },
          parentId: 'group-1',
          index: 1
        }
      ])

      expect(addBatch).not.toHaveBeenCalled()
      expect(addSingle).not.toHaveBeenCalled()
      expect(clearProjection).toHaveBeenCalledOnce()
    } finally {
      dispose()
      addSingle.mockRestore()
      addBatch.mockRestore()
      reload.mockRestore()
      clearProjection.mockRestore()
    }
  })

  it('keeps UI batch projection isolated per Core observer lifetime', () => {
    const createCore = () => {
      const observers = new Map<string, TestDataChannelObserver>()
      const core = {
        getSelection: () => undefined,
        registerDataChannelObserver: (
          registration: TestDataChannelObserver & { name: string }
        ) => {
          observers.set(registration.name, registration)
        },
        unregisterDataChannelObserver: (name: string) => observers.delete(name)
      } as unknown as PresetCoreAPIs

      return { core, observers }
    }

    const first = createCore()
    const second = createCore()
    const firstDependencies = createDeps()
    const secondDependencies = createDeps()
    const firstGetAllElements = vi.fn(() => new Map())
    const secondGetAllElements = vi.fn(() => new Map())
    firstDependencies.sceneTree.getAllElements = firstGetAllElements
    secondDependencies.sceneTree.getAllElements = secondGetAllElements
    propertyRegistry.register('flattenedElementIds', { defaultValue: [] })
    propertyRegistry.register('elementDataMap', { defaultValue: {} })
    uiContext.set('flattenedElementIds', [])
    uiContext.set('elementDataMap', {})

    // Register the second lifetime first so a shared projection queue would
    // expose state through the wrong observer lifetime.
    const disposeSecond = registerDefaultDataChannelObservers(
      second.core,
      secondDependencies,
      undefined,
      { uiContext: true }
    )
    const disposeFirst = registerDefaultDataChannelObservers(
      first.core,
      firstDependencies,
      undefined,
      { uiContext: true }
    )

    try {
      deliverObserverChanges(
        first.observers.get('preset.uiContext.sceneTree'),
        [
          {
            action: SCENE_TREE_ACTIONS.ADD_ELEMENT,
            data: {
              id: 'first-element',
              parentId: 'first-workspace',
              type: 'rectangle'
            },
            parentId: 'first-workspace'
          }
        ]
      )

      expect(firstGetAllElements).not.toHaveBeenCalled()
      expect(secondGetAllElements).not.toHaveBeenCalled()
      expect(uiContext.get('flattenedElementIds')).toEqual(['first-element'])

      disposeSecond()
      deliverObserverChanges(
        first.observers.get('preset.uiContext.sceneTree'),
        [
          {
            action: SCENE_TREE_ACTIONS.ADD_ELEMENT,
            data: {
              id: 'first-element-2',
              parentId: 'first-workspace',
              type: 'rectangle'
            },
            parentId: 'first-workspace'
          }
        ]
      )

      expect(firstGetAllElements).not.toHaveBeenCalled()
      expect(secondGetAllElements).not.toHaveBeenCalled()
      expect(uiContext.get('flattenedElementIds')).toEqual([
        'first-element',
        'first-element-2'
      ])
    } finally {
      disposeFirst()
      disposeSecond()
      propertyRegistry.unregister('flattenedElementIds')
      propertyRegistry.unregister('elementDataMap')
    }
  })

  it('projects one affected UI context snapshot per formal canonical batch', () => {
    const observers = new Map<string, TestDataChannelObserver>()
    const core = {
      getSelection: () => undefined,
      registerDataChannelObserver: (
        registration: TestDataChannelObserver & { name: string }
      ) => {
        observers.set(registration.name, registration)
      },
      unregisterDataChannelObserver: (name: string) => observers.delete(name)
    } as unknown as PresetCoreAPIs
    const dependencies = createDeps()
    const elements = new Map<
      string,
      {
        get: (key: string) => unknown
        save: () => Record<string, unknown>
      }
    >()
    const workspaceChildren: string[] = []
    const getAllElements = vi.fn(() => elements)
    dependencies.sceneTree.getElementById = (elementId: string) =>
      elements.get(elementId)
    dependencies.sceneTree.getAllElements = getAllElements
    dependencies.sceneTree.currentWorkspace = {
      get: (key: string) =>
        key === 'type' ? EntityTypes.WORKSPACE : undefined,
      save: () => ({
        id: 'workspace-1',
        type: EntityTypes.WORKSPACE,
        children: [...workspaceChildren]
      })
    }
    propertyRegistry.register('flattenedElementIds', { defaultValue: [] })
    propertyRegistry.register('elementDataMap', { defaultValue: {} })
    uiContext.set('flattenedElementIds', [])
    uiContext.set('elementDataMap', {})
    const dispose = registerDefaultDataChannelObservers(
      core,
      dependencies,
      undefined,
      { uiContext: true }
    )

    const addElement = (elementId: string) => {
      const saved = {
        id: elementId,
        type: EntityTypes.RECTANGLE,
        parentId: 'workspace-1'
      }
      elements.set(elementId, {
        get: (key: string) => saved[key as keyof typeof saved],
        save: () => ({ ...saved })
      })
      workspaceChildren.push(elementId)
      return {
        action: SCENE_TREE_ACTIONS.ADD_ELEMENT,
        data: saved,
        options: { sharedDelivery: 'immediate' },
        parentId: 'workspace-1'
      }
    }

    try {
      deliverObserverChanges(observers.get('preset.uiContext.sceneTree'), [
        addElement('rect-1'),
        addElement('rect-2')
      ])

      expect(getAllElements).not.toHaveBeenCalled()
      expect(uiContext.get('flattenedElementIds')).toEqual(['rect-1', 'rect-2'])
      expect(uiContext.get('elementDataMap')).toEqual({
        'rect-1': {
          id: 'rect-1',
          type: EntityTypes.RECTANGLE,
          parentId: 'workspace-1'
        },
        'rect-2': {
          id: 'rect-2',
          type: EntityTypes.RECTANGLE,
          parentId: 'workspace-1'
        }
      })

      deliverObserverChanges(observers.get('preset.uiContext.sceneTree'), [
        addElement('rect-3')
      ])

      expect(getAllElements).not.toHaveBeenCalled()
      expect(uiContext.get('flattenedElementIds')).toEqual([
        'rect-1',
        'rect-2',
        'rect-3'
      ])
    } finally {
      dispose()
      propertyRegistry.unregister('flattenedElementIds')
      propertyRegistry.unregister('elementDataMap')
    }
  })

  it.each([
    {
      name: 'move',
      change: {
        action: SCENE_TREE_ACTIONS.MOVE_ELEMENTS,
        eventName: EventTypes.MOVE_ELEMENTS,
        moves: [
          {
            elementId: 'rect-2',
            before: { parentId: 'workspace-1', index: 0 },
            after: { parentId: 'group-1', index: 1 }
          }
        ]
      },
      initialIds: ['rect-2', 'group-1', 'rect-1'],
      initialMap: {
        'rect-2': {
          id: 'rect-2',
          type: EntityTypes.RECTANGLE,
          parentId: 'workspace-1'
        },
        'group-1': {
          id: 'group-1',
          type: EntityTypes.GROUP,
          parentId: 'workspace-1',
          children: ['rect-1']
        },
        'rect-1': {
          id: 'rect-1',
          type: EntityTypes.RECTANGLE,
          parentId: 'group-1'
        }
      },
      workspaceChildren: ['group-1'],
      elements: {
        'group-1': {
          id: 'group-1',
          type: EntityTypes.GROUP,
          parentId: 'workspace-1',
          children: ['rect-1', 'rect-2']
        },
        'rect-1': {
          id: 'rect-1',
          type: EntityTypes.RECTANGLE,
          parentId: 'group-1'
        },
        'rect-2': {
          id: 'rect-2',
          type: EntityTypes.RECTANGLE,
          parentId: 'group-1'
        }
      },
      expectedIds: ['group-1', 'rect-1', 'rect-2']
    },
    {
      name: 'same-parent multi-element move',
      change: {
        action: SCENE_TREE_ACTIONS.MOVE_ELEMENTS,
        eventName: EventTypes.MOVE_ELEMENTS,
        moves: [
          {
            elementId: 'rect-b',
            before: { parentId: 'group-1', index: 1 },
            after: { parentId: 'group-1', index: 2 }
          },
          {
            elementId: 'rect-c',
            before: { parentId: 'group-1', index: 2 },
            after: { parentId: 'group-1', index: 3 }
          }
        ]
      },
      initialIds: ['group-1', 'rect-a', 'rect-b', 'rect-c', 'rect-d'],
      initialMap: {
        'group-1': {
          id: 'group-1',
          type: EntityTypes.GROUP,
          parentId: 'workspace-1',
          children: ['rect-a', 'rect-b', 'rect-c', 'rect-d']
        },
        'rect-a': {
          id: 'rect-a',
          type: EntityTypes.RECTANGLE,
          parentId: 'group-1'
        },
        'rect-b': {
          id: 'rect-b',
          type: EntityTypes.RECTANGLE,
          parentId: 'group-1'
        },
        'rect-c': {
          id: 'rect-c',
          type: EntityTypes.RECTANGLE,
          parentId: 'group-1'
        },
        'rect-d': {
          id: 'rect-d',
          type: EntityTypes.RECTANGLE,
          parentId: 'group-1'
        }
      },
      workspaceChildren: ['group-1'],
      elements: {
        'group-1': {
          id: 'group-1',
          type: EntityTypes.GROUP,
          parentId: 'workspace-1',
          children: ['rect-a', 'rect-d', 'rect-b', 'rect-c']
        },
        'rect-a': {
          id: 'rect-a',
          type: EntityTypes.RECTANGLE,
          parentId: 'group-1'
        },
        'rect-b': {
          id: 'rect-b',
          type: EntityTypes.RECTANGLE,
          parentId: 'group-1'
        },
        'rect-c': {
          id: 'rect-c',
          type: EntityTypes.RECTANGLE,
          parentId: 'group-1'
        },
        'rect-d': {
          id: 'rect-d',
          type: EntityTypes.RECTANGLE,
          parentId: 'group-1'
        }
      },
      expectedIds: ['group-1', 'rect-a', 'rect-d', 'rect-b', 'rect-c']
    },
    {
      name: 'subtree removal',
      change: {
        action: SCENE_TREE_ACTIONS.REMOVE_SUBTREE,
        undoAction: SCENE_TREE_ACTIONS.RESTORE_SUBTREE,
        eventName: EventTypes.CHANGE_SUBTREE,
        elementId: 'group-1',
        rootParentChildrenAfter: [],
        removed: [
          {
            elementId: 'rect-1',
            parentId: 'group-1',
            index: 0,
            data: { id: 'rect-1', type: EntityTypes.RECTANGLE }
          },
          {
            elementId: 'group-1',
            parentId: 'workspace-1',
            index: 0,
            data: {
              id: 'group-1',
              type: EntityTypes.GROUP,
              children: ['rect-1']
            }
          }
        ]
      },
      initialIds: ['group-1', 'rect-1'],
      initialMap: {
        'group-1': {
          id: 'group-1',
          type: EntityTypes.GROUP,
          parentId: 'workspace-1',
          children: ['rect-1']
        },
        'rect-1': {
          id: 'rect-1',
          type: EntityTypes.RECTANGLE,
          parentId: 'group-1'
        }
      },
      workspaceChildren: [],
      elements: {},
      expectedIds: []
    },
    {
      name: 'subtree restoration',
      change: {
        action: SCENE_TREE_ACTIONS.RESTORE_SUBTREE,
        undoAction: SCENE_TREE_ACTIONS.REMOVE_SUBTREE,
        eventName: EventTypes.CHANGE_SUBTREE,
        elementId: 'group-1',
        rootParentChildrenAfter: [],
        removed: [
          {
            elementId: 'rect-1',
            parentId: 'group-1',
            index: 0,
            data: { id: 'rect-1', type: EntityTypes.RECTANGLE }
          },
          {
            elementId: 'group-1',
            parentId: 'workspace-1',
            index: 0,
            data: {
              id: 'group-1',
              type: EntityTypes.GROUP,
              children: ['rect-1']
            }
          }
        ]
      },
      initialIds: [],
      initialMap: {},
      workspaceChildren: ['group-1'],
      elements: {
        'group-1': {
          id: 'group-1',
          type: EntityTypes.GROUP,
          parentId: 'workspace-1',
          children: ['rect-1']
        },
        'rect-1': {
          id: 'rect-1',
          type: EntityTypes.RECTANGLE,
          parentId: 'group-1'
        }
      },
      expectedIds: ['group-1', 'rect-1']
    }
  ])(
    'projects canonical hierarchy after $name',
    ({
      change,
      initialIds,
      initialMap,
      workspaceChildren,
      elements,
      expectedIds
    }) => {
      const observers = new Map<string, TestDataChannelObserver>()
      const core = {
        getSelection: () => undefined,
        registerDataChannelObserver: (
          registration: TestDataChannelObserver & { name: string }
        ) => observers.set(registration.name, registration),
        unregisterDataChannelObserver: (name: string) => observers.delete(name)
      } as unknown as PresetCoreAPIs
      const elementRecords = Object.entries(elements).map(
        ([elementId, data]) => [
          elementId,
          {
            get: (key: string) => data[key as keyof typeof data],
            save: () => ({
              ...data,
              ...('children' in data
                ? { children: [...(data.children ?? [])] }
                : {})
            })
          }
        ]
      )
      const elementMap = new Map(elementRecords)
      const dependencies = {
        ...createDeps(),
        sceneTree: {
          getElementById: (elementId: string) => elementMap.get(elementId),
          getAllElements: () => elementMap,
          currentWorkspace: {
            get: (key: string) =>
              key === 'type' ? EntityTypes.WORKSPACE : undefined,
            save: () => ({
              id: 'workspace-1',
              type: EntityTypes.WORKSPACE,
              children: [...workspaceChildren]
            })
          }
        }
      } as unknown as PresetDependencies

      propertyRegistry.register('flattenedElementIds', { defaultValue: [] })
      propertyRegistry.register('elementDataMap', { defaultValue: {} })
      uiContext.set('flattenedElementIds', [...initialIds])
      uiContext.set('elementDataMap', { ...initialMap })
      const dispose = registerDefaultDataChannelObservers(
        core,
        dependencies,
        undefined,
        { uiContext: true }
      )

      try {
        const observer = observers.get('preset.uiContext.sceneTree')
        expect(observer).toBeDefined()

        deliverObserverChanges(observer, [change])

        expect(uiContext.get('flattenedElementIds')).toEqual(expectedIds)
        expect(uiContext.get('elementDataMap')).toEqual(elements)
      } finally {
        dispose()
        propertyRegistry.unregister('flattenedElementIds')
        propertyRegistry.unregister('elementDataMap')
      }
    }
  )

  it('applies selection channel changes and removes deleted selection ids via observers', () => {
    const observers = new Map<string, TestDataChannelObserver>()
    const selections = new Map<string, BaseSelection>()
    const core = {
      defineSelection: (type: string, selection: BaseSelection) => {
        selections.set(type, selection)
      },
      unregisterSelection: (type: string) => selections.delete(type),
      getSelection: (type: string) => selections.get(type),
      registerDataChannelObserver: (
        registration: TestDataChannelObserver & { name: string }
      ) => {
        observers.set(registration.name, registration)
      },
      unregisterDataChannelObserver: (name: string) => observers.delete(name)
    } as unknown as PresetCoreAPIs
    const dependencies = createDeps()

    const disposeSelections = registerSelections(core)
    const disposeObservers = registerDefaultDataChannelObservers(
      core,
      dependencies,
      undefined,
      { selection: true, uiContext: true }
    )

    const selectionRuntimeObserver = observers.get('preset.selection.runtime')
    expect(selectionRuntimeObserver).toBeDefined()
    selectionRuntimeObserver?.onChange({
      selectionType: SelectionChannels.ELEMENT,
      action: SelectionActions.SELECT_ELEMENTS,
      eventName: SelectionEventNames.SELECT_ELEMENTS,
      before: [],
      after: ['rect-1', 'oval-1']
    } satisfies SelectionChange)

    expect(
      Array.from(
        selections.get(SelectionChannels.ELEMENT)?.getSelectedIds() ?? []
      )
    ).toEqual(['rect-1', 'oval-1'])

    selectionRuntimeObserver?.onChange({
      selectionType: SelectionChannels.VECTOR_POINT,
      action: SelectionActions.SELECT_VECTOR_POINTS,
      eventName: SelectionEventNames.SELECT_VECTOR_POINTS,
      before: [],
      after: ['point-1']
    } satisfies SelectionChange)

    expect(
      Array.from(
        selections.get(SelectionChannels.VECTOR_POINT)?.getSelectedIds() ?? []
      )
    ).toEqual(['point-1'])

    selectionRuntimeObserver?.onChange({
      selectionType: SelectionChannels.VECTOR_SEGMENT,
      action: SelectionActions.SELECT_VECTOR_SEGMENTS,
      eventName: SelectionEventNames.SELECT_VECTOR_SEGMENTS,
      before: [],
      after: ['segment-1']
    } satisfies SelectionChange)

    expect(
      Array.from(
        selections.get(SelectionChannels.VECTOR_SEGMENT)?.getSelectedIds() ?? []
      )
    ).toEqual(['segment-1'])
    const sceneTreeObserver = observers.get('preset.uiContext.sceneTree')
    expect(sceneTreeObserver).toBeDefined()

    deliverObserverChanges(sceneTreeObserver, [
      {
        action: SCENE_TREE_ACTIONS.REMOVE_ELEMENT,
        data: { id: 'oval-1', type: 'oval' },
        parentId: 'workspace-1'
      }
    ])

    expect(
      Array.from(
        selections.get(SelectionChannels.ELEMENT)?.getSelectedIds() ?? []
      )
    ).toEqual(['rect-1'])

    const renderSelectionSpy = vi.spyOn(renderSelectionStore, 'updateSelection')

    // Undo/redo path publishes direct selection events (not shared-channel updates).
    // Ensure those events still refresh render selection mirrors.
    publishEvent({
      type: EventTypes.SELECT_ELEMENTS,
      payload: {
        selectionType: SelectionChannels.ELEMENT,
        action: SelectionActions.SELECT_ELEMENTS,
        eventName: SelectionEventNames.SELECT_ELEMENTS,
        before: ['rect-1'],
        after: ['rect-1', 'vector-1']
      }
    })

    expect(
      Array.from(
        selections.get(SelectionChannels.ELEMENT)?.getSelectedIds() ?? []
      )
    ).toEqual(['rect-1', 'vector-1'])
    expect(renderSelectionSpy).toHaveBeenCalledWith(SelectionChannels.ELEMENT)

    disposeObservers()
    disposeSelections()
    renderSelectionSpy.mockRestore()
  })

  it('syncs vector-editing selection mirrors without the UI context default', () => {
    const observers = new Map<string, { onChange: (change: unknown) => void }>()
    const selections = new Map<string, BaseSelection>()
    const core = {
      defineSelection: (type: string, selection: BaseSelection) => {
        selections.set(type, selection)
      },
      unregisterSelection: (type: string) => selections.delete(type),
      getSelection: (type: string) => selections.get(type),
      registerDataChannelObserver: (registration: {
        name: string
        onChange: (change: unknown) => void
      }) => {
        observers.set(registration.name, registration)
      },
      unregisterDataChannelObserver: (name: string) => observers.delete(name)
    } as unknown as PresetCoreAPIs
    propertyRegistry.register('vectorPointSelection', {
      defaultValue: new Set<string>()
    })
    propertyRegistry.register('vectorSegmentSelection', {
      defaultValue: new Set<string>()
    })
    const disposeSelections = registerSelections(core, undefined, [
      SelectionChannels.VECTOR_POINT,
      SelectionChannels.VECTOR_SEGMENT
    ])
    const disposeSelectionObservers = registerDefaultDataChannelObservers(
      core,
      createDeps(),
      undefined,
      { selection: true }
    )
    const disposeVectorEditingObservers = registerDefaultDataChannelObservers(
      core,
      createDeps(),
      undefined,
      { vectorEditing: true }
    )

    try {
      const runtimeObserver = observers.get('preset.selection.runtime')
      const vectorEditingObserver = observers.get(
        'preset.vectorEditing.selection'
      )
      expect(runtimeObserver).toBeDefined()
      expect(vectorEditingObserver).toBeDefined()

      const pointChange = {
        selectionType: SelectionChannels.VECTOR_POINT,
        action: SelectionActions.SELECT_VECTOR_POINTS,
        eventName: SelectionEventNames.SELECT_VECTOR_POINTS,
        before: [],
        after: ['point-1']
      } satisfies SelectionChange
      runtimeObserver?.onChange(pointChange)
      vectorEditingObserver?.onChange(pointChange)

      const segmentChange = {
        selectionType: SelectionChannels.VECTOR_SEGMENT,
        action: SelectionActions.SELECT_VECTOR_SEGMENTS,
        eventName: SelectionEventNames.SELECT_VECTOR_SEGMENTS,
        before: [],
        after: ['segment-1']
      } satisfies SelectionChange
      runtimeObserver?.onChange(segmentChange)
      vectorEditingObserver?.onChange(segmentChange)

      expect(uiContext.get('vectorPointSelection')).toEqual(
        new Set(['point-1'])
      )
      expect(uiContext.get('vectorSegmentSelection')).toEqual(
        new Set(['segment-1'])
      )

      publishEvent({
        type: EventTypes.SELECT_VECTOR_POINTS,
        payload: {
          selectionType: SelectionChannels.VECTOR_POINT,
          action: SelectionActions.SELECT_VECTOR_POINTS,
          eventName: SelectionEventNames.SELECT_VECTOR_POINTS,
          before: ['point-1'],
          after: ['point-2']
        }
      })

      expect(
        Array.from(
          selections.get(SelectionChannels.VECTOR_POINT)?.getSelectedIds() ?? []
        )
      ).toEqual(['point-2'])
      expect(uiContext.get('vectorPointSelection')).toEqual(
        new Set(['point-2'])
      )
    } finally {
      disposeVectorEditingObservers()
      disposeSelectionObservers()
      disposeSelections()
      propertyRegistry.unregister('vectorPointSelection')
      propertyRegistry.unregister('vectorSegmentSelection')
    }
  })

  it('does not let UI context projection write vector-editing properties', () => {
    const observers = new Map<string, { onChange: (change: unknown) => void }>()
    const selections = new Map<string, BaseSelection>()
    const core = {
      defineSelection: (type: string, selection: BaseSelection) => {
        selections.set(type, selection)
      },
      unregisterSelection: (type: string) => selections.delete(type),
      getSelection: (type: string) => selections.get(type),
      registerDataChannelObserver: (registration: {
        name: string
        onChange: (change: unknown) => void
      }) => {
        observers.set(registration.name, registration)
      },
      unregisterDataChannelObserver: (name: string) => observers.delete(name)
    } as unknown as PresetCoreAPIs
    const appPointSelection = new Set(['app-point'])
    const appSegmentSelection = new Set(['app-segment'])
    propertyRegistry.register('vectorPointSelection', {
      defaultValue: appPointSelection
    })
    propertyRegistry.register('vectorSegmentSelection', {
      defaultValue: appSegmentSelection
    })
    const disposeSelections = registerSelections(core, undefined, [
      SelectionChannels.VECTOR_POINT,
      SelectionChannels.VECTOR_SEGMENT
    ])
    selections
      .get(SelectionChannels.VECTOR_POINT)
      ?.select(['preset-owned-point'])
    selections
      .get(SelectionChannels.VECTOR_SEGMENT)
      ?.select(['preset-owned-segment'])
    const disposeObservers = registerDefaultDataChannelObservers(
      core,
      createDeps(),
      undefined,
      { uiContext: true }
    )

    try {
      const uiContextObserver = observers.get('preset.uiContext.selection')
      expect(uiContextObserver).toBeDefined()
      uiContextObserver?.onChange({
        selectionType: SelectionChannels.VECTOR_POINT,
        action: SelectionActions.SELECT_VECTOR_POINTS,
        eventName: SelectionEventNames.SELECT_VECTOR_POINTS,
        before: [],
        after: ['preset-owned-point']
      } satisfies SelectionChange)
      uiContextObserver?.onChange({
        selectionType: SelectionChannels.VECTOR_SEGMENT,
        action: SelectionActions.SELECT_VECTOR_SEGMENTS,
        eventName: SelectionEventNames.SELECT_VECTOR_SEGMENTS,
        before: [],
        after: ['preset-owned-segment']
      } satisfies SelectionChange)

      expect(uiContext.get('vectorPointSelection')).toBe(appPointSelection)
      expect(uiContext.get('vectorSegmentSelection')).toBe(appSegmentSelection)
    } finally {
      disposeObservers()
      disposeSelections()
      propertyRegistry.unregister('vectorPointSelection')
      propertyRegistry.unregister('vectorSegmentSelection')
    }
  })
})
