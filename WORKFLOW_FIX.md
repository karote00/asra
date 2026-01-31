# WORKFLOW FIX - Type System Mismatch

## Problem Found

The workflow system was broken due to **type mismatch** between framework and app layer:

### Framework Expected

```typescript
DecisionResult {
  type: string
  payload?: unknown
}
```

### App Returned (WRONG)

```typescript
InteractionEvent {  // ❌ Doesn't match DecisionResult
  type: string
  payload?: unknown
  options?: EVENT_OPTIONS  // This field was being lost!
}
```

### Additional Issues

1. `options` field was lost in `window.dispatchEvent()` - only passed `payload`
2. Behaviors returned `InteractionEvent` but should return `DecisionResult`
3. Rules returned `InteractionEvent` but should return `DecisionResult`

## Fix Applied

### 1. Update DecisionResult (packages/interaction-core/src/registry.ts)

```typescript
export interface DecisionResult<TPayload = unknown> {
  type: string
  payload?: TPayload
  options?: EVENT_OPTIONS // ✅ Added this field
}
```

### 2. Update dispatchDecision (packages/interaction-core/src/interaction-core.ts)

```typescript
private dispatchDecision(result: DecisionResult | null) {
  if (!result) {
    return
  }

  window.dispatchEvent(
    new CustomEvent(result.type, {
      detail: {
        payload: result.payload,
        options: result.options  // ✅ Now passes options
      }
    })
  )
}
```

### 3. Update All Rules (apps/asyra-design/src/init/rules/\*)

```typescript
// Before:
import { InteractionEvent } from '@asyra/utils'
export const decideUndoRedoRules = (): InteractionEvent => // ❌ Wrong type

// After:
import type { DecisionResult } from '@asyra/interaction-core'
export const decideUndoRedoRules = (): DecisionResult => // ✅ Correct type
```

**Files Updated:**

- `undoredo-rules.ts`
- `zoomfit-rules.ts`
- `switch-primary-tool-rules.ts`
- `select-rules.ts`
- `resize-element-rules.ts`
- `reset-element-size-rules.ts`
- `panzoom-rules.ts`
- `move-rules.ts`
- `create-element-rules.ts`

### 4. Update All Behaviors (apps/asyra-design/src/init/behaviors/\*)

```typescript
// Before:
import { InteractionEvent } from '@asyra/utils'
export const decideDragStartBehavior = (): InteractionEvent => // ❌ Wrong type

// After:
import type { DecisionResult } from '@asyra/interaction-core'
export const decideDragStartBehavior = (): DecisionResult => // ✅ Correct type
```

**Files Updated:**

- `drag-start-behavior.ts`
- `drag-update-behavior.ts`
- `drag-end-behavior.ts`
- `panzoom-behavior.ts`
- `switch-primary-tool-behavior.ts`
- `zoomfit-behavior.ts`

### 5. Export DecisionResult from interaction-core

```typescript
export { InteractionCore }
export * from './registry' // ✅ Exports DecisionResult and DecisionHandler
export default interactionCore
```

## Status

✅ Build successful
✅ Type system aligned
✅ Options field preserved
✅ Workflow flow working

## Execution Flow (Now Working)

```
1. User Input
   ↓
2. InputSystemRegistry → emits 'input.drag.start'
   ↓
3. WorkflowRegistry.get('input.drag.start') → dragStartWorkflow
   ↓
4. dragStartWorkflow.contextUpdate() → core.updateMouseState()
   ↓
5. dragStartWorkflow.coreAPI = 'startSession'
   ↓
6. dragStartWorkflow.APIArgs() → ['input.drag.start']
   ↓
7. core.startSession('input.drag.start')
   ↓
8. InteractionCore.decide() → dragStartBehavior()
   ↓
9. decideFromCreateElementRules() → DecisionResult { type, payload, options }
   ↓
10. dispatchDecision() → window.dispatchEvent(type, { payload, options })
   ↓
11. create-element handler subscribes → addRectangle()
```

Ready for review. Try the app now!
