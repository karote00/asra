import {
  EntityTypes,
  type ElementRawData,
  type SystemContextSnapshot
} from '@asyra/utils'
import { elementApis, hierarchyApis, selectionApis } from '../common-apis'

export type CanvasHierarchyElementDataMap = Record<
  string,
  Partial<ElementRawData>
>

export interface ResolveCanvasHierarchyTargetInput {
  hitElementId: string | null
  selectedElementIds: readonly string[]
  bypassParentScope: boolean
  flattenedIds: readonly string[]
  elementDataMap: CanvasHierarchyElementDataMap
}

interface ValidHierarchyProjection {
  flattenedIdSet: ReadonlySet<string>
  workspaceId: string
}

const validateHierarchyProjection = (
  flattenedIds: readonly string[],
  elementDataMap: CanvasHierarchyElementDataMap
): ValidHierarchyProjection | null => {
  const flattenedIdSet = new Set(flattenedIds)
  const projectedIds = Object.keys(elementDataMap)
  if (
    flattenedIds.length === 0 ||
    flattenedIdSet.size !== flattenedIds.length ||
    projectedIds.length !== flattenedIds.length
  ) {
    return null
  }

  const flattenedIndexes = new Map(
    flattenedIds.map((elementId, index) => [elementId, index])
  )
  const rootParentIds = new Set<string>()

  for (const elementId of flattenedIds) {
    const element = elementDataMap[elementId]
    const parentId = element?.parentId
    if (
      element?.id !== elementId ||
      element.type === EntityTypes.WORKSPACE ||
      typeof parentId !== 'string' ||
      parentId.length === 0
    ) {
      return null
    }

    if (!flattenedIdSet.has(parentId)) {
      rootParentIds.add(parentId)
      continue
    }

    const parentIndex = flattenedIndexes.get(parentId)
    const elementIndex = flattenedIndexes.get(elementId)
    if (
      parentIndex === undefined ||
      elementIndex === undefined ||
      parentIndex >= elementIndex
    ) {
      return null
    }
  }

  if (
    projectedIds.some((elementId) => !flattenedIdSet.has(elementId)) ||
    rootParentIds.size !== 1
  ) {
    return null
  }

  const workspaceId = [...rootParentIds][0]
  for (const elementId of flattenedIds) {
    const visited = new Set<string>()
    let currentId = elementId

    while (currentId !== workspaceId) {
      if (visited.has(currentId)) {
        return null
      }
      visited.add(currentId)

      const parentId = elementDataMap[currentId]?.parentId
      if (typeof parentId !== 'string' || parentId.length === 0) {
        return null
      }
      if (parentId !== workspaceId && !flattenedIdSet.has(parentId)) {
        return null
      }
      currentId = parentId
    }
  }

  return {
    flattenedIdSet,
    workspaceId
  }
}

export const resolveCanvasHierarchyTarget = ({
  hitElementId,
  selectedElementIds,
  bypassParentScope,
  flattenedIds,
  elementDataMap
}: ResolveCanvasHierarchyTargetInput): string | null => {
  if (!hitElementId) {
    return null
  }

  const projection = validateHierarchyProjection(flattenedIds, elementDataMap)
  if (!projection?.flattenedIdSet.has(hitElementId)) {
    return null
  }

  if (bypassParentScope) {
    return elementDataMap[hitElementId]?.type === EntityTypes.GROUP
      ? null
      : hitElementId
  }

  const selectedIdSet = new Set(selectedElementIds)
  if (selectedIdSet.size !== selectedElementIds.length) {
    return null
  }

  const referenceParentIds = new Set<string>()
  if (selectedElementIds.length === 0) {
    referenceParentIds.add(projection.workspaceId)
  } else {
    for (const selectedElementId of selectedElementIds) {
      if (!projection.flattenedIdSet.has(selectedElementId)) {
        return null
      }

      const parentId = elementDataMap[selectedElementId]?.parentId
      if (typeof parentId !== 'string' || parentId.length === 0) {
        return null
      }
      referenceParentIds.add(parentId)
    }
  }

  let currentId = hitElementId
  while (projection.flattenedIdSet.has(currentId)) {
    const parentId = elementDataMap[currentId]?.parentId
    if (typeof parentId !== 'string' || parentId.length === 0) {
      return null
    }
    if (referenceParentIds.has(parentId)) {
      return currentId
    }
    currentId = parentId
  }

  return null
}

export const resolveCurrentCanvasHierarchyTarget = (
  hitElementId: string | null,
  snapshot: Pick<SystemContextSnapshot, 'keyMeta' | 'keyCtrl'>
): string | null =>
  resolveCanvasHierarchyTarget({
    hitElementId,
    selectedElementIds: selectionApis.getSelectedIds(),
    bypassParentScope: snapshot.keyMeta || snapshot.keyCtrl,
    flattenedIds: hierarchyApis.getFlattenedElementIds(),
    elementDataMap: hierarchyApis.getElementDataMap()
  })

export const resolveCanvasHierarchyTargetAtClientPos = (
  snapshot: Pick<SystemContextSnapshot, 'mousePosition' | 'keyMeta' | 'keyCtrl'>
): string | null =>
  resolveCurrentCanvasHierarchyTarget(
    elementApis.getRenderElementIdAtClientPos(snapshot.mousePosition),
    snapshot
  )
