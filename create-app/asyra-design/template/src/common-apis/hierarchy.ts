import { runTransaction } from '@asyra/core'
import {
  groupElements,
  moveElementsWithGroupGeometry,
  ungroupElement
} from '@asyra/preset'
import type {
  EVENT_OPTIONS,
  MoveHierarchyRequest,
  MoveHierarchyResult,
  RemoveSubtreeResult
} from '@asyra/utils'
import core from '../contexts'

export const hierarchyApis = {
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
