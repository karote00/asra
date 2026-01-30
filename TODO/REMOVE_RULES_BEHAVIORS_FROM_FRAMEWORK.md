# Remove Rules and Behaviors from Framework

## Overview

Move ALL rule and behavior logic from framework to application layer. Framework becomes a pure workflow/orchestration mechanism.

## Current State

```
packages/interaction-core/
├── interaction-core.ts           # Main class, workflow, APIs (KEEP)
├── registry.ts                   # Registry mechanism (KEEP)
├── handlers/                     # Execution logic (KEEP)
├── subscribes.ts                 # Event subscriptions (KEEP)
├── decider/
│   ├── interaction-decider.ts   # Default init (DELETE)
│   ├── behavior/*               # ALL BEHAVIORS (DELETE)
│   │   ├── drag-start-behavior.ts
│   │   ├── drag-update-behavior.ts
│   │   ├── drag-end-behavior.ts
│   │   ├── select-behavior.ts
│   │   ├── panzoom-behavior.ts
│   │   ├── zoomfit-behavior.ts
│   │   ├── undoredo-behavior.ts
│   │   └── switch-primary-tool-behavior.ts
│   └── rules/*                  # ALL RULES (DELETE)
│       ├── select-rules.ts
│       ├── move-rules.ts
│       ├── create-element-rules.ts
│       ├── resize-element-rules.ts
│       ├── panzoom-rules.ts
│       ├── undoredo-rules.ts
│       ├── zoomfit-rules.ts
│       └── switch-primary-tool-rules.ts

App Layer:
├── init-interactions.ts          # Imports behaviors from framework (WILL CHANGE)
```

## Proposed State

```
packages/interaction-core/
├── interaction-core.ts           # ✅ KEEP: Workflow, APIs
├── registry.ts                   # ✅ KEEP: Registration mechanism
├── handlers/                     # ✅ KEEP: Execution logic (event type → action)
├── subscribes.ts                 # ✅ KEEP: Event subscriptions
├── README.md                     # ✅ UPDATE: Document new approach
└── index.ts                      # ✅ UPDATE: Remove behavior/rule exports

Deleted:
├── decider/FOLDER                # ❌ DELETE ENTIRE FOLDER
    ├── behavior/                # All behaviors
    ├── rules/                   # All rules
    └── *.test files              # Framework tests

App Layer:
├── init/
    ├── init-interactions.ts      # ✅ NEW: User-defined behaviors
    ├── behaviors/                # ✅ NEW: User behavior files
    │   ├── drag-start-behavior.ts
    │   ├── drag-update-behavior.ts
    │   ├── drag-end-behavior.ts
    │   └── select-behavior.ts
    └── rules/                    # ✅ NEW: User rule files
        ├── select-rules.ts
        ├── move-rules.ts
        ├── create-element-rules.ts
        └── ...
```

## Naming Question: "Registry" vs Alternatives

### Current: `Registry` ✅

**Pros:**

- Clear meaning: "collection of registered handlers"
- Consistent with existing pattern (`InputSystemRegistry`)
- Dynamic registration at runtime
- Not initialization-specific
- Industry standard (React Registry, Vue Registry)

**Cons:**

- None significant

### Alternatives Considered

| Name         | Pros                                 | Cons                                                      |
| ------------ | ------------------------------------ | --------------------------------------------------------- |
| **registry** | ✅ Clear, dynamic, industry standard | -                                                         |
| **use**      | Short                                | ❌ Too generic, conflicts with patterns                   |
| **hook**     | Short                                | ❌ React-specific, confusion with React hooks             |
| **config**   | Clear                                | ❌ Implies static configuration, not dynamic registration |
| **setup**    | Clear                                | ❌ Initialization-focused, not applicable to runtime      |
| **builder**  | Good                                 | ❌ Implies construction, not registration                 |
| **manager**  | Clear                                | ❌ Implies state management, not registration             |

### Decision: **Keep "Registry"** ✅

**Reason:**

1. Already established pattern (`InputSystemRegistry`)
2. Clear and unambiguous
3. Dynamic registration at runtime (not just init)
4. Industry standard terminology
5. Users understand: "register things to be used"

---

## Implementation Plan

### Phase 1: Copy Behaviors to App (1 hour)

**Action:** Copy framework behavior files to app folder

```bash
mkdir -p apps/asyra-design/src/init/behaviors
mkdir -p apps/asyra-design/src/init/rules

# Copy behaviors
cp packages/interaction-core/src/decider/behavior/*.ts \
   apps/asyra-design/src/init/behaviors/

# Copy rules
cp packages/interaction-core/src/decider/rules/*.ts \
   apps/asyra-design/src/init/rules/
```

**Update imports in copied files:**

```typescript
// apps/asyra-design/src/init/behaviors/drag-start-behavior.ts
// Change:
import {
  InteractionActions,
  InteractionEvent,
  PrimaryToolType
} from '@asyra/utils'
import { decideFromCreateElementRules, decideFromSelectRules } from '../rules'

// From:
import { decideFromCreateElementRules, decideFromSelectRules } from '../rules'
```

### Phase 2: Update App Init (15 min)

**Edit:** `apps/asyra-design/src/init/init-interactions.ts`

```typescript
// Change from framework imports:
import { decideDragStartBehavior, ... } from '@asyra/interaction-core'

// To local imports:
import {
  decideDragStartBehavior,
  decideDragUpdateBehavior,
  decideDragEndBehavior
} from './behaviors'

export const initInteractions = () => {
  // Rest stays the same
}
```

### Phase 3: Delete Framework Rules/Behaviors (5 min)

**Delete folders:**

```bash
rm -rf packages/interaction-core/src/decider/
```

