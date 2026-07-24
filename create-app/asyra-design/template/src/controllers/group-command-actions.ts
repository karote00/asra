import { getFeature } from '@asyra/core'
import { FeatureNames } from '../constants'
import type {
  GroupCommand,
  GroupCommandExecutionResult
} from '../features/group-elements'

interface GroupCommandFeatureAPI {
  execute?: (command: GroupCommand) => GroupCommandExecutionResult | null
}

export const runGroupCommand = (
  command: GroupCommand
): GroupCommandExecutionResult | null => {
  try {
    const featureApi = getFeature(
      FeatureNames.GROUP_ELEMENTS
    ) as GroupCommandFeatureAPI
    return featureApi.execute?.(command) ?? null
  } catch (error) {
    console.error('[group-command-actions] Group command failed:', error)
    return null
  }
}
