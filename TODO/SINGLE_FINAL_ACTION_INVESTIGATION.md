# Investigation: Single Final Action Guarantee

## User's Observation

> "User should be able to define when core receives a input event, then how many situations it should handle. And after each handler, what will be the final decision."

> "This flow in old architecture is used to help user to make sure that `no matter how user manipulate on canvas, it will only has one final user action happened`."

---

## Current Architecture Flow

### The Linear Flow (Single Final Action Guarantee)

```
User Action (Mouse/Keyboard)
        ↓
[1] Input System
        ├─ Listen: browser event listeners
        ├─ Check: inputSystem.registry.getCombinations(event)
        └─ Trigger: inputSystem.on(eventName, rawEvent)
        ↓
[2] Core Subscribe Handler (UNIQUE PER EVENT)
        ├─ Example: RenderHandler._handleDragStart()
        ├─ Updates state: mouseState, keyState
        └─ Calls: interactionCore.startSession('input.drag.start')
        ↓
[3] InteractionCore API
        ├─ Gets systemContextSnapshot
        ├─ Calls: registry.decide(eventName, snapshot, detail)
        └─ Returns: InteractionEvent | null (SINGLE RESULT)
        ↓
[4] InteractionCore Handlers (UNIQUE PER EVENT TYPE)
        ├─ Map: InteractionCoreHandlers[event.type]
        ├─ Executes: handler(payload, options)
        └─ Publishes: DecisionEvent via reactive-events
        ↓
[5] Core Subscribe to DecisionEvent (UNIQUE PER EVENT TYPE)
        └─ Calls: System APIs (factory, sceneTree, etc.)
        ↓
[6] State Update
        └─ Document model updated (YJS/CRDT)
```

### The "How Many Situations" Question

**Answer: ONE handler per event name**

The implementation uses:

```typescript
// InteractionRegistry: Map<string, DecisionHandler>
private handlers = new Map<string, DecisionHandler>()

register(eventName: string, handler: DecisionHandler) {
  this.handlers.set(eventName, handler)  // OVERWRITES, not adds
}
```

**Key Points:**

- Each event name has exactly **ONE** handler
- `Map.set()` overwrites any existing handler
- No multiple handlers for same event
- Guarantees single decision path

---

## Analysis

### What Users Currently Define

**1. Which input events to handle:**

```typescript
// apps/asyra-design/src/init/init-input-system.ts
inputSystem.registry.register('input.drag.start', [...combos])
inputSystem.registry.register('input.drag.update', [...combos])
inputSystem.registry.register('input.shortcut.undo', [...combos])
// ... define mappings
```

**2. Which behaviors to register:**

```typescript
// apps/asyra-design/src/init/init-interactions.ts
core.registerInteraction('input.drag.start', decideDragStartBehavior)
core.registerInteraction('input.drag.update', decideDragUpdateBehavior)
// ... one handler per event
```

**3. Final decision:**

```typescript
// Handler decides and returns SINGLE interaction
const decideDragStartBehavior = (snapshot): InteractionEvent | null => {
  // Returns THE decision
  return {
    type: InteractionActions.INTERACTION_SELECT_ELEMENTS,
    payload: { elementIds: [...] }
  }
}
```

---

## The Single Final Action Guarantee

### How It Works

**Mechanism:** Linear flow with no branching

| Step                             | Component                 | Multiplicity        | Behavior                      |
| -------------------------------- | ------------------------- | ------------------- | ----------------------------- | ----- |
| [1] Input Event → Core Subscribe | `inputSystem.on()`        | 1 handler per event | Only one listener per event   |
| [2] Core → InteractionCore API   | `startSession()` etc.     | 1 API call          | No decision logic in Core     |
| [3] InteractionCore → Registry   | `registry.decide()`       | 1 handler per event | `Map.set()` overwrites        |
| [4] Registry → Result            | `handler()`               | 1 return value      | Returns `Event                | null` |
| [5] Result → Handlers            | `InteractionCoreHandlers` | 1 handler per type  | Unique handler per event type |

### No Parallelism

```
input.drag.start → RenderHandler._handleDragStart
                  → startSession('input.drag.start')
                    → registry.decide('input.drag.start')
                      → decideDragStartBehavior() [returns ONE InteractionEvent]
                        → TransactionHandlers.START_TRANSACTION
                          → Event published
```

**Key:** No branching, no async chains, no concurrent decisions.

### The Guarantee

> "No matter how user manipulates on canvas, it will only has one final user action happened"

**Proof:**

1. Each input event name → ONE subscribe listener in Core
2. Each listener → ONE InteractionCore API call
3. Each API call → ONE registry decision
4. Each decision → ONE interaction event type
5. Each event type → ONE handler execution

**Result:** Linear flow = Single final action.

---

## Question: Does This Need to Change?

### Should Users Define "How Many Situations"?

Current: 1 handler per event (framework enforces)

**Option A: Keep Current (Recommended)**

- ✅ Single responsibility principle
- ✅ Clear, predictable flow
- ✅ Easier to debug
- ✅ Single final action guaranteed
- ✅ Matches current architecture

