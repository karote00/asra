# Implementation Plan

## Overview

This plan details how to implement the Feature System with priority-based session coordination. The implementation will be done in phases to allow incremental adoption while maintaining backward compatibility.

## Package Access Guidelines

After introducing the feature-system, packages can be accessed through two patterns:

### Hybrid Approach (Recommended)

The hybrid approach balances flexibility with best practices:

**Feature-System Access (for business logic)**

```typescript
// Use ONLY inside defineFeature() for complex logic
defineFeature('createRectangle', ({ packages }) => ({
  api: {
    create: (position) => {
      packages.factory.startTransaction()
      const id = packages.sceneTree.addRectangle({ position })
      packages.factory.endTransaction()
      return id
    }
  },
  define: () => {
    session('input.drag', ...)
  }
}))
```

**Direct Access (for simple UI/view logic)**

```typescript
// Allow direct package access for simple UI operations
import { selection, sceneTree } from './contexts'

export const SelectedCount = () => {
  // Simple data read for display - OK to access directly
  return <div>{selection.selectedElements.length} selected</div>
}
```

**UI Components Use Feature APIs**

```typescript
// UI components trigger features, don't implement logic
export const CreateButton = () => {
  const createFeature = importFeature('createRectangle')
  return <button onClick={() => createFeature.api.create(...)}>
    Create Rectangle
  </button>
}
```

### When to Use Each Pattern

| Use Case                          | Pattern        | Example                          |
| --------------------------------- | -------------- | -------------------------------- |
| Business logic/complex operations | Feature-System | Create, move, delete elements    |
| Transaction handling              | Feature-System | Undo/redo, multi-step operations |
| Session coordination              | Feature-System | Drag, resize interactions        |
| Feature composition               | Feature-System | Reuse other features             |
| Simple data read                  | Direct Access  | Get element count, names         |
| Display-only UI                   | Direct Access  | Show selection state             |
| One-off UI interactions           | Direct Access  | Simple button handlers           |

### Benefits of Hybrid Approach

1. **Gradual Migration** - Not everything needs to be a feature immediately
2. **Clear Separation** - Complex logic in features, simple UI direct
3. **Flexibility** - Teams can adopt at their own pace
4. **Best Practices** - Guidance on when to use each pattern

### Migration Strategy

- **Phase 1**: All core interactions → Feature-system
- **Phase 2**: Existing features → Migrate gradually
- **Phase 3**: New features → Feature-system first
- **Phase 4**: Simple UI → Decide case-by-case

### Note on Turbo Dependencies

The `@asyra/feature-system` package should declare its dependencies in `package.json`. The `scripts/gen-turbo.js` script will automatically generate the `turbo.json` build configuration based on these dependencies. No manual turbo.json updates are needed.

## Package Structure

```
@asyra/feature-system/  (NEW PACKAGE)
├── src/
│   ├── types/
│   │   ├── feature.ts              # FeatureDefinition, FeatureBuilder types
│   │   ├── session.ts              # SessionManager types, SessionConfig
│   │   └── registry.ts             # FeatureRegistry types
│   ├── core/
│   │   ├── feature.ts              # defineFeature() implementation
│   │   ├── session-manager.ts      # Priority-based session coordination
│   │   └── feature-registry.ts     # Feature registration and lookup
│   ├── builders/
│   │   ├── feature-builder.ts      # FeatureBuilder implementation
│   │   ├── event-builder.ts        # Auto-wiring events
│   │   └── key-builder.ts          # Key combination registration
│   ├── utils/
│   │   ├── micro-features.ts       # withTransaction, withSelection, etc.
│   │   └── templates.ts            # Pre-built feature templates
│   └── index.ts                    # Public exports
├── __tests__/
│   ├── feature-system.test.ts
│   ├── session-manager.test.ts
│   ├── feature-registry.test.ts
│   └── integration/
│       └── multi-feature-scenarios.test.ts
└── package.json

apps/asyra-design/
├── src/features/                    # NEW DIRECTORY (app-level features)
│   ├── transaction/
│   │   ├── index.ts
│   │   └── types.ts
│   ├── selection/
│   │   ├── index.ts
│   │   └── types.ts
│   ├── rectangle-tool/
│   │   └── index.ts
│   └── index.ts                     # Register all features
├── src/init/
│   ├── legacy/                      # OLD structure (kept during migration)
│   └── index.ts                     # Will call both old and new
```

