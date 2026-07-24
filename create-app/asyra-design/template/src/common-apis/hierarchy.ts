import { runTransaction } from '@asyra/core'
import {
  groupElements,
  moveElementsWithGroupGeometry,
  ungroupElement
} from '@asyra/preset'
import type {
  ElementRawData,
  EVENT_OPTIONS,
  MoveHierarchyRequest,
  MoveHierarchyResult,
  RemoveSubtreeResult
} from '@asyra/utils'
import { UI_PROPERTIES } from '../constants/ui-properties'
import core from '../contexts'

export const hierarchyApis = {
  getWorkspaceId: (): string | null => {
    const workspaceId = core.sceneTreeSaveData().workspace
    return typeof workspaceId === 'string' && workspaceId.length > 0
      ? workspaceId
      : null
  },

  getFlattenedElementIds: (): string[] =>
    core.getUIProperty<string[]>(UI_PROPERTIES.FLATTENED_ELEMENT_IDS) ?? [],

  getElementDataMap: (): Record<string, Partial<ElementRawData>> =>
    core.getUIProperty<Record<string, Partial<ElementRawData>>>(
      UI_PROPERTIES.ELEMENT_DATA_MAP
    ) ?? {},

  groupElements: (elementIds: readonly string[], options?: EVENT_OPTIONS) =>
    groupElements(core, elementIds, options),

  ungroupElement: (groupId: string, options?: EVENT_OPTIONS) =>
    ungroupElement(core, groupId, options),

  moveElements: (
    request: MoveHierarchyRequest,
    options?: EVENT_OPTIONS
  ): MoveHierarchyResult =>
    moveElementsWithGroupGeometry(core, request, options),

  removeSubtree: (
    elementId: string,
    options?: EVENT_OPTIONS
  ): RemoveSubtreeResult =>
    runTransaction(() => core.removeSubtree(elementId, options))
}
