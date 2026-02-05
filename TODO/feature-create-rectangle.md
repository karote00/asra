# TODO: Create Rectangle Feature (Feature-System)

## Definition of Done

### ✅ Feature Implementation

- [ ] Feature defined using `defineFeature()` following feature-system patterns
- [ ] Handles `input.drag.start`, `input.drag.update`, `input.drag.end` events
- [ ] Creates rectangle with super small size (width: 0, height: 0) on drag start
- [ ] Updates element size and position during drag update
- [ ] Resets size to 100x100 on drag end if no movement occurred
- [ ] Exposed public API (createRectangle, updateElementSize, resetElementSize)
- [ ] Uses `@asyra/scene-tree` for element creation
- [ ] Uses `@asyra/reactive-events` (changeComputedData) for updates

### ✅ Functionality

- [ ] Mouse down → create element at position with size 0x0
- [ ] Mouse move → update element size (width, height) based on drag delta
- [ ] Mouse up → if no movement (drag < 1px), reset size to 100x100
- [ ] Element is selected automatically after creation
- [ ] Transaction wrapping for undo/redo support

### ✅ Visual Feedback

- [ ] Rectangle appears at clicked position
- [ ] Rectangle grows as mouse drags
- [ ] Selection box appears around created rectangle
- [ ] Works at different zoom levels and pan positions

### ✅ Testing

- [ ] Unit tests for create Rectangle API
- [ ] Integration tests for drag start/update/end flow
- [ ] Visual testing in browser
- [ ] Edge cases tested (no movement, small movement)

### ✅ Code Quality

- [ ] Follows monorepo import rules (`@asyra/package-name`)
- [ ] Logs removed or kept for debugging (as appropriate)
- [ ] Types are properly defined
- [ ] Passes `yarn lint:ci`
- [ ] Tests pass (`yarn workspace @asyra/asyra-design test:local`)

### ✅ Documentation

- [ ] Feature implementation is self-documenting (clear naming)
- [ ] Any complex logic has comments

## Implementation Plan

### Phase 1: Create Feature Structure

- [ ] Create `features/create-element/index.ts`
- [ ] Define feature with `defineFeature()`
- [ ] Set up event handlers for drag start/update/end

### Phase 2: Implement Drag Start

- [ ] Check if primary tool is 'rectangle'
- [ ] Calculate workspace position from mouse position
- [ ] Start transaction
- [ ] Create rectangle with width: 0, height: 0
- [ ] Store created element ID
- [ ] Select the created element
- [ ] End transaction

### Phase 3: Implement Drag Update

- [ ] Check if primary tool is 'rectangle' and dragging
- [ ] Calculate width = currentPos.x - dragStart.x
- [ ] Calculate height = currentPos.y - dragStart.y
- [ ] Start transaction
- [ ] Use `changeComputedData` to update width and height
- [ ] End transaction

### Phase 4: Implement Drag End

- [ ] Check if primary tool is 'rectangle'
- [ ] Calculate movement distance
- [ ] If movement < 1px:
  - [ ] Reset size to 100x100 (DEFAULT_ELEMENT_SIZE)
- [ ] Clear stored element ID

### Phase 5: Testing & Verification

- [ ] Test click (no drag) → creates 100x100 rectangle
- [ ] Test drag → creates rectangle with dragged size
- [ ] Test at different zoom levels
- [ ] Test at different pan positions
- [ ] Verify undo/redo works
- [ ] Run lint check
- [ ] Run tests

## Status

- Feature structure: ✅ Complete
- Drag start: ✅ Complete
- Drag update: ✅ Complete
- Drag end: ✅ Complete
- Testing & Verification: 🔄 In Progress