**Option B: Allow Multiple Handlers per Event**

```typescript
// Hypothetical: NOT current architecture
interactionCore.registry.register('event', handler1)
interactionCore.registry.register('event', handler2)
// Would need: chaining, priority, async handling
```

- ❌ Complexity increases significantly
- ❌ No single final action guarantee (multiple handlers could emit multiple events)
- ❌ Harder to debug
- ❌ Breaks linear flow principle

**Option C: Middleware/Pipeline Pattern**

```typescript
// Hypothetical: NOT current architecture
interactionCore.use([(next) => handler1(), (next) => handler2()])
```

- ❌ Complexity increases
- ❌ No clear final action
- ❌ Requires async handling

### Recommendation: **KEEP CURRENT 1:1 Pattern**

**Reasons:**

1. **Simplicity**: One handler = easy to understand
2. **Predictability**: Linear flow = deterministic behavior
3. **Guarantee**: Single final action is architectural invariant
4. **Extensibility**: Users can still customize via custom handlers
5. **Debugging**: Single path = easier to trace

---

## Real-World Example

### Adding Custom Tool: Circle Tool

**Current approach (1:1 pattern):**

```typescript
// Define custom tool type
export const CustomToolType = {
  ELLIPSE: 'ellipse'
} as const

// apps/asyra-design/src/constants.ts
export const InputSystemEvents = {
  ...DefaultEvents,
  INPUT_DRAG_START: 'input.drag.start',
  // User events still follow 1:1 pattern
  CUSTOM_SHAPE_START: 'custom.shape.start'
} as const

// Register input mappings
inputSystem.registry.register('custom.shape.start', [
  { type: InputType.POINTER, keys: [PointerKey.LEFT_MOUSE_DOWN] }
])

// Register interaction behavior (1:1)
core.registerInteraction('custom.shape.start', (snapshot) => {
  const { primaryTool } = snapshot

  switch (primaryTool) {
    case PrimaryToolType.RECTANGLE:
      return decideFromCreateElementRules(snapshot)
    case CustomToolType.ELLIPSE:
      return decideFromCreateElementRules(snapshot) // Re-use for ellipse
    default:
      return decideFromSelectRules(snapshot)
  }
})
```

**Result:** Still one final action per event, but user has full control over what that action is.

---

## Conclusion

### Current State: ✅ Already Implements User's Requirement

**User asked for:**

1. "Define when core receives a input event" → ✅ Already possible via `inputSystem.on()`
2. "How many situations it should handle" → ✅ 1 situation per event (architectural choice)
3. "After each handler, what will be the final decision" → ✅ Handler returns `Event | null`

**Architecture provides:**

- ✅ Single final action guarantee (linear flow)
- ✅ User control over which events to handle
- ✅ User control over what decisions are made
- ✅ Simple, predictable, debuggable

### Recommendation: DO NOT CHANGE

**Why:**

1. The 1:1 mapping (event name → handler) is intentional
2. It provides the single final action guarantee
3. Complexity reduction is valuable
4. Extensibility is already sufficient (custom handlers)

### What CAN Change (Without Breaking Guarantee):

**NOT THIS:**

```typescript
// ❌ NOT: Multiple handlers per event
registry.register('event', handler1)
registry.register('event', handler2)
```

**THIS (still 1:1, but more flexible handler):**

```typescript
// ✅ YES: More complex logic inside single handler
core.registerInteraction('custom.event', (snapshot) => {
  const { tool, state } = snapshot

  // Complex logic INSIDE single handler
  if (state.dragging) {
    return handleDragging(snapshot)
  }

  if (state.hovering && tool === 'select') {
    return handleHoverSelect(snapshot)
  }

  return handleDefault(snapshot)
})
```

---

## Framework-App Separation for This Requirement

**Framework (Mechanism):**

```typescript
// @asyra/interaction-core
- InputSystemRegistry (mechanism to register events)
- InteractionRegistry (mechanism to register decisions: ONE per event)
- InteractionCore (APIs: executeAction, startSession, etc.)
```

**App (Configuration):**

```typescript
// asyra-design
- WHICH events to handle: inputSystem.registry.register()
- WHAT decisions to make: core.registerInteraction()
- HOW to decide: Write handler function (can be complex)
```

**The Guarantee:**

- App defines WHAT (behavior)
- Framework provides HOW (mechanism: 1 handler per event → single final action)
- Invariant maintained by architecture, not by user code

---

## Final Answer

**Question:** Can we extract rules and deciders to give users more control?

**Answer:** The current architecture ALREADY gives users full control via the 1:1 pattern. Extracting rules as atomic functions (as planned in EXTRACT_RULES_DECIDERS.md) will enable:

1. ✅ Users can write custom handlers
2. ✅ Users can import framework rules as helpers
3. ✅ Users can make ANY decision they want
4. ✅ STILL: One final action per input event

**The linear flow + 1:1 mapping = architectural invariant that ensures single final action.**