---

## Phase 1: Core Feature System (Foundation)

### 1.1 Feature Type Definitions

**File:** `packages/feature-system/src/types/feature.ts`

```typescript
// Feature definition interface
export interface FeatureDefinition<API = Record<string, any>> {
  name: string
  api?: API
  define: (builder: FeatureBuilder) => void
  metadata?: {
    version?: string
    description?: string
    author?: string
  }
}

// API that features expose to other features
export type FeatureAPI<T = Record<string, any>> = T

// Builder provided to feature definitions
export interface FeatureBuilder {
  // Package access
  packages: {
    factory: Factory
    sceneTree: SceneTree
    selection: Selection
    render: Render
    props: Props
    systemContext: SystemContext
    viewport: Viewport
  }

  // Event operations
  events: {
    register: (name: string) => EventRegistration
    emit: (name: string, payload?: unknown, options?: unknown) => void
    subscribe: (name: string, handler: EventHandler) => Subscription
  }

  // Key combination registration
  keys: (combos: KeyCombo[]) => void

  // Interaction handler registration
  handle: (eventName: string, handler: InteractionHandler) => void

  // Event subscriber (auto-wiring)
  on: (eventName: string, handler: EventHandler) => void

  // Import other features' APIs
  importFeature: (featureName: string) => FeatureAPI

  // Session builder
  session: {
    start: <T>(
      sessionName: string,
      config?: SessionConfig,
      onStart?: SessionStartHandler<T>,
      onUpdate?: SessionUpdateHandler<T>,
      onEnd?: SessionEndHandler<T>
    ) => void
  }
}

// Supporting types
export interface KeyCombo {
  keys: string
  type?: string
  meta?: any
}

export interface InteractionHandler {
  (snapshot: SystemContextSnapshot): DecisionResult
}

export interface DecisionResult {
  event?: string
  payload?: unknown
  handler?: EventHandler
}

export type EventHandler = (payload: unknown, options?: unknown) => void
```

### 1.2 Session Type Definitions

**File:** `packages/feature-system/src/types/session.ts`

```typescript
// Session configuration
export interface SessionConfig {
  priority?: number // Higher = runs first (default: 0)
  exclusive?: boolean // Stop lower priority features (default: true)
  name?: string // Optional name for debugging
}

// Session state (per-feature)
export type SessionState = Record<string, unknown>

// Active session tracking
export interface ActiveSession {
  name: string
  participants: SessionParticipant[]
  startTime: number
  states: Map<string, SessionState>
}

// Feature participating in session
export interface SessionParticipant {
  featureName: string
  priority: number
  exclusive: boolean
  handler: SessionHandler
  state: SessionState | null
}

// Lifecycle handlers
export type SessionStartHandler<T = SessionState> = (
  snapshot: SystemContextSnapshot
) => T | null

export type SessionUpdateHandler<T = SessionState> = (
  snapshot: SystemContextSnapshot,
  state: T
) => void

export type SessionEndHandler<T = SessionState> = (
  snapshot: SystemContextSnapshot,
  state: T
) => void

// Combined session handler
export interface SessionHandler<T = SessionState> {
  onStart?: SessionStartHandler<T>
  onUpdate?: SessionUpdateHandler<T>
  onEnd?: SessionEndHandler<T>
}
```

### 1.3 defineFeature() Implementation

**File:** `packages/feature-system/src/core/feature.ts`

