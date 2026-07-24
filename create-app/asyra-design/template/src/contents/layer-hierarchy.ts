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

export const projectVisibleLayerRows = (
  flattenedIds: readonly string[],
  elementDataMap: ElementDataMap,
  collapsedGroupIds: ReadonlySet<string>
): LayerHierarchyProjection => {
  const flattenedIdSet = new Set(flattenedIds)
  if (flattenedIdSet.size !== flattenedIds.length) {
    return rejectProjection('duplicate element id in canonical projection')
  }

  const indexById = new Map(
    flattenedIds.map((elementId, index) => [elementId, index])
  )
  const depthById = new Map<string, number>()
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
    let depth = 0

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
      depth += 1
      parentId = parent.parentId
    }

    if (workspaceId === null) {
      workspaceId = parentId
    } else if (workspaceId !== parentId) {
      return rejectProjection(
        `multiple workspace roots "${workspaceId}" and "${parentId}"`
      )
    }

    depthById.set(elementId, depth)
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

  const rows: VisibleLayerRow[] = []
  for (const elementId of flattenedIds) {
    const element = elementDataMap[elementId]
    let parentId = element.parentId
    let isVisible = true

    while (parentId && elementDataMap[parentId]) {
      const parent = elementDataMap[parentId]
      if (
        parent.type === EntityTypes.GROUP &&
        collapsedGroupIds.has(parentId)
      ) {
        isVisible = false
        break
      }
      parentId = parent.parentId
    }

    if (!isVisible) {
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
