# Implementation Plan: Extract Interaction Registry to Framework

This plan outlines the steps to refactor `@asyra/interaction-core` from a hardcoded decision tree into a dynamic, registry-based framework component. This will allow `@asyra/core` to expose an API for registering custom interactions, moving towards a plugin-based architecture.

## Goals
1.  **Decouple** `InteractionCore` from specific product behaviors (drag/drop, rectangles, etc.).
2.  **Create** generic `InteractionRegistry` to manage decision logic.
3.  **Refactor** existing hardcoded `switch` statements into registered handlers.
4.  **Expose** the registration API via `@asyra/core`.

---

## Phase 1: Framework Foundation (The Registry)

We will build the generic mechanism that allows mapping "Events" to "Decisions".

### Step 1.1: Create `InteractionRegistry`
**Location:** `packages/interaction-core/src/registry.ts` (New File)
**Responsibility:**
- Store a map of `GameEventName -> DecisionHandler`.
- Provide methods `register(eventName, handler)` and `decide(eventName, context)`.
- **Note:** This file must have **ZERO** imports from product-specific files (like `behavior/*`).

### Step 1.2: Integrate Registry into `InteractionCore`
**Location:** `packages/interaction-core/src/interaction-core.ts`
**Change:**
- Add `registry` property to `InteractionCore` class.
- Replace the direct call to `decideInteraction` with `this.registry.decide(...)`.
- Update `executeAction`, `startSession`, `updateSession`, `endSession` to use the registry.

---

## Phase 2: Product Refactoring (The Migration)

We will move the existing product logic into the new registry, proving the system works.

### Step 2.1: Define `initCoreHandlers`
**Location:** `packages/interaction-core/src/decider/index.ts` (Refactor)
**Change:**
- Instead of exporting a single `decideInteraction` function with a giant switch case, export an `initInteractions(registry)` function.
- This function will register all existing behaviors:
    - `InputSystemEvents.INPUT_DRAG_START` -> `decideDragStartBehavior`
    - `InputSystemEvents.INPUT_DRAG_UPDATE` -> `decideDragUpdateBehavior`
    - etc...

### Step 2.2: Update `InteractionCore` Singleton Initialization
**Location:** `packages/interaction-core/src/interaction-core.ts`
**Change:**
- In the default export / instantiation line at the bottom, call `initInteractions(interactionCore.registry)` immediately.
- This ensures the app still works exactly as before, but via the registry.

---

## Phase 3: Public API Exposure (The Framework)

We will allow external consumers (like `asyra-design` or `core`) to register *new* interactions.

### Step 3.1: Expose Registry API in Core
**Location:** `packages/core/src/types/index.ts` & `packages/core/src/core.ts`
**Change:**
- Add `registerInteraction` to `InteractionCoreAPIs` interface.
- Implement `registerInteraction` in `Core` class, proxying to `this.deps.interactionCore.registry.register`.

---

## Verification Plan

### Test 1: Unit Tests
- Verify `InteractionRegistry` correctly stores and retrieves handlers.
- Verify `decide()` returns `null` for unregistered events.
- Verify `decide()` executes the correct handler for registered events.

### Test 2: Regression Check
- Run existing `packages/interaction-core` tests.
- Ensure standard interactions (Draw Rectangle, Select) still work, proving the `initInteractions` migration was successful.

### Test 3: Framework Capability Check
- (Manual or Test) Try to register a *new* dummy interaction via `core.registerInteraction` and verify it triggers when the event is fired.
