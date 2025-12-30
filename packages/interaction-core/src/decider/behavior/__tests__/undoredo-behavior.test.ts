
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SystemContextSnapshot } from '@asra/utils';
import { decideUndoRedoBehavior } from '../undoredo-behavior';
import * as rules from '../../rules';
import { baseSnapshot } from '../../rules/__tests__/test-helpers';

vi.mock('../../rules', () => ({
  decideUndoRedoRules: vi.fn(),
}));

describe('decideUndoRedoBehavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('should call decideUndoRedoRules with the key snapshot', () => {
    const snapshot: SystemContextSnapshot = {
      ...baseSnapshot,
    };
    decideUndoRedoBehavior(snapshot);
    expect(rules.decideUndoRedoRules).toHaveBeenCalledWith(snapshot.key);
  });
});
