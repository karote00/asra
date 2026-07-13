# App-Level Event Pattern Standard

**Status:** Implemented (switchPrimaryTool feature) ✅
**Standard Date:** February 2, 2026

---

## Overview

This standard defines how to move interaction decision events from framework layer to application layer while maintaining clean architecture and avoiding conflicts.

### Core Principle

**"User defines WHAT, Framework handles HOW"**

- Framework provides infrastructure tools
- App layer defines events, workflows, behaviors
- App subscribers use `core.deps.*` to execute actions

---

## The Pattern

### 1. User-Defined Events (App Layer)

**Location:** `apps/asyra-design/src/init/events/`

```typescript
import { eventRegistry } from '@asyra/reactive-events'
import type { PrimaryToolType } from '@asyra/utils'

// Register event using eventRegistry
const switchPrimaryToolEvent = eventRegistry.register(
  'decideToSwitchPrimaryTool'
)

// Export publish function (for rules/decision handlers)
export const decideToSwitchPrimaryTool = (primaryTool: PrimaryToolType) => {
  switchPrimaryToolEvent.publish({ primaryTool })
}

// Export subscribe function (for subscribers)
export const subscribeToDecideToSwitchPrimaryTool =
  switchPrimaryToolEvent.subscribe
```

### 2. Rule Publishes Event (App Layer)

**Location:** `apps/asyra-design/src/init/rules/switch-primary-tool-rules.ts`

```typescript
import { decideToSwitchPrimaryTool } from '../events/interaction'

export const decideFromSwitchPrimaryToolRules = (
  detail?: DetailType
): DecisionResult => {
  return {
    type: 'INTERACTION_SWITCH_PRIMARY_TOOL',
    payload: {
      primaryTool: detail?.primaryTool
    },
    handler: (payload: any) => decideToSwitchPrimaryTool(payload.primaryTool)
  }
}
```

### 3. Subscriber Listens to Event (App Layer)

**Location:** `apps/asyra-design/src/init/subscribers/primary-tool.ts`

```typescript
import { subscribeToDecideToSwitchPrimaryTool } from '../events/interaction'
import core from '@asyra/core'

export const initPrimaryToolSubscribers = () => {
  subscribeToDecideToSwitchPrimaryTool((payload: any) => {
    // Call framework API using core.deps
    core.deps.systemContext.switchPrimaryTool(payload as PrimaryToolType)
  })
}
```

### 4. InitApp Subscribes All (App Entry Point)

**Location:** `apps/asyra-design/src/init/init-app.ts`

```typescript
import {
  initPrimaryToolSubscribers
  // ... other subscribers
} from './subscribers'

export const initApp = () => {
  // ... initialization
  initPrimaryToolSubscribers()
}
```

---

## Framework Responsibilities

### What Framework Provides:

1. **@asyra/reactive-events**
   - `eventRegistry` - Infrastructure for user-defined events
   - Session events: `executeAction`, `startSession`, `updateSession`, `endSession`
   - System events: transaction (startTransaction, endTransaction)

2. **@asyra/core**
   - `core.deps.systemContext`
   - `core.deps.select`
   - `core.deps.factory`
   - `core.deps.render`
   - `core.deps.sceneTree`
   - All framework APIs needed by app layer

### What Framework Does NOT Provide:

- **NO** interaction decision events (decideToSwitchPrimaryTool, decideToCreateElement, etc.)
- **NO** interaction decision subscribes (subscribeToDecideToSwitchPrimaryTool, etc.)

---

## Step-by-Step Refactoring Process

### Prerequisites

❌ **Comment out in framework** (Do NOT do):

- Don't delete or comment framework events in `packages/reactive-events/src/interaction-core/subscribes.ts`
- This breaks framework infrastructure

### Steps:

#### Step 1: Create User-Defined Event

**File:** `apps/asyra-design/src/init/events/interaction/index.ts`

```typescript
import { eventRegistry } from '@asyra/reactive-events'
import type { PrimaryToolType } from '@asyra/utils'

const switchPrimaryToolEvent = eventRegistry.register(
  'decideToSwitchPrimaryTool'
)

export const decideToSwitchPrimaryTool = (primaryTool: PrimaryToolType) => {
  switchPrimaryToolEvent.publish({ primaryTool })
}

export const subscribeToDecideToSwitchPrimaryTool =
  switchPrimaryToolEvent.subscribe
```

#### Step 2: Update Rule to Publish Event

**File:** `apps/asyra-design/src/init/rules/switch-primary-tool-rules.ts`

```typescript
import { decideToSwitchPrimaryTool } from '../events/interaction'

// Rule handler publishes to user-defined event
export const decideFromSwitchPrimaryToolRules = (
  detail?: DetailType
): DecisionResult => {
  return {
    type: 'INTERACTION_SWITCH_PRIMARY_TOOL',
    payload: { primaryTool: detail?.primaryTool },
    handler: (payload: any) => decideToSwitchPrimaryTool(payload.primaryTool)
  }
}
```

#### Step 3: Create App-Level Subscriber

**File:** `apps/asyra-design/src/init/subscribers/primary-tool.ts`

```typescript
import { subscribeToDecideToSwitchPrimaryTool } from '../events/interaction'
import core from '@asyra/core'

export const initPrimaryToolSubscribers = () => {
  subscribeToDecideToSwitchPrimaryTool((payload: any) => {
    core.deps.systemContext.switchPrimaryTool(payload as PrimaryToolType)
  })
}
```

#### Step 4: Initialize Subscriber

