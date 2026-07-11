import {
  defineDataChannelObserver,
  propertyRegistry,
  renderSceneTreeStore,
  renderSelectionStore,
  subscribeToSelectElements,
  subscribeToSelectVectorPoints,
  subscribeToSelectVectorSegments,
  uiContext,
  subscribeToEndTransaction,
  subscribeToFileLoadComplete
} from '@asyra/core'
import {
  EntityTypes,
  type EVENT_OPTIONS,
  SCENE_TREE_ACTIONS,
  SharedDataChannelNames,
  type AddRemoveElementChange,
  type ComputedAttrs,
  type GroupRawData,
  type SceneTreeChange,
  type SelectionChange,
  type UpdateElementBatchChange,
  type UpdateElementChange,
  type UpdateElementPatchChange,
  type WorkspaceRawData
} from '@asyra/utils'
import type { PresetCoreAPIs, PresetDependencies } from '../types'
import {
  SelectionActions,
  SelectionChannels,
  SelectionEventNames,
  type SelectionChannel
} from '../selection/channels'

const measureBrowserDragPhase = <T>(phaseName: string, run: () => T): T => {
  const sink = (
    globalThis as typeof globalThis & {
      __asyraBrowserDragPhaseSink?: (
        phaseName: string,
        durationMs: number
      ) => void
    }
  ).__asyraBrowserDragPhaseSink

  if (!sink) {
    return run()
  }

  const start = performance.now()
  try {
    return run()
  } finally {
    sink(phaseName, performance.now() - start)
  }
}

const emitStrokePipelineCounter = (counterName: string, value = 1): void => {
  ;(
    globalThis as typeof globalThis & {
      __asyraStrokePipelineCounterSink?: (
        counterName: string,
        value?: number
      ) => void
    }
  ).__asyraStrokePipelineCounterSink?.(counterName, value)
}

const ELEMENT_DATA_MAP_COMPUTED_KEYS = new Set([
  'name',
  'type',
  'visible',
  'lock'
])

const shouldUpdateElementDataMapForComputedKey = (key: string): boolean =>
  ELEMENT_DATA_MAP_COMPUTED_KEYS.has(key)

const getMatchingPropertiesForSceneTreeChange = (
  change: SceneTreeChange
): string[] => {
  if (
    change.action !== SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_BATCH &&
    change.action !== SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_PATCH
  ) {
    return propertyRegistry.getMatchingProperties(change)
  }

  if (change.action === SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_PATCH) {
    const patchChange = change as UpdateElementPatchChange
    const changedKeys = [
      ...Object.keys(patchChange.patch.values ?? {}),
      ...Object.keys(patchChange.patch.records ?? {})
    ]
    return Array.from(
      new Set(
        changedKeys.flatMap((key) =>
          propertyRegistry.getMatchingProperties({
            action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA,
            eventName: patchChange.eventName,
            id: patchChange.id,
            key,
            before: null,
            after: null,
            options: patchChange.options
          })
        )
      )
    )
  }

  const batchChange = change as UpdateElementBatchChange
  return Array.from(
    new Set(
      batchChange.changes.flatMap(({ key, before, after }) =>
        propertyRegistry.getMatchingProperties({
          action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA,
          eventName: batchChange.eventName,
          id: batchChange.id,
          key,
          before,
          after,
          options: batchChange.options
        })
      )
    )
  )
}

// Render observers keep render-internal stores in sync with shared channel changes.
const updateRenderSceneTree = (change: SceneTreeChange) => {
  switch (change.action) {
    case SCENE_TREE_ACTIONS.ADD_ELEMENT: {
      renderSceneTreeStore.addElementById(
        (change as AddRemoveElementChange).data.id
      )
      break
    }
    case SCENE_TREE_ACTIONS.REMOVE_ELEMENT: {
      const { parentId, data } = change as AddRemoveElementChange
      renderSceneTreeStore.removeElement(data, parentId)
      break
    }
    case SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA: {
      const { id, key, before, after, options } = change as UpdateElementChange
      renderSceneTreeStore.updateElement(id, key, before, after, options)
      break
    }
    case SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_BATCH: {
      const { id, changes, options } = change as UpdateElementBatchChange
      renderSceneTreeStore.updateElementBatch(id, changes, options)
      break
    }
    case SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_PATCH: {
      const { id, patch, options } = change as UpdateElementPatchChange
      renderSceneTreeStore.updateElementPatch(id, patch, options)
      break
    }
  }
}

