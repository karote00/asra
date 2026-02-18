# Asyra Framework Architecture Conclusions

## As a Framework: What Users Can Use

**Core APIs are the single source of truth.**

Users interact with the framework only through **Core APIs**:

- `elementApis.*` - Create, read, update elements
- `selectionApis.*` - Manage selection state
- Other domain-specific Core APIs

**Examples:**

```typescript
// User feature
elementApis.createElementAtClientPos(position, type)
elementApis.changeComputedData([elementId], { x, y, width, height })
selectionApis.selectElements([elementId])
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

## Component Extensibility Pattern

**Framework-First Philosophy: Users extend through APIs, not code modifications.**

### User-Level Component Registration

When users create custom components (like `Oval`, `Rectangle`, etc.), they use `defineComponent()`:

```typescript
// User code (no framework modifications!)
defineComponent('OVAL', {
  name: 'Oval',
  char: 'O',
  defaultPrefix: 'oval'
  // ... other config
})
```

### Auto-Registration Process

`defineComponent()` automatically registers the component with the framework's naming and ID systems:

```typescript
// define-component.ts (framework code)
export function defineComponent<T extends Component>(
  entityTypes: string,
  config: ComponentConfig<T>
): void {
  const { name, char, defaultPrefix, ...restConfig } = config

  // Auto-register with nameCounter for human-readable names: "Oval 1", "Oval 2"
  if (char && defaultPrefix) {
    nameCounter.registerType(char, defaultPrefix)
  }

  // Auto-register with idCounter for stable IDs: "oval-1", "oval-2"
  if (defaultPrefix) {
    idCounter.registerType(defaultPrefix)
  }

  // Rest of component registration...
}
```

### Dynamic Component Type Propagation

When elements are created dynamically via `createDynamicComponent`, the type information flows through:

```typescript
// create-dynamic-component.ts (framework code)
class DynamicElementComponent extends Element {
  private _idType!: string
  private _nameType!: string

  constructor(nameCounter, idCounter, data, sceneTreeRegistry) {
    super(nameCounter, idCounter, data, sceneTreeRegistry)

    // Set type BEFORE _init() (parent may call create() which uses it)
    this._idType = data.type // e.g., "OVAL"
    this._nameType = data.type // e.g., "OVAL"

    this._init(data)
  }

  get idType(): string {
    return this._idType
  }
  get nameType(): string {
    return this._nameType
  }
}
```

### Element Creation with Correct Type

Element.create() now respects the dynamic type instead of hardcoding "ELEMENT":

```typescript
// element.ts (framework code)
create(data: any) {
  const element = new Element(this.nameCounter, this.idCounter, {
    type: this.data.type,  // Dynamic: "OVAL", "RECTANGLE", etc. (NOT hardcoded)
    ...data
  })

  element.nameCounter.generateName(
    element,
    this.data.type || this.nameType,  // Uses element's type for naming
    this.data.char
  )

  element.idCounter.generateId(
    element.data.type || this.idType   // Uses element's type for ID
  )
}
```

### Benefits

- ✅ **No framework modifications** - Users define components at app level
- ✅ **Consistent naming** - "Oval 1", "Rectangle 1", etc.
- ✅ **Stable IDs** - "oval-1", "rectangle-1", etc.
- ✅ **Extensibility** - New element types work automatically
- ✅ **Framework-first** - APIs support user needs, not code changes

### Example: Complete User Component

```typescript
// User code (app level)
import { defineComponent } from '@asyra/core'
import { Element } from '@asyra/scene-tree'

defineComponent('OVAL', {
  name: 'Oval',
  char: 'O',
  defaultPrefix: 'oval'
  // Auto-registers: nameCounter('O', 'oval'), idCounter('oval')
})

export class Oval extends Element {
  createPixiObject(options) {
    const graphics = new PIXI.Graphics()
    // ... oval drawing logic
    return graphics
  }
}
```

Results:

- Element displays as: "Oval 1", "Oval 2", etc.
- Element ID: "oval-1", "oval-2", etc.
- No framework code modified for this feature