```typescript
import { FeatureDefinition, FeatureBuilder } from '../types/feature'
import { FeatureRegistry } from './feature-registry'
import { SessionManager } from './session-manager'
import { createFeatureBuilder } from '../builders/feature-builder'

const featureRegistry = new FeatureRegistry()
const sessionManager = new SessionManager()

/**
 * Define a new feature
 * @param name - Unique feature name
 * @param definition - Feature definition with api and setup
 * @returns Feature with public API
 */
export function defineFeature<API>(
  name: string,
  definition: FeatureDefinition<API>
): { api: FeatureAPI<API> } {
  const builder = createFeatureBuilder({
    name,
    packages: /* injected from core */,
    events: /* eventRegistry wrapped */,
    sessionManager,
    featureRegistry
  })

  // Execute feature's define block
  definition.define(builder)

  // Register feature
  featureRegistry.register(name, definition)

  // Return public API wrapper
  return {
    api: definition.api as FeatureAPI<API>
  }
}

/**
 * Import a feature's API
 * @param featureName - Name of feature to import
 * @returns Feature's public API
 */
export function importFeature(featureName: string): FeatureAPI {
  return featureRegistry.getAPI(featureName)
}

/**
 * Register a feature (for initialization)
 * @param feature - Feature from defineFeature()
 */
export function registerFeature(feature: { api: FeatureAPI }): void {
  // Feature already registered by defineFeature()
  // This is for explicit initialization order control
}

export { featureRegistry, sessionManager }
```

### 1.4 Session Manager Implementation (Priority-Based)

**File:** `packages/feature-system/src/core/session-manager.ts`

```typescript
import {
  SessionConfig,
  ActiveSession,
  SessionParticipant,
  SessionState
} from '../types/session'
import { SystemContextSnapshot } from '@asyra/utils'

export class SessionManager {
  private activeSessions = new Map<string, ActiveSession>()
  private sessionHandlers = new Map<string, SessionParticipant[]>()

  /**
   * Register a session handler for a feature
   */
  registerSession(
    sessionName: string,
    featureName: string,
    config: SessionConfig,
    handler: any
  ): void {
    const participant: SessionParticipant = {
      featureName,
      priority: config.priority ?? 0,
      exclusive: config.exclusive ?? true,
      handler,
      state: null
    }

    if (!this.sessionHandlers.has(sessionName)) {
      this.sessionHandlers.set(sessionName, [])
    }

    const handlers = this.sessionHandlers.get(sessionName)!
    handlers.push(participant)

    // Sort by priority (descending) - higher priority first
    handlers.sort((a, b) => b.priority - a.priority)
  }

  /**
   * Handle session start (priority-based selection)
   */
  async handleStart(
    sessionName: string,
    snapshot: SystemContextSnapshot
  ): Promise<boolean> {
    const handlers = this.sessionHandlers.get(sessionName)
    if (!handlers || handlers.length === 0) return false

    // Priority-ordered: check features from highest to lowest priority
    const participants: SessionParticipant[] = []
    let exclusiveFound = false

    for (const participant of handlers) {
      // Skip if previous exclusive feature stopped us
      if (exclusiveFound) break

      // Call onStart handler
      const state = await participant.handler.onStart?.(snapshot)

      if (state !== null && state !== undefined) {
        // Feature participates
        participants.push({
          ...participant,
          state
        })

        // If exclusive, stop checking lower priorities
        if (participant.exclusive) {
          exclusiveFound = true
        }
      }
    }

    if (participants.length === 0) {
      return false // No participants
    }

    // Create active session
    const activeSession: ActiveSession = {
      name: sessionName,
      participants,
      startTime: Date.now(),
      states: new Map()
    }

    participants.forEach((p) => {
      activeSession.states.set(p.featureName, p.state!)
    })

    this.activeSessions.set(sessionName, activeSession)
    return true
  }

  /**
   * Handle session update (only for participants)
   */
  async handleUpdate(
    sessionName: string,
    snapshot: SystemContextSnapshot
  ): Promise<void> {
    const session = this.activeSessions.get(sessionName)
    if (!session) return

    // Call onUpdate for all participants (original priority order)
    for (const participant of session.participants) {
      await participant.handler.onUpdate?.(
        snapshot,
        session.states.get(participant.name)!
      )
    }
  }

  /**
   * Handle session end (only for participants)
   */
  async handleEnd(
    sessionName: string,
    snapshot: SystemContextSnapshot
  ): Promise<void> {
    const session = this.activeSessions.get(sessionName)
    if (!session) return

    // Call onEnd for all participants
    for (const participant of session.participants) {
      await participant.handler.onEnd?.(
        snapshot,
        session.states.get(participant.name)!
      )
    }

    // Clear session
    this.activeSessions.delete(sessionName)
  }

  /**
   * Get active session (for debugging)
   */
  getActiveSession(sessionName: string): ActiveSession | undefined {
    return this.activeSessions.get(sessionName)
  }

  /**
   * Clear all sessions (for cleanup)
   */
  clearAll(): void {
    this.activeSessions.clear()
  }
}
```

