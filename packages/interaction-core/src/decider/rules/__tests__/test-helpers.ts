import {
  DefaultKeySnapshot,
  DefaultPosition,
  DefaultMoseSnapshot,
  DefaultTargetSnapshot,
  PrimaryToolType,
  SystemContextSnapshot,
  SystemMode
} from '@asra/utils'

export const baseSnapshot: SystemContextSnapshot = {
  mouse: {
    ...DefaultMoseSnapshot,
    dragStart: DefaultPosition
  },
  key: DefaultKeySnapshot,
  target: DefaultTargetSnapshot,
  primaryTool: PrimaryToolType.SELECT,
  systemMode: SystemMode.IDLE
}
