import { EntityTypes, type ElementRawData } from '@asyra/utils'

type ElementDataMap = Record<string, Partial<ElementRawData>>

export interface VisibleLayerRow {
  id: string
  depth: number
  isGroup: boolean
  isExpanded: boolean
}

export interface LayerHierarchyProjection {
  rows: VisibleLayerRow[]
  error: string | null
}

const rejectProjection = (message: string): LayerHierarchyProjection => ({
  rows: [],
  error: `[Layers hierarchy] ${message}`
})

const rejectInvalidCanonicalProjection = (
  flattenedIds: readonly string[],
  elementDataMap: ElementDataMap,
  flattenedIdSet: ReadonlySet<string>
): LayerHierarchyProjection => {
  const indexById = new Map(
    flattenedIds.map((elementId, index) => [elementId, index])
  )
  let workspaceId: string | null = null

  for (const elementId of flattenedIds) {
    const element = elementDataMap[elementId]
    if (!element || element.id !== elementId) {
      return rejectProjection(`missing element data for "${elementId}"`)
    }
    if (
      element.type === EntityTypes.WORKSPACE ||
      typeof element.parentId !== 'string' ||
      element.parentId.length === 0
    ) {
      return rejectProjection(`invalid parent for "${elementId}"`)
    }

    const visited = new Set<string>([elementId])
    let parentId = element.parentId

    while (elementDataMap[parentId]) {
      if (visited.has(parentId)) {
        return rejectProjection(`cycle detected at "${parentId}"`)
      }
      visited.add(parentId)

      if (!flattenedIdSet.has(parentId)) {
        return rejectProjection(
          `missing parent "${parentId}" from flattened projection`
        )
      }

      const parent = elementDataMap[parentId]
      if (
        !parent ||
        typeof parent.parentId !== 'string' ||
        parent.parentId.length === 0
      ) {
        return rejectProjection(`invalid parent data for "${parentId}"`)
      }
      parentId = parent.parentId
    }

    if (workspaceId === null) {
      workspaceId = parentId
    } else if (workspaceId !== parentId) {
      return rejectProjection(
        `multiple workspace roots "${workspaceId}" and "${parentId}"`
      )
    }
  }

  for (const elementId of flattenedIds) {
    const parentId = elementDataMap[elementId]?.parentId
    const parentIndex = parentId ? indexById.get(parentId) : undefined
    const elementIndex = indexById.get(elementId)
    if (
      parentIndex !== undefined &&
      elementIndex !== undefined &&
      parentIndex >= elementIndex
    ) {
      return rejectProjection(
        `parent "${parentId}" must appear before "${elementId}"`
      )
    }
  }

  return rejectProjection('invalid canonical projection')
}

export const projectExpandedLayerRow = (
  elementId: string,
  elementDataMap: ElementDataMap
): VisibleLayerRow | null => {
  const element = elementDataMap[elementId]
  if (
    !element ||
    element.id !== elementId ||
    element.type === EntityTypes.WORKSPACE ||
    typeof element.parentId !== 'string' ||
    element.parentId.length === 0
  ) {
    return null
  }

  let depth = 0
  let parentId = element.parentId
  const visited = new Set<string>([elementId])
  while (elementDataMap[parentId]) {
    if (visited.has(parentId)) {
      return null
    }
    visited.add(parentId)
    const parent = elementDataMap[parentId]
    if (
      !parent ||
      typeof parent.parentId !== 'string' ||
      parent.parentId.length === 0
    ) {
      return null
    }
    depth += 1
    parentId = parent.parentId
  }

  const isGroup = element.type === EntityTypes.GROUP
  return {
    id: elementId,
    depth,
    isGroup,
    isExpanded: isGroup
  }
}

export const projectVisibleLayerRows = (
  flattenedIds: readonly string[],
  elementDataMap: ElementDataMap,
  collapsedGroupIds: ReadonlySet<string>
): LayerHierarchyProjection => {
  const flattenedIdSet = new Set(flattenedIds)
  if (flattenedIdSet.size !== flattenedIds.length) {
    return rejectProjection('duplicate element id in canonical projection')
  }

  const depthById = new Map<string, number>()
  const parentIdById = new Map<string, string>()
  const workspaceIdById = new Map<string, string>()
  let workspaceId: string | null = null

  for (const elementId of flattenedIds) {
    const element = elementDataMap[elementId]
    if (!element || element.id !== elementId) {
      return rejectInvalidCanonicalProjection(
        flattenedIds,
        elementDataMap,
        flattenedIdSet
      )
    }
    const parentId = element.parentId
    if (
      element.type === EntityTypes.WORKSPACE ||
      typeof parentId !== 'string' ||
      parentId.length === 0
    ) {
      return rejectInvalidCanonicalProjection(
        flattenedIds,
        elementDataMap,
        flattenedIdSet
      )
    }
    parentIdById.set(elementId, parentId)

    let elementWorkspaceId = parentId
    if (elementDataMap[parentId]) {
      if (!flattenedIdSet.has(parentId)) {
        return rejectInvalidCanonicalProjection(
          flattenedIds,
          elementDataMap,
          flattenedIdSet
        )
      }
      const parentDepth = depthById.get(parentId)
      const parentWorkspaceId = workspaceIdById.get(parentId)
      if (parentDepth === undefined || parentWorkspaceId === undefined) {
        return rejectInvalidCanonicalProjection(
          flattenedIds,
          elementDataMap,
          flattenedIdSet
        )
      }
      depthById.set(elementId, parentDepth + 1)
      elementWorkspaceId = parentWorkspaceId
    } else {
      depthById.set(elementId, 0)
    }
    workspaceIdById.set(elementId, elementWorkspaceId)

    if (workspaceId === null) {
      workspaceId = elementWorkspaceId
    } else if (workspaceId !== elementWorkspaceId) {
      return rejectInvalidCanonicalProjection(
        flattenedIds,
        elementDataMap,
        flattenedIdSet
      )
    }
  }

  const rows: VisibleLayerRow[] = []
  const hiddenElementIds = new Set<string>()
  for (const elementId of flattenedIds) {
    const element = elementDataMap[elementId]
    const parentId = parentIdById.get(elementId)
    const parent = parentId ? elementDataMap[parentId] : undefined
    if (
      (parentId && hiddenElementIds.has(parentId)) ||
      (parentId &&
        parent?.type === EntityTypes.GROUP &&
        collapsedGroupIds.has(parentId))
    ) {
      hiddenElementIds.add(elementId)
      continue
    }

    const isGroup = element.type === EntityTypes.GROUP
    rows.push({
      id: elementId,
      depth: depthById.get(elementId) ?? 0,
      isGroup,
      isExpanded: isGroup && !collapsedGroupIds.has(elementId)
    })
  }

  return { rows, error: null }
}
