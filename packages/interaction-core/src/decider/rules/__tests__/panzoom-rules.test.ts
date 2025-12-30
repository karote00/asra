
import { describe, it, expect } from 'vitest';
import {
  InteractionActions,
  PanZoom,
  KeySnapshot,
  MouseSnapshot,
  MouseButton,
} from '@asra/utils';
import { decidePanZoomRules } from '../panzoom-rules';

describe('decidePanZoomRules', () => {
  const baseKeySnapshot: KeySnapshot = {
    shift: false,
    alt: false,
    ctrl: false,
    meta: false,
  };

  const baseMouseSnapshot: MouseSnapshot = {
    button: MouseButton.NONE,
    down: false,
    dragging: false,
    position: { x: 100, y: 200 },
    delta: { x: 10, y: 20 },
    dragStart: { x: 0, y: 0 },
  };

  it('should return a ZOOM interaction when the meta key is pressed', () => {
    const keySnapshot: KeySnapshot = { ...baseKeySnapshot, meta: true };
    const result = decidePanZoomRules(keySnapshot, baseMouseSnapshot);

    expect(result).toEqual({
      type: InteractionActions.INTERACTION_PAN_ZOOM,
      payload: {
        panzoom: PanZoom.ZOOM,
        mouse: { x: 100, y: 200 },
        wheel: { x: 10, y: 20 },
      },
    });
  });

  it('should return a PAN interaction when the meta key is not pressed', () => {
    const keySnapshot: KeySnapshot = { ...baseKeySnapshot, meta: false };
    const result = decidePanZoomRules(keySnapshot, baseMouseSnapshot);

    expect(result).toEqual({
      type: InteractionActions.INTERACTION_PAN_ZOOM,
      payload: {
        panzoom: PanZoom.PAN,
        mouse: { x: 100, y: 200 },
        wheel: { x: 10, y: 20 },
      },
    });
  });
});
