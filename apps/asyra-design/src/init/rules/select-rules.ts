import type { DecisionResult } from '@asyra/interaction-core'
import { decideToSelectElements } from '@asyra/reactive-events'
import { MouseButton, SystemContextSnapshot } from '@asyra/utils'

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
