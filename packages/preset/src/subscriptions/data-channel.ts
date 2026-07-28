import {
  defineDataChannelObserver,
  EventTypes,
  propertyRegistry,
  renderSceneTreeStore,
  renderSelectionStore,
  subscribeToSynchronousEvent,
  uiContext,
  subscribeToFileLoadComplete,
  type DataChannelObserverRegistration,
  type SelectElementsEvent,
  type SelectVectorPointsEvent,
  type SelectVectorSegmentsEvent
} from '@asyra/core'
import {
  EntityTypes,
  type EVENT_OPTIONS,
  SCENE_TREE_ACTIONS,
  SharedDataChannelNames,
  type AddRemoveElementChange,
  type ComputedAttrs,
  type GroupRawData,
  type MoveElementsChange,
  emitDiagnosticCounter,
  measureBrowserDragPhase,
  type SceneTreeChange,
  type SelectionChange,
  type SubtreeChange,
  type UpdateElementBatchChange,
  type UpdateElementChange,
  type UpdateElementPatchChange,
  type WorkspaceRawData
} from '@asyra/utils'
import type {
  UpdateComputedDataBatchEvent,
  UpdateComputedDataEvent,
  UpdateComputedDataPatchEvent
} from '@asyra/reactive-events'
import type { PresetCoreAPIs, PresetDependencies } from '../types'
import { createCleanupReporter } from '../cleanup-reporter'
import {
  SelectionActions,
  SelectionChannels,
  SelectionEventNames,
  type SelectionChannel
} from '../selection/channels'

const ELEMENT_DATA_MAP_COMPUTED_KEYS = new Set([
  'name',
  'type',
  'visible',
  'lock'
])

const shouldUpdateElementDataMapForComputedKey = (key: string): boolean =>
  ELEMENT_DATA_MAP_COMPUTED_KEYS.has(key)

const RENDER_PROJECTION_OUTCOMES = new Set([
  'applied',
  'resynced',
  'removed',
  'failed'
])

const recordRenderProjectionOutcome = (outcome: unknown) => {
  const status =
    outcome && typeof outcome === 'object' && 'status' in outcome
      ? (outcome as { status?: unknown }).status
      : undefined
  if (typeof status === 'string' && RENDER_PROJECTION_OUTCOMES.has(status)) {
    emitDiagnosticCounter(`render-projection-outcome-${status}`)
  } else {
    emitDiagnosticCounter('render-projection-outcome-missing')
  }
  return outcome
}

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
            owner: 'computed',
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
      batchChange.changes.flatMap(({ owner, key, before, after }) =>
        propertyRegistry.getMatchingProperties({
          action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA,
          eventName: batchChange.eventName,
          id: batchChange.id,
          owner,
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
      const { data, parentId, index } = change as AddRemoveElementChange
      return recordRenderProjectionOutcome(
        renderSceneTreeStore.addElementById(data.id, parentId, index)
      )
    }
    case SCENE_TREE_ACTIONS.REMOVE_ELEMENT: {
      const { parentId, index, data } = change as AddRemoveElementChange
      return recordRenderProjectionOutcome(
        renderSceneTreeStore.removeElement(data, parentId, index)
      )
    }
    case SCENE_TREE_ACTIONS.MOVE_ELEMENTS: {
      const { moves } = change as MoveElementsChange
      return recordRenderProjectionOutcome(
        renderSceneTreeStore.moveElements(moves)
      )
    }
    case SCENE_TREE_ACTIONS.REMOVE_SUBTREE:
    case SCENE_TREE_ACTIONS.RESTORE_SUBTREE:
      return recordRenderProjectionOutcome(
        renderSceneTreeStore.applySubtreeChange(change as SubtreeChange)
      )
    case SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA: {
      const { id, owner, key, before, after, options } =
        change as UpdateElementChange
      return recordRenderProjectionOutcome(
        renderSceneTreeStore.updateElement(
          id,
          owner,
          key,
          before,
          after,
          options
        )
      )
    }
    case SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_BATCH: {
      const { id, changes, options } = change as UpdateElementBatchChange
      return recordRenderProjectionOutcome(
        renderSceneTreeStore.updateElementBatch(id, changes, options)
      )
    }
    case SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_PATCH: {
      const { id, patch, options } = change as UpdateElementPatchChange
      return recordRenderProjectionOutcome(
        renderSceneTreeStore.updateElementPatch(id, patch, options)
      )
    }
  }
}

