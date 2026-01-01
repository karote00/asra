import {
  DefaultKeySnapshot,
  DefaultPosition,
  DefaultMoseSnapshot,
  DefaultTargetSnapshot,
  DefaultSystemSnapshot,
  PrimaryToolType,
  SystemContextSnapshot
} from '@asra/utils'

export const baseSnapshot: SystemContextSnapshot = {
  mouse: {
    ...DefaultMoseSnapshot,
    dragStart: DefaultPosition
  },
  key: DefaultKeySnapshot,
  target: DefaultTargetSnapshot,
  primaryTool: PrimaryToolType.SELECT,
  system: DefaultSystemSnapshot
}