// Render selection mirror used by overlay/render behavior.
const updateRenderSelection = (change: SelectionChange) => {
  switch (change.action) {
    case SelectionActions.SELECT_ELEMENTS:
    case SelectionActions.DESELECT_ELEMENTS:
      renderSelectionStore.updateSelection(SelectionChannels.ELEMENT)
      break
    case SelectionActions.SELECT_VECTOR_POINTS:
    case SelectionActions.DESELECT_VECTOR_POINTS:
      renderSelectionStore.updateSelection(SelectionChannels.VECTOR_POINT)
      break
    case SelectionActions.SELECT_VECTOR_SEGMENTS:
    case SelectionActions.DESELECT_VECTOR_SEGMENTS:
      renderSelectionStore.updateSelection(SelectionChannels.VECTOR_SEGMENT)
      break
  }
}

// Data-channel observer definitions for render defaults.
const renderSceneTreeDataChannelObserver = defineDataChannelObserver({
  name: 'preset.render.sceneTree',
  channel: SharedDataChannelNames.SCENE_TREE,
  onChange: updateRenderSceneTree
})

const renderSelectionDataChannelObserver = defineDataChannelObserver({
  name: 'preset.render.selection',
  channel: SharedDataChannelNames.SELECTION,
  onChange: updateRenderSelection
})

// Read current selected IDs from selection runtime (single source of truth).
const getSelectedIds = (
  core: PresetCoreAPIs,
  type: SelectionChannel
): Set<string> => {
  const selection = core.getSelection(type)
  return selection ? selection.getSelectedIds() : new Set<string>()
}

// Build ui-context aggregate compute input from current selection + scene-tree data.
const buildSelectionContext = (
  deps: PresetDependencies,
  selectedIds: Set<string>
) => {
  const elements = [...selectedIds].reduce((acc, elementId) => {
    const element = deps.sceneTree.getElementById(elementId)
    if (!element) {
      return acc
    }

    const elementData = element.getAllComputedData() as ComputedAttrs
    acc.push(elementData)
    return acc
  }, [] as ComputedAttrs[])

  return {
    selectedIds,
    elements
  }
}

// Sync selection-related ui-context properties and run aggregate recompute (x/y/width/...).
const syncElementSelectionAndDerived = (
  core: PresetCoreAPIs,
  deps: PresetDependencies
) => {
  const selectedIds = getSelectedIds(core, SelectionChannels.ELEMENT)
  uiContext.set('elementSelection', selectedIds)
  uiContext.recomputeSelectionProperties(
    buildSelectionContext(deps, selectedIds)
  )
}

const syncSelectionOnElementRemoval = (
  core: PresetCoreAPIs,
  removedId: string
) => {
  const selection = core.getSelection(SelectionChannels.ELEMENT)
  if (!selection) {
    return
  }

  const current = Array.from(selection.getSelectedIds())
  if (!current.includes(removedId)) {
    return
  }

  selection.select(current.filter((id) => id !== removedId))
  selection.cleanChanges()
  renderSelectionStore.updateSelection(SelectionChannels.ELEMENT)
}

// Sync vector point/segment selection mirrors for UI consumers.
const syncVectorSelections = (core: PresetCoreAPIs) => {
  uiContext.set(
    'vectorPointSelection',
    getSelectedIds(core, SelectionChannels.VECTOR_POINT)
  )
  uiContext.set(
    'vectorSegmentSelection',
    getSelectedIds(core, SelectionChannels.VECTOR_SEGMENT)
  )
}

// Build a depth-first flattened element id index from the scene-tree.
const collectChildrenIds = (
  deps: PresetDependencies,
  elementId: string,
  ids: string[]
) => {
  const element = deps.sceneTree.getElementById(elementId)
  if (!element) {
    return
  }

  ids.push(elementId)
  const elementData = element.save() as GroupRawData

  if (elementData.type === EntityTypes.GROUP) {
    const children = elementData.children ?? []
    children.forEach((childId: string) => {
      collectChildrenIds(deps, childId, ids)
    })
  }
}

const getFlattenedElementIds = (deps: PresetDependencies): string[] => {
  const ids: string[] = []
  const workspace = deps.sceneTree.currentWorkspace
  if (!workspace) {
    return ids
  }

  const workspaceData = workspace.save() as WorkspaceRawData
  const workspaceChildren = workspaceData.children ?? []
  workspaceChildren.forEach((childId: string) => {
    collectChildrenIds(deps, childId, ids)
  })

  return ids
}

