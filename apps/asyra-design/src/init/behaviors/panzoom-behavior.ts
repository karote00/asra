import { InteractionEvent, SystemContextSnapshot } from '@asyra/utils'
import { decidePanZoomRules } from '../rules'

export const decidePanZoomBehavior = (
  systemContextSnapshot: SystemContextSnapshot
): InteractionEvent => {
  return decidePanZoomRules(
    systemContextSnapshot.key,
    systemContextSnapshot.mouse
  )
}
