# Extensible Decision Chain - COMPLETED

## Implementation Summary

Successfully implemented extensible decision chain with fully simplified type system where users have complete control over interaction types.

## Last Commit

`5e9d9d2` - feat: Add extensible workflow and decision chain with layered architecture

## Current Changes (NOT COMMITTED YET)

### Type System Simplification ✅

**Removed Hardcoded Types:**

- ❌ Deleted `InteractionActions` enum/const from `@asyra/utils`
- ✅ Simplified `InteractionEvent` interface to just `{ payload, options }`
- ✅ Created `DecisionResult<T>` interface: `{ type: string, payload? }

**Key Changes:**

1. **Framework Provides Structure Only**:

   - `InteractionEvent<T>` = `{ payload?, options? }` - simple event payload wrapper
   - `DecisionResult<T>` = `{ type: string, payload? }` - decision result from rules
   - No hardcoded interaction action names

2. **App Layer Defines All Types**:

   - Users define interaction type names as string literals in rules
   - Example: `type: 'INTERACTION_CREATE_ELEMENT'`
   - Full control to extend with custom types

3. **Framework Flow**:
   ```
   Input → WorkflowRegistry (L1)
     → InteractionCore.decide() → DecisionResult
     → window.dispatchEvent(CustomEvent)
     → Handlers subscribe and execute
   ```

### Clean Implementation ✅

**Zero `as any` in Production Code:**

- ✅ `packages/interaction-core/src/interaction-core.ts` - CLEAN
- ✅ `packages/interaction-core/src/registry.ts` - CLEAN
- ✅ `packages/core/src/*` - CLEAN
- ❌ `packages/interaction-core/src/handlers/` - DELETED

**Dead Code Removed:**

- Deleted entire `packages/interaction-core/src/handlers/` folder (13 files)
  - These were old-style static handlers not used anymore
  - Had `as any` casts but were DEAD CODE
  - No longer needed with new window.dispatchEvent approach

### App Layer Updates ✅

**Rules Updated:**
All rules in `apps/asyra-design/src/init/rules/` now use string literals:

```typescript
// Before:
type: InteractionActions.INTERACTION_CREATE_ELEMENT

// After:
type: 'INTERACTION_CREATE_ELEMENT'
```

**Files Updated:**

- `create-element-rules.ts`
- `move-rules.ts`
- `panzoom-rules.ts`
- `reset-element-size-rules.ts`
- `resize-element-rules.ts`
- `select-rules.ts`
- `switch-primary-tool-rules.ts`
- `undoredo-rules.ts`
- `zoomfit-rules.ts`

## Architecture

### Layered Architecture (Final)

```
User Input
  ↓
Layer 1: WorkflowRegistry (app layer)
  - `contextUpdate(core, raw)` - updates mouse/key state
  - Calls `coreAPI` (executeAction/startSession/updateSession/endSession)

Layer 2: InteractionCore (framework)
  - `decide()` → returns `DecisionResult { type, payload }`
  - Users define decision logic in app rules
  - `window.dispatchEvent(CustomEvent)` emits decision

Layer 3: Handlers (framework + app)
  - Subscribe to CustomEvents
  - Execute side effects
  - HandlerRegistry allows custom user handlers
```

### User Extensibility

Users can now add ANY custom feature:

```typescript
// 1. Register input event (already possible)
inputSystemRegistry.register('input.draw.polygon.start', combos)

// 2. Register workflow (already possible)
workflowRegistry.register('input.draw.polygon.start', {
  contextUpdate: (core, raw) => core.updateMouseState(raw.pointer),
  coreAPI: 'executeAction',
  APIArgs: () => ['input.draw.polygon.start']
})

// 3. Register decision rule (NOW POSSIBLE - user defines type)
interactionRegistry.register('input.draw.polygon.start', (context) => ({
  type: 'INTERACTION_DRAW_POLYGON', // CUSTOM TYPE!
  payload: { vertices: calculateVertices(context) }
}))

// 4. Register handler (NOW POSSIBLE)
handlerRegistry.register('INTERACTION_DRAW_POLYGON', ({ vertices }) => {
  renderService.drawPolygon(vertices)
})
```

## Build & Test Status

✅ **Build**: All packages build successfully
✅ **Tests**: All 162 tests passing
✅ **Lint**: Clean (no errors)

## Files Changed

### Framework (packages/)

- `utils/` - Simplified types, removed hardcoded enums
- `interaction-core/` - Updated to use DecisionResult, removed dead code
- `core/` - WorkflowRegistry, HandlerRegistry implementation
- `reactive-events/` - DecisionEventRegistry

### App (apps/asyra-design/)

- `src/init/rules/*` - Updated to use string literals
- `src/init/workflows/*` - Created (from previous commit)
- L1-L3 architecture fully operational

## Core Invariant Preserved ✅

Single decision flow maintained:

- All input goes through WorkflowRegistry
- All decisions go through InteractionCore.decide()
- All副作用 executed via subscribe handlers (not direct API calls)
- Framework controls execution flow

## Next

Ready for review and commit (per user: "don't commit and don't push")