const toRenderElementAddition = (
  change: SceneTreeChange
):
  | {
      elementId: string
      parentId: string
      index: number
    }
  | undefined => {
  if (change.action !== SCENE_TREE_ACTIONS.ADD_ELEMENT) {
    return
  }
  const { data, parentId, index } = change as AddRemoveElementChange
  if (
    typeof data.id !== 'string' ||
    data.id.length === 0 ||
    typeof parentId !== 'string' ||
    parentId.length === 0 ||
    !Number.isInteger(index) ||
    (index as number) < 0
  ) {
    return
  }
  return {
    elementId: data.id,
    parentId,
    index: index as number
  }
}

export const projectLocalComputedEventToRender = (
  event:
    | UpdateComputedDataEvent
    | UpdateComputedDataBatchEvent
    | UpdateComputedDataPatchEvent
) => {
  const { payload } = event

  if ('patch' in payload) {
    return updateRenderSceneTree({
      action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_PATCH,
      eventName: EventTypes.UPDATE_COMPUTED_DATA_PATCH,
      id: payload.id,
      patch: payload.patch
    } as UpdateElementPatchChange)
  }

  if ('changes' in payload) {
    if (payload.changes.some(({ owner }) => owner !== 'computed')) {
      return
    }
    return updateRenderSceneTree({
      action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_BATCH,
      eventName: EventTypes.UPDATE_COMPUTED_DATA,
      id: payload.id,
      changes: payload.changes
    } as UpdateElementBatchChange)
  }

  if (payload.owner !== 'computed') {
    return
  }
  return updateRenderSceneTree({
    action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA,
    eventName: EventTypes.UPDATE_COMPUTED_DATA,
    id: payload.id,
    owner: payload.owner,
    key: payload.key,
    before: payload.before,
    after: payload.after
  } as UpdateElementChange)
}

