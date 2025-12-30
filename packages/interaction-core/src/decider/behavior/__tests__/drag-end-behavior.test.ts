
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PrimaryToolType,
  SystemContextSnapshot,
} from '@asra/utils';
import { decideDragEndBehavior } from '../drag-end-behavior';
import * as rules from '../../rules';
import { baseSnapshot } from '../../rules/__tests__/test-helpers';

vi.mock('../../rules', () => ({
  decideFromResetElementSizeRules: vi.fn(),
}));

describe('decideDragEndBehavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('should call decideFromResetElementSizeRules when the primary tool is RECTANGLE', () => {
    const snapshot: SystemContextSnapshot = {
      ...baseSnapshot,
      primaryTool: PrimaryToolType.RECTANGLE,
    };
    decideDragEndBehavior(snapshot);
    expect(rules.decideFromResetElementSizeRules).toHaveBeenCalledWith(snapshot);
  });

  it('should return null when the primary tool is SELECT', () => {
    const snapshot: SystemContextSnapshot = {
      ...baseSnapshot,
      primaryTool: PrimaryToolType.SELECT,
    };
    const result = decideDragEndBehavior(snapshot);
    expect(result).toBeNull();
  });
});
