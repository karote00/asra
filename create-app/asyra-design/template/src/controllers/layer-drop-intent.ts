import {
  EntityTypes,
  type ElementRawData,
  type GroupRawData,
  type MoveHierarchyRequest
} from '@asyra/utils'
import type {
  LayerDropZone,
  LayerPointerTarget
} from './layer-pointer-session'
import type { LayerMoveSourcePlan } from './layer-move-source'

type ProjectedElement = Partial<ElementRawData & GroupRawData>
type LayerDropElementDataMap = Record<string, ProjectedElement>

export type LayerDropIntentZone = LayerDropZone | 'workspace'

export type LayerDropRejection =
  | 'selected-target'
  | 'descendant-target'
  | 'locked-target'
  | 'unsupported-container'
  | 'missing-target'
  | 'stale-source-projection'
  | 'invalid-workspace-root'
  | 'invalid-target-index'

export interface ValidLayerDropIntent {
  kind: 'valid'
  zone: LayerDropIntentZone
  targetElementId: string | null
  expandGroupId: string | null
  request: MoveHierarchyRequest
}

export interface InvalidLayerDropIntent {
  kind: 'invalid'
  zone: LayerDropIntentZone
  targetElementId: string | null
  reason: LayerDropRejection
}

export type LayerDropIntent =
  | ValidLayerDropIntent
  | InvalidLayerDropIntent

interface ProjectLayerDropIntentInput {
  target: LayerPointerTarget
  source: LayerMoveSourcePlan
  flattenedIds: readonly string[]
  elementDataMap: LayerDropElementDataMap
  collapsedGroupIds: ReadonlySet<string>
}

const invalid = (
  zone: LayerDropIntentZone,
  targetElementId: string | null,
  reason: LayerDropRejection
): InvalidLayerDropIntent => ({
  kind: 'invalid',
  zone,
  targetElementId,
  reason
})

const getDirectChildIds = (
  parentId: string,
  flattenedIds: readonly string[],
  elementDataMap: LayerDropElementDataMap,
  movedIdSet: ReadonlySet<string>
): string[] =>
  flattenedIds.filter(
    (elementId) =>
      elementDataMap[elementId]?.parentId === parentId &&
      !movedIdSet.has(elementId)
  )

const getWorkspaceId = (
  flattenedIds: readonly string[],
  elementDataMap: LayerDropElementDataMap
): string | null => {
  const rootParentIds = new Set<string>()
  flattenedIds.forEach((elementId) => {
    const parentId = elementDataMap[elementId]?.parentId
    if (
      typeof parentId === 'string' &&
      parentId.length > 0 &&
      !elementDataMap[parentId]
    ) {
      rootParentIds.add(parentId)
    }
  })
  return rootParentIds.size === 1 ? [...rootParentIds][0] : null
}

const wouldTargetDescendant = (
  targetParentId: string,
  movedIdSet: ReadonlySet<string>,
  elementDataMap: LayerDropElementDataMap
): boolean => {
  const visited = new Set<string>()
  let currentId: string | undefined = targetParentId

  while (currentId && !visited.has(currentId)) {
    if (movedIdSet.has(currentId)) {
      return true
    }
    visited.add(currentId)
    currentId = elementDataMap[currentId]?.parentId
  }
  return false
}

const valid = ({
  zone,
  targetElementId,
  targetParentId,
  targetIndex,
  source,
  expandGroupId = null
}: {
  zone: LayerDropIntentZone
  targetElementId: string | null
  targetParentId: string
  targetIndex: number
  source: LayerMoveSourcePlan
  expandGroupId?: string | null
}): LayerDropIntent => {
  if (!Number.isInteger(targetIndex) || targetIndex < 0) {
    return invalid(zone, targetElementId, 'invalid-target-index')
  }

  return {
    kind: 'valid',
    zone,
    targetElementId,
    expandGroupId,
    request: {
      elementIds: [...source.elementIds],
      targetParentId,
      targetIndex
    }
  }
}

export const projectLayerDropIntent = ({
  target,
  source,
  flattenedIds,
  elementDataMap,
  collapsedGroupIds
}: ProjectLayerDropIntentInput): LayerDropIntent => {
  const flattenedIdSet = new Set(flattenedIds)
  const movedIdSet = new Set(source.elementIds)
  if (
    movedIdSet.size !== source.elementIds.length ||
    source.elementIds.some(
      (elementId) =>
        !flattenedIdSet.has(elementId) ||
        elementDataMap[elementId]?.id !== elementId
    )
  ) {
    const zone = target.kind === 'workspace' ? 'workspace' : target.zone
    return invalid(
      zone,
      target.kind === 'row' ? target.elementId : null,
      'stale-source-projection'
    )
  }

  if (target.kind === 'workspace') {
    const workspaceId = getWorkspaceId(flattenedIds, elementDataMap)
    if (!workspaceId) {
      return invalid('workspace', null, 'invalid-workspace-root')
    }
    const targetBase = getDirectChildIds(
      workspaceId,
      flattenedIds,
      elementDataMap,
      movedIdSet
    )
    return valid({
      zone: 'workspace',
      targetElementId: null,
      targetParentId: workspaceId,
      targetIndex: targetBase.length,
      source
    })
  }

  const { elementId: targetElementId, zone } = target
  const targetElement = elementDataMap[targetElementId]
  if (
    !targetElement ||
    targetElement.id !== targetElementId ||
    !flattenedIdSet.has(targetElementId)
  ) {
    return invalid(zone, targetElementId, 'missing-target')
  }
  if (movedIdSet.has(targetElementId)) {
    return invalid(zone, targetElementId, 'selected-target')
  }

  if (zone === 'inside') {
    if (targetElement.type !== EntityTypes.GROUP) {
      return invalid(zone, targetElementId, 'unsupported-container')
    }
    if (targetElement.lock === true) {
      return invalid(zone, targetElementId, 'locked-target')
    }
    if (
      wouldTargetDescendant(targetElementId, movedIdSet, elementDataMap)
    ) {
      return invalid(zone, targetElementId, 'descendant-target')
    }

    const targetBase = getDirectChildIds(
      targetElementId,
      flattenedIds,
      elementDataMap,
      movedIdSet
    )
    return valid({
      zone,
      targetElementId,
      targetParentId: targetElementId,
      targetIndex: targetBase.length,
      source,
      expandGroupId: collapsedGroupIds.has(targetElementId)
        ? targetElementId
        : null
    })
  }

  const targetParentId = targetElement.parentId
  if (
    typeof targetParentId !== 'string' ||
    targetParentId.length === 0
  ) {
    return invalid(zone, targetElementId, 'missing-target')
  }
  if (wouldTargetDescendant(targetParentId, movedIdSet, elementDataMap)) {
    return invalid(zone, targetElementId, 'descendant-target')
  }

  const targetBase = getDirectChildIds(
    targetParentId,
    flattenedIds,
    elementDataMap,
    movedIdSet
  )
  const targetBaseIndex = targetBase.indexOf(targetElementId)
  if (targetBaseIndex < 0) {
    return invalid(zone, targetElementId, 'invalid-target-index')
  }

  return valid({
    zone,
    targetElementId,
    targetParentId,
    targetIndex: targetBaseIndex + (zone === 'after' ? 1 : 0),
    source
  })
}