const updateRenderSceneTreeBatch = (changes: readonly SceneTreeChange[]) => {
  let changeIndex = 0
  while (changeIndex < changes.length) {
    const change = changes[changeIndex]
    const firstAddition = toRenderElementAddition(change)
    if (!firstAddition) {
      updateRenderSceneTree(change)
      changeIndex += 1
      continue
    }

    const additions = [firstAddition]
    let nextIndex = changeIndex + 1
    while (nextIndex < changes.length) {
      const nextAddition = toRenderElementAddition(changes[nextIndex])
      if (!nextAddition || nextAddition.parentId !== firstAddition.parentId) {
        break
      }
      additions.push(nextAddition)
      nextIndex += 1
    }

    if (additions.length === 1) {
      updateRenderSceneTree(change)
    } else {
      renderSceneTreeStore
        .addElementsById(additions)
        .forEach(recordRenderProjectionOutcome)
    }
    changeIndex = nextIndex
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

type ProjectedElementData = Record<string, unknown>
type ProjectedElementDataMap = Record<string, ProjectedElementData>

const cloneProjectedElementData = (
  value: unknown
): ProjectedElementData | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  const data = { ...(value as ProjectedElementData) }
  if (Array.isArray(data.children)) {
    data.children = [...data.children]
  }
  return data
}

const getProjectedParentId = (
  data: ProjectedElementData | undefined
): string | undefined =>
  typeof data?.parentId === 'string' && data.parentId.length > 0
    ? data.parentId
    : undefined

const isProjectedHierarchyKey = (key: string): boolean =>
  key === 'parentId' || key === 'children'

const sceneTreeChangeUpdatesProjectedHierarchy = (
  change: SceneTreeChange
): boolean => {
  switch (change.action) {
    case SCENE_TREE_ACTIONS.ADD_ELEMENT:
    case SCENE_TREE_ACTIONS.REMOVE_ELEMENT:
    case SCENE_TREE_ACTIONS.MOVE_ELEMENTS:
    case SCENE_TREE_ACTIONS.REMOVE_SUBTREE:
    case SCENE_TREE_ACTIONS.RESTORE_SUBTREE:
      return true
    case SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA:
      return isProjectedHierarchyKey((change as UpdateElementChange).key)
    case SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_BATCH:
      return (change as UpdateElementBatchChange).changes.some(({ key }) =>
        isProjectedHierarchyKey(key)
      )
    case SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_PATCH:
      return Object.keys(
        (change as UpdateElementPatchChange).patch.values ?? {}
      ).some(isProjectedHierarchyKey)
    default:
      return false
  }
}

const projectUIContextSceneTreeBatch = (
  changes: readonly SceneTreeChange[]
): void => {
  if (changes.length === 0) {
    return
  }

  measureBrowserDragPhase('ui-context:project-scene-tree-batch', () => {
    const updatesHierarchy = changes.some(
      sceneTreeChangeUpdatesProjectedHierarchy
    )
    const current =
      uiContext.get<ProjectedElementDataMap>('elementDataMap') ?? {}
    const currentFlattenedIds = updatesHierarchy
      ? (uiContext.get<string[]>('flattenedElementIds') ?? [])
      : []
    let next = current
    let mapChanged = false
    const childrenByParent = new Map<string, string[]>()
    const dirtyParentIds = new Set<string>()
    const changedElementIds = new Set<string>()

    const ensureMutableMap = (): ProjectedElementDataMap => {
      if (next === current) {
        next = { ...current }
      }
      mapChanged = true
      return next
    }

    if (updatesHierarchy) {
      currentFlattenedIds.forEach((elementId) => {
        const parentId = getProjectedParentId(current[elementId])
        if (!parentId) return
        const children = childrenByParent.get(parentId) ?? []
        children.push(elementId)
        childrenByParent.set(parentId, children)
      })
    }

    const removeMembership = (
      parentId: string | undefined,
      elementId: string
    ): void => {
      if (!parentId) return
      const children = childrenByParent.get(parentId)
      if (!children) return
      const index = children.indexOf(elementId)
      if (index >= 0) {
        children.splice(index, 1)
        dirtyParentIds.add(parentId)
      }
    }

    const insertMembership = (
      parentId: string | undefined,
      elementId: string,
      requestedIndex?: number
    ): void => {
      if (!parentId) return
      const children = childrenByParent.get(parentId) ?? []
      const existingIndex = children.indexOf(elementId)
      if (existingIndex >= 0) {
        children.splice(existingIndex, 1)
      }
      const index =
        Number.isInteger(requestedIndex) && (requestedIndex as number) >= 0
          ? Math.min(requestedIndex as number, children.length)
          : children.length
      children.splice(index, 0, elementId)
      childrenByParent.set(parentId, children)
      dirtyParentIds.add(parentId)
    }

    const setProjectedValue = (
      elementId: string,
      key: string,
      value: unknown
    ): void => {
      const currentData = next[elementId]
      if (!currentData) return
      if (
        !isProjectedHierarchyKey(key) &&
        !shouldUpdateElementDataMapForComputedKey(key)
      ) {
        return
      }
      if (key === 'parentId') {
        const beforeParentId = getProjectedParentId(currentData)
        const afterParentId =
          typeof value === 'string' && value.length > 0 ? value : undefined
        removeMembership(beforeParentId, elementId)
        insertMembership(afterParentId, elementId)
      } else if (key === 'children' && Array.isArray(value)) {
        childrenByParent.set(
          elementId,
          value.filter(
            (childId): childId is string =>
              typeof childId === 'string' && childId.length > 0
          )
        )
        dirtyParentIds.add(elementId)
      }
      ensureMutableMap()[elementId] = {
        ...currentData,
        [key]: Array.isArray(value) ? [...value] : value
      }
      changedElementIds.add(elementId)
    }

    changes.forEach((change) => {
      switch (change.action) {
        case SCENE_TREE_ACTIONS.ADD_ELEMENT: {
          const { data, parentId, index } = change as AddRemoveElementChange
          const elementData = cloneProjectedElementData(data)
          const elementId =
            typeof elementData?.id === 'string' ? elementData.id : undefined
          if (!elementData || !elementId) return
          const projectedParentId =
            typeof parentId === 'string'
              ? parentId
              : getProjectedParentId(elementData)
          if (projectedParentId) {
            elementData.parentId = projectedParentId
          }
          ensureMutableMap()[elementId] = elementData
          changedElementIds.add(elementId)
          if (Array.isArray(elementData.children)) {
            childrenByParent.set(
              elementId,
              elementData.children.filter(
                (childId): childId is string =>
                  typeof childId === 'string' && childId.length > 0
              )
            )
            dirtyParentIds.add(elementId)
          }
          insertMembership(projectedParentId, elementId, index)
          break
        }
        case SCENE_TREE_ACTIONS.REMOVE_ELEMENT: {
          const { data, parentId } = change as AddRemoveElementChange
          const elementId = data.id
          removeMembership(
            typeof parentId === 'string'
              ? parentId
              : getProjectedParentId(next[elementId]),
            elementId
          )
          Reflect.deleteProperty(ensureMutableMap(), elementId)
          changedElementIds.add(elementId)
          childrenByParent.delete(elementId)
          break
        }
        case SCENE_TREE_ACTIONS.MOVE_ELEMENTS: {
          const { moves } = change as MoveElementsChange
          const movedIds = new Set(moves.map(({ elementId }) => elementId))
          const affectedParentIds = new Set<string>()
          moves.forEach(({ before, after }) => {
            affectedParentIds.add(before.parentId)
            affectedParentIds.add(after.parentId)
          })
          affectedParentIds.forEach((parentId) => {
            const children = childrenByParent.get(parentId)
            if (!children) return
            const retainedChildren = children.filter(
              (childId) => !movedIds.has(childId)
            )
            if (retainedChildren.length !== children.length) {
              childrenByParent.set(parentId, retainedChildren)
              dirtyParentIds.add(parentId)
            }
          })
          moves
            .slice()
            .sort(
              (left, right) =>
                left.after.parentId.localeCompare(right.after.parentId) ||
                left.after.index - right.after.index
            )
            .forEach(({ elementId, after }) => {
              insertMembership(after.parentId, elementId, after.index)
            })
          moves.forEach(({ elementId, after }) => {
            const elementData = next[elementId]
            if (elementData) {
              ensureMutableMap()[elementId] = {
                ...elementData,
                parentId: after.parentId
              }
              changedElementIds.add(elementId)
            }
          })
          break
        }
        case SCENE_TREE_ACTIONS.REMOVE_SUBTREE:
        case SCENE_TREE_ACTIONS.RESTORE_SUBTREE: {
          const subtree = change as SubtreeChange
          if (change.action === SCENE_TREE_ACTIONS.REMOVE_SUBTREE) {
            subtree.removed.forEach(({ elementId, parentId }) => {
              removeMembership(parentId, elementId)
              Reflect.deleteProperty(ensureMutableMap(), elementId)
              changedElementIds.add(elementId)
              childrenByParent.delete(elementId)
            })
            const root = subtree.removed.find(
              ({ elementId }) => elementId === subtree.elementId
            )
            if (root) {
              childrenByParent.set(root.parentId, [
                ...subtree.rootParentChildrenAfter
              ])
              dirtyParentIds.add(root.parentId)
            }
            break
          }

          subtree.removed.forEach(({ data, elementId }) => {
            const elementData = cloneProjectedElementData(data)
            if (!elementData) return
            ensureMutableMap()[elementId] = elementData
            changedElementIds.add(elementId)
            if (Array.isArray(elementData.children)) {
              childrenByParent.set(elementId, [...elementData.children])
              dirtyParentIds.add(elementId)
            }
          })
          subtree.removed.forEach(({ elementId, parentId, index }) => {
            insertMembership(parentId, elementId, index)
            const elementData = next[elementId]
            if (elementData) {
              ensureMutableMap()[elementId] = {
                ...elementData,
                parentId
              }
              changedElementIds.add(elementId)
            }
          })
          break
        }
        case SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA: {
          const { id, key, after } = change as UpdateElementChange
          setProjectedValue(id, key, after)
          break
        }
        case SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_BATCH: {
          const { id, changes: updates } = change as UpdateElementBatchChange
          updates.forEach(({ key, after }) => {
            setProjectedValue(id, key, after)
          })
          break
        }
        case SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_PATCH: {
          const { id, patch } = change as UpdateElementPatchChange
          Object.entries(patch.values ?? {}).forEach(([key, value]) => {
            setProjectedValue(id, key, value.after)
          })
          break
        }
      }
    })

    dirtyParentIds.forEach((parentId) => {
      const parent = next[parentId]
      if (!parent) return
      ensureMutableMap()[parentId] = {
        ...parent,
        children: [...(childrenByParent.get(parentId) ?? [])]
      }
      changedElementIds.add(parentId)
    })

    if (mapChanged) {
      emitDiagnosticCounter(
        'ui-context-sync-element-data-map-entry',
        changedElementIds.size
      )
      uiContext.set('elementDataMap', next)
    }

    if (updatesHierarchy) {
      const currentFlattenedIdSet = new Set(currentFlattenedIds)
      const orderedCandidates = [
        ...currentFlattenedIds,
        ...Object.keys(next).filter(
          (elementId) => !currentFlattenedIdSet.has(elementId)
        )
      ]
      const rootParentIds: string[] = []
      orderedCandidates.forEach((elementId) => {
        const parentId = getProjectedParentId(next[elementId])
        if (parentId && !next[parentId] && !rootParentIds.includes(parentId)) {
          rootParentIds.push(parentId)
        }
      })
      const flattenedElementIds: string[] = []
      const visited = new Set<string>()
      const collectProjectedChildren = (elementId: string): void => {
        if (visited.has(elementId) || !next[elementId]) return
        visited.add(elementId)
        flattenedElementIds.push(elementId)
        ;(childrenByParent.get(elementId) ?? []).forEach(
          collectProjectedChildren
        )
      }
      rootParentIds.forEach((parentId) => {
        ;(childrenByParent.get(parentId) ?? []).forEach(
          collectProjectedChildren
        )
      })

      emitDiagnosticCounter('ui-context-sync-flattened-ids')
      uiContext.set('flattenedElementIds', flattenedElementIds)
    }
  })
}

interface PendingUIContextSync {
  elementSelectionAndDerived: boolean
  dirtyPropertyKeys: Set<string>
  sceneTreeChanges: SceneTreeChange[]
}

const createPendingUIContextSync = (): PendingUIContextSync => ({
  elementSelectionAndDerived: false,
  dirtyPropertyKeys: new Set(),
  sceneTreeChanges: []
})

interface UIContextSyncLifetime {
  disposed: boolean
  pending: PendingUIContextSync
}

const createUIContextSyncLifetime = (): UIContextSyncLifetime => ({
  disposed: false,
  pending: createPendingUIContextSync()
})

const resetPendingUIContextSync = (lifetime: UIContextSyncLifetime): void => {
  lifetime.pending = createPendingUIContextSync()
}

const hasPendingUIContextSync = (lifetime: UIContextSyncLifetime): boolean =>
  lifetime.pending.elementSelectionAndDerived ||
  lifetime.pending.dirtyPropertyKeys.size > 0 ||
  lifetime.pending.sceneTreeChanges.length > 0

const flushPendingUIContextSync = (
  lifetime: UIContextSyncLifetime,
  core: PresetCoreAPIs,
  deps: PresetDependencies
): void => {
  if (!hasPendingUIContextSync(lifetime)) {
    emitDiagnosticCounter('ui-context-transaction-flush-skip')
    return
  }

  const pending = lifetime.pending
  resetPendingUIContextSync(lifetime)

  measureBrowserDragPhase('ui-context:flush', () => {
    emitDiagnosticCounter('ui-context-transaction-flush')

    projectUIContextSceneTreeBatch(pending.sceneTreeChanges)

    if (pending.elementSelectionAndDerived) {
      emitDiagnosticCounter('ui-context-sync-element-selection-derived')
      syncElementSelectionAndDerived(core, deps)
    }

    if (pending.dirtyPropertyKeys.size > 0) {
      emitDiagnosticCounter(
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
const updateUIContextElementSelection = (
  change: SelectionChange,
  core: PresetCoreAPIs,
  deps: PresetDependencies
): void => {
  switch (change.action) {
    case SelectionActions.SELECT_ELEMENTS:
    case SelectionActions.DESELECT_ELEMENTS:
      syncElementSelectionAndDerived(core, deps)
      break
  }
}

const updateVectorEditingSelection = (
  change: SelectionChange,
  core: PresetCoreAPIs
): void => {
  switch (change.action) {
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
  _deps: PresetDependencies,
  lifetime: UIContextSyncLifetime
): void => {
  lifetime.pending.sceneTreeChanges.push(change)
  const updatedPropertyKeys = getMatchingPropertiesForSceneTreeChange(change)
  updatedPropertyKeys.forEach((key) => {
    lifetime.pending.dirtyPropertyKeys.add(key)
  })

  if (change.action === SCENE_TREE_ACTIONS.REMOVE_ELEMENT) {
    const removedId = (change as AddRemoveElementChange).data.id
    if (typeof removedId === 'string' && removedId.length > 0) {
      syncSelectionOnElementRemoval(core, removedId)
      lifetime.pending.elementSelectionAndDerived = true
    }
  }
}

const applySelectionChangeToRuntime = (
  core: PresetCoreAPIs,
  change: SelectionChange
): void => {
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

interface RuntimeSubscription {
  unsubscribe(): void
}

export interface PresetDataChannelObserverOptions {
  readonly renderScene?: boolean
  readonly selection?: boolean
  readonly vectorEditing?: boolean
  readonly uiContext?: boolean
}

// Register preset default shared-channel observers for one preset lifetime.
export const registerDefaultDataChannelObservers = (
  core: PresetCoreAPIs,
  deps: PresetDependencies,
  onCleanupReady?: (dispose: () => void) => void,
  options: PresetDataChannelObserverOptions = {
    renderScene: true,
    selection: true,
    vectorEditing: true,
    uiContext: true
  }
): (() => void) => {
  const renderSceneEnabled = options.renderScene === true
  const selectionEnabled = options.selection === true
  const vectorEditingEnabled = options.vectorEditing === true
  const uiContextEnabled = options.uiContext === true
  const eventSubscriptions: RuntimeSubscription[] = []
  const registeredObserverNames: string[] = []
  const uiContextSyncLifetime = createUIContextSyncLifetime()
  let disposed = false

  const dispose = (): void => {
    if (disposed) return

    disposed = true
    const failures: unknown[] = []
    for (let index = registeredObserverNames.length - 1; index >= 0; index--) {
      const name = registeredObserverNames[index]
      try {
        core.unregisterDataChannelObserver(name)
        registeredObserverNames.splice(index, 1)
      } catch (error) {
        failures.push(error)
      }
    }
    for (let index = eventSubscriptions.length - 1; index >= 0; index--) {
      try {
        eventSubscriptions[index].unsubscribe()
        eventSubscriptions.splice(index, 1)
      } catch (error) {
        failures.push(error)
      }
    }
    if (renderSceneEnabled) {
      try {
        renderSceneTreeStore.clearProjection()
      } catch (error) {
        failures.push(error)
      }
    }
    uiContextSyncLifetime.disposed = true
    resetPendingUIContextSync(uiContextSyncLifetime)

    if (failures.length > 0) {
      throw failures[0]
    }
  }
  const cleanupReporter = createCleanupReporter(onCleanupReady, dispose)
  const registerObserver = <TChange>(
    registration: DataChannelObserverRegistration<TChange>
  ): void => {
    core.registerDataChannelObserver(registration)
    registeredObserverNames.push(registration.name)
    cleanupReporter.report()
  }

  const uiContextSceneTreeDataChannelObserver = defineDataChannelObserver({
    name: 'preset.uiContext.sceneTree',
    channel: SharedDataChannelNames.SCENE_TREE,
    onBatch: (changes: readonly SceneTreeChange[]) => {
      if (uiContextSyncLifetime.disposed) {
        return
      }
      changes.forEach((change) => {
        handleUIContextSceneTreeChange(
          change,
          core,
          deps,
          uiContextSyncLifetime
        )
      })
      flushPendingUIContextSync(uiContextSyncLifetime, core, deps)
    }
  })

  const renderSceneTreeDataChannelObserver = defineDataChannelObserver({
    name: 'preset.render.sceneTree',
    channel: SharedDataChannelNames.SCENE_TREE,
    onBatch: (changes: readonly SceneTreeChange[]) => {
      if (!disposed) {
        updateRenderSceneTreeBatch(changes)
      }
    }
  })

  const uiContextSelectionDataChannelObserver = defineDataChannelObserver({
    name: 'preset.uiContext.selection',
    channel: SharedDataChannelNames.SELECTION,
    onChange: (change: SelectionChange) =>
      updateUIContextElementSelection(change, core, deps)
  })

  const vectorEditingSelectionDataChannelObserver = defineDataChannelObserver({
    name: 'preset.vectorEditing.selection',
    channel: SharedDataChannelNames.SELECTION,
    onChange: (change: SelectionChange) =>
      updateVectorEditingSelection(change, core)
  })

  const selectionRuntimeDataChannelObserver = defineDataChannelObserver({
    name: 'preset.selection.runtime',
    channel: SharedDataChannelNames.SELECTION,
    onChange: (change: SelectionChange) =>
      applySelectionChangeToRuntime(core, change)
  })

  try {
    if (renderSceneEnabled) {
      eventSubscriptions.push(
        subscribeToSynchronousEvent(EventTypes.FILE_LOAD_COMPLETE, () => {
          renderSceneTreeStore.reload()
        })
      )
      cleanupReporter.report()
    }

    if (uiContextEnabled || vectorEditingEnabled) {
      eventSubscriptions.push(
        subscribeToFileLoadComplete(() => {
          if (uiContextEnabled) {
            resetPendingUIContextSync(uiContextSyncLifetime)
            syncFlattenedElementIds(deps)
            syncElementDataMap(deps)
            syncElementSelectionAndDerived(core, deps)
          }
          if (vectorEditingEnabled) {
            syncVectorSelections(core)
          }
        })
      )
      cleanupReporter.report()
    }

    // Undo/redo publishes selection events directly from transaction history.
    // Apply those payloads to runtime so selection state is restored correctly.
    if (selectionEnabled || uiContextEnabled) {
      eventSubscriptions.push(
        subscribeToSynchronousEvent<SelectElementsEvent>(
          EventTypes.SELECT_ELEMENTS,
          (event) => {
            const change = createSelectionChangeFromDirectEvent(
              SelectionChannels.ELEMENT,
              SelectionActions.SELECT_ELEMENTS,
              SelectionEventNames.SELECT_ELEMENTS,
              event.payload,
              event.options
            )

            if (selectionEnabled) {
              applySelectionIdsToRuntime(
                core,
                SelectionChannels.ELEMENT,
                change.after,
                change.options
              )

              // Replay events bypass shared channel observers. Mirror them to render.
              updateRenderSelection(change)
            }
            if (uiContextEnabled) {
              updateUIContextElementSelection(change, core, deps)
            }
          }
        )
      )
      cleanupReporter.report()
    }

    if (selectionEnabled || vectorEditingEnabled) {
      eventSubscriptions.push(
        subscribeToSynchronousEvent<SelectVectorPointsEvent>(
          EventTypes.SELECT_VECTOR_POINTS,
          (event) => {
            const change = createSelectionChangeFromDirectEvent(
              SelectionChannels.VECTOR_POINT,
              SelectionActions.SELECT_VECTOR_POINTS,
              SelectionEventNames.SELECT_VECTOR_POINTS,
              event.payload,
              event.options
            )

            if (selectionEnabled) {
              applySelectionIdsToRuntime(
                core,
                SelectionChannels.VECTOR_POINT,
                change.after,
                change.options
              )
              updateRenderSelection(change)
            }
            if (vectorEditingEnabled) {
              updateVectorEditingSelection(change, core)
            }
          }
        )
      )
      cleanupReporter.report()
      eventSubscriptions.push(
        subscribeToSynchronousEvent<SelectVectorSegmentsEvent>(
          EventTypes.SELECT_VECTOR_SEGMENTS,
          (event) => {
            const change = createSelectionChangeFromDirectEvent(
              SelectionChannels.VECTOR_SEGMENT,
              SelectionActions.SELECT_VECTOR_SEGMENTS,
              SelectionEventNames.SELECT_VECTOR_SEGMENTS,
              event.payload,
              event.options
            )

            if (selectionEnabled) {
              applySelectionIdsToRuntime(
                core,
                SelectionChannels.VECTOR_SEGMENT,
                change.after,
                change.options
              )
              updateRenderSelection(change)
            }
            if (vectorEditingEnabled) {
              updateVectorEditingSelection(change, core)
            }
          }
        )
      )
      cleanupReporter.report()
    }

    if (renderSceneEnabled) {
      registerObserver(renderSceneTreeDataChannelObserver)
      renderSceneTreeStore.reload()
    }
    if (selectionEnabled) {
      registerObserver(selectionRuntimeDataChannelObserver)
      registerObserver(renderSelectionDataChannelObserver)
    }
    if (uiContextEnabled) {
      registerObserver(uiContextSceneTreeDataChannelObserver)
      registerObserver(uiContextSelectionDataChannelObserver)
    }
    if (vectorEditingEnabled) {
      registerObserver(vectorEditingSelectionDataChannelObserver)
    }
  } catch (error) {
    if (!cleanupReporter.hasReported()) dispose()
    throw error
  }

  return dispose
}
