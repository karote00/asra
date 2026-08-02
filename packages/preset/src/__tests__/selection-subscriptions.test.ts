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
  PROPS_ACTIONS,
  SCENE_TREE_ACTIONS,
  subscribeToDiagnosticCounters,
  type PropsChange,
  type SelectionChange
} from '@asyra/utils'
import {
  EventTypes,
  publishEvent,
  publishEventsToObservers
} from '@asyra/reactive-events'
import { registerSelections } from '../selection/register-default-selections'
import {
  projectLocalComputedEventToRender,
  registerDefaultDataChannelObservers
} from '../subscriptions/data-channel'
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
  it('projects one immediate canonical Props batch through the Scene Tree owner', () => {
    const observers = new Map<string, TestDataChannelObserver>()
    const core = {
      getSelection: () => undefined,
      registerDataChannelObserver: (
        registration: TestDataChannelObserver & { name: string }
      ) => observers.set(registration.name, registration),
      unregisterDataChannelObserver: (name: string) => observers.delete(name)
    } as unknown as PresetCoreAPIs
    const projectLocalComputedDataFromPropertyIds = vi.fn()
    const deps = {
      ...createDeps(),
      sceneTree: {
        ...createDeps().sceneTree,
        projectLocalComputedDataFromPropertyIds
      }
    } as unknown as PresetDependencies
    const changes: PropsChange[] = [
      {
        action: PROPS_ACTIONS.UPDATE_PROPERTY,
        eventName: EventTypes.UPDATE_PROPERTY,
        id: 'fill-1',
        key: 'color',
        before: '#cccccc',
        after: '#ff0000',
        options: {
          undoable: false,
          sharedDelivery: 'immediate'
        }
      },
      {
        action: PROPS_ACTIONS.UPDATE_PROPERTY,
        eventName: EventTypes.UPDATE_PROPERTY,
        id: 'fill-1',
        key: 'opacity',
        before: 1,
        after: 0.8,
        options: {
          undoable: false,
          sharedDelivery: 'immediate'
        }
      },
      {
        action: PROPS_ACTIONS.UPDATE_PROPERTY,
        eventName: EventTypes.UPDATE_PROPERTY,
        id: 'gradient-stop-1',
        key: 'color',
        before: '#000000',
        after: '#00ff00',
        options: {
          undoable: false,
          sharedDelivery: 'immediate'
        }
      }
    ]

    const dispose = registerDefaultDataChannelObservers(core, deps, undefined, {
      propertyProjection: true
    })

    expect(observers.get('preset.sceneTree.props')).toBeDefined()
    deliverObserverChanges(observers.get('preset.sceneTree.props'), changes)
    expect(projectLocalComputedDataFromPropertyIds).toHaveBeenCalledOnce()
    expect(projectLocalComputedDataFromPropertyIds).toHaveBeenCalledWith([
      'fill-1',
      'gradient-stop-1'
    ])

    dispose()
    expect(observers.has('preset.sceneTree.props')).toBe(false)
  })

  it('projects local computed scalar, batch, and patch events without accepting raw owners', () => {
    const scalar = vi.spyOn(renderSceneTreeStore, 'updateElement')
    const batch = vi.spyOn(renderSceneTreeStore, 'updateElementBatch')
    const patch = vi.spyOn(renderSceneTreeStore, 'updateElementPatch')
    scalar.mockReturnValue({ status: 'applied', elementId: 'vector-1' })
    batch.mockReturnValue({ status: 'applied', elementId: 'vector-1' })
    patch.mockReturnValue({ status: 'applied', elementId: 'vector-1' })

    try {
      projectLocalComputedEventToRender({
        type: EventTypes.UPDATE_COMPUTED_DATA,
        payload: {
          id: 'vector-1',
          owner: 'computed',
          key: 'x',
          before: 0,
          after: 12
        }
      })
      projectLocalComputedEventToRender({
        type: EventTypes.UPDATE_COMPUTED_DATA,
        payload: {
          action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_BATCH,
          eventName: EventTypes.UPDATE_COMPUTED_DATA,
          id: 'vector-1',
          changes: [
            {
              owner: 'computed',
              key: 'y',
              before: 0,
              after: 18
            }
          ]
        }
      })
      projectLocalComputedEventToRender({
        type: EventTypes.UPDATE_COMPUTED_DATA_PATCH,
        payload: {
          id: 'vector-1',
          patch: {
            values: {
              width: {
                before: 20,
                after: 24
              }
            }
          }
        }
      })
      projectLocalComputedEventToRender({
        type: EventTypes.UPDATE_COMPUTED_DATA,
        payload: {
          id: 'vector-1',
          owner: 'raw',
          key: 'visible',
          before: true,
          after: false
        }
      })
      projectLocalComputedEventToRender({
        type: EventTypes.UPDATE_COMPUTED_DATA,
        payload: {
          action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_BATCH,
          eventName: EventTypes.UPDATE_COMPUTED_DATA,
          id: 'vector-1',
          changes: [
            {
              owner: 'computed',
              key: 'x',
              before: 12,
              after: 14
            },
            {
              owner: 'raw',
              key: 'visible',
              before: true,
              after: false
            }
          ]
        }
      })

      expect(scalar).toHaveBeenCalledTimes(1)
      expect(scalar).toHaveBeenCalledWith(
        'vector-1',
        'computed',
        'x',
        0,
        12,
        undefined
      )
      expect(batch).toHaveBeenCalledTimes(1)
      expect(batch).toHaveBeenCalledWith(
        'vector-1',
        [
          {
            owner: 'computed',
            key: 'y',
            before: 0,
            after: 18
          }
        ],
        undefined
      )
      expect(patch).toHaveBeenCalledTimes(1)
      expect(patch).toHaveBeenCalledWith(
        'vector-1',
        {
          values: {
            width: {
              before: 20,
              after: 24
            }
          }
        },
        undefined
      )
    } finally {
      scalar.mockRestore()
      batch.mockRestore()
      patch.mockRestore()
    }
  })

  it('registers one ordinary computed batch projection lifetime and excludes shared computed evidence', () => {
    const observers = new Map<string, TestDataChannelObserver>()
    const core = {
      getSelection: () => undefined,
      registerDataChannelObserver: (
        registration: TestDataChannelObserver & { name: string }
      ) => observers.set(registration.name, registration),
      unregisterDataChannelObserver: (name: string) => observers.delete(name)
    } as unknown as PresetCoreAPIs
    const renderBatch = vi
      .spyOn(renderSceneTreeStore, 'updateElementBatch')
      .mockReturnValue({ status: 'applied', elementId: 'vector-1' })
    const renderPatch = vi
      .spyOn(renderSceneTreeStore, 'updateElementPatch')
      .mockReturnValue({ status: 'applied', elementId: 'vector-2' })
    const reload = vi
      .spyOn(renderSceneTreeStore, 'reload')
      .mockImplementation(() => undefined)
    propertyRegistry.register('flattenedElementIds', { defaultValue: [] })
    propertyRegistry.register('elementDataMap', { defaultValue: {} })
    uiContext.set('flattenedElementIds', ['vector-1', 'vector-2'])
    uiContext.set('elementDataMap', {
      'vector-1': {
        id: 'vector-1',
        type: VECTOR_TYPE,
        visible: true,
        lock: false
      },
      'vector-2': {
        id: 'vector-2',
        type: VECTOR_TYPE,
        visible: true
      }
    })
    const uiSet = vi.spyOn(uiContext, 'set')
    const ordinaryComputedEvents = [
      {
        type: EventTypes.UPDATE_COMPUTED_DATA,
        payload: {
          action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_BATCH,
          eventName: EventTypes.UPDATE_COMPUTED_DATA,
          id: 'vector-1',
          changes: [
            {
              owner: 'computed',
              key: 'visible',
              before: true,
              after: false
            },
            {
              owner: 'computed',
              key: 'lock',
              before: false,
              after: true
            }
          ]
        }
      },
      {
        type: EventTypes.UPDATE_COMPUTED_DATA_PATCH,
        payload: {
          id: 'vector-2',
          patch: {
            values: {
              visible: {
                before: true,
                after: false
              }
            }
          }
        }
      }
    ] as const
    let disposeRender = () => undefined
    let disposeUIContext = () => undefined

    try {
      // Preset installs Render and UI context as two independent defaults.
      // One ordinary computed batch must still reach each singleton projection
      // exactly once.
      disposeRender = registerDefaultDataChannelObservers(
        core,
        createDeps(),
        undefined,
        { renderScene: true }
      )
      disposeUIContext = registerDefaultDataChannelObservers(
        core,
        createDeps(),
        undefined,
        { uiContext: true }
      )
      renderBatch.mockClear()
      renderPatch.mockClear()
      uiSet.mockClear()

      publishEventsToObservers(ordinaryComputedEvents)

      expect(renderBatch).toHaveBeenCalledOnce()
      expect(renderPatch).toHaveBeenCalledOnce()
      expect(
        uiSet.mock.calls.filter(([property]) => property === 'elementDataMap')
      ).toHaveLength(0)
      expect(uiContext.get('elementDataMap')).toEqual({
        'vector-1': {
          id: 'vector-1',
          type: VECTOR_TYPE,
          visible: false,
          lock: true
        },
        'vector-2': {
          id: 'vector-2',
          type: VECTOR_TYPE,
          visible: false
        }
      })

      const renderBatchCallCount = renderBatch.mock.calls.length
      const renderPatchCallCount = renderPatch.mock.calls.length
      const uiSetCallCount = uiSet.mock.calls.length
      const sharedComputedChanges = ordinaryComputedEvents.map(
        ({ payload }) => payload
      )
      deliverObserverChanges(
        observers.get('preset.render.sceneTree'),
        sharedComputedChanges
      )
      deliverObserverChanges(
        observers.get('preset.uiContext.sceneTree'),
        sharedComputedChanges
      )

      expect(renderBatch).toHaveBeenCalledTimes(renderBatchCallCount)
      expect(renderPatch).toHaveBeenCalledTimes(renderPatchCallCount)
      expect(uiSet).toHaveBeenCalledTimes(uiSetCallCount)

      disposeUIContext()
      disposeRender()
      publishEventsToObservers(ordinaryComputedEvents)

      expect(renderBatch).toHaveBeenCalledTimes(renderBatchCallCount)
      expect(renderPatch).toHaveBeenCalledTimes(renderPatchCallCount)
      expect(uiSet).toHaveBeenCalledTimes(uiSetCallCount)
    } finally {
      disposeUIContext()
      disposeRender()
      uiSet.mockRestore()
      renderBatch.mockRestore()
      renderPatch.mockRestore()
      reload.mockRestore()
      propertyRegistry.unregister('flattenedElementIds')
      propertyRegistry.unregister('elementDataMap')
    }
  })

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

  it('routes shared canonical Scene Tree deltas without projecting local computed evidence', async () => {
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
    const add = vi.spyOn(renderSceneTreeStore, 'addElements')
    const remove = vi.spyOn(renderSceneTreeStore, 'removeElements')
    const scalar = vi.spyOn(renderSceneTreeStore, 'updateElement')
    const batch = vi.spyOn(renderSceneTreeStore, 'updateElementBatch')
    const patch = vi.spyOn(renderSceneTreeStore, 'updateElementPatch')
    const move = vi.spyOn(renderSceneTreeStore, 'moveElements')
    const subtree = vi.spyOn(renderSceneTreeStore, 'applySubtreeChange')
    const reload = vi
      .spyOn(renderSceneTreeStore, 'reload')
      .mockImplementation(() => undefined)
    add.mockReturnValue([{ status: 'applied', elementId: 'vector-1' }])
    remove.mockReturnValue([{ status: 'removed', elementId: 'vector-1' }])
    scalar.mockReturnValue({ status: 'resynced', elementId: 'vector-1' })
    batch.mockReturnValue({ status: 'applied', elementId: 'vector-1' })
    patch.mockReturnValue({ status: 'failed', elementId: 'vector-1' })
    move.mockReturnValue({ status: 'applied', elementId: 'vector-1' })
    subtree.mockReturnValue({ status: 'removed', elementId: 'group-1' })

    const counters: string[] = []
    const unsubscribe = subscribeToDiagnosticCounters((name) => {
      counters.push(name)
    })

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
          action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_DATA,
          eventName: EventTypes.UPDATE_ELEMENT_DATA,
          id: 'vector-1',
          changes: [
            {
              key: 'name',
              before: 'Vector',
              after: 'Renamed Vector'
            },
            {
              key: 'visible',
              before: true,
              after: false
            }
          ],
          options: { undoable: false }
        },
        {
          action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_BATCH,
          eventName: 'update-computed',
          id: 'vector-1',
          changes: [{ owner: 'computed', key: 'y', before: 0, after: 20 }],
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

      expect(add).toHaveBeenCalledWith([
        {
          data: { id: 'vector-1', type: 'vector' },
          parentId: 'group-1',
          index: 1
        }
      ])
      expect(scalar).not.toHaveBeenCalled()
      expect(batch).toHaveBeenCalledTimes(1)
      expect(batch).toHaveBeenCalledWith(
        'vector-1',
        [
          {
            owner: 'raw',
            key: 'name',
            before: 'Vector',
            after: 'Renamed Vector'
          },
          {
            owner: 'raw',
            key: 'visible',
            before: true,
            after: false
          }
        ],
        { undoable: false }
      )
      expect(patch).not.toHaveBeenCalled()
      expect(remove).toHaveBeenCalledWith([
        {
          data: { id: 'vector-1', type: 'vector' },
          parentId: 'group-1',
          index: 1
        }
      ])
      expect(move).toHaveBeenCalledWith(moves)
      expect(subtree).toHaveBeenNthCalledWith(1, subtreeChange)
      expect(subtree).toHaveBeenNthCalledWith(2, restoreSubtreeChange)
      expect(counters).toEqual([
        'render-projection-outcome-applied',
        'render-projection-outcome-applied',
        'render-projection-outcome-removed',
        'render-projection-outcome-applied',
        'render-projection-outcome-removed',
        'render-projection-outcome-removed'
      ])
    } finally {
      dispose()
      unsubscribe()
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

  it('routes one canonical Scene addition batch through one Render relationship batch', () => {
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
      .spyOn(renderSceneTreeStore, 'addElements')
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
          action: SCENE_TREE_ACTIONS.ADD_ELEMENTS,
          eventName: EventTypes.ADD_ELEMENTS,
          undoType: EventTypes.REMOVE_ELEMENTS,
          undoAction: SCENE_TREE_ACTIONS.REMOVE_ELEMENTS,
          entries: [
            {
              data: { id: 'child-b', type: 'vector' },
              parentId: 'group-1',
              index: 1
            },
            {
              data: { id: 'child-a', type: 'vector' },
              parentId: 'group-1',
              index: 0
            }
          ]
        }
      ])

      expect(addBatch).toHaveBeenCalledOnce()
      expect(addBatch).toHaveBeenCalledWith([
        {
          data: { id: 'child-b', type: 'vector' },
          parentId: 'group-1',
          index: 1
        },
        {
          data: { id: 'child-a', type: 'vector' },
          parentId: 'group-1',
          index: 0
        }
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
    const addBatch = vi
      .spyOn(renderSceneTreeStore, 'addElements')
      .mockImplementation((additions) =>
        additions.map(({ data }) => ({
          status: 'applied',
          elementId: data.id
        }))
      )
    const remove = vi
      .spyOn(renderSceneTreeStore, 'removeElements')
      .mockImplementation((entries) =>
        entries.map(({ data }) => ({
          status: 'removed',
          elementId: data.id
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

      expect(addBatch).toHaveBeenCalledTimes(2)
      expect(uiSet.mock.calls.map(([property]) => property)).toEqual([
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
      expect(addBatch).toHaveBeenCalledTimes(3)
      expect(addBatch).toHaveBeenNthCalledWith(3, [
        {
          data: {
            id: 'child-b',
            parentId: 'group-1',
            type: VECTOR_TYPE
          },
          parentId: 'group-1',
          index: 1
        },
        {
          data: {
            id: 'child-c',
            parentId: 'group-1',
            type: VECTOR_TYPE
          },
          parentId: 'group-1',
          index: 2
        }
      ])
      expect(uiSet.mock.calls.map(([property]) => property)).toEqual([
        'flattenedElementIds',
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
          action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_DATA,
          eventName: EventTypes.UPDATE_ELEMENT_DATA,
          id: 'child-a',
          changes: [
            {
              key: 'name',
              before: 'Child A',
              after: 'Renamed child'
            }
          ],
          options: { undoable: false }
        }
      ])

      const afterPropertyMap =
        uiContext.get<Record<string, Record<string, unknown>>>(
          'elementDataMap'
        ) ?? {}
      expect(uiSet.mock.calls.map(([property]) => property)).toEqual([])
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

      uiSet.mockClear()
      renderObserver?.onBatch?.([
        {
          action: SCENE_TREE_ACTIONS.REMOVE_ELEMENTS,
          eventName: EventTypes.REMOVE_ELEMENTS,
          undoType: EventTypes.ADD_ELEMENTS,
          undoAction: SCENE_TREE_ACTIONS.ADD_ELEMENTS,
          entries: [
            {
              data: {
                id: 'child-a',
                parentId: 'group-1',
                type: VECTOR_TYPE
              },
              parentId: 'group-1',
              index: 0
            },
            {
              data: {
                id: 'child-c',
                parentId: 'group-1',
                type: VECTOR_TYPE
              },
              parentId: 'group-1',
              index: 2
            }
          ]
        }
      ])
      uiObserver?.onBatch?.([
        {
          action: SCENE_TREE_ACTIONS.REMOVE_ELEMENTS,
          eventName: EventTypes.REMOVE_ELEMENTS,
          undoType: EventTypes.ADD_ELEMENTS,
          undoAction: SCENE_TREE_ACTIONS.ADD_ELEMENTS,
          entries: [
            {
              data: {
                id: 'child-a',
                parentId: 'group-1',
                type: VECTOR_TYPE
              },
              parentId: 'group-1',
              index: 0
            },
            {
              data: {
                id: 'child-c',
                parentId: 'group-1',
                type: VECTOR_TYPE
              },
              parentId: 'group-1',
              index: 2
            }
          ]
        }
      ])

      expect(remove).toHaveBeenCalledOnce()
      expect(remove).toHaveBeenCalledWith([
        {
          data: {
            id: 'child-a',
            parentId: 'group-1',
            type: VECTOR_TYPE
          },
          parentId: 'group-1',
          index: 0
        },
        {
          data: {
            id: 'child-c',
            parentId: 'group-1',
            type: VECTOR_TYPE
          },
          parentId: 'group-1',
          index: 2
        }
      ])
      expect(uiContext.get('flattenedElementIds')).toEqual([
        'group-1',
        'child-b'
      ])
      expect(
        (uiContext.get<Record<string, { children?: string[] }>>(
          'elementDataMap'
        ) ?? {})['group-1']?.children
      ).toEqual(['child-b'])
      expect(uiSet.mock.calls.map(([property]) => property)).toEqual([
        'flattenedElementIds'
      ])
      expect(getAllElements).not.toHaveBeenCalled()
    } finally {
      dispose()
      propertyRegistry.unregister('flattenedElementIds')
      propertyRegistry.unregister('elementDataMap')
      addBatch.mockRestore()
      remove.mockRestore()
      reload.mockRestore()
      uiSet.mockRestore()
    }
  })

  it('projects a scalar addition run through one UI membership batch', () => {
    const observers = new Map<string, TestDataChannelObserver>()
    const core = {
      getSelection: () => undefined,
      registerDataChannelObserver: (
        registration: TestDataChannelObserver & { name: string }
      ) => observers.set(registration.name, registration),
      unregisterDataChannelObserver: (name: string) => observers.delete(name)
    } as unknown as PresetCoreAPIs
    const counters = new Map<string, number>()
    const unsubscribe = subscribeToDiagnosticCounters((name, value) => {
      counters.set(name, (counters.get(name) ?? 0) + value)
    })
    propertyRegistry.register('flattenedElementIds', { defaultValue: [] })
    propertyRegistry.register('elementDataMap', { defaultValue: {} })
    uiContext.set('flattenedElementIds', [])
    uiContext.set('elementDataMap', {})
    const uiSet = vi.spyOn(uiContext, 'set')
    const dispose = registerDefaultDataChannelObservers(
      core,
      createDeps(),
      undefined,
      { uiContext: true }
    )
    const childCount = 128
    const children = Array.from(
      { length: childCount },
      (_unused, index) => `child-${index}`
    )

    try {
      uiSet.mockClear()
      deliverObserverChanges(observers.get('preset.uiContext.sceneTree'), [
        {
          action: SCENE_TREE_ACTIONS.ADD_ELEMENT,
          data: {
            children: [],
            id: 'group-1',
            parentId: 'workspace-1',
            type: EntityTypes.GROUP
          },
          parentId: 'workspace-1',
          index: 0
        },
        ...children.map((elementId, index) => ({
          action: SCENE_TREE_ACTIONS.ADD_ELEMENT,
          data: {
            id: elementId,
            parentId: 'group-1',
            type: VECTOR_TYPE
          },
          parentId: 'group-1',
          index
        }))
      ])

      expect(counters.get('ui-context-membership-add-batch')).toBe(1)
      expect(counters.get('ui-context-membership-add-batch-entry')).toBe(
        childCount + 1
      )
      expect(counters.get('ui-context-membership-add-scalar') ?? 0).toBe(0)
      expect(
        (uiContext.get<Record<string, { children?: string[] }>>(
          'elementDataMap'
        ) ?? {})['group-1']?.children
      ).toEqual(children)
      expect(uiContext.get('flattenedElementIds')).toEqual([
        'group-1',
        ...children
      ])
      expect(uiSet.mock.calls.map(([property]) => property)).toEqual([
        'flattenedElementIds'
      ])
    } finally {
      dispose()
      unsubscribe()
      propertyRegistry.unregister('flattenedElementIds')
      propertyRegistry.unregister('elementDataMap')
      uiSet.mockRestore()
    }
  })

  it('projects additions without enumerating the existing UI element map', () => {
    const observers = new Map<string, TestDataChannelObserver>()
    const core = {
      getSelection: () => undefined,
      registerDataChannelObserver: (
        registration: TestDataChannelObserver & { name: string }
      ) => observers.set(registration.name, registration),
      unregisterDataChannelObserver: (name: string) => observers.delete(name)
    } as unknown as PresetCoreAPIs
    const existingElement = {
      id: 'existing',
      parentId: 'workspace-1',
      type: VECTOR_TYPE
    }
    let enumerationCount = 0
    const existingMap = new Proxy(
      { existing: existingElement },
      {
        ownKeys: (target) => {
          enumerationCount += 1
          return Reflect.ownKeys(target)
        }
      }
    )

    propertyRegistry.register('flattenedElementIds', { defaultValue: [] })
    propertyRegistry.register('elementDataMap', { defaultValue: {} })
    uiContext.set('flattenedElementIds', ['existing'])
    uiContext.set('elementDataMap', existingMap)
    enumerationCount = 0
    const dispose = registerDefaultDataChannelObservers(
      core,
      createDeps(),
      undefined,
      { uiContext: true }
    )

    try {
      deliverObserverChanges(observers.get('preset.uiContext.sceneTree'), [
        {
          action: SCENE_TREE_ACTIONS.ADD_ELEMENT,
          data: {
            id: 'added',
            parentId: 'workspace-1',
            type: VECTOR_TYPE
          },
          parentId: 'workspace-1',
          index: 1
        }
      ])

      const projected =
        uiContext.get<Record<string, Record<string, unknown>>>(
          'elementDataMap'
        ) ?? {}
      expect(enumerationCount).toBe(0)
      expect(projected.existing).toBe(existingElement)
      expect(projected.added).toEqual({
        id: 'added',
        parentId: 'workspace-1',
        type: VECTOR_TYPE
      })
      expect(uiContext.get('flattenedElementIds')).toEqual([
        'existing',
        'added'
      ])
    } finally {
      dispose()
      propertyRegistry.unregister('flattenedElementIds')
      propertyRegistry.unregister('elementDataMap')
    }
  })

  it('projects one ordered plural Vector addition batch without scanning canonical state', () => {
    const observers = new Map<string, TestDataChannelObserver>()
    const core = {
      getSelection: () => undefined,
      registerDataChannelObserver: (
        registration: TestDataChannelObserver & { name: string }
      ) => observers.set(registration.name, registration),
      unregisterDataChannelObserver: (name: string) => observers.delete(name)
    } as unknown as PresetCoreAPIs
    const dependencies = createDeps()
    const getAllElements = vi.fn(() => {
      throw new Error('plural UI projection must not scan canonical state')
    })
    dependencies.sceneTree.getAllElements = getAllElements
    const counters = new Map<string, number>()
    const unsubscribe = subscribeToDiagnosticCounters((name, value) => {
      counters.set(name, (counters.get(name) ?? 0) + value)
    })
    const groupData = {
      children: [] as string[],
      id: 'group-1',
      parentId: 'workspace-1',
      type: EntityTypes.GROUP
    }
    const vectorCount = 128
    const vectors = Array.from({ length: vectorCount }, (_unused, index) => ({
      componentIds: [`vector-geometry-${index}`, `vector-appearance-${index}`],
      id: `vector-${index}`,
      name: `Vector ${index}`,
      parentId: 'group-1',
      relationshipIds: [`group-1:vector-${index}`],
      type: VECTOR_TYPE,
      visible: index % 2 === 0
    }))
    const vectorIds = vectors.map(({ id }) => id)
    propertyRegistry.register('flattenedElementIds', { defaultValue: [] })
    propertyRegistry.register('elementDataMap', { defaultValue: {} })
    uiContext.set('flattenedElementIds', ['group-1'])
    uiContext.set('elementDataMap', { 'group-1': groupData })
    const uiSet = vi.spyOn(uiContext, 'set')
    const dispose = registerDefaultDataChannelObservers(
      core,
      dependencies,
      undefined,
      { uiContext: true }
    )

    try {
      uiSet.mockClear()
      deliverObserverChanges(observers.get('preset.uiContext.sceneTree'), [
        {
          action: SCENE_TREE_ACTIONS.ADD_ELEMENTS,
          eventName: EventTypes.ADD_ELEMENTS,
          undoAction: SCENE_TREE_ACTIONS.REMOVE_ELEMENTS,
          undoType: EventTypes.REMOVE_ELEMENTS,
          entries: vectors.map((data, index) => ({
            data,
            parentId: 'group-1',
            index
          }))
        }
      ])

      const projectedMap =
        uiContext.get<Record<string, Record<string, unknown>>>(
          'elementDataMap'
        ) ?? {}
      expect(Object.keys(projectedMap)).toEqual(['group-1', ...vectorIds])
      expect(vectors.map(({ id }) => projectedMap[id])).toEqual(vectors)
      expect(projectedMap['group-1']).toEqual({
        ...groupData,
        children: vectorIds
      })
      expect(uiContext.get('flattenedElementIds')).toEqual([
        'group-1',
        ...vectorIds
      ])
      expect(counters.get('ui-context-membership-add-batch')).toBe(1)
      expect(counters.get('ui-context-membership-add-batch-entry')).toBe(
        vectorCount
      )
      expect(counters.get('ui-context-membership-add-scalar') ?? 0).toBe(0)
      expect(uiSet.mock.calls.map(([property]) => property)).toEqual([
        'flattenedElementIds'
      ])
      expect(getAllElements).not.toHaveBeenCalled()
    } finally {
      dispose()
      unsubscribe()
      propertyRegistry.unregister('flattenedElementIds')
      propertyRegistry.unregister('elementDataMap')
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
    const addBatch = vi.spyOn(renderSceneTreeStore, 'addElements')
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
      after: ['rect-1', 'oval-1', 'star-1']
    } satisfies SelectionChange)

    expect(
      Array.from(
        selections.get(SelectionChannels.ELEMENT)?.getSelectedIds() ?? []
      )
    ).toEqual(['rect-1', 'oval-1', 'star-1'])

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
    const elementSelection = selections.get(SelectionChannels.ELEMENT)
    if (!elementSelection) {
      throw new Error('Expected the element selection runtime')
    }
    const selectSpy = vi.spyOn(elementSelection, 'select')
    const cleanChangesSpy = vi.spyOn(elementSelection, 'cleanChanges')
    const renderSelectionSpy = vi.spyOn(renderSelectionStore, 'updateSelection')
    const sceneTreeObserver = observers.get('preset.uiContext.sceneTree')
    expect(sceneTreeObserver).toBeDefined()

    deliverObserverChanges(sceneTreeObserver, [
      {
        action: SCENE_TREE_ACTIONS.REMOVE_ELEMENTS,
        entries: [
          {
            data: { id: 'oval-1', type: 'oval' },
            parentId: 'workspace-1',
            index: 1
          },
          {
            data: { id: 'not-selected', type: 'vector' },
            parentId: 'workspace-1',
            index: 2
          }
        ]
      },
      {
        action: SCENE_TREE_ACTIONS.REMOVE_ELEMENTS,
        entries: [
          {
            data: { id: 'star-1', type: 'star' },
            parentId: 'workspace-1',
            index: 3
          }
        ]
      }
    ])

    expect(
      Array.from(
        selections.get(SelectionChannels.ELEMENT)?.getSelectedIds() ?? []
      )
    ).toEqual(['rect-1'])
    expect(selectSpy).toHaveBeenCalledOnce()
    expect(selectSpy).toHaveBeenCalledWith(['rect-1'])
    expect(cleanChangesSpy).toHaveBeenCalledOnce()
    expect(renderSelectionSpy).toHaveBeenCalledOnce()
    expect(renderSelectionSpy).toHaveBeenCalledWith(SelectionChannels.ELEMENT)

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
    expect(renderSelectionSpy).toHaveBeenCalledTimes(2)
    expect(renderSelectionSpy).toHaveBeenLastCalledWith(
      SelectionChannels.ELEMENT
    )

    disposeObservers()
    disposeSelections()
    selectSpy.mockRestore()
    cleanChangesSpy.mockRestore()
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
