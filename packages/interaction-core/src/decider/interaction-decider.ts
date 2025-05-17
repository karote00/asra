import { PrimaryToolType } from '@asra/utils'
import { decideSelectBehavior } from './behavior'
import { SystemSnapshot } from '../snapshot'
import { InteractionEvent } from '../types'

export function decideInteraction(
  snapshot: SystemSnapshot
): InteractionEvent | null {
  switch (snapshot.system.primaryTool) {
    case PrimaryToolType.SELECT:
      return decideSelectBehavior(snapshot)
    default:
      return null
  }
}
