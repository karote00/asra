import {
  InteractionActions,
  InteractionEvent,
  KeySnapshot,
  MouseSnapshot,
  PanZoom
} from '@asyra/utils'

export const decidePanZoomRules = (
  keySnapshot: KeySnapshot,
  mouseSnapshot: MouseSnapshot
): InteractionEvent => {
  const interaction: InteractionEvent = {
    type: InteractionActions.INTERACTION_PAN_ZOOM,
    payload: {
      panzoom: keySnapshot.meta ? PanZoom.ZOOM : PanZoom.PAN,
      mouse: { ...mouseSnapshot.position },
      wheel: { ...mouseSnapshot.delta }
    }
  }

  return interaction
}
