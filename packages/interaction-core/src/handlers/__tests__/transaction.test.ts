
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TransactionHandlers } from '../transaction';
import { InteractionActions } from '@asra/utils';
import * as reactiveEvents from '@asra/reactive-events';

vi.mock('@asra/reactive-events', () => ({
  decideToStartTransaction: vi.fn(),
  decideToEndTransaction: vi.fn(),
}));

describe('TransactionHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call decideToStartTransaction for INTERACTION_START_TRANSACTION', () => {
    TransactionHandlers[InteractionActions.INTERACTION_START_TRANSACTION]();
    expect(reactiveEvents.decideToStartTransaction).toHaveBeenCalled();
  });

  it('should call decideToEndTransaction for INTERACTION_END_TRANSACTION', () => {
    TransactionHandlers[InteractionActions.INTERACTION_END_TRANSACTION]();
    expect(reactiveEvents.decideToEndTransaction).toHaveBeenCalled();
  });
});
