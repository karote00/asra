import { InteractionEvent, SystemContextSnapshot } from '@asra/utils'
import { decidePanZoomRules } from '../rules'

export const decidePanZoomBehavior = (
  systemContextSnapshot: SystemContextSnapshot
): InteractionEvent => {
  return decidePanZoomRules(
    systemContextSnapshot.key,
    systemContextSnapshot.mouse
  )
}