// Publish flattened ids so UI can do fast filtering/lookup without tree traversal.
const syncFlattenedElementIds = (deps: PresetDependencies): void => {
  uiContext.set('flattenedElementIds', getFlattenedElementIds(deps))
}

// Published UI lookup map keyed by element id (used by element row rendering).
const getElementDataMap = (
  deps: PresetDependencies
): Record<string, Record<string, unknown>> => {
  const dataMap: Record<string, Record<string, unknown>> = {}
  deps.sceneTree.getAllElements().forEach((element, elementId) => {
    if (element.get('type') === EntityTypes.WORKSPACE) {
      return
    }
    dataMap[elementId] = element.save() as unknown as Record<string, unknown>
  })
  return dataMap
}

const syncElementDataMap = (deps: PresetDependencies): void => {
  uiContext.set('elementDataMap', getElementDataMap(deps))
}

const syncElementDataMapEntries = (
  deps: PresetDependencies,
  elementIds: Iterable<string>
): void => {
  const current =
    uiContext.get<Record<string, Record<string, unknown>>>('elementDataMap') ??
    {}
  const removedIds = new Set<string>()
  const updatedEntries = new Map<string, Record<string, unknown>>()

  for (const elementId of elementIds) {
    const element = deps.sceneTree.getElementById(elementId)
    if (!element || element.get('type') === EntityTypes.WORKSPACE) {
      removedIds.add(elementId)
      continue
    }

    updatedEntries.set(
      elementId,
      element.save() as unknown as Record<string, unknown>
    )
  }

  const next = Object.entries(current).reduce(
    (acc, [elementId, elementData]) => {
      if (!removedIds.has(elementId)) {
        acc[elementId] = elementData
      }
      return acc
    },
    {} as Record<string, Record<string, unknown>>
  )
  updatedEntries.forEach((elementData, elementId) => {
    next[elementId] = elementData
  })

  uiContext.set('elementDataMap', next)
}

interface PendingUIContextSync {
  flattenedElementIds: boolean
  fullElementDataMap: boolean
  elementSelectionAndDerived: boolean
  dirtyElementDataMapIds: Set<string>
  dirtyPropertyKeys: Set<string>
}

const createPendingUIContextSync = (): PendingUIContextSync => ({
  flattenedElementIds: false,
  fullElementDataMap: false,
  elementSelectionAndDerived: false,
  dirtyElementDataMapIds: new Set(),
  dirtyPropertyKeys: new Set()
})

let pendingUIContextSync = createPendingUIContextSync()

const resetPendingUIContextSync = (): void => {
  pendingUIContextSync = createPendingUIContextSync()
}

const hasPendingUIContextSync = (): boolean =>
  pendingUIContextSync.flattenedElementIds ||
  pendingUIContextSync.fullElementDataMap ||
  pendingUIContextSync.elementSelectionAndDerived ||
  pendingUIContextSync.dirtyElementDataMapIds.size > 0 ||
  pendingUIContextSync.dirtyPropertyKeys.size > 0

const flushPendingUIContextSync = (
  core: PresetCoreAPIs,
  deps: PresetDependencies
): void => {
  if (!hasPendingUIContextSync()) {
    emitStrokePipelineCounter('ui-context-transaction-flush-skip')
    return
  }

  const pending = pendingUIContextSync
  resetPendingUIContextSync()

  measureBrowserDragPhase('ui-context:flush', () => {
    emitStrokePipelineCounter('ui-context-transaction-flush')

    if (pending.flattenedElementIds) {
      emitStrokePipelineCounter('ui-context-sync-flattened-ids')
      syncFlattenedElementIds(deps)
    }

    if (pending.fullElementDataMap) {
      emitStrokePipelineCounter('ui-context-sync-element-data-map-full')
      syncElementDataMap(deps)
    } else if (pending.dirtyElementDataMapIds.size > 0) {
      emitStrokePipelineCounter(
        'ui-context-sync-element-data-map-entry',
        pending.dirtyElementDataMapIds.size
      )
      syncElementDataMapEntries(deps, pending.dirtyElementDataMapIds)
    }

    if (pending.elementSelectionAndDerived) {
      emitStrokePipelineCounter('ui-context-sync-element-selection-derived')
      syncElementSelectionAndDerived(core, deps)
    }

    if (pending.dirtyPropertyKeys.size > 0) {
      emitStrokePipelineCounter(
        'ui-context-recompute-property-key-count',
        pending.dirtyPropertyKeys.size
      )
      const selectedIds = getSelectedIds(core, SelectionChannels.ELEMENT)
      uiContext.recomputeProperties(
        [...pending.dirtyPropertyKeys],
        buildSelectionContext(deps, selectedIds)
      )
    }
  })
}

