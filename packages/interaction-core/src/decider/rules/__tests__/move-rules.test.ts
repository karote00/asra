
import { describe, it, expect } from 'vitest';
import {
  InteractionActions,
  SystemContextSnapshot,
} from '@asra/utils';
import { decideFromMoveRules } from '../move-rules';
import { baseSnapshot } from './test-helpers';

describe('decideFromMoveRules', () => {
  it('should return INTERACTION_MOVE_ELEMENTS when dragging with selected elements', () => {
    const snapshot: SystemContextSnapshot = {
      ...baseSnapshot,
      mouse: {
        ...baseSnapshot.mouse,
        dragging: true,
        delta: { x: 10, y: 20 },
      },
      target: {
        ...baseSnapshot.target,
        selectedElementIds: ['element-1', 'element-2'],
      },
    };

    const result = decideFromMoveRules(snapshot);

    expect(result).toEqual({
      type: InteractionActions.INTERACTION_MOVE_ELEMENTS,
      payload: {
        ids: ['element-1', 'element-2'],
        delta: { x: 10, y: 20 },
      },
    });
  });

  it('should return null when not dragging', () => {
    const snapshot: SystemContextSnapshot = {
      ...baseSnapshot,
      mouse: {
        ...baseSnapshot.mouse,
        dragging: false,
      },
      target: {
        ...baseSnapshot.target,
        selectedElementIds: ['element-1'],
      },
    };

    const result = decideFromMoveRules(snapshot);

    expect(result).toBeNull();
  });

  it('should return null when dragging but no elements are selected', () => {
    const snapshot: SystemContextSnapshot = {
      ...baseSnapshot,
      mouse: {
        ...baseSnapshot.mouse,
        dragging: true,
      },
      target: {
        ...baseSnapshot.target,
        selectedElementIds: [],
      },
    };

    const result = decideFromMoveRules(snapshot);

    expect(result).toBeNull();
  });
});
