
import { describe, it, expect } from 'vitest';
import {
  InteractionActions,
  MouseButton,
  SystemContextSnapshot,
} from '@asra/utils';
import { decideFromSelectRules } from '../select-rules';
import { baseSnapshot } from './test-helpers';

describe('decideFromSelectRules', () => {
  it('should return INTERACTION_SELECT_ELEMENTS when left mouse is pressed without shift and an element is hovered', () => {
    const snapshot: SystemContextSnapshot = {
      ...baseSnapshot,
      mouse: { ...baseSnapshot.mouse, button: MouseButton.LEFT },
      target: { ...baseSnapshot.target, hoveredElementId: 'element-1' },
    };

    const result = decideFromSelectRules(snapshot);

    expect(result).toEqual({
      type: InteractionActions.INTERACTION_SELECT_ELEMENTS,
      payload: {
        elementIds: ['element-1'],
      },
    });
  });

  it('should return INTERACTION_SELECT_ELEMENTS with empty payload when left mouse is pressed without shift and no element is hovered', () => {
    const snapshot: SystemContextSnapshot = {
      ...baseSnapshot,
      mouse: { ...baseSnapshot.mouse, button: MouseButton.LEFT },
    };

    const result = decideFromSelectRules(snapshot);

    expect(result).toEqual({
      type: InteractionActions.INTERACTION_SELECT_ELEMENTS,
      payload: {
        elementIds: [],
      },
    });
  });

  it('should return null when the right mouse button is pressed', () => {
    const snapshot: SystemContextSnapshot = {
      ...baseSnapshot,
      mouse: { ...baseSnapshot.mouse, button: MouseButton.RIGHT },
    };

    const result = decideFromSelectRules(snapshot);

    expect(result).toBeNull();
  });

  it('should return null when the left mouse button is pressed with the shift key', () => {
    const snapshot: SystemContextSnapshot = {
      ...baseSnapshot,
      mouse: { ...baseSnapshot.mouse, button: MouseButton.LEFT },
      key: { ...baseSnapshot.key, shift: true },
    };

    const result = decideFromSelectRules(snapshot);

    expect(result).toBeNull();
  });

  it('should return null when no mouse button is pressed', () => {
    const snapshot: SystemContextSnapshot = {
      ...baseSnapshot,
    };

    const result = decideFromSelectRules(snapshot);

    expect(result).toBeNull();
  });
});