// Selection channel updates only affect selection-derived UI properties.
const updateUIContextSelection = (
  change: SelectionChange,
  core: PresetCoreAPIs,
  deps: PresetDependencies
) => {
  switch (change.action) {
    case SelectionActions.SELECT_ELEMENTS:
    case SelectionActions.DESELECT_ELEMENTS:
      syncElementSelectionAndDerived(core, deps)
      break
    case SelectionActions.SELECT_VECTOR_POINTS:
    case SelectionActions.DESELECT_VECTOR_POINTS:
      uiContext.set(
        'vectorPointSelection',
        getSelectedIds(core, SelectionChannels.VECTOR_POINT)
      )
      break
    case SelectionActions.SELECT_VECTOR_SEGMENTS:
    case SelectionActions.DESELECT_VECTOR_SEGMENTS:
      uiContext.set(
        'vectorSegmentSelection',
        getSelectedIds(core, SelectionChannels.VECTOR_SEGMENT)
      )
      break
  }
}

// Scene-tree channel updates affect list/map mirrors, and may trigger aggregate recompute.
const handleUIContextSceneTreeChange = (
  change: SceneTreeChange,
  core: PresetCoreAPIs,
  deps: PresetDependencies
) => {
  const updatedPropertyKeys = getMatchingPropertiesForSceneTreeChange(change)
  updatedPropertyKeys.forEach((key) => {
    pendingUIContextSync.dirtyPropertyKeys.add(key)
  })

  switch (change.action) {
    case SCENE_TREE_ACTIONS.ADD_ELEMENT:
      pendingUIContextSync.flattenedElementIds = true
      pendingUIContextSync.fullElementDataMap = true
      break
    case SCENE_TREE_ACTIONS.REMOVE_ELEMENT: {
      const removedId = (change as AddRemoveElementChange).data.id
      if (typeof removedId === 'string' && removedId.length > 0) {
        syncSelectionOnElementRemoval(core, removedId)
        pendingUIContextSync.elementSelectionAndDerived = true
      }
      pendingUIContextSync.flattenedElementIds = true
      pendingUIContextSync.fullElementDataMap = true
      break
    }
    case SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA: {
      const { id, key } = change as UpdateElementChange
      if (shouldUpdateElementDataMapForComputedKey(key)) {
        pendingUIContextSync.dirtyElementDataMapIds.add(id)
      }
      if (key === 'children') {
        pendingUIContextSync.flattenedElementIds = true
      }
      break
    }
    case SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_BATCH: {
      const { id, changes } = change as UpdateElementBatchChange
      changes.forEach(({ key }) => {
        if (shouldUpdateElementDataMapForComputedKey(key)) {
          pendingUIContextSync.dirtyElementDataMapIds.add(id)
        }
        if (key === 'children') {
          pendingUIContextSync.flattenedElementIds = true
        }
      })
      break
    }
    case SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_PATCH: {
      const { id, patch } = change as UpdateElementPatchChange
      Object.keys(patch.values ?? {}).forEach((key) => {
        if (shouldUpdateElementDataMapForComputedKey(key)) {
          pendingUIContextSync.dirtyElementDataMapIds.add(id)
        }
        if (key === 'children') {
          pendingUIContextSync.flattenedElementIds = true
        }
      })
      break
    }
  }
}

const applySelectionChangeToRuntime = (
  core: PresetCoreAPIs,
  change: SelectionChange
) => {
  const selection = core.getSelection(change.selectionType)
  if (!selection) {
    return
  }

  selection.select(change.after, change.options)
  selection.cleanChanges()
}

const applySelectionIdsToRuntime = (
  core: PresetCoreAPIs,
  selectionType: SelectionChannel,
  after: string[],
  options?: EVENT_OPTIONS
) => {
  const selection = core.getSelection(selectionType)
  if (!selection) {
    return
  }

  selection.select(after, options)
  selection.cleanChanges()
}

