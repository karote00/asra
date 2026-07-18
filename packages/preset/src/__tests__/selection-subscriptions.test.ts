import { describe, expect, it, vi } from 'vitest'
import {
  BaseSelection,
  propertyRegistry,
  renderSceneTreeStore,
  renderSelectionStore,
  uiContext
} from '@asyra/core'
import { SCENE_TREE_ACTIONS, type SelectionChange } from '@asyra/utils'
import {
  EventTypes,
  publishEvent,
  runTransaction
} from '@asyra/reactive-events'
import { registerSelections } from '../selection/register-default-selections'
import { registerDefaultDataChannelObservers } from '../subscriptions/data-channel'
import type { PresetCoreAPIs, PresetDependencies } from '../types'
import {
  SelectionActions,
  SelectionChannels,
  SelectionEventNames
} from '../selection/channels'

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

describe('Preset Selection Subscriptions', () => {
  it('clears Render projection state once when the render observer is disposed', () => {
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
        resetProjection: () => void
      }
    const resetProjection = vi
      .spyOn(projectionStore, 'resetProjection')
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
      expect(resetProjection).toHaveBeenCalledTimes(1)

      const disposeSelection = registerDefaultDataChannelObservers(
        core,
        createDeps(),
        undefined,
        { selection: true }
      )
      disposeSelection()
      expect(resetProjection).toHaveBeenCalledTimes(1)
    } finally {
      resetProjection.mockRestore()
    }
  })

  it('routes complete Scene Tree deltas and records Render projection outcomes', () => {
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
    add.mockReturnValue({ status: 'applied', elementId: 'vector-1' })
    remove.mockReturnValue({ status: 'removed', elementId: 'vector-1' })
    scalar.mockReturnValue({ status: 'resynced', elementId: 'vector-1' })
    batch.mockReturnValue({ status: 'applied', elementId: 'vector-1' })
    patch.mockReturnValue({ status: 'failed', elementId: 'vector-1' })

    const counters: string[] = []
    const runtimeGlobal = globalThis as typeof globalThis & {
      __asyraStrokePipelineCounterSink?: (name: string) => void
    }
    const previousCounterSink = runtimeGlobal.__asyraStrokePipelineCounterSink
    runtimeGlobal.__asyraStrokePipelineCounterSink = (name) => {
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
      observer?.onChange({
        action: SCENE_TREE_ACTIONS.ADD_ELEMENT,
        data: { id: 'vector-1', type: 'vector' }
      })
      observer?.onChange({
        action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA,
        eventName: 'update-computed',
        id: 'vector-1',
        key: 'visible',
        before: true,
        after: false,
        options: { undoable: false }
      })
      observer?.onChange({
        action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_BATCH,
        eventName: 'update-computed',
        id: 'vector-1',
        changes: [
          { key: 'x', before: 0, after: 10 },
          { key: 'y', before: 0, after: 20 }
        ],
        options: { undoable: false }
      })
      observer?.onChange({
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
      })
      observer?.onChange({
        action: SCENE_TREE_ACTIONS.REMOVE_ELEMENT,
        data: { id: 'vector-1', type: 'vector' },
        parentId: 'workspace-1'
      })

      expect(add).toHaveBeenCalledWith('vector-1')
      expect(scalar).toHaveBeenCalledWith('vector-1', 'visible', true, false, {
        undoable: false
      })
      expect(batch).toHaveBeenCalledWith(
        'vector-1',
        [
          { key: 'x', before: 0, after: 10 },
          { key: 'y', before: 0, after: 20 }
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
        'workspace-1'
      )
      expect(counters).toEqual([
        'render-projection-outcome-applied',
        'render-projection-outcome-resynced',
        'render-projection-outcome-applied',
        'render-projection-outcome-failed',
        'render-projection-outcome-removed'
      ])
    } finally {
      dispose()
      runtimeGlobal.__asyraStrokePipelineCounterSink = previousCounterSink
      add.mockRestore()
      remove.mockRestore()
      scalar.mockRestore()
      batch.mockRestore()
      patch.mockRestore()
    }
  })

  it('keeps pending UI context transactions isolated per Core observer lifetime', () => {
    const createCore = () => {
      const observers = new Map<
        string,
        { onChange: (change: unknown) => void }
      >()
      const core = {
        getSelection: () => undefined,
        registerDataChannelObserver: (registration: {
          name: string
          onChange: (change: unknown) => void
        }) => {
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

    // Register the second lifetime first so a shared pending queue would be
    // flushed with the wrong dependency set at the transaction boundary.
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
      first.observers.get('preset.uiContext.sceneTree')?.onChange({
        action: SCENE_TREE_ACTIONS.ADD_ELEMENT,
        data: { id: 'first-element', type: 'rectangle' },
        parentId: 'first-workspace'
      })

      runTransaction(() => undefined)

      expect(firstGetAllElements).toHaveBeenCalledOnce()
      expect(secondGetAllElements).not.toHaveBeenCalled()

      first.observers.get('preset.uiContext.sceneTree')?.onChange({
        action: SCENE_TREE_ACTIONS.ADD_ELEMENT,
        data: { id: 'first-element-2', type: 'rectangle' },
        parentId: 'first-workspace'
      })
      disposeSecond()

      runTransaction(() => undefined)

      expect(firstGetAllElements).toHaveBeenCalledTimes(2)
      expect(secondGetAllElements).not.toHaveBeenCalled()
    } finally {
      disposeFirst()
      disposeSecond()
      propertyRegistry.unregister('flattenedElementIds')
      propertyRegistry.unregister('elementDataMap')
    }
  })

  it('applies selection channel changes and removes deleted selection ids via observers', () => {
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

    sceneTreeObserver?.onChange({
      action: SCENE_TREE_ACTIONS.REMOVE_ELEMENT,
      data: { id: 'oval-1', type: 'oval' },
      parentId: 'workspace-1'
    })

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
