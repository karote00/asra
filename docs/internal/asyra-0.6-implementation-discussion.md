# Asyra Framework Architecture Conclusions

## As a Framework: What Users Can Use

**Core APIs are the single source of truth.**

Users interact with the framework only through **Core APIs**:

- `elementApis.*` - Create, read, update elements
- `selectionApis.*` - Manage selection state
- `defineComponent()` - Define custom component types
- Other domain-specific Core APIs

**Examples:**

```typescript
// User feature
elementApis.createElementAtClientPos(position, type)
elementApis.changeComputedData([elementId], { x, y, width, height })
selectionApis.selectElements([elementId])

// User defines custom component
defineComponent({
  type: 'star',
  idPrefix: 'star',
  namePrefix: 'Star',
  properties: [...],
  renderStrategy: (graphic, data) => { /* custom drawing */ }
})
```

**Users can also:**

- Call `startTransaction()` and `endTransaction()` directly for transaction boundaries
- Subscribe to events for observation
- Publish events (but for most operations, use Core APIs)

**Users CANNOT:**

- Import repositories directly (e.g., `import sceneTree from '@asyra/scene-tree'`)
- Access reactive-events publishing functions for core system events
- Bypass Core APIs to manipulate data

---

## What Internal Repositories Can Use

**Each repository manages its own state and publishes its events.**

Repositories can:

- Import types and utilities from other packages
- Subscribe to reactive-events to observe changes
- Maintain internal change buffers

Repositories CANNOT:

- Import other repositories (with one exception)
- Publish other repositories' events

---

## If Repo A Needs to Manipulate with Repo B

**Use reactive-events.**

Repo A publishes an event describing what it needs. Repo B subscribes to that event and responds.

**Pattern:**

```typescript
// Repo A
someOperation() {
  this.internalUpdate()
  this.commitA()

  publishEvent({ type: 'B_NEEDS_UPDATE', payload: {...} })
}

// Repo B
subscribeToBNeedsUpdate(({payload}) => {
  this.updateBasedOnB(payload)
  this.commitB()
})
```

This maintains:

- Decoupling between repositories
- Independent versioning
- Testability in isolation
- Extensibility (new repos can be added)

---

## Can Any Repo Manipulate with Other Repo Directly?

**No. Only ONE direct dependency is allowed: SceneTree → PropsManager.**

**The Exception:**

```typescript
// SceneTree can call PropsManager directly
import propsManager from '@asyra/props-manager'

addNewElement(...) {
  const element = this.createElement(data)

  // Direct call - ONLY allowed dependency
  propsManager.updateElementProps(element.id, defaultProps)

  this.addToMap(element)
  this.commitSceneTreeTransaction()
}
```

**Why is this exception allowed?**

- Elements fundamentally have props - it's domain reality
- This structural coupling won't change
- Adding an element without props is invalid
- It's an inherent relationship in the information model

**All other cross-repo coordination MUST use reactive-events.**

```
SceneTree ──────────────────────→ PropsManager
                                    (direct call)

SceneTree ← Reactive Events ← Selection
SceneTree ← Reactive Events ← Render
Selection ← Reactive Events ← Render
etc.
```

**Benefits:**

- No circular dependencies
- Clean, maintainable package boundaries
- Each package can be versioned independently
- New packages can be added without modifying existing ones

---

## Autoflushes with Data Change

**Every repository method that changes data MUST autoflush.**

**The rule applies to ALL data-modifying APIs:**

```typescript
// SceneTree
addNewElement(...) {
  this.updateInternalState()     // Change internal state
  this.addChangeBuffer(...)      // Record change
  this.commitSceneTreeTransaction()  // ← MUST autoflush (calls updateTransaction)
}

removeElement(...) {
  this.updateInternalState()     // Change internal state
  this.addChangeBuffer(...)      // Record change
  this.commitSceneTreeTransaction()  // ← MUST autoflush (calls updateTransaction)
}

// PropsManager
updateProps(...) {
  this.updateInternalState()     // Change internal state
  this.addChangeBuffer(...)      // Record change
  this.commitPropsChanges()      // ← MUST autoflush (calls updateTransaction)
}
```

**Important distinction:**

- `commitSceneTreeTransaction()` = `updateTransaction()` - adds to **pending** transaction
- `endTransaction()` = **real** commit to undo/redo stack

**Autoflush always happens, regardless of call path:**

- Direct repo call? → Autoflush
- Called via event subscriber? → Autoflush
- Consistent behavior everywhere

**Why autoflush is required:**

- Separates concerns: repos manage state, features control boundaries
- Predictable error handling
- Clear contract: "modification → record change → flush to transaction"
- Simplifies app-level code (no need to remember to call commit)

---

## Summary Table

Who can do what?

| Actor                  | Can Use Directly                                                              | Must Use Events For  |
| ---------------------- | ----------------------------------------------------------------------------- | -------------------- |
| **User Features / AI** | Core APIs (`elementApis.*`, `selectionApis.*`)                                | Observation only     |
| **User Features / AI** | `startTransaction()`, `endTransaction()`                                      | N/A                  |
| **User Features / AI** | `defineComponent()`, `nameCounter.registerType()`, `idCounter.registerType()` | N/A                  |
| **SceneTree Repo**     | PropsManager (only exception)                                                 | All other repos      |
| **All Other Repos**    | None (no direct repo imports)                                                 | All cross-repo comms |
| **Any Repo**           | Never                                                                         | N/A                  |

**Autoflush rule:** Every data-modifying repo method MUST autoflush via `updateTransaction()`.

---

## Component Extensibility Architecture

**Framework-First Philosophy: Users extend through APIs, not code modifications.**

See `asyra-component-extensibility-pattern.md` for detailed documentation of the component extensibility pattern.

### Key Points

1. **Registration APIs:**
   - `nameCounter.registerType(type, namePrefix, initialValue?)`
   - `idCounter.registerType(type, idPrefix, initialValue?)`

2. **defineComponent Auto-Registration:**
   - Automatically registers components with both counters
   - No framework code modifications needed

3. **Constructor Prefix Support:**
   - `Element` constructor supports `idPrefix` and `namePrefix` parameters
   - `Group` passes `IDTypes.GROUP` and `NameTypes.GROUP` to parent
   - `Workspace` passes `IDTypes.WORKSPACE` and `NameTypes.WORKSPACE` to parent

4. **Dynamic Component Type Propagation:**
   - `createDynamicComponent` returns class that passes prefixes to parent constructor
   - `_init()` method sets `this._idType` and `this._nameType` before calling `super._init()`

5. **Lifecycle Flow:**

   ```
   defineComponent(...definition)
     → nameCounter.registerType(type, namePrefix)
     → idCounter.registerType(type, idPrefix)
     → createDynamicComponent(type, idPrefix, namePrefix, ...)

   new Component(data)
     → super(data, idPrefix, namePrefix)
     → Element constructor: sets this._idType, this._nameType
     → _init(): generates ID/Name using this._idType/this._nameType
   ```

### Benefits

- ✅ No framework code modifications for app-level components
- ✅ Consistent naming: "Oval 1", "Star 1", etc.
- ✅ Stable IDs: "oval-1", "star-1", etc.
- ✅ Extensible: new component types work automatically
- ✅ Type-safe: constructor signatures maintain type information
