# Workflow Simplification Plan - Feature Architecture

## Architecture Understanding

### Current Flow

```
User Action
    ├── Canvas → Input System (combinations) → Core → Interaction Core → Decision Event → Core → Packages
    └── UI → Directly to Core → Packages
```

### The Real Problem

**To add ONE feature (e.g., "Select Elements"), user must:**

1. Define key combinations in input-system
2. Register event for final decision
3. Create interaction handler (`core.registerInteraction`)
4. Define behavior logic (decider function)
5. Define rules (decision logic)
6. Create subscriber to receive event
7. In subscriber, call package API (`packages.sceneTree.select()`)
8. Export event publish/subscribe functions
9. Wire everything together in multiple init files

**8+ steps, scattered across 6+ directories, ~200 lines of boilerplate.**

**And worse:**

- No way to compose features (can't easily do `transactionFeature.start()`)
- Subscribers are just repetitive boilerplate (event → API wrapper)
- No pattern to follow - each feature reinvents wiring
- No public API for features
- No dependency management between features

---

## Core Requirements

1. ✅ User defines key combinations
2. ✅ User registers events for publish/subscribe
3. ✅ User can manipulate `core.deps.xxx` (packages)
4. ✅ **Feature composition** (call feature from feature)
5. ✅ Subscribers are app-level adapters (simplify them)
6. ✅ Support custom logic OR config

---

## Proposed Architecture: Feature System

### Core Concept

**Feature = Self-contained, programmable capability with:**

- Internal event/key definitions
- Decision behavior logic
- Auto-generated subscribers
- **Public API** for other features to call
- Access to packages

### Feature Definition API

```typescript
// Define a feature
const transactionFeature = defineFeature(
  'transaction',
  ({ packages, events }) => ({
    // PUBLIC API - What other features can call
    api: {
      start: () => packages.factory.startTransaction(),
      update: (change) => packages.factory.updateTransaction(change),
      end: () => packages.factory.endTransaction(),
      undo: () => packages.factory.undo(),
      redo: () => packages.factory.redo()
    },

    // INTERNAL DEFINITION - How it works
    define: ({ keys, handle, on }) => {
      // 1. Key combinations
      keys([
        { keys: 'CmdOrCtrl+Z', type: 'undo' },
        { keys: 'CmdOrCtrl+Shift+Z', type: 'redo' }
      ])

      // 2. Interaction handler
      handle('input.shortcut.undoredo', (snapshot) => {
        return {
          event: 'undoRedo.execute',
          payload: {
            type: snapshot.modifiers.includes('Shift') ? 'redo' : 'undo'
          }
        }
      })

      // 3. Auto-generate: when event fires → call API
      on('undoRedo.execute', ({ type }) => {
        if (type === 'undo') packages.factory.undo()
        else packages.factory.redo()
      })
    }
  })
)
```

### Feature Composition

```typescript
// Selection feature uses transaction feature
const selectionFeature = defineFeature(
  'selection',
  ({ packages, importFeature }) => ({
    api: {
      selectElements: (ids) => {
        const txn = importFeature('transaction')
        txn.start()
        packages.sceneTree.selectElements(ids)
        txn.end()
      }
    },

    define: ({ on }) => {
      on('selectSingle', ({ elementId }) => {
        packages.selection.selectElements([elementId])
      })
    }
  })
)
```

### UI Actions (Direct to Feature API)

```typescript
// In UI component: Direct feature API call - no event needed
<button onClick={() => deletionFeature.api.deleteElements(selectedIds)}>
  Delete
</button>
```

---

## API Design

### Feature Builder Interface

```typescript
type FeatureBuilder = {
  packages: {
    factory: Factory
    sceneTree: SceneTree
    selection: Selection
    // ... all packages
  }

  events: {
    register: (name: string) => EventReg
    emit: (name: string, payload: any) => void
  }

  keys: KeyCombo[] => void
  handle: (eventName: string, handler: (s) => DecisionResult) => void
  on: (eventName: string, handler: (p) => void) => void
  importFeature: (name: string) => FeatureAPI
  session: {
    // Unified session API: one name, three lifecycle handlers (all optional)
    start: (
      sessionName: string,
      onStart?: (snapshot: SystemContextSnapshot) => SessionState | null,
      onUpdate?: (snapshot: SystemContextSnapshot, state: SessionState) => void,
      onEnd?: (snapshot: SystemContextSnapshot, state: SessionState) => void
    ) => void
  }
}
```

### Complete Example: Rectangle Tool

```typescript
export const rectangleFeature = defineFeature(
  'rectangleTool',
  ({ packages, session }) => ({
    api: {
      create: (position, size) => {
        packages.factory.startTransaction()
        const id = packages.sceneTree.addRectangle({ position, size })
        packages.factory.endTransaction()
        return id
      }
    },

    define: ({ session, on }) => {
      // Single session name for entire drag interaction
      session(
        'input.drag',
        // onStart
        (snapshot) => {
          packages.factory.startTransaction()
          const id = packages.sceneTree.addRectangle({
            position: snapshot.mouse.position,
            size: { width: 0, height: 0 }
          })
          return { id, start: snapshot.mouse.position }
        },
        // onUpdate
        (snapshot, state) => {
          const size = {
            width: snapshot.mouse.position.x - state.start.x,
            height: snapshot.mouse.position.y - state.start.y
          }
          packages.sceneTree.updateComputedData(state.id, { size })
        },
        // onEnd
        (snapshot, state) => {
          packages.factory.endTransaction()
        }
      )

      on('rectangle.resize', ({ elementId, newSize }) => {
        packages.sceneTree.updateComputedData(elementId, { size: newSize })
      })
    }
  })
)
```

---

## Strategies

### Strategy 1: Feature Capsules (Primary Recommendation)

**All-in-one feature definition:**

- Auto event registration
- Auto interaction handlers
- Auto subscriber generation
- Public API
- Feature composition

**Files: 8 → 1 (87% reduction)**

### Strategy 2: Micro-Feature Composition

**Atomic utilities:**

```typescript
const withTransaction = microFeature((callback) => {
  packages.factory.startTransaction()
  try {
    return callback()
  } finally {
    packages.factory.endTransaction()
  }
})

// Use anywhere
const deleteFeature = defineFeature('delete', {
  api: {
    delete: (ids) => withTransaction(() => packages.sceneTree.delete(ids))
  }
})
```

### Strategy 3: Event Auto-Wiring

**Replace subscribers:**

```typescript
// Before (3 files/steps):
const ev = eventRegistry.register('foo')
ev.subscribe((p) => selectionApi.select(p.ids))
export { foo, subscribeToFoo }

// After (1 step):
on('foo', ({ ids }) => packages.selection.select(ids))
// Core auto-registers event, creates subscriber, creates publisher
```

### Strategy 4: Session Builder

**Unified session API:**

```typescript
// Single session name, with start/update/end handlers (positional)
session(
  'input.drag',
  // onStart
  (snapshot) => {
    // Session starts here, return initial state
    return {
      /* initial state */
    }
  },
  // onUpdate
  (snapshot, state) => {
    // Session continues, state persists between updates
  },
  // onEnd
  (snapshot, state) => {
    // Session ends, cleanup here
  }
)

// Handlers can be null if feature doesn't need that phase
session(
  'input.drag',
  (s) => ({}), // onStart
  null, // onUpdate (not needed)
  (s, state) => {} // onEnd
)
```

### Strategy 5: Multi-Feature Session Coordination

**Problem:** Multiple features might handle the same session (e.g., both "drag element" and "create rectangle" track `input.drag`)

**Solution:** Session Manager with feature participation

```typescript
// Feature 1: Rectangle creation
const rectangleFeature = defineFeature('rectangle', ({ packages, session }) => ({
  define: () => {
    session('input.drag',
      // onStart
      (snapshot) => {
        // Only participate if primary tool is 'rectangle'
        if (snapshot.primaryTool !== 'rectangle') return null

        const id = packages.sceneTree.addRectangle({
          position: snapshot.mouse.position,
          size: { width: 0, height: 0 }
        })
        return { id }
      },
      // onUpdate
      (snapshot, state) => {
        if (!state) return  // Not participating
        // Update rectangle size...
      },
      // onEnd
      (snapshot, state) => {
        if (!state) return
        // Cleanup...
      }
    )
  }
}))

// Feature 2: Element dragging
const dragFeature = defineFeature('drag', ({ packages, session }) => ({
  define: () => {
    session('input.drag',
      // onStart
      (snapshot) => {
        // Only participate if element is selected and not creating
        if (snapshot.primaryTool === 'rectangle') return null
        if (snapshot.target.selectedElementIds.length === 0) return null

        return { startPositions: packages.sceneTree.getPositions(...) }
      },
      // onUpdate
      (snapshot, state) => {
        if (!state) return
        // Drag element...
      },
      // onEnd
      (snapshot, state) => {
        if (!state) return
        // End drag...
      }
    )
  }
}))
```

**Key Mechanism:**

- If `onStart` returns `null`, feature opts out of this session
- Session state is **per-feature** (no shared state conflicts)
- Features can simultaneously participate or opt out
- Core coordination: session manager calls all registered handlers, passes each feature its own state

**Alternative: Priority-based Sessions**

```typescript
// Future: Could add priority API if needed
// session.withPriority(10, 'input.drag', onStart?, onUpdate?, onEnd?)
// Lower priority features won't be called if higher priority handles it
```

### Strategy 6: Template System

**Pre-built patterns:**

```typescript
toolTemplate({
  name: 'eraseTool',
  keys: 'E',
  drag: { onStart: ..., onUpdate: ..., onEnd: ... }
})

shortcutTemplate({
  name: 'zoomFit',
  keys: 'CmdOrCtrl+0',
  action: () => packages.viewport.zoomFit()
})
```

---

## Implementation Plan

### Phase 1: Core Feature System (Foundation)

1. Define Feature interface
2. Create `defineFeature()` function
3. Create FeatureBuilder with all capabilities
4. Create FeatureRegistry (register/get features)

### Phase 2: Session Builder

Implement `session()` for drag-based interactions with auto state management

### Phase 3: Micro-Feature Utilities

Create composable utilities: `withTransaction`, `withSelection`, `withUndoRedo`

### Phase 4: Template Library

Templates for: tools, shortcuts, transactional ops, viewport

### Phase 5: Migration & Tooling

1. Migrate existing features
2. Migration guide
3. CLI: `yarn create:feature <name> --template=<template>`

---

## Comparison

### Before: Adding "Delete" feature

```
1. init/workflows/delete.ts
2. init/behaviors/delete-behavior.ts
3. init/rules/delete-rules.ts
4. init/events/interaction/index.ts (add event)
5. init/subscribers/delete.ts
6. init/apis/delete.ts
7. init/init-workflows.ts (register)
8. init/init-interactions.ts (register)
9. init/init-subscribers.ts (init)

Result: 9 files, ~200 lines, 8 steps
```

### After: Adding "Delete" feature

```
features/delete/index.ts (~30 lines)
defineFeature('delete', ({ packages, keys, on }) => ({
  api: {
    delete: (ids) => {
      packages.factory.startTransaction()
      packages.sceneTree.delete(ids)
      packages.factory.endTransaction()
    }
  },
  define: () => {
    keys([{ keys: 'Backspace' }])
    on('executeDelete', ({ ids }) => this.api.delete(ids))
  }
}))

Result: 1 file, ~30 lines, 1 registration
Reduction: 90%
```

---

## Feature Composition Examples

### Rectangle with Snap to Grid

```typescript
// Feature 1: Snap to grid
const snapFeature = defineFeature('snapToGrid', ({ packages }) => ({
  api: {
    snap: (position) => ({
      x: Math.round(position.x / 20) * 20,
      y: Math.round(position.y / 20) * 20
    })
  }
}))

// Feature 2: Rectangle using snap
const rectangleFeature = defineFeature(
  'rectangle',
  ({ packages, importFeature, session }) => ({
    api: {
      /* ... */
    },
    define: () => {
      const snap = importFeature('snapToGrid')

      // Single session name: 'input.drag'
      session(
        'input.drag',
        // onStart
        (snapshot) => {
          // Only participate if rectangle tool is active
          if (snapshot.primaryTool !== 'rectangle') return null

          const snapPosition = snap.api.snap(snapshot.mouse.position)
          packages.factory.startTransaction()
          const id = packages.sceneTree.addRectangle({ position: snapPosition })
          return { id, start: snapPosition }
        },
        // onUpdate
        (snapshot, state) => {
          if (!state) return
          const snapPosition = snap.api.snap(snapshot.mouse.position)
          packages.sceneTree.updateComputedData(state.id, {
            position: snapPosition,
            size: {
              width: snapPosition.x - state.start.x,
              height: snapPosition.y - state.start.y
            }
          })
        },
        // onEnd
        (snapshot, state) => {
          if (!state) return
          packages.factory.endTransaction()
        }
      )
    }
  })
)
```

### Delete with Transaction

```typescript
const deleteFeature = defineFeature(
  'delete',
  ({ packages, importFeature }) => ({
    api: {
      delete: (ids) => {
        const txn = importFeature('transaction')
        txn.start()
        packages.sceneTree.delete(ids)
        txn.end()
      }
    },
    define: ({ keys, on }) => {
      keys([{ keys: 'Backspace' }])
      on('executeDelete', ({ ids }) => this.api.delete(ids))
    }
  })
)
```

---

## Developer Experience Impact

### Metrics

| Metric              | Before    | After     | Improvement     |
| ------------------- | --------- | --------- | --------------- |
| Files per feature   | 8+        | 1         | **87%** fewer   |
| Lines of code       | ~200      | ~50       | **75%** fewer   |
| Registration points | 6+        | 1         | **83%** fewer   |
| Directories touched | 5+        | 1         | **80%** fewer   |
| Time to add feature | 1-2 hours | 15-30 min | **3-4x** faster |

### Onboarding

**Before:**
"To add a feature, edit workflows, behaviors, rules, events, subscribers, apis, init files..."

**After:**
"Create a new feature with `defineFeature()` in one file"

---

## Open Questions

1. **Feature Initialization Order** - Handle feature dependencies
2. **Event Name Collision** - Namespacing strategy
3. **Circular Dependencies** - Detection and handling
4. **Hot-Reload** - Feature re-registration without restart

---

## Visual Feature Builder (Future Vision)

With the Feature System, a visual UI builder becomes possible for non-technical users:

```
┌─────────────────────────────────────────────────────────┐
│  Visual Feature Builder                                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Feature: rectangleTool                                 │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 📦 Define Block                                  │  │
│  │ ┌──────────────────────────────────────────────┐ │  │
│  │ │ Trigger: input.drag                          │ │  │
│  │ │                                              │ │  │
│  │ │ onStart:                                     │ │  │
│  │ │   • Check if tool = rectangle                │ │  │
│  │ │   • Add rectangle to scene                   │ │  │
│  │ │   • Return { id, start }                     │ │  │
│  │ │                                              │ │  │
│  │ │ onUpdate:                                    │ │  │
│  │ │   • Update width/height from mouse delta     │ │  │
│  │ │                                              │ │  │
│  │ │ onEnd:                                       │ │  │
│  │ │   • End transaction                         │ │  │
│  │ └──────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 🔌 Adapter Block                                │  │
│  │ ┌──────────────────────────────────────────────┐ │  │
│  │ │ Import: snapToGrid feature                  │ │  │
│  │ │                                              │ │  │
│  │ │ Use in onStart:                              │ │  │
│  │ │   const snapPosition = snap.api.snap(...)   │ │  │
│  │ │   packages.sceneTree.add({ position: ... })│ │  │
│  │ └──────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │ ⚡ Trigger Block (Key Combinations)             │  │
│  │ ┌──────────────────────────────────────────────┐ │  │
│  │ │ Switch to rectangle tool:                    │ │  │
│  │ │   • Key: R                                   │ │  │
│  │ │   • Action: set primaryTool = rectangle      │ │  │
│  │ └──────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  [Link connections visible]                              │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 🔗 Feature Connections                          │  │
│  │  • rectangleTool ── uses ──> snapToGrid         │  │
│  │  • rectangleTool ── uses ──> transaction        │  │
│  │  • rectangleTool ── uses ──> sceneTree          │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**How it works:**

1. **Define Block** - Drag-and-drop logic blocks (if/else, loops, function calls)
2. **Adapter Block** - Import other features, call their public APIs
3. **Trigger Block** - Key combinations, mouse gestures, UI events
4. **Visual Links** - See dependencies between features

**Generated Code:** Click "Generate" → produces feature definition TypeScript file

---

## Summary

**Current Architecture:** Excellent foundation, flexible, powerful
**Current DX Pain:** Too much boilerplate, feature composition impossible

**Proposed:**

1. **Feature Capsules** - Self-contained, single-file definitions
2. **Public API** - Features expose methods for composition
3. **Feature Import** - Feature A can call Feature B
4. **Auto-Wiring** - Events, subscribers, handlers auto-registered
5. **Session Builder** - Unified drag interaction API with per-feature state
6. **Multi-Feature Coordination** - Features can opt-in/opt-out of sessions
7. **Template System** - Common patterns as one-liners
8. **Visual Builder** - Future UI for non-coders to build features

**Impact:** ~85% reduction in complexity, 3-4x faster development, easy composition, visual feature creation
