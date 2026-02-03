import type { DecisionResult } from '@asyra/interaction-core'
import { MouseButton, SystemContextSnapshot } from '@asyra/utils'
import { decideToSelectElements } from '../events'

export const decideFromSelectRules = (
  systemContextSnapshot: SystemContextSnapshot
): DecisionResult | null => {
  const { mouse, key, target } = systemContextSnapshot

  if (mouse.button === MouseButton.LEFT && !key.shift) {
    return {
      type: 'INTERACTION_SELECT_ELEMENTS',
      payload: {
        elementIds: target.hoveredElementId ? [target.hoveredElementId] : []
      },
      handler: (payload: any) => decideToSelectElements(payload.elementIds)
    }
  }

  return null
}