**File:** `apps/asyra-design/src/init/init-app.ts`

```typescript
import { initPrimaryToolSubscribers } from './subscribers'

export const initApp = () => {
  // ... other init
  initPrimaryToolSubscribers()
}
```

#### Step 5: Update Providers (If Needed)

Check if any providers subscribe to old framework events and update to new app events:

**Before:**

```typescript
import { subscribeToSwitchPrimaryTool } from '@asyra/reactive-events'
```

**After:**

```typescript
import { subscribeToDecideToSwitchPrimaryTool } from '@asyra/design/src/init/events'
```

---

## Event Naming Convention

### Framework Events (Infrastructure)

Pattern: **Verb** or **Verb-Noun**

Examples:

- `/.*to.*/` - Action events: `startTransaction`, `endTransaction`, `executeAction`
- `/Session.*/` - Session management events: `startSession`, `updateSession`, `endSession`

### User-Defined Events (Decisions)

Pattern: **decideTo** + **Action**

Examples:

- `decideToSwitchPrimaryTool`
- `decideToCreateElement`
- `decideToSelectElements`

---

## Complete Flow

```
User Action → Input Event
    ↓
Workflow (app/init/workflows/)
    ↓
Rule (app/init/rules/)
    → Returns DecisionResult with handler
    ↓
Handler → publish(decideToSwitchPrimaryTool) → Event (eventRegistry)
    ↓
Subscriber (app/init/subscribers/) → Listen and execute
    → core.deps.systemContext.switchPrimaryTool()
    ↓
Framework API executes
```

---

## File Organization

```
apps/asyra-design/src/init/
├── events/
│   └── interaction/          # User-defined decision events
│       └── index.ts
├── rules/                    # Decision rules
│   └── switch-primary-tool-rules.ts
├── subscribers/              # Event → Behavior forwarding
│   └── primary-tool.ts
└── init-app.ts              # Initialize all subscribers
```

---

## Verification

1. ✅ Import from app events (not framework):

   ```typescript
   import { decideToSwitchPrimaryTool } from '../events/interaction'
   ```

2. ✅ Subscribe in app layer (not framework):

   ```typescript
   import { subscribeToDecideToSwitchPrimaryTool } from '../events/interaction'
   ```

3. ✅ Use core.deps in subscribers:

   ```typescript
   core.deps.systemContext.switchPrimaryTool(...)
   ```

4. ✅ Initialize subscribers in initApp:

   ```typescript
   initPrimaryToolSubscribers()
   ```

5. ✅ No framework event exports for this interaction:
   - NOT in `packages/reactive-events/src/interaction-core/subscribes.ts`
   - NOT in `packages/core/src/subscribes/interaction-core/primary-tool.ts`

---

## Migration Checklist

For each interaction event to extract:

- [ ] Create user-defined event in `apps/asyra-design/src/init/events/`
- [ ] Update rule to publish new event
- [ ] Create app-level subscriber using `core.deps.*`
- [ ] Initialize subscriber in `initApp`
- [ ] Update providers if they subscribe to old events
- [ ] Update imports in all affected files
- [ ] Run tests to verify
- [ ] Remove old framework comments once all migrations complete

---

## Events Needing Migration

Based on current framework events:

### Interaction-Core Events (Priority 1)

- [x] decideToSwitchPrimaryTool ✅ **COMPLETED**
- [ ] decideToCreateElement
- [ ] decideToSelectElements
- [ ] decideToResizeElement
- [ ] decideToEndResizeElement
- [ ] decideToResetElementSize
- [ ] decideToUndoRedo
- [ ] decideToZoomFit
- [ ] decideToPanZoom

### System-Context Events (Priority 2)

- [ ] SwitchPrimaryTool (ui event)
- [ ] EmitSwitchPrimaryTool (ui event)

These are UI emission events, may not need migration depending on architecture.

---

## Anti-Patterns

❌ **DO NOT:**

1. Comment out framework exports in `packages/reactive-events/src/interaction-core/subscribes.ts`
   - This breaks framework infrastructure

2. Import old framework events in app layer:

   ```typescript
   // Bad
   import { subscribeToDecideToSwitchPrimaryTool } from '@asyra/reactive-events'
   ```

3. Call framework APIs directly in rules:
   ```typescript
   // Bad
   export const switchPrimaryToolRules = () => {
     core.deps.systemContext.switchPrimaryTool(...) // Rules should only decide
   }
   ```

✅ **DO:**

1. Define events in app layer using `eventRegistry`
2. Publish events in rules
3. Subscribe to events in app subscribers
4. Call `core.deps.*` in subscribers
5. Import from app event files

---

## Benefits of This Standard

1. **No Event Conflicts**
   - User-defined events via `eventRegistry` won't conflict with framework events
   - Clear namespace: framework infrastructure vs app behavior

2. **Singular Source of Truth**
   - All interaction logic in app layer
   - Framework remains clean infrastructure

3. **Extensibility**
   - Users can create custom events without touching framework
   - Framework provides tools, users provide patterns

4. **Type Safety**
   - Compile-time type information for events
   - No "magic strings" for event names

---

## References

- **Architecture:** `docs/ai/project/ARCHITECTURE.md`
- **Workflow:** `docs/ai/project/WORKFLOW.md`
- **Core Principle:** "User defines WHAT, Framework handles HOW" - `docs/ai/project/AI_ESSENTIALS.md`

---

**Last Updated:** February 2, 2026
**Standard By:** Asa Tsai & AI Assistant
