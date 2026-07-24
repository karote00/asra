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

export interface ResolveCreateElementParentInput
  extends ResolveCanvasHierarchyTargetInput {
  workspaceId: string
}

export interface ResolveCanvasHoverHierarchyTargetInput
  extends ResolveCanvasHierarchyTargetInput {
  groupBoundsHitElementIds: readonly string[]
}

interface ValidHierarchyProjection {
  flattenedIdSet: ReadonlySet<string>
  workspaceId: string
}

const validateHierarchyProjection = (
  flattenedIds: readonly string[],
  elementDataMap: CanvasHierarchyElementDataMap,
  expectedWorkspaceId?: string
): ValidHierarchyProjection | null => {
  const flattenedIdSet = new Set(flattenedIds)
  const projectedIds = Object.keys(elementDataMap)
  const hasExpectedWorkspace =
    typeof expectedWorkspaceId === 'string' && expectedWorkspaceId.length > 0

  if (flattenedIds.length === 0) {
    if (projectedIds.length !== 0 || !hasExpectedWorkspace) {
      return null
    }

    return {
      flattenedIdSet,
      workspaceId: expectedWorkspaceId
    }
  }

  if (
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
  if (hasExpectedWorkspace && workspaceId !== expectedWorkspaceId) {
    return null
  }

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

export const resolveCanvasHoverHierarchyTarget = ({
  groupBoundsHitElementIds,
  ...targetInput
}: ResolveCanvasHoverHierarchyTargetInput): string | null => {
  if (targetInput.hitElementId) {
    return resolveCanvasHierarchyTarget(targetInput)
  }

  if (targetInput.bypassParentScope) {
    return null
  }

  const projection = validateHierarchyProjection(
    targetInput.flattenedIds,
    targetInput.elementDataMap
  )
  if (!projection) {
    return null
  }

  const groupBoundsHitIdSet = new Set(groupBoundsHitElementIds)
  if (groupBoundsHitIdSet.size !== groupBoundsHitElementIds.length) {
    return null
  }

  for (const elementId of groupBoundsHitElementIds) {
    if (
      !projection.flattenedIdSet.has(elementId) ||
      targetInput.elementDataMap[elementId]?.type !== EntityTypes.GROUP
    ) {
      return null
    }
  }

  const selectedIdSet = new Set(targetInput.selectedElementIds)
  if (selectedIdSet.size !== targetInput.selectedElementIds.length) {
    return null
  }

  const referenceParentIds = new Set<string>()
  for (const selectedElementId of targetInput.selectedElementIds) {
    if (!projection.flattenedIdSet.has(selectedElementId)) {
      return null
    }

    const parentId = targetInput.elementDataMap[selectedElementId]?.parentId
    if (typeof parentId !== 'string' || parentId.length === 0) {
      return null
    }
    referenceParentIds.add(parentId)
  }

  for (
    let index = targetInput.flattenedIds.length - 1;
    index >= 0;
    index -= 1
  ) {
    const candidateId = targetInput.flattenedIds[index]
    if (!groupBoundsHitIdSet.has(candidateId)) {
      continue
    }

    if (
      targetInput.selectedElementIds.length > 0 &&
      referenceParentIds.has(candidateId)
    ) {
      return candidateId
    }

    const resolvedTargetId = resolveCanvasHierarchyTarget({
      ...targetInput,
      hitElementId: candidateId
    })
    if (resolvedTargetId) {
      return resolvedTargetId
    }
  }

  return null
}

export const resolveCreateElementParent = ({
  workspaceId,
  ...targetInput
}: ResolveCreateElementParentInput): string | null => {
  const projection = validateHierarchyProjection(
    targetInput.flattenedIds,
    targetInput.elementDataMap,
    workspaceId
  )
  if (!projection) {
    return null
  }

  if (!targetInput.hitElementId) {
    return projection.workspaceId
  }

  const targetId = resolveCanvasHierarchyTarget(targetInput)
  if (!targetId) {
    return null
  }

  const target = targetInput.elementDataMap[targetId]
  if (target?.type === EntityTypes.GROUP) {
    return targetId
  }

  const parentId = target?.parentId
  if (parentId === projection.workspaceId) {
    return projection.workspaceId
  }

  return typeof parentId === 'string' &&
    targetInput.elementDataMap[parentId]?.type === EntityTypes.GROUP
    ? parentId
    : projection.workspaceId
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

export const resolveCanvasHoverHierarchyTargetAtClientPos = (
  snapshot: Pick<SystemContextSnapshot, 'mousePosition' | 'keyMeta' | 'keyCtrl'>
): string | null => {
  const hitElementId = elementApis.getRenderElementIdAtClientPos(
    snapshot.mousePosition
  )
  if (hitElementId) {
    return resolveCurrentCanvasHierarchyTarget(hitElementId, snapshot)
  }

  const flattenedIds = hierarchyApis.getFlattenedElementIds()
  const elementDataMap = hierarchyApis.getElementDataMap()
  const bypassParentScope = snapshot.keyMeta || snapshot.keyCtrl
  const groupBoundsHitElementIds: string[] = []

  if (!bypassParentScope) {
    for (let index = flattenedIds.length - 1; index >= 0; index -= 1) {
      const elementId = flattenedIds[index]
      if (elementDataMap[elementId]?.type !== EntityTypes.GROUP) {
        continue
      }
      if (
        elementApis.isClientPositionInsideElementBounds(
          elementId,
          snapshot.mousePosition
        )
      ) {
        groupBoundsHitElementIds.push(elementId)
      }
    }
  }

  return resolveCanvasHoverHierarchyTarget({
    hitElementId: null,
    groupBoundsHitElementIds,
    selectedElementIds: selectionApis.getSelectedIds(),
    bypassParentScope,
    flattenedIds,
    elementDataMap
  })
}

export const resolveCreateElementParentAtClientPos = (
  snapshot: Pick<SystemContextSnapshot, 'mousePosition' | 'keyMeta' | 'keyCtrl'>
): string | null => {
  const workspaceId = hierarchyApis.getWorkspaceId()
  if (!workspaceId) {
    return null
  }

  return resolveCreateElementParent({
    hitElementId: elementApis.getRenderElementIdAtClientPos(
      snapshot.mousePosition
    ),
    selectedElementIds: selectionApis.getSelectedIds(),
    bypassParentScope: snapshot.keyMeta || snapshot.keyCtrl,
    workspaceId,
    flattenedIds: hierarchyApis.getFlattenedElementIds(),
    elementDataMap: hierarchyApis.getElementDataMap()
  })
}