const createSelectionChangeFromDirectEvent = (
  selectionType: SelectionChannel,
  action: string,
  eventName: string,
  payload: unknown,
  options?: EVENT_OPTIONS
): SelectionChange => {
  const raw = (payload ?? {}) as Partial<SelectionChange> & {
    after?: string[]
  }

  return {
    selectionType: raw.selectionType ?? selectionType,
    action: raw.action ?? action,
    eventName: raw.eventName ?? eventName,
    before: Array.isArray(raw.before) ? raw.before : [],
    after: Array.isArray(raw.after) ? raw.after : [],
    options: raw.options ?? options
  } as SelectionChange
}

let hasRegistered = false

// Register preset default shared-channel observers once.
export const registerDefaultDataChannelObservers = (
  core: PresetCoreAPIs,
  deps: PresetDependencies
): void => {
  if (hasRegistered) {
    return
  }

  const uiContextSceneTreeDataChannelObserver = defineDataChannelObserver({
    name: 'preset.uiContext.sceneTree',
    channel: SharedDataChannelNames.SCENE_TREE,
    onChange: (change: SceneTreeChange) => {
      handleUIContextSceneTreeChange(change, core, deps)
      if (change.options?.sharedDelivery === 'immediate') {
        flushPendingUIContextSync(core, deps)
      }
    }
  })

  const uiContextSelectionDataChannelObserver = defineDataChannelObserver({
    name: 'preset.uiContext.selection',
    channel: SharedDataChannelNames.SELECTION,
    onChange: (change: SelectionChange) =>
      updateUIContextSelection(change, core, deps)
  })

  const selectionRuntimeDataChannelObserver = defineDataChannelObserver({
    name: 'preset.selection.runtime',
    channel: SharedDataChannelNames.SELECTION,
    onChange: (change: SelectionChange) =>
      applySelectionChangeToRuntime(core, change)
  })

  subscribeToFileLoadComplete(() => {
    resetPendingUIContextSync()
    renderSceneTreeStore.reload()
    syncFlattenedElementIds(deps)
    syncElementDataMap(deps)
    syncElementSelectionAndDerived(core, deps)
    syncVectorSelections(core)
  })

  subscribeToEndTransaction(() => {
    flushPendingUIContextSync(core, deps)
  })

  // Undo/redo publishes selection events directly from transaction history.
  // Apply those payloads to runtime so selection state is restored correctly.
  subscribeToSelectElements((event) => {
    const change = createSelectionChangeFromDirectEvent(
      SelectionChannels.ELEMENT,
      SelectionActions.SELECT_ELEMENTS,
      SelectionEventNames.SELECT_ELEMENTS,
      event.payload,
      event.options
    )

    applySelectionIdsToRuntime(
      core,
      SelectionChannels.ELEMENT,
      change.after,
      change.options
    )

    // Direct selection events (undo/redo path) bypass shared channel observers.
    // Mirror them to render/UI explicitly so selection visuals stay in sync.
    updateRenderSelection(change)
    updateUIContextSelection(change, core, deps)
  })
  subscribeToSelectVectorPoints((event) => {
    const change = createSelectionChangeFromDirectEvent(
      SelectionChannels.VECTOR_POINT,
      SelectionActions.SELECT_VECTOR_POINTS,
      SelectionEventNames.SELECT_VECTOR_POINTS,
      event.payload,
      event.options
    )

    applySelectionIdsToRuntime(
      core,
      SelectionChannels.VECTOR_POINT,
      change.after,
      change.options
    )
    updateRenderSelection(change)
    updateUIContextSelection(change, core, deps)
  })
  subscribeToSelectVectorSegments((event) => {
    const change = createSelectionChangeFromDirectEvent(
      SelectionChannels.VECTOR_SEGMENT,
      SelectionActions.SELECT_VECTOR_SEGMENTS,
      SelectionEventNames.SELECT_VECTOR_SEGMENTS,
      event.payload,
      event.options
    )

    applySelectionIdsToRuntime(
      core,
      SelectionChannels.VECTOR_SEGMENT,
      change.after,
      change.options
    )
    updateRenderSelection(change)
    updateUIContextSelection(change, core, deps)
  })

  core.registerDataChannelObserver(renderSceneTreeDataChannelObserver)
  core.registerDataChannelObserver(selectionRuntimeDataChannelObserver)
  core.registerDataChannelObserver(renderSelectionDataChannelObserver)
  core.registerDataChannelObserver(uiContextSceneTreeDataChannelObserver)
  core.registerDataChannelObserver(uiContextSelectionDataChannelObserver)
  hasRegistered = true
}
