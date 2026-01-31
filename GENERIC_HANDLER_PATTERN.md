# Generic Handler Pattern - Completed

## The BIG Rule

> **User can define ALL they want for a workflow.
> Framework will handle HOW workflow works.**

## Problem

User rejected the big switch statement in `dispatchDecision()` - too much framework knowledge about specific decisions.

## Solution

Generic handler pattern where users define handlers in their DecisionResult.

## Architecture

### Framework (interaction-core.ts)

```typescript
private dispatchDecision(result: DecisionResult | null) {
  if (!result) return

  if (result.handler) {
    result.handler(result.payload, result.options)
  }
}
```

**Framework responsibility**: Call `result.handler(payload, options)` - that's it!

### User Layer (rules)

```typescript
export const decideUndoRedoRules = (
  keySnapshot: KeySnapshot
): DecisionResult => {
  return {
    type: 'INTERACTION_UNDOREDO',
    payload: {
      undoredo: keySnapshot.shift ? UNDO.REDO : UNDO.UNDO
    },
    handler: (payload: any) => decideToUndoRedo(payload.undoredo) // ✅ User provides
  }
}
```

**User responsibility**: Define everything - type, payload, options, AND handler

## DecisionResult Interface

```typescript
export interface DecisionResult<TPayload = unknown> {
  type: string
  payload?: TPayload
  options?: EVENT_OPTIONS
  handler?: (
    payload: TPayload | undefined,
    options: EVENT_OPTIONS | undefined
  ) => void
}
```

## Execution Flow

```
1. User Input
  ↓
2. WorkflowRegistry → contextUpdate → coreAPI
  ↓
3. InteractionCore.decide() → call DecisionHandler (user's behavior)
  ↓
4. User's rule returns: DecisionResult { type, payload, options, handler }
  ↓
5. Framework: dispatchDecision() → result.handler(payload, options)
  ↓
6. Handler calls reactive-events: decideToUndoRedo(undoredo)
  ↓
7. Reactive-events publish → handlers subscribe → execute side effects
```

## Files Updated

### Framework

- **InteractionCore**: Simplified to generic `result.handler()` call
- **Registry**: Added `handler` field to `DecisionResult`

### App Layer (User Defines Everything)

All rules now include handler:

- `undoredo-rules.ts` → handler calls `decideToUndoRedo`
- `zoomfit-rules.ts` → handler calls `decideToZoomFit`
- `switch-primary-tool-rules.ts` → handler calls `decideToSwitchPrimaryTool`
- `select-rules.ts` → handler calls `decideToSelectElements`
- `resize-element-rules.ts` → handler calls `decideToResizeElement`
- `reset-element-size-rules.ts` → handler calls `decideToResetElementSize`
- `panzoom-rules.ts` → handler calls `decideToPanZoom`
- `create-element-rules.ts` → handler calls `decideToCreateElement`
- `move-rules.ts` → handler (TODO: implements reactive-events)

## Benefits

1. **User Defines Everything** - Type, payload, options, handler - all in user code
2. **Framework Handles HOW** - Just calls `result.handler(payload, options)`
3. **Fully Extensible** - User can add custom decisions with custom handlers
4. **No Switch Statement** - No framework knowledge of specific decision types
5. **Uses Reactive-Events** - Handlers call `decideTo*()` publish functions

## Future Extensibility Example

User wants custom feature "draw polygon":

```typescript
export const decideDrawPolygonRules = (
  context: SystemContextSnapshot
): DecisionResult => {
  return {
    type: 'INTERACTION_DRAW_POLYGON', // User defines type
    payload: { vertices: calculateVertices(context) }, // User defines payload
    handler: (payload) => renderService.drawPolygon(payload.vertices) // User defines handler
  }
}
```

Framework doesn't need to know anything about "draw polygon"!

## Status

✅ Build successful
✅ Generic handler pattern implemented
✅ Users define everything, framework handles how
✅ Try the app now!
