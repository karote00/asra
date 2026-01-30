# Generic Handler Registry & Extensible Core APIs

## Overview

Make subscribe handlers configurable via registry pattern, AND make Core APIs extensible so users can register custom system operations.

## The Complete Flow (User Example)

```
1. User defines input event:
   apps/asyra-design/src/constants.ts
   InputSystemEvents.INPUT_KEY_ESCAPE = 'input.key.escape'

2. User registers input mapping:
   apps/asyra-design/src/init/init-input-system.ts
   inputSystem.registry.register('input.key.escape', [
     { type: InputType.KEYBOARD, keys: [keyMap.keys.Escape] }
   ])

3. User subscribes to event (NEW - Generic Registry):
   apps/asyra-design/src/init/init-subscribe-handlers.ts
   registerInputHandler('input.key.escape', (raw) => {
     core.updateKeyState(raw.modifiers)
     core.executeAction('input.key.escape')
   })

4. User registers custom Core API (NEW - Extensible APIs):
   apps/asyra-design/src/init/init-custom-apis.ts
   core.registerAPI('deleteSelectedElements', () => {
     const selected = core.getSelectedElements()
     sceneTree.removeElements(selected)
   })

5. User registers behavior for escape:
   apps/asyra-design/src/init/behaviors/escape-behavior.ts
   export const decideEscapeBehavior = () => {
     return {
       type: InteractionActions.INTERACTION_DELETE_ELEMENTS,
       payload: {}
     }
   }

6. User registers interaction:
   core.registerInteraction('input.key.escape', decideEscapeBehavior)

7. User registers custom handler for delete event:
   packages/core/src/subscribes/interaction-core/delete.ts (NEW)
   subscribe(InteractionActions.INTERACTION_DELETE_ELEMENTS, () => {
     core.deleteSelectedElements()  // Custom API
   })

8. Flow when user presses Escape:
   Input System → Handler → executeAction('input.key.escape')
     → InteractionCore.decide('input.key.escape')
     → Returns { type: INTERACTION_DELETE_ELEMENTS }
     → Handler executes core.deleteSelectedElements()
     → Elements deleted ✅
```

---

## Architecture Changes

### Before (Hardcoded Framework)

```
Framework (@asyra/core):
├── subscribes/input-system/
│   ├── render.ts           (Hardcoded handlers)
│   ├── undo.ts
│   ├── primary-tool.ts
│   └── viewport.ts
├── APIs (Fixed, unextensible)
│   ├── executeAction()
│   ├── startSession()
│   ├── sceneTreeInit()
│   └── removeElements()    (User can't add custom APIs)
```

### After (Configurable by Users)

```
Framework (@asyra/core):
├── apis/
│   ├── existing-apis.ts    (Keep: pre-built APIs)
│   ├── registry.ts          (NEW: API registry mechanism)
│   └── index.ts             (Export: registerInputHandler, registerAPI)
├── subscribes/input-system/
│   ├── render.ts           (Keep: helper class)
│   ├── undo.ts
│   ├── primary-tool.ts
│   └── viewport.ts
└── subscribes/interaction-core/
    └── delete.ts            (NEW: delete event handler)

App (asyra-design):
├── init/
│   ├── init-input-system.ts   (Define input mappings)
│   ├── init-interactions.ts   (Define behaviors)
│   ├── init-subscribe-handlers.ts (NEW: Register handlers)
│   ├── init-custom-apis.ts    (NEW: Register custom APIs)
│   ├── behaviors/             (User-owned behaviors)
│   └── rules/                 (User-owned rules)
```

---

## Implementation Plan

### Phase 1: Create API Registry (15 min)

**Create:** `packages/core/src/apis/registry.ts`

```typescript
export type CustomAPI = (...args: any[]) => any

export class APIRegistry {
  private apis = new Map<string, CustomAPI>()

  register(name: string, api: CustomAPI) {
    this.apis.set(name, api)
  }

  get(name: string): CustomAPI | undefined {
    return this.apis.get(name)
  }

  has(name: string): boolean {
    return this.apis.has(name)
  }

  // Add API to Core instance
  mountTo(coreInstance: any) {
    for (const [name, api] of this.apis) {
      coreInstance[name] = api
    }
  }
}
```

**Update:** `packages/core/src/core.ts`

```typescript
import { APIRegistry } from './apis/registry'

class Core implements CoreAPIs {
  readonly apiRegistry: APIRegistry

  constructor(private readonly deps: CoreDeps) {
    this.apiRegistry = new APIRegistry()
    this.apiRegistry.mountTo(this)

    // ... rest of constructor
  }

  // New method to register custom APIs
  registerAPI(name: string, api: CustomAPI) {
    this.apiRegistry.register(name, api)
    this[name] = api
  }
}
```

---

### Phase 2: Create Generic Handler Registry (10 min)

**Create:** `packages/core/src/apis/input-handler.ts`

