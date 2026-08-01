import { EntityTypes, type ElementRawData } from '@asyra/utils'

export type LayerMoveElementDataMap = Record<string, Partial<ElementRawData>>

export interface ResolvedLayerMoveSource {
  elementIds: string[]
  sourceParentId: string
  preSessionSelection: string[]
  requestedSourceSelection: string[]
  replacesSelection: boolean
}

export type LayerMoveSourceRejection =
  | 'missing-source'
  | 'duplicate-source'
  | 'stale-source-projection'
  | 'workspace-source'
  | 'locked-source'
  | 'mixed-parent-source'

export type LayerMoveSourceResult =
  | {
      ok: true
      source: ResolvedLayerMoveSource
    }
  | {
      ok: false
      reason: LayerMoveSourceRejection
    }

interface DeriveLayerMoveSourceInput {
  sourceElementId: string
  selectedIds: readonly string[]
  flattenedIds: readonly string[]
  elementDataMap: LayerMoveElementDataMap
}

export const deriveLayerMoveSource = ({
  sourceElementId,
  selectedIds,
  flattenedIds,
  elementDataMap
}: DeriveLayerMoveSourceInput): LayerMoveSourceResult => {
  const sourceIsSelected = selectedIds.includes(sourceElementId)
  const candidateIds = sourceIsSelected ? [...selectedIds] : [sourceElementId]
  const candidateIdSet = new Set(candidateIds)

  if (candidateIdSet.size !== candidateIds.length) {
    return { ok: false, reason: 'duplicate-source' }
  }

  const elements = candidateIds.map((elementId) => elementDataMap[elementId])
  if (
    elements.some(
      (element, index) =>
        !element ||
        element.id !== candidateIds[index] ||
        typeof element.parentId !== 'string'
    )
  ) {
    return { ok: false, reason: 'missing-source' }
  }

  if (elements.some((element) => element?.type === EntityTypes.WORKSPACE)) {
    return { ok: false, reason: 'workspace-source' }
  }

  const flattenedIdSet = new Set(flattenedIds)
  if (candidateIds.some((elementId) => !flattenedIdSet.has(elementId))) {
    return { ok: false, reason: 'stale-source-projection' }
  }

  if (elements.some((element) => element?.lock === true)) {
    return { ok: false, reason: 'locked-source' }
  }

  const sourceParentId = elements[0]?.parentId
  if (
    typeof sourceParentId !== 'string' ||
    sourceParentId.length === 0 ||
    elements.some((element) => element?.parentId !== sourceParentId)
  ) {
    return { ok: false, reason: 'mixed-parent-source' }
  }

  return {
    ok: true,
    source: {
      elementIds: candidateIds,
      sourceParentId,
      preSessionSelection: [...selectedIds],
      requestedSourceSelection: [...candidateIds],
      replacesSelection: !sourceIsSelected
    }
  }
}