### 1.5 Feature Builder Implementation

**File:** `packages/feature-system/src/builders/feature-builder.ts`

```typescript
import { FeatureBuilder } from '../types/feature'
import eventRegistry from '@asyra/reactive-events'

export function createFeatureBuilder(context: {
  name: string
  packages: any
  sessionManager: any
  featureRegistry: any
}): FeatureBuilder {
  const { name, packages, sessionManager, featureRegistry } = context

  return {
    packages,

    events: {
      register: (eventName: string) => eventRegistry.register(eventName),
      emit: (eventName: string, payload?: unknown, options?: unknown) => {
        eventRegistry.register(eventName).publish(payload, options)
      },
      subscribe: (eventName: string, handler: (payload, options) => void) => {
        return eventRegistry.register(eventName).subscribe(handler)
      }
    },

    keys: (combos) => {
      // Register key combinations with input-system
      combos.forEach((combo) => {
        // Integration with input-system
        inputSystem.setCombination(combo.keys, combo)
      })
    },

    handle: (eventName: string, handler) => {
      // Register interaction handler with core interaction-core
      core.registerInteraction(eventName, handler)
    },

    on: (eventName: string, handler) => {
      // Auto-wiring: subscribe to event
      eventRegistry.register(eventName).subscribe(handler)
    },

    importFeature: (featureName: string) => {
      return featureRegistry.getAPI(featureName)
    },

    session: {
      start: <T>(
        sessionName: string,
        config: SessionConfig | undefined,
        onStart?: SessionStartHandler<T>,
        onUpdate?: SessionUpdateHandler<T>,
        onEnd?: SessionEndHandler<T>
      ) => {
        // Register session handler
        sessionManager.registerSession(sessionName, name, config || {}, {
          onStart,
          onUpdate,
          onEnd
        })
      }
    }
  }
}
```

---

## Phase 2: Integration with Core

### 2.1 Core Integration

**File:** `packages/core/src/feature-integration.ts` (NEW)

```typescript
import { sessionManager, featureRegistry } from '@asyra/feature-system'
import core from './core'

/**
 * Integrate feature-system with core
 */
export function initFeatureSystem() {
  // Connect session manager to input-system events

  // Track input.drag.start
  core.deps.inputSystem.on('input.drag.start', async (raw) => {
    const snapshot = core.deps.systemContext.getSystemContextSnapshot()
    await sessionManager.handleStart('input.drag', snapshot)
  })

  // Track input.drag.update
  core.deps.inputSystem.on('input.drag.update', async (raw) => {
    const snapshot = core.deps.systemContext.getSystemContextSnapshot()
    await sessionManager.handleUpdate('input.drag', snapshot)
  })

  // Track input.drag.end
  core.deps.inputSystem.on('input.drag.end', async (raw) => {
    const snapshot = core.deps.systemContext.getSystemContextSnapshot()
    await sessionManager.handleEnd('input.drag', snapshot)
  })

  // TODO: Add other session types (click, hover, scroll, etc.)
}
```

