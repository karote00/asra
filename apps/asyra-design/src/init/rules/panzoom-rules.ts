import type { DecisionResult } from '@asyra/interaction-core'
import { decideToPanZoom } from '../events'
import { KeySnapshot, MouseSnapshot, PanZoom } from '@asyra/utils'

export const decidePanZoomRules = (
  keySnapshot: KeySnapshot,
  mouseSnapshot: MouseSnapshot
): DecisionResult => {
  return {
    type: 'INTERACTION_PAN_ZOOM',
    payload: {
      panzoom: keySnapshot.meta ? PanZoom.ZOOM : PanZoom.PAN,
      mouse: { ...mouseSnapshot.position },
      wheel: { ...mouseSnapshot.delta }
    },
    handler: (payload: any) =>
      decideToPanZoom(payload.panzoom, payload.mouse, payload.wheel)
  }
}
