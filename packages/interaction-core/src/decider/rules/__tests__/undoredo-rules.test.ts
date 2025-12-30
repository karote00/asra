
import { describe, it, expect } from 'vitest';
import {
  InteractionActions,
  KeySnapshot,
  UNDO,
} from '@asra/utils';
import { decideUndoRedoRules } from '../undoredo-rules';

describe('decideUndoRedoRules', () => {
  const baseKeySnapshot: KeySnapshot = {
    shift: false,
    alt: false,
    ctrl: false,
    meta: false,
  };

  it('should return a REDO interaction when the shift key is pressed', () => {
    const keySnapshot: KeySnapshot = { ...baseKeySnapshot, shift: true };
    const result = decideUndoRedoRules(keySnapshot);

    expect(result).toEqual({
      type: InteractionActions.INTERACTION_UNDOREDO,
      payload: {
        undoredo: UNDO.REDO,
      },
    });
  });

  it('should return an UNDO interaction when the shift key is not pressed', () => {
    const keySnapshot: KeySnapshot = { ...baseKeySnapshot, shift: false };
    const result = decideUndoRedoRules(keySnapshot);

    expect(result).toEqual({
      type: InteractionActions.INTERACTION_UNDOREDO,
      payload: {
        undoredo: UNDO.UNDO,
      },
    });
  });
});