### 2.2 Package Dependencies

**File:** `packages/feature-system/package.json`

```json
{
  "name": "@asyra/feature-system",
  "version": "0.1.0",
  "dependencies": {
    "@asyra/reactive-events": "workspace:*",
    "@asyra/utils": "workspace:*",
    "@asyra/core": "workspace:*",
    "@asyra/input-system": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
```

---

## Phase 3: Micro-Feature Utilities

### 3.1 withTransaction Utility

**File:** `packages/feature-system/src/utils/micro-features.ts`

```typescript
import type { FeatureBuilder } from '../types/feature'

/**
 * Wrap callback in transaction
 * Usage in feature: on('delete', () => withTransaction(() => packages.sceneTree.delete(...)))
 */
export const withTransaction = (packages: any) => {
  return <T>(callback: () => T): T => {
    packages.factory.startTransaction()
    try {
      return callback()
    } finally {
      packages.factory.endTransaction()
    }
  }
}

/**
 * Wrap callback with selection context
 */
export const withSelection = (packages: any) => {
  return <T>(selectionIds: string[], callback: (ids: string[]) => T): T => {
    const previous = packages.selection.getElementSelectionIds()
    packages.selection.selectElements(selectionIds)
    try {
      return callback(selectionIds)
    } finally {
      packages.selection.selectElements(previous)
    }
  }
}

/**
 * Execute with undo/redo tracking
 */
export const withUndoRedo = (packages: any) => {
  return <T>(actionName: string, callback: () => T): T => {
    return callback() // Already wrapped in transaction
  }
}
```

---

## Phase 4: Template System

### 4.1 Pre-built Templates

**File:** `packages/feature-system/src/utils/templates.ts`

```typescript
/**
 * Template for tool-based interactions (drag to create/select)
 */
export const toolTemplate = <API, State>(
  config: {
    name: string
    keys?: string
    session: 'input.drag' | 'input.hover' | 'input.click'
    priority?: number
  },
  implementation: {
    api: API
    onStart: (snapshot: SystemContextSnapshot) => State | null
    onUpdate?: (snapshot: SystemContextSnapshot, state: State) => void
    onEnd?: (snapshot: SystemContextSnapshot, state: State) => void
  }
) => {
  return defineFeature(config.name, ({ packages, session, keys }) => ({
    api: implementation.api,
    define: () => {
      if (config.keys) {
        keys([{ keys: config.keys, type: 'switchTool' }])
      }

      session.start(
        config.session,
        { priority: config.priority },
        implementation.onStart,
        implementation.onUpdate,
        implementation.onEnd
      )
    }
  }))
}

/**
 * Template for keyboard shortcuts
 */
export const shortcutTemplate = (config: {
  name: string
  keys: string
  action: () => void
}) => {
  return defineFeature(config.name, ({ keys, handle }) => ({
    api: {},
    define: () => {
      keys([{ keys: config.keys }])
      handle('input.shortcut', () => ({
        event: `${config.name}.execute`,
        handler: config.action
      }))
    }
  }))
}

/**
 * Template for transaction-wrapped actions
 */
export const transactionalTemplate = <API>(config: {
  name: string
  shortcut?: string
  action: (...args: any[]) => void
  api?: API
}) => {
  return defineFeature(config.name, ({ packages, keys, handle }) => ({
    api: config.api || {},
    define: () => {
      if (config.shortcut) {
        keys([{ keys: config.shortcut }])
      }

      handle(`${config.name}.trigger`, () => {
        packages.factory.startTransaction()
        config.action()
        packages.factory.endTransaction()
      })
    }
  }))
}
```

---

## Phase 5: Migration Guide

### 5.1 Existing Feature Migration Example