```typescript
import inputSystem from '@asyra/input-system'
import { RawInputEvent } from '@asyra/utils'

export const registerInputHandler = (
  eventName: string,
  handler: (raw: RawInputEvent) => void
) => {
  inputSystem.on(eventName, handler)
}
```

**Export:** `packages/core/src/index.ts`

```typescript
export { Core }
export * from './apis'
export * from './registry'
export default core
```

---

### Phase 3: Create Custom Event Handler (10 min)

**Create:** `packages/core/src/subscribes/interaction-core/delete.ts`

```typescript
import { InteractionActions } from '@asyra/utils'
import { subscribe } from '@asyra/reactive-events'

export const initDeleteHandler = (core: any) => {
  subscribe(InteractionActions.INTERACTION_DELETE_ELEMENTS, () => {
    if (typeof core.deleteSelectedElements === 'function') {
      core.deleteSelectedElements()
    }
  })
}
```

**Update:** `packages/core/src/subscribes/interaction-core/index.ts`

```typescript
import { initDeleteHandler } from './delete'

export { initDeleteHandler }
export * from './transaction'
export * from './element'
export * from './zoomfit'
export * from './primary-tool'
export * from './undoredo'
```

---

### Phase 4: Update Core Constructor (5 min)

**Modify:** `packages/core/src/core.ts`

```typescript
constructor(private readonly deps: CoreDeps) {
  this.apiRegistry = new APIRegistry()
  this.apiRegistry.mountTo(this)

  const requests = createRequests({ ... })
  const apis = createAPIs(requests)

  initAllHandlers(...)
  Object.assign(this, apis as CoreAPIs)

  // Initialize event handlers (NEW)
  initDeleteHandler(this)  // subscribe to delete interaction
}
```

---

### Phase 5: Create App-Level Files (20 min)

**Create:** `apps/asyra-design/src/init/init-subscribe-handlers.ts`

```typescript
import inputSystem from '@asyra/input-system'
import core from '@asyra/core'
import {
  RenderHandler,
  UndoHandler,
  PrimaryToolHandler,
  ViewportHandler
} from '@asyra/core/subscribes/input-system'
import { registerInputHandler } from '@asyra/core'
import { InputSystemEvents } from '../constants'

export const initSubscribeHandlers = () => {
  // Pattern 1: Use pre-built framework handler classes
  new RenderHandler(inputSystem, {
    updateMouseState: core.updateMouseState,
    updateKeyState: core.updateKeyState,
    startSession: core.startSession,
    updateSession: core.updateSession,
    endSession: core.endSession
  }).init()

  new UndoHandler(inputSystem, {
    updateKeyState: core.updateKeyState,
    executeAction: core.executeAction
  }).init()

  new PrimaryToolHandler(inputSystem, {
    executeAction: core.executeAction
  }).init()

  new ViewportHandler(inputSystem, {
    updateMouseState: core.updateMouseState,
    updateKeyState: core.updateKeyState,
    executeAction: core.executeAction
  }).init()

  // Pattern 2: Use generic registry for simple handlers
  registerInputHandler(InputSystemEvents.INPUT_SHORTCUT_ZOOM_PRESET, () => {
    core.executeAction(InputSystemEvents.INPUT_SHORTCUT_ZOOM_PRESET)
  })

  // Pattern 3: Custom handler with custom logic
  registerInputHandler('input.key.escape', (raw) => {
    core.updateKeyState(raw.modifiers)
    core.executeAction('escape.action')
  })
}
```

**Create:** `apps/asyra-design/src/init/init-custom-apis.ts`

```typescript
import core from '@asyra/core'
import sceneTree from '@asyra/scene-tree'

export const initCustomAPIs = () => {
  // Register custom API for deleting selected elements
  core.registerAPI('deleteSelectedElements', () => {
    const selected = core.getSelectedElements()
    if (selected.length > 0) {
      // Remove all selected elements
      selected.forEach((id) => {
        sceneTree.remove(id)
      })
    }
  })

  // Register custom API for duplicating elements
  core.registerAPI('duplicateSelectedElements', () => {
    const selected = core.getSelectedElements()
    if (selected.length > 0) {
      selected.forEach((id) => {
        const element = sceneTree.get(id)
        sceneTree.duplicate(element)
      })
    }
  })
}
```

**Create:** `apps/asyra-design/src/init/behaviors/escape-behavior.ts`

```typescript
import { InteractionEvent, InteractionActions } from '@asyra/utils'

export const decideEscapeBehavior = (): InteractionEvent => {
  return {
    type: InteractionActions.INTERACTION_DELETE_ELEMENTS,
    payload: {}
  }
}
```

**Update:** `apps/asyra-design/src/init/init-interactions.ts`

```typescript
import core from '@asyra/core'
import { decideEscapeBehavior } from './behaviors'
// ... other behavior imports

core.registerInteraction('input.key.escape', () => decideEscapeBehavior())
```

