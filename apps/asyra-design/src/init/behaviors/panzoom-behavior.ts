import { SystemContextSnapshot } from '@asyra/utils'
import type { DecisionResult } from '@asyra/interaction-core'
import { decidePanZoomRules } from '../rules'

export const decidePanZoomBehavior = (
  systemContextSnapshot: SystemContextSnapshot
): DecisionResult => {
  return decidePanZoomRules(
    systemContextSnapshot.key,
    systemContextSnapshot.mouse
  )
}
