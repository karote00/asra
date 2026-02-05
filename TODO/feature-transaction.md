# TODO: Transaction Feature (Feature-System)

## Definition of Done

### ✅ Feature Implementation

- [ ] Feature defined using `defineFeature()` following feature-system patterns
- [ ] Handles `input.shortcut.undoredo` event (Cmd+Z, Cmd+Shift+Z)
- [ ] Subscribes to `decideToStartTransaction` event
- [ ] Subscribes to `decideToEndTransaction` event
- [ ] Exposed public API (start, end, undo, redo)
- [ ] Uses `@asyra/factory` for transaction management
- [ ] Uses `@asyra/reactive-events` for event subscription

### ✅ Functionality

- [ ] Cmd+Z triggers undo (Meta key on Mac, Control on others)
- [ ] Cmd+Shift+Z triggers redo
- [ ] Start transaction wraps changes into undoable unit
- [ ] End transaction commits the undoable unit
- [ ] Undo reverts last transaction
- [ ] Redo reapplies last undone transaction

### ✅ Visual Feedback

- [ ] Undo/redo actions reflect in UI (as applicable)
- [ ] Changes are properly reverted/applied

### ✅ Testing

- [ ] Unit tests for undo/redo API
- [ ] Integration tests for transaction wrapping
- [ ] Visual testing in browser
- [ ] Edge cases tested (empty stack, nested transactions)

### ✅ Code Quality

- [ ] Follows monorepo import rules (`@asyra/package-name`)
- [ ] Types are properly defined
- [ ] Passes `yarn lint:ci`
- [ ] Tests pass (`yarn workspace @asyra/asyra-design test:local`)

### ✅ Documentation

- [ ] Feature implementation is self-documenting (clear naming)

## Implementation Plan

### Phase 1: Create Feature Structure

- [ ] Define transaction feature with `defineFeature()`
- [ ] Set up event handlers and subscriptions

### Phase 2: Implement API

- [ ] Create `start()` API → calls factory.startTransaction()
- [ ] Create `end()` API → calls factory.endTransaction()
- [ ] Create `undo()` API → calls factory.undo()
- [ ] Create `redo()` API → calls factory.redo()

### Phase 3: Implement Undo/Redo Shortcuts

- [ ] Handle `input.shortcut.undoredo` event
- [ ] Check key combinations:
  - Meta + Z → undo (on Mac) / Control + Z (on others)
  - Meta + Shift + Z → redo (on Mac) / Control + Shift + Z (on others)
- [ ] Call appropriate API method

### Phase 4: Implement Transaction Subscriptions

- [ ] Subscribe to `decideToStartTransaction`
- [ ] Call `start()` API on event
- [ ] Subscribe to `decideToEndTransaction`
- [ ] Call `end()` API on event

### Phase 5: Testing & Verification

- [ ] Test Cmd+Z undoes last action
- [ ] Test Cmd+Shift+Z redoes action
- [ ] Test transaction wrapping
- [ ] Test multiple undo/redo operations
- [ ] Run lint check
- [ ] Run tests

## Status

- Feature structure: ✅ Complete
- API implementation: ✅ Complete
- Undo/Redo shortcuts: ✅ Complete
- Transaction subscriptions: ✅ Complete
- Testing & Verification: 🔄 In Progress
