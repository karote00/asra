
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UndoRedoHandlers } from '../undoredo';
import { InteractionActions, UNDO } from '@asra/utils';
import * as reactiveEvents from '@asra/reactive-events';

vi.mock('@asra/reactive-events', () => ({
  decideToUndoRedo: vi.fn(),
}));

describe('UndoRedoHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call decideToUndoRedo for INTERACTION_UNDOREDO', () => {
    const payload = { undoredo: UNDO.UNDO };
    UndoRedoHandlers[InteractionActions.INTERACTION_UNDOREDO](payload);
    expect(reactiveEvents.decideToUndoRedo).toHaveBeenCalledWith(
      payload.undoredo
    );
  });
});