**Before (Current):**

```
init/workflows/selection.ts (10 lines)
init/behaviors/select-behavior.ts (15 lines)
init/rules/select-rules.ts (22 lines)
init/events/interaction/index.ts (add 10 lines)
init/subscribers/select-elements.ts (14 lines)
init/apis/selection.ts (16 lines)
```

**After (New):**

```
features/selection/index.ts (35 lines)
```

**Migration Steps:**

1. Create `features/selection/index.ts`
2. Combine logic from behaviors + rules → `define()` block
3. Move APIs → `api` block
4. Move subscribers → `on()` calls
5. Remove old files
6. Update `init/index.ts` to register feature

### 5.2 Coexistence Period

**During migration, support both:**

```typescript
// apps/asyra-design/src/init/index.ts

export const initApp = () => {
  // Legacy initialization (keep working during migration)
  initInputSystem()
  initWorkflows() // Old workflow system
  initInteractions() // Old interaction handlers
  initSubscribers() // Old subscribers

  // New feature system (gradual migration)
  core.initEventHandlers() // Integrates session manager
  registerTransactionFeature()
  registerSelectionFeature()
  // Add features one by one as migrated
}
```

### 5.3 Migration Checklist

- [ ] Create `@asyra/feature-system` package
- [ ] Implement core: defineFeature, FeatureRegistry, SessionManager
- [ ] Create template library
- [ ] Create micro-feature utilities
- [ ] Migrate 1 feature as proof-of-concept (recommend: transaction)
- [ ] Test migrated feature works parallel to legacy
- [ ] Migrate remaining features one by one
- [ ] Remove legacy code after all features migrated
- [ ] Update documentation

---

## Phase 6: Testing Strategy

### 6.1 Unit Tests

**Session Manager Tests:**

```typescript
// Priority ordering
test('higher priority feature runs first', () => {
  // Register feature A (priority 100)
  // Register feature B (priority 50)
  // Trigger session
  // Assert A onStart called, B onStart NOT called (if A exclusive)
  // Assert both called if A not exclusive
})

// Opt-out behavior
test('feature returning null opts out', () => {
  // Feature A returns null
  // Feature B returns state
  // Assert B handles session
})

// Non-exclusive participation
test('non-exclusive features run together', () => {
  // Feature A (priority 100, exclusive: false)
  // Feature B (priority 50, exclusive: false)
  // Assert both A and B update called
})

// State persistence
test('feature state persists across update/end', () => {
  // Feature onStart returns { id: '123' }
  // Update receives same state
  // End receives same state
})
```

**Feature Registry Tests:**

```typescript
test('register and retrieve feature', () => {
  defineFeature('test', ({}) => ({ ... }))
  const api = importFeature('test')
  expect(api).toBeDefined()
})

test('feature import returns public API', () => {
  const feature = defineFeature('test', ({}) => ({
    api: { method: () => 'hello' }
  }))
  const api = importFeature('test')
  expect(api.method()).toBe('hello')
})
```

### 6.2 Integration Tests

**Multi-Feature Scenario:**

```typescript
test('rectangle + drag priorities work correctly', () => {
  // Register rectangle tool (priority 100, exclusive)
  // Register drag elements (priority 50, exclusive)

  // Scenario 1: Rectangle tool active
  const snapshot1 = { primaryTool: 'rectangle', ... }
  await sessionManager.handleStart('input.drag', snapshot1)

  // Assert rectangle participates, drag elements skipped

  // Scenario 2: Select tool active + elements selected
  const snapshot2 = { primaryTool: 'select', selectedElements: ['a', 'b'], ... }
  await sessionManager.handleStart('input.drag', snapshot2)

  // Assert drag elements participates, rectangle skipped
})
```

**Feature Composition:**