**Update:** `apps/asyra-design/src/init/init-app.ts`

```typescript
import { initInputSystem } from './init-input-system'
import { initInteractions } from './init-interactions'
import { initSubscribeHandlers } from './init-subscribe-handlers' // NEW
import { initCustomAPIs } from './init-custom-apis' // NEW

export const initApp = () => {
  initInputSystem()
  initInteractions()
  initSubscribeHandlers() // NEW
  initCustomAPIs() // NEW
}
```

---

## User Experience Example

### Adding Escape Key to Delete Selection

**Step 1: Define event**

```typescript
// apps/asyra-design/src/constants.ts
export const InputSystemEvents = {
  // ... existing events
  INPUT_KEY_ESCAPE: 'input.key.escape'
} as const
```

**Step 2: Map input**

```typescript
// apps/asyra-design/src/init/init-input-system.ts
inputSystem.registry.register(InputSystemEvents.INPUT_KEY_ESCAPE, [
  { type: InputType.KEYBOARD, keys: [keyMap.keys.Escape] }
])
```

**Step 3: Subscribe handler**

```typescript
// apps/asyra-design/src/init/init-subscribe-handlers.ts
registerInputHandler('input.key.escape', (raw) => {
  core.updateKeyState(raw.modifiers)
  core.executeAction('input.key.escape')
})
```

**Step 4: Register custom API**

```typescript
// apps/asyra-design/src/init/init-custom-apis.ts
core.registerAPI('deleteSelectedElements', () => {
  // Implementation
})
```

**Step 5: Define behavior**

```typescript
// apps/asyra-design/src/init/behaviors/escape-behavior.ts
export const decideEscapeBehavior = () => ({
  type: InteractionActions.INTERACTION_DELETE_ELEMENTS,
  payload: {}
})
```

**Step 6: Register interaction**

```typescript
// apps/asyra-design/src/init/init-interactions.ts
core.registerInteraction('input.key.escape', decideEscapeBehavior)
```

**Result:** Press Escape → Selection deleted! ✅

---

## Benefits

### Framework-App Separation Complete

| Layer                 | Framework Provides                  | App Defines                     |
| --------------------- | ----------------------------------- | ------------------------------- |
| **Input**             | Input detection                     | Input events + mappings         |
| **Subscribes**        | Registry mechanism + helper classes | Which events to handle          |
| **Context Updates**   | update APIs                         | When to update                  |
| **Core APIs**         | Pre-built APIs + registry mechanism | Custom APIs                     |
| **Interaction Logic** | Decision mechanism                  | Behaviors + rules               |
| **Execution**         | Event handlers                      | Custom handlers for event types |

### User Capabilities

✅ **Add any input event** → Define and map  
✅ **Add any handler** → Register via `registerInputHandler()`  
✅ **Add any API** → Register via `core.registerAPI()`  
✅ **Add any behavior** → Custom function with rules  
✅ **Complete control** – from input to action

### Developer Experience

```typescript
// Clean, consistent API naming
inputSystem.registry.register() // Register input mappings
core.registerInteraction() // Register decision handlers
registerInputHandler() // Register event handlers
core.registerAPI() // Register custom APIs

// All 4 registries follow the same pattern
```

---

## Estimated Effort

| Phase                     | Files | Complexity | Time        |
| ------------------------- | ----- | ---------- | ----------- |
| Phase 1: API Registry     | 2     | Low        | 15 min      |
| Phase 2: Handler Registry | 1     | Low        | 10 min      |
| Phase 3: Custom Handler   | 2     | Low        | 10 min      |
| Phase 4: Update Core      | 1     | Low        | 5 min       |
| Phase 5: App Files        | 3     | Medium     | 20 min      |
| **Total**                 | **9** | **Low**    | **~1 hour** |

---

## Success Criteria

✅ Users can register custom handlers for any input event  
✅ Users can register custom Core APIs  
✅ Framework provides registry mechanism  
✅ Framework provides helper classes  
✅ Pattern consistent with InputSystem/InteractionCore  
✅ No hardcoded subscribe handlers in Core  
✅ Build passes

---

## Complete Framework Architecture

After this change + previous rules/behaviors removal:

```
Framework (@asyra/*):              App (asyra-design):
├── input-system/                    ├── constants.ts
│   └── InputSystemRegistry         ├── init/
│   (mechanism)                    │   ├── init-custom-apis.ts    (custom APIs)
├── interaction-core/                │   ├── init-subscribe-handlers.ts (handlers)
│   └── InteractionRegistry          │   ├── init-interactions.ts
│   (mechanism)                    │   ├── behaviors/            (logic)
│   └── handlers/                     │   └── rules/                (logic)
│   (execution logic)
├── core/
│   ├── APIRegistry                │
│   └── registerInputHandler()
│   (mechanisms)
└── reactive-events/
    └── Event bus
    (mechanism)
```

**This completes the framework transformation!**

All user configuration happens in app layer through registries.
