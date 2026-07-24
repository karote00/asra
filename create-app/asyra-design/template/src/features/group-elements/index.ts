import { defineFeature } from '@asyra/core'
import type { SystemContextSnapshotWithDetail } from '@asyra/utils'
import {
  hierarchyApis,
  selectionApis,
  transactionApis
} from '../../common-apis'
import {
  createCurrentGroupCommandRequest,
  type GroupCommand,
  type GroupCommandRequest
} from '../../controllers/group-commands'
import { FeatureNames, InputSystemEvents } from '../../constants'

export interface GroupCommandExecutionResult {
  [key: string]: unknown
  command: GroupCommand
  groupId: string
  selectedIds: string[]
}

export type { GroupCommand }

interface GroupCommandFeatureAPI {
  execute: (command: GroupCommand) => GroupCommandExecutionResult | null
  [key: string]: unknown
}

export const executeGroupCommandRequest = (
  request: GroupCommandRequest
): GroupCommandExecutionResult =>
  transactionApis.runTransaction(() => {
    if (request.command === 'group') {
      const result = hierarchyApis.groupElements(request.elementIds)
      const selectedIds = [result.groupId]
      selectionApis.selectElements(selectedIds)
      return {
        command: request.command,
        groupId: result.groupId,
        selectedIds
      }
    }

    const result = hierarchyApis.ungroupElement(request.elementIds[0])
    const selectedIds = [...result.elementIds]
    selectionApis.selectElements(selectedIds)
    return {
      command: request.command,
      groupId: result.groupId,
      selectedIds
    }
  })

const api: GroupCommandFeatureAPI = {
  execute: (command) => {
    const request = createCurrentGroupCommandRequest(command)
    return request ? executeGroupCommandRequest(request) : null
  }
}

export const groupCommandFeatureDefinition = {
  priority: 100,
  exclusive: true,
  api,
  execution: (snapshot: SystemContextSnapshotWithDetail) => {
    if (
      snapshot.detail?.groupShortcut !== true ||
      snapshot.detail.editableTarget === true
    ) {
      return null
    }

    return api.execute(snapshot.keyShift ? 'ungroup' : 'group')
  }
}

export const groupCommandFeature = defineFeature(
  FeatureNames.GROUP_ELEMENTS,
  InputSystemEvents.INPUT_SHORTCUT_GROUP,
  groupCommandFeatureDefinition
)

export default groupCommandFeature