### Phase 4:Update Framework Exports (5 min)

**Edit:** `packages/interaction-core/src/index.ts`

```typescript
// Current:
export { InteractionCore }
export * from './registry'
export * from './decider/behavior' // ❌ DELETE
export default interactionCore

// After:
export { InteractionCore }
export * from './registry'
export default interactionCore // Only keep core mechanism
```

### Phase 5: Update Documentation (30 min)

**Edit:** `packages/interaction-core/README.md`

````markdown
# @asyra/interaction-core

Framework component for interaction orchestration.

## What It Provides

### Core Workflow APIs

- `executeAction()` - Execute single interaction
- `startSession()` - Start interaction session (transaction)
- `updateSession()` - Update interaction session
- `endSession()` - End interaction session (commit transaction)

### Registry Mechanism

- `InteractionRegistry` - Register decision handlers
- `core.registerInteraction()` - App-level registration

### Handlers

- Execution logic for each InteractionEvent type
- Maps events to system API calls

## What It Does NOT Provide (App Layer)

### ❌ Rules and Behaviors

- Application must define its own rules
- Application must define its own behaviors
- See your app's `src/init/behaviors/` and `src/init/rules/` folders

### Example: Define Custom Behavior

```typescript
// apps/asyra-design/src/init/behaviors/custom-behavior.ts
import {
  InteractionEvent,
  InteractionActions,
  SystemContextSnapshot
} from '@asyra/utils'
import { decideFromSelectRules } from '../rules'

export const decideCustomBehavior = (
  snapshot: SystemContextSnapshot
): InteractionEvent | null => {
  const { primaryTool } = snapshot

  switch (primaryTool) {
    case 'select':
      return decideFromSelectRules(snapshot)
    default:
      return null
  }
}
```
````

## Migration Guide

### From v1.0 to v2.0

**Before:**

```typescript
import { decideDragStartBehavior } from '@asyra/interaction-core'
```

**After:**

```typescript
import { decideDragStartBehavior } from './init/behaviors'
```

### Steps to Migrate

1. Copy behaviors from framework to app
2. Copy rules from framework to app
3. Update imports in app
4. Remove framework behavior/rule imports

````

### Phase 6: Tests (30 min)

**Remove framework tests:**
```bash
rm -rf packages/interaction-core/src/decider/__tests__/
````

**Keep handler tests** (they test execution logic, not decider logic):

```
packages/interaction-core/src/handlers/__tests__/
├── element.test.ts
├── panzoom.test.ts
├── primary-tool.test.ts
├── transaction.test.ts
├── undoredo.test.ts
└── zoomfit.test.ts
```

**App-level behavior tests:**

- Copy behavior tests to app
- Update imports
- Run to verify

---

## Benefits

### **Framework Becomes Pure Mechanism**

| Component                       | Status    | Owner     |
| ------------------------------- | --------- | --------- |
| Core workflow (InteractionCore) | ✅ Keep   | Framework |
| Registry mechanism              | ✅ Keep   | Framework |
| Handlers (execution logic)      | ✅ Keep   | Framework |
| Behaviors                       | ❌ Delete | App       |
| Rules                           | ❌ Delete | App       |

### **App Has Full Control**

**Before:**

- App imports pre-built behaviors from framework
- Cannot customize without forking
- Limited to built-in tool types

**After:**

- App owns all behavior logic
- Can customize everything
- Unlimited tool types
- Can define custom rule patterns

### **Framework is Smaller**

```
Before:
packages/interaction-core/
├── 40+ files (behaviors, rules, tests)
├── 2000+ lines of behavior-specific code

After:
packages/interaction-core/
├── 15 files (core, registry, handlers, subscribes)
├── ~800 lines of orchestration code
```

---

## Risks & Mitigations

| Risk                               | Impact | Mitigation                                 |
| ---------------------------------- | ------ | ------------------------------------------ |
| **Breaking Change**                | High   | Document migration guide clearly           |
| **App Must Copy All Behaviors**    | Medium | Provide copy script/template               |
| **Framework Tests Lost**           | Low    | Move behavior tests to app                 |
| **Updates to Framework Behaviors** | Low    | Framework changes won't affect app (good!) |

---

## Estimated Effort

| Phase                     | Files    | Complexity | Time         |
| ------------------------- | -------- | ---------- | ------------ |
| Phase 1: Copy to App      | ~20      | Medium     | 1 hour       |
| Phase 2: Update App Init  | 1        | Low        | 15 min       |
| Phase 3: Delete Framework | 1 folder | Low        | 5 min        |
| Phase 4: Update Exports   | 1        | Low        | 5 min        |
| Phase 5: Documentation    | 1        | Low        | 30 min       |
| Phase 6: Tests            | Migrate  | Medium     | 30 min       |
| **Total**                 | **~25**  | **Medium** | **~3 hours** |

---

## Success Criteria

✅ All rules and behaviors removed from `packages/interaction-core/`  
✅ App owns all behavior rule/logic  
✅ Framework still provides core workflow and registry  
✅ Documentation updated  
✅ App tests pass  
✅ No framework behavior-specific code remains

---

## Next Steps

1. Review this plan
2. Approve naming decision ("registry" confirmed as best choice)
3. Execute phases in order
4. Run full test suite
5. Update documentation

---

## Naming Decision Summary

**Question:** Should we use "registry" or another term?

**Answer:** **Keep "registry"** ✅

**Reasons:**

1. Clear meaning: "collection of registered handlers"
2. Dynamic registration (not just initialization)
3. Consistent with existing pattern
4. Industry standard
5. No better alternative found

**Registry is the perfect term for this pattern.**
