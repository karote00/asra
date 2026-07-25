import { EntityTypes, type ElementRawData } from '@asyra/utils'
import { hierarchyApis, selectionApis } from '../common-apis'
import { GroupCommandIds, type GroupCommand } from '../constants'

export type { GroupCommand } from '../constants'

export type GroupCommandElementDataMap = Record<string, Partial<ElementRawData>>

export interface GroupCommandState {
  canGroup: boolean
  canUngroup: boolean
  canonicalSelectedIds: string[]
}

export interface GroupCommandRequest {
  command: GroupCommand
  elementIds: string[]
}

const hasProjectedElement = (
  elementId: string,
  flattenedIdSet: ReadonlySet<string>,
  elementDataMap: GroupCommandElementDataMap
): boolean => {
  const element = elementDataMap[elementId]
  return (
    flattenedIdSet.has(elementId) &&
    element?.id === elementId &&
    element.type !== EntityTypes.WORKSPACE &&
    typeof element.parentId === 'string' &&
    element.parentId.length > 0
  )
}

export const deriveGroupCommandState = (
  selectedIds: readonly string[],
  flattenedIds: readonly string[],
  elementDataMap: GroupCommandElementDataMap
): GroupCommandState => {
  const uniqueSelectedIds = new Set(selectedIds)
  const flattenedIdSet = new Set(flattenedIds)
  const hasUniqueSelection = uniqueSelectedIds.size === selectedIds.length
  const projectedSelectionIsValid =
    selectedIds.length > 0 &&
    hasUniqueSelection &&
    selectedIds.every((elementId) =>
      hasProjectedElement(elementId, flattenedIdSet, elementDataMap)
    )

  const canonicalSelectedIds = projectedSelectionIsValid
    ? flattenedIds.filter((elementId) => uniqueSelectedIds.has(elementId))
    : []
  const hasCompleteCanonicalSelection =
    canonicalSelectedIds.length === selectedIds.length
  const commonParentId = projectedSelectionIsValid
    ? elementDataMap[selectedIds[0]]?.parentId
    : undefined
  const hasCommonParent =
    typeof commonParentId === 'string' &&
    selectedIds.every(
      (elementId) => elementDataMap[elementId]?.parentId === commonParentId
    )

  const canGroup =
    projectedSelectionIsValid &&
    hasCompleteCanonicalSelection &&
    hasCommonParent
  const selectedElement =
    selectedIds.length === 1 ? elementDataMap[selectedIds[0]] : undefined
  const canUngroup =
    projectedSelectionIsValid &&
    hasCompleteCanonicalSelection &&
    selectedIds.length === 1 &&
    selectedElement?.type === EntityTypes.GROUP

  return {
    canGroup,
    canUngroup,
    canonicalSelectedIds
  }
}

export const createGroupCommandRequest = (
  command: GroupCommand,
  state: GroupCommandState
): GroupCommandRequest | null => {
  const isAvailable =
    command === GroupCommandIds.GROUP ? state.canGroup : state.canUngroup
  if (!isAvailable) {
    return null
  }

  return {
    command,
    elementIds: [...state.canonicalSelectedIds]
  }
}

export const getCurrentGroupCommandState = (): GroupCommandState =>
  deriveGroupCommandState(
    selectionApis.getSelectedIds(),
    hierarchyApis.getFlattenedElementIds(),
    hierarchyApis.getElementDataMap()
  )

export const createCurrentGroupCommandRequest = (
  command: GroupCommand
): GroupCommandRequest | null =>
  createGroupCommandRequest(command, getCurrentGroupCommandState())
