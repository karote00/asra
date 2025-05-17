import { MouseButton } from '@asra/utils'
import { SystemSnapshot } from '../../snapshot'
import { InteractionAction, InteractionEvent } from '../../types/'

export function decideFromSelectRules(
  snapshot: SystemSnapshot
): InteractionEvent | null {
  const { mouse, key, target } = snapshot

  if (
    mouse.button === MouseButton.LEFT &&
    !key.shift &&
    target.hoveredElementId
  ) {
    return {
      type: InteractionAction.SELECT_ELEMENTS,
      payload: { id: target.hoveredElementId }
    }
  }

  return null
}
