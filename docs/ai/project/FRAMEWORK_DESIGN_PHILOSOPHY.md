# Framework Design Philosophy

This document captures the core design principles and goals for the Asyra framework. All features, documentation, and architecture decisions should align with these principles.

## Core Philosophy

**The framework should empower users while providing guidance.**

We balance power/extensibility with good defaults and clear patterns.

## Layered Approach

### 1. Core APIs (`contexts/core.ts`)

**Target: 80% of use cases**

Core provides simplified, orchestrated APIs for common operations. Features should primarily use core APIs.

**Responsibilities:**

- Transaction management
- Reactive-events coordination
- Undo/redo integration
- Common orchestration patterns
- State aggregation

**Characteristics:**

- Simple, declarative API surface
- No transaction/event boilerplate required
- Automatically integrates with framework features
- Stable, backwards-compatible

**Examples:**

```javascript
// Simplified API for features
core.selectElements([id])
core.updateElement(id, 'x', 100)
core.getProperty('zoom')
```

### 2. Direct Context Exports (`contexts/index.ts`)

**Target: Advanced use cases, plugins, custom features**

Direct context access enables extensibility beyond what core anticipates.

**Use Cases:**

- Building custom features that need direct context access
- Plugin development
- Custom component behaviors
- Advanced integrations

**Characteristics:**

- Full power, no abstraction
- Requires understanding of framework internals
- May require manual transaction/event management
- For advanced users only

**Examples:**

```javascript
// Advanced users can go deeper
selection.getSelectionManager()
systemContext.registerObserver(...)
factory.sceneTreeMap.observe(...)
```

### 3. Reactive-Events (`@asyra/reactive-events`)

**Target: Framework internals**

Event system is plumbing, not for feature authors directly.

**Responsibilities:**

- Event publishing and subscription
- Transaction boundaries
- Undo/redo queue management
- Distributed state synchronization (YJS)

**No direct usage in:** features, core orchestration

**Indirect usage through:** core APIs, context observers

## Design Principles

### 1. 80/20 Rule

- Core APIs cover 80% of common use cases
- Direct context access for 20% advanced/edge cases
- Users shouldn't need to jump layers for common operations

### 2. Clear API Boundaries

- **Features → Core (preferred)**
- **Features → Contexts (advanced needs only)**
- **Features → Reactive-events (never)**
- **Core → Reactive-events (implementation)**
- **Contexts → Reactive-events (implementation)**

### 3. Frameworks Provide Orchestration

- Features implement **business logic**: what to do
- Core handles **framework orchestration**: when/how to do it
- Examples:
  - Feature says "select this element"
  - Core wraps in transaction, fires events, integrates undo/redo
- Feature says "update this property"
  - Core coordinates with props-manager, fires change events

### 4. Single Source of Truth

- YJS = ultimate data source
- Contexts provide observable views of YJS state
- Core aggregates and coordinates updates
- Features consume through core or direct context

### 5. Event-Driven Architecture (CDD)

- All state changes flow through reactive-events
- Observers subscribe to events to stay synced
- Data-driven (YJS) + Event-driven (reaction)
- Consistent order: Data Update → Event Fire → Observer React

### 6. Transaction Boundaries

- Nested transactions supported
- Events fire inside transaction scope
- Undo/redo groups related changes
- Features control transaction scope for user actions

### 7. Progressive Disclosure of Power

- Simple: Use core APIs
- Advanced: Use contexts directly
- Expert: Understand reactive-events, YJS internals
- Users can start simple, go deeper as needed

## API Surface Examples

### Feature Usage (Core API)

```javascript
// In feature - ONLY import from common-apis
import { elementApis, selectionApis } from '../../common-apis'

export const moveElementFeature = defineFeature('moveElement', 'input.drag', {
  api: {
    move: (elementId, dx, dy) => {
      const selectedIds = selectionApis.getSelectedIds()
      selectedIds.forEach((id) => {
        const current = elementApis.getProperty(id, 'x')
        const currentY = elementApis.getProperty(id, 'y')
        elementApis.changeComputedData([id], 'x', current + dx)
        elementApis.changeComputedData([id], 'y', currentY + dy)
      })
    }
  }
})
```

### Plugin/Advanced Usage (Direct Context)

```javascript
// In custom plugin or common-apis (NOT in features)
import { selection, factory } from '../contexts'

export const customSelectionPlugin = {
  init() {
    // Custom merge algorithm
    factory.elementSelectionMap.observe(this.handleCustomMerge.bind(this))
  },

  handleCustomMerge(event) {
    // Direct YJS manipulation for advanced needs
    const trans = event.doc.transact(() => {
      // Custom logic...
    })
  }
}
```

### Migration Path

As features evolve:

