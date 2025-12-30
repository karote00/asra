
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SystemContextSnapshot } from '@asra/utils';
import { decideSelectBehavior } from '../select-behavior';
import * as rules from '../../rules';
import { baseSnapshot } from '../../rules/__tests__/test-helpers';

vi.mock('../../rules', () => ({
  decideFromMoveRules: vi.fn(),
  decideFromSelectRules: vi.fn(),
}));

describe('decideSelectBehavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('should call decideFromMoveRules when dragging with selected elements', () => {
    const snapshot: SystemContextSnapshot = {
      ...baseSnapshot,
      mouse: { ...baseSnapshot.mouse, dragging: true },
      target: { ...baseSnapshot.target, selectedElementIds: ['element-1'] },
    };
    decideSelectBehavior(snapshot);
    expect(rules.decideFromMoveRules).toHaveBeenCalledWith(snapshot);
    expect(rules.decideFromSelectRules).not.toHaveBeenCalled();
  });

  it('should call decideFromSelectRules when not dragging', () => {
    const snapshot: SystemContextSnapshot = {
      ...baseSnapshot,
      mouse: { ...baseSnapshot.mouse, dragging: false },
    };
    decideSelectBehavior(snapshot);
    expect(rules.decideFromSelectRules).toHaveBeenCalledWith(snapshot);
    expect(rules.decideFromMoveRules).not.toHaveBeenCalled();
  });

  it('should call decideFromSelectRules when dragging with no selected elements', () => {
    const snapshot: SystemContextSnapshot = {
      ...baseSnapshot,
      mouse: { ...baseSnapshot.mouse, dragging: true },
      target: { ...baseSnapshot.target, selectedElementIds: [] },
    };
    decideSelectBehavior(snapshot);
    expect(rules.decideFromSelectRules).toHaveBeenCalledWith(snapshot);
    expect(rules.decideFromMoveRules).not.toHaveBeenCalled();
  });
});
