# Task Breakdown: Interaction Core & Decision Engine

**Status**: [Completed]

## 1. Interaction State Machine
- [x] Create `@asra/interaction-core` package
- [x] Implement `InteractionCore` class (Session Manager)
- [x] Define `decideInteraction` function structure

## 2. Rules Engine
- [x] Implement `decider/rules/` directory structure
- [x] Create `create-element-rules.ts` (Click to create)
- [x] Create `drag-rules.ts` (Drag to resize/move)
- [x] Create `select-rules.ts` (Hit testing)

## 3. System Context
- [x] Create `@asra/system-context`
- [x] Implement state slices: `MouseState`, `KeyState`, `PrimaryToolState`
- [x] Implement `getSystemContextSnapshot()`

## 4. Wiring Handlers
- [x] Register subscriptions in `core`
- [x] Connect `input-system` events to `interaction-core`
- [x] Connect `interaction-core` decisions to `core` APIs