```typescript
test('feature can import another feature', () => {
  // Define transaction feature
  const txn = defineFeature('transaction', ({}) => ({
    api: { start: vi.fn() }
  }))

  // Define selection feature using transaction
  defineFeature('selection', ({ importFeature }) => ({
    define: () => {
      const txnAPI = importFeature('transaction')
      txnAPI.start()
    }
  }))

  // Assert transaction.start() called
})
```

### 6.3 E2E Tests

**Feature End-to-End:**

```typescript
// apps/asyra-design/e2e/feature-system.spec.ts

test('user can create rectangle with feature system', async ({ page }) => {
  await page.click('[data-testid="tool-rectangle"]')
  await page.mouse.move(100, 100)
  await page.mouse.down()
  await page.mouse.move(200, 200)
  await page.mouse.up()

  // Assert rectangle created
  const element = await page.locator('[data-testid="element-rectangle"]')
  await expect(element).toBeVisible()
})
```

---

## Phase 7: Documentation

### 7.1 User Guide

**Sections:**

1. Introduction - What is the Feature System
2. Quick Start - Your first feature in 5 minutes
3. Feature API - Complete API reference
4. Session Guide - Priority-based interactions
5. Feature Composition - Importing and using other features
6. Package Access Guidelines - When to use feature-system vs direct access
7. Templates - Pre-built patterns
8. Migration Guide - Moving from legacy system
9. Best Practices - Tips and patterns

### 7.2 API Reference

Auto-generated from TypeScript types with examples.

### 7.3 Examples Directory

```
examples/
├── basic-feature/
├── session-priority/
├── feature-composition/
├── template-usage/
└── visual-builder-integration/ (future)
```

---

## Timeline

| Phase                   | Duration  | Deliverable                                    |
| ----------------------- | --------- | ---------------------------------------------- |
| Phase 1: Core           | 1-2 weeks | defineFeature, SessionManager, FeatureRegistry |
| Phase 2: Integration    | 3-5 days  | Core integration, package wiring               |
| Phase 3: Micro-Features | 2-3 days  | withTransaction, utilities                     |
| Phase 4: Templates      | 3-5 days  | Tool, shortcut, transactional templates        |
| Phase 5: Migration      | 2-3 weeks | Migrate all features, remove legacy            |
| Phase 6: Testing        | Ongoing   | Unit + integration + E2E tests                 |
| Phase 7: Documentation  | 1 week    | User guide, API docs, examples                 |

**Total Estimated Time:** 5-7 weeks

---

## Success Criteria

- [ ] defineFeature() API works end-to-end
- [ ] Session manager correctly handles priority-based selection
- [ ] Features can import other features
- [ ] All existing features migrated to new system
- [ ] 85% reduction in code lines and files per feature
- [ ] Tests cover all critical paths
- [ ] Documentation complete
- [ ] No breaking changes (backward compatible migration)

---

## Open Questions

### Questions for Team Review:

1. **Feature Initialization Order:** Should features declare explicit dependencies, or rely on `importFeature()` being lazy? (Proposal: Lazy import for simplicity)

2. **Event Namespacing:** Should events be `transaction.start()` or namespaced `transaction/transaction.start()`? (Proposal: Global events for simplicity, namespace manually if needed)

3. **Priority Ranges:** Should we document priority tiers? e.g., 100-90 for primary interactions, 80-70 for secondary, 60-50 for utilities, <50 for analytics (Proposal: Document recommended ranges)

4. **Hot Reload:** Should features be unregisterable for development? (Proposal: Yes, add `unregisterFeature()` for dev tooling)

5. **Error Handling:** What happens if a feature throws during session? (Proposal: Log error, continue with next feature, feature stops participating after error)

---

## Next Steps

1. **Review and approve** this implementation plan
2. **Set up** `@asyra/feature-system` package structure
3. **Implement Phase 1** (Core types and defineFeature)
4. **Create proof-of-concept** feature (transaction feature)
5. **Test** priority-based session management
6. **Iterate** based on feedback
7. **Migrate** features incrementally

---

**Implementation Plan End**
