# Reactive-Events Integration Fix

## Problem

User didn't like the `window.dispatchEvent()` approach. They had designed the reactive-events system with `DECIDE_TO_XXX` events for final decisions.

## Solution

Use reactive-events `decideTo*` publish functions instead of `window.dispatchEvent()`.

## Changes

### Before (window.dispatchEvent)

```typescript
private dispatchDecision(result: DecisionResult | null) {
  if (!result) return;

  window.dispatchEvent(
    new CustomEvent(result.type, {
      detail: { payload: result.payload, options: result.options }
    })
  )
}
```

### After (reactive-events)

```typescript
import {
  decideToStartTransaction,
  decideToEndTransaction,
  decideToSwitchPrimaryTool,
  decideToCreateElement,
  decideToSelectElements,
  decideToResizeElement,
  decideToEndResizeElement,
  decideToResetElementSize,
  decideToUndoRedo,
  decideToZoomFit,
  decideToPanZoom
} from '@asyra/reactive-events'

private dispatchDecision(result: DecisionResult | null) {
  if (!result) return

  switch (result.type) {
    case 'INTERACTION_CREATE_ELEMENT':
      const ce = result.payload as { position: any; elementType: string }
      decideToCreateElement(ce.position, ce.elementType as any)
      break
    case 'INTERACTION_UNDOREDO':
      const ur = result.payload as { undoredo: any }
      decideToUndoRedo(ur.undoredo)
      break
    // ... all other cases
  }
}
```

## Benefits

1. **Uses existing reactive-events infrastructure**
2. **Follows the DECIDE_TO_XXX event flow design**
3. **No custom window.dispatchEvent**
4. **Maintains consistency with rest of the framework**

## Architecture

```
Input → Workflow → InteractionCore.decide() → DecisionResult
  ↓
dispatchDecision() → decideTo*() publish function
  ↓
Reactive-events event-bus
  ↓
Handlers in packages/core/src/subscribes/interaction-core/ subscribe
  ↓
Execute side effects (addRectangle, etc)
```

The switch statement in dispatchDecision maps decision types to their corresponding `decideTo*` functions from reactive-events.

## Future Extensibility

For custom decision types, users can:

1. Create custom publish functions in their app
2. Register custom handlers
3. The framework provides the mechanism, app provides the specifics