1. **Start**: Use reactive-events directly (initial implementation)
2. **Progress**: Wrap in common-apis/ (iteration 1)
3. **Mature**: Move to core APIs (final state)

## When to Add to Core

Add API to core when:

- Used by 3+ features
- Requires transaction/event management
- Requires coordination between multiple systems
- Common pattern that users repeat

Keep in common-apis/ when:

- Specific to one domain/domain
- Used by 1-2 features
- May change in future iterations

Don't use reactive-events directly in features when:

- A core API exists
- Feature is not framework infrastructure

## Benefits of This Design

### For Feature Developers

- Simple API surface: `core.selectElements([id])`
- No boilerplate: transactions, events handled automatically
- Focus on business logic, not framework internals
- Consistent patterns across framework

### For Advanced Users

- Full access when needed
- Build plugins, custom features
- Extend beyond what core anticipates
- Not limited by predefined APIs

### For Framework Maintainers

- Clear separation: core vs internal internals
- Stable core API surface
- Can evolve internals without breaking core APIs
- Reactive-events can change, APIs stay same

## Implementation Rules

### Feature Layer

**MUST:**

- Import ONLY from `common-apis/*` for data changes
- Never import directly from `contexts` or `@asyra/reactive-events`
- Use `common-apis/` as the only interface to framework functionality

**Example:**

```javascript
// ✅ Correct
import { selectionApis, elementApis } from '../../common-apis'

// ❌ Wrong
import { selection } from '../../contexts'
import { selectElements } from '@asyra/reactive-events'
```

### Common-APIs Layer

**Rules for Data-Changing APIs:**

1. **Read Operations:** Can access contexts directly

   ```javascript
   import { selection } from '../contexts'

   export const selectionApis = {
     getSelectedIds: () => selection.getElementSelectionIds()
   }
   ```

2. **Write Operations via Core:** No transaction wrapping needed (core handles it)

   ```javascript
   import core, { selection } from '../contexts'

   export const selectionApis = {
     selectElements: (elementIds: string[]) => core.selectElements(elementIds),

     toggleSelection: (elementId: string) => {
       const currentIds = selection.getElementSelectionIds()
       const newIds = currentIds.includes(elementId)
         ? currentIds.filter((id: string) => id !== elementId)
         : [...currentIds, elementId]
       core.selectElements(newIds)
     }
   }
   ```

3. **Write Operations via Reactive-Events:** MUST wrap with transactions

   ```javascript
   import {
     changeComputedData,
     startTransaction,
     endTransaction
   } from '@asyra/reactive-events'

   export const elementApis = {
     changeComputedData: (elementIds: string[], key: string, value: any) => {
       startTransaction()
       changeComputedData(elementIds, key, value)
       endTransaction()
     }
   }
   ```

4. **Write Operations via Core:** No transaction wrapping needed (core handles it)

   ```javascript
   import core from '../contexts'

   export const selectionApis = {
     selectElements: (elementIds: string[]) => core.selectElements(elementIds)
   }
   ```

5. **Write Operations via Reactive-Events:** MUST wrap with transactions

   ```javascript
   import { changeComputedData, startTransaction, endTransaction } from '@asyra/reactive-events'

   export const elementApis = {
     changeComputedData: (elementIds: string[], key: string, value: any) => {
       startTransaction()
       changeComputedData(elementIds, key, value)
       endTransaction()
     }
   }
   ```

**Summary:**

- Common-apis ARE NOT core APIs - they are reusable APIs extracted from features
- If API delegates to `core.selectElements()` or similar → core handles transactions internally
- If API calls reactive-events directly → MUST wrap with `startTransaction()` / `endTransaction()`
- Read operations can import contexts directly from `../contexts`

### Core API Layer

**Responsible for:**

- Transaction management (internal)
- Event coordination
- Undo/redo integration

**Usage:**

- Called by common-apis for complex operations
- Features NEVER import core directly (must go through common-apis)
- Wraps reactive-events calls internally

## Import Dependency Summary

```
Features
  ↓ imports ONLY
Common-apis
  ↓ imports (reads)
Contexts
  ↓ imports (implementation)
Reactive-events
```

**Allowed imports by layer:**

| Layer       | Can Import From                                                         |
| ----------- | ----------------------------------------------------------------------- |
| Features    | `common-apis/*` only                                                    |
| Common-apis | `contexts/*` (reads), `core`, `@asyra/reactive-events` (implementation) |
| Core        | `contexts/*`, `@asyra/reactive-events`                                  |
| Contexts    | `@asyra/reactive-events`                                                |

**Prohibited:**

- Features importing `contexts/*` or `@asyra/reactive-events` directly
- Features importing `core` directly
- Using `require()` - always use ES imports
- Common-apis changing data without wrapping transactions (when not delegating to core)
