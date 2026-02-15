# Kernel Reality Audit 0.5

**Date:** 2025-02-16
**Scope:** Core kernel mechanisms, transaction integrity, singleton management, flow mapping
**Status:** ✅ Complete

---

## Executive Summary

This audit examines the Asyra framework's kernel integrity, transaction systems, singleton patterns, and flow architecture. The analysis reveals a **hybrid event-driven architecture** with strong extensibility through user-defined features and components, but with **critical structural risks** around:

1. **Unprotected kernel state** - All 20+ singletons expose internal state directly
2. **Transaction integrity gaps** - Immediate mutations before transaction boundaries, no error handling
3. **Massive singleton usage** - 19 singleton instances with initialization order dependencies
4. **Flow isolation concerns** - User failures in critical paths can block the kernel

**Overall Assessment:** The framework has excellent extensibility but relies on **implicit trust** of user code and has limited protection against errors, state corruption, or malicious interactions.

---

## Table of Contents

1. [Kernel Integrity](#1-kernel-integrity)
2. [Transaction Audit](#2-transaction-audit)
3. [Singleton & Instance Management](#3-singleton--instance-management)
4. [Flow Mapping](#4-flow-mapping)
5. [Recommendations](#5-recommendations)

---

## 1. Kernel Integrity

### 1.1 Core Kernel Mechanisms Identified

The kernel consists of three architectural layers:

| Layer            | Packages                                             | Purpose                                  | Singleton Count |
| ---------------- | ---------------------------------------------------- | ---------------------------------------- | --------------- |
| **System Layer** | reactive-events, factory, core, interaction-core     | Event bus, transactions, orchestration   | 6               |
| **Data Layer**   | scene-tree, props-manager, selection, system-context | Document model, element state, selection | 12              |
| **I/O Layer**    | input-system, render, ui-context                     | Input handling, rendering, UI state      | 4               |

**Total Kernel Singletons:** 20+

### 1.2 Internal State Inventory

#### Internal Storage Summary

| Package         | Maps | Arrays | Sets | Objects   | YJS             | RxJS |
| --------------- | ---- | ------ | ---- | --------- | --------------- | ---- |
| reactive-events |      |        |      |           | 1 ReplaySubject |      |
| factory         | 1    | 2      |      |           | 3 arrays        |      |
| scene-tree      | 2    | 2      |      |           |                 |      |
| props-manager   | 2    | 1      |      |           |                 |      |
| system-context  | 1    |        |      | 5 classes |                 |      |
| feature-system  | 2    | 1      | 1    |           |                 |      |
| selection       | 1    |        |      |           |                 |      |
| render          |      | 1      |      |           |                 |      |
| ui-context      | 2    |        |      |           |                 |      |
| input-system    | 2    | 1      | 1    |           |                 |      |
| utils           | 2    |        |      |           |                 |      |

**Total Internal State Objects:**

- 13 Maps
- 8 Arrays
- 2 Sets
- 5 State objects
- 3 YJS arrays
- 1 RxJS ReplaySubject

#### Critical Internal State Examples

**YJS Document (Global State)**

```typescript
// packages/factory/src/data.ts
import * as Y from 'yjs'
const doc = new Y.Doc()
export const sceneTreeChanges =
  doc.getArray<SceneTreeYjsChange>('sceneTreeChanges')
export const elementSelectionChanges =
  doc.getArray<SelectionYjsChange>('selectionChanges')
export const propsChanges = doc.getArray<PropsYjsChange>('propsChanges')
```

- **Risk:** Direct access to YJS arrays allows bypassing transaction tracking
- **Risk:** All apps/tests share same document - state pollution

**Global Event Bus**

```typescript
// packages/reactive-events/src/event-bus.ts
const eventBus = new ReplaySubject<AllEvent>(1)
```

- **Risk:** Any code can publish events to modify system state
- **Risk:** Event bus never clears - memory leaks

**ID Counters (Global State in utils)**

```typescript
// packages/utils/src/sid/idCounter.ts
export const idCounter = new IDCounter()
class IDCounter {
  counter: Record<string, string> = {}
}

// packages/utils/src/naming/nameCounter.ts
export const nameCounter = new NameCounter()
class NameCounter {
  counter: Record<string, string> = {}
}
```

- **Risk:** Counter maps are public - direct manipulation possible
- **Risk:** ID conflicts if counter corrupted
- **Risk:** Tests pollute each other

### 1.3 Protection Mechanisms Analysis

#### State Protection Matrix

| Package         | Private Fields          | Getters/Setters | Read-Only APIs | Guards             |
| --------------- | ----------------------- | --------------- | -------------- | ------------------ |
| reactive-events | No                      | No              | No             | ❌ None            |
| factory         | Some                    | No              | No             | ⚠️ Methods-based   |
| scene-tree      | Yes (underscore prefix) | No              | No             | ⚠️ Methods-based   |
| props-manager   | Yes                     | No              | No             | ⚠️ Methods-based   |
| system-context  | Yes                     | Yes             | No             | ⚠️ Minimal         |
| feature-system  | Yes (registries)        | No              | No             | ⚠️ Private fields  |
| selection       | No                      | No              | No             | ❌ Public fields   |
| render          | No                      | No              | No             | ❌ Public fields   |
| ui-context      | Yes                     | No              | No             | ⚠️ RxJS pattern    |
| input-system    | Yes                     | No              | No             | ❌ Registry public |
| utils           | No                      | No              | No             | ❌ Public fields   |

**Protection Score:** 4/10 (Private fields only, no runtime enforcement)

#### Boundary Between Kernel and User Code

**Existing Boundaries:**

1. **Feature System** - User code flows through well-defined hooks
2. **Component System** - User components registered via registry
3. **Property System** - User properties managed by kernel

**Boundary Gaps:**

1. **No explicit permission system** - Any code can register features/components
2. **No sandboxing** - User code runs in same context as kernel
3. **No namespace isolation** - User and kernel share all registries

#### Can User Code Interfere with Kernel? (YES)

```typescript
// Example 1: Direct mutation of event bus
import { getEventBus } from '@asyra/reactive-events'
const bus = getEventBus()
bus.next({ type: 'SCENE_TREE_ADD_ELEMENT', payload: maliciousData })

// Example 2: Direct access to YJS document
import { sceneTreeChanges } from '@asyra/factory/src/registry/scene-tree'
sceneTreeChanges.push([{ any: 'data' }]) // Bypasses transactions!

// Example 3: Direct element map modification
import sceneTree from '@asyra/scene-tree'
sceneTree._elements.set('fake-id', anyElement) // No validation!

// Example 4: Counter manipulation
import { idCounter } from '@asyra/utils'
idCounter.counter['ELEMENT'] = 'ELEMENT-99999' // ID conflicts!
```

**Result:** **No runtime guards** against these actions.

### 1.4 User Domain Knowledge Management

#### Feature System Infrastructure

**Storage:** `Map<string, FeatureEntry>` in `FeatureRegistry`

```typescript
interface FeatureEntry {
  definition: FeatureDefinition
  api: FeatureAPI
  registeredAt: number
}
```

**User Data vs Kernel State:**

- **User Data:** Feature definitions (APIs, handlers)
- **Kernel State:** Execution contexts, sessions, change tracking

**Separation:** User defines feature → kernel manages lifecycle

#### Component System Infrastructure

**Storage:** `Map<string, ComponentRegistration>` in `ComponentRegistry`

```typescript
interface ComponentRegistration {
  type: string
  idPrefix: string
  namePrefix: string
  constructor: new (data?) => Element
  properties: PropertyDefinition[]
  defaults: Record<string, unknown>
  isContainer?: boolean
}
```

**User Data vs Kernel State:**

- **User Data:** Component type definitions
- **Kernel State:** Element instances, property values

**Separation:** User defines component type → kernel manages instances

#### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     User Domain                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Define       │  │ Define       │  │ Create       │     │
│  │ Features     │  │ Components   │  │ Elements     │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
└─────────┼─────────────────┼─────────────────┼─────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│                   Registries (Kernel)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ feature      │  │ component    │  │ sceneTree    │     │
│  │ Registry     │  │ Registry     │  │ _elements    │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
└─────────┼─────────────────┼─────────────────┼─────────────┘
          │                 │                 │
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│              Execution/State Management                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Session      │  │ Factory      │  │ Props        │     │
│  │ Manager      │  │ (Undo/Redo)  │  │ Manager      │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### 1.5 Critical Risks

| Risk                          | Severity    | Impact                                 |
| ----------------------------- | ----------- | -------------------------------------- |
| No read-only state protection | 🔴 Critical | Can corrupt kernel state               |
| YJS document exposure         | 🔴 Critical | Can bypass transactions                |
| Counter state exposure        | 🔴 Critical | Can cause ID conflicts                 |
| No permission system          | 🔴 Critical | Malicious code can hijack system       |
| Event system not segregated   | 🟠 High     | Unauthorized state changes via events  |
| Session/feature not isolated  | 🟠 High     | Feature could hijack system operations |
| No input validation           | 🟠 High     | Runtime errors from malformed data     |
| Selection system public       | 🟠 High     | Can interfere with multi-user state    |

---

## 2. Transaction Audit

### 2.1 Identified Transaction Systems

The framework has **3 separate transaction systems** that are not coordinated:

| System                   | Location                           | State Managed                       | Required Call                   |
| ------------------------ | ---------------------------------- | ----------------------------------- | ------------------------------- |
| **DataTransact**         | factory/src/data-transact.ts       | Global undo/redo stacks, YJS arrays | startTransaction/endTransaction |
| **SceneTreeTransaction** | scene-tree/src/sceneTree.ts        | Element map, changes array          | commitSceneTreeTransaction()    |
| **PropsTransaction**     | props-manager/src/props-manager.ts | Property changes                    | commitChanges()                 |
| **SelectionTransaction** | selection/src/selections/          | Selection state                     | Manual forEach loop             |

### 2.2 Primary Transaction System (DataTransact)

**Location:** `/packages/factory/src/data-transact.ts`

**State Managed:**

- `changes: AllEvent[]` - accumulated events during transaction
- `undoStack: AllEvent[][]` - snapshot for undo
- `redoStack: AllEvent[][]` - snapshot for redo
- `isTransacting: number` - transaction nesting counter
- `inUndo: boolean` / `inRedo: boolean` - operation flags
- YJS arrays: sceneTreeChanges, elementSelectionChanges, propsChanges

**Transaction Lifecycle:**

```typescript
start() // Increment isTransacting++
update(event) // Add event to changes array if transacting
end() // Decrement isTransacting--; commitUndo() if 0
undo() // Reverse events, push to redoStack
redo() // Replay events, push to undoStack
```

**Initiation Points:**

1. `InteractionCore.executeAction()` - Line 22, 32
2. `InteractionCore.startSession()` - Line 44
3. `InteractionCore.endSession()` - Line 81
4. `createElementSelectionAPIs.selectElements()` - Lines 11-13
5. `SessionManager.handleStart()` - Line 121 (auto-starts transaction)
6. `SessionManager.handleEnd()` - Line 266 (auto-commits)

**Critical Issue: NO ERROR HANDLING**

```typescript
// INTERACTION_CORE - NO ERROR HANDLING
executeAction(...) {
    startTransaction()  // START
    const result = this.registry.decide(...)  // ⚠️ Can throw
    this.dispatchDecision(result)              // ⚠️ Can throw
    endTransaction()                          // ⚠️ Never in finally block
}

// If registry.decide() or dispatchDecision() throws:
// → isTransacting counter stays > 0
// → Future transactions nest incorrectly
// → Undo/redo breaks
```

**Reference Sharing Status:** ✅ FIXED

- undo/redo stacks now use deep cloning
- `JSON.parse(JSON.stringify(event))` prevents reference sharing
- Previous audit issue resolved

### 2.3 Secondary Transaction System (SceneTreeTransaction)

**Location:** `/packages/scene-tree/src/sceneTree.ts`

**Required API Call:** `commitSceneTreeTransaction()` MUST be called after mutations

**Critical Risk - Half-Completed State:**

```typescript
// sceneTree.ts:171-209
addNewElement(...elementData..., inUndoRedo = false): string {
    let newElement: ElementInstanceTypes | null = null

    if (inUndoRedo) {
        newElement = this.getRestoreElementById(elementData.id as string)
    } else {
        newElement = this.createElement(elementData)
    }

    if (newElement) {
        Object.keys(propOverrides).forEach((propKey) => {
            newElement.updateComputedData(propKey, propOverrides[propKey])
        })
        propsManager.commitChanges()  // Commit 1: properties

        workspace.addNewElement(newElement, parent, index)  // MUTATION 1: parent.children
        sceneTree.addToMap(element)                         // MUTATION 2: element map

        this.commitSceneTreeTransaction()                   // Commit 2: scene tree

        return newElement.get('id')
    }
    return ''  // ⚠️ If newElement is null, mutations 1-2 are NOT rolled back!
}
```

**Half-Completed State Risk:**

1. `workspace.addNewElement()` mutates children array
2. `sceneTree.addToMap()` adds to element map
3. If exception between lines 201 and 203, element is partially added
4. **No cleanup** on failure - partial mutations remain
5. If commitSceneTreeTransaction() is forgotten, element exists but not in undo/redo

**Required Commits (NOT AUTOMATIC):**

```typescript
// Must manually call commits in these locations:
// scene-tree/src/subscribes.ts:
subscribeToAddElement → sceneTree.addNewElement() → commitSceneTreeTransaction() (Line 34)
subscribeToRemoveElement → sceneTree.removeElement() → commitSceneTreeTransaction() (Line 41)
subscribeToUpdateComputedData → commitSceneTreeTransaction() (Lines 55, 66)
```

### 2.4 Secondary Transaction System (PropsTransaction)

**Location:** `/packages/props-manager/src/props-manager.ts`

**Required API Call:** `commitChanges()` MUST be called after mutations

**Commit Pattern:**

```typescript
// props-manager.ts:152
commitChanges() {
    this.changes.forEach((change) => {
        updateTransaction(change.eventName, change)
    })
    this.cleanChanges()
}
```

**Missing Commit Points:**

- Props cleanup on element deletion: NO transaction wrapper
  ```typescript
  // props.ts:117-123
  cleanup() {
      const removedPropertyIds: { id: string }[] = []
      this.propertyIds.forEach((id) => {
          removedPropertyIds.push({ id })
      })
      removeProperty(removedPropertyIds)  // ⚠️ No transaction wrapper
  }
  ```

### 2.5 CRUD Operations and Transaction Safety

#### Element Creation (ADD) Flow

```
publishEvent(ADD_ELEMENT)
  → subscribeToAddElement (scene-tree/subscribes.ts:30)
    → sceneTree.addNewElement()
        → createElement() - Creates element
        → workspace.addNewElement()  [MUTATION 1: parent.children]
        → sceneTree.addToMap()       [MUTATION 2: element map]
    → commitSceneTreeTransaction()  [REQUIRED CALL]
```

**Transaction Safety Issues:**

1. **Half-Completed State:** Exception between mutation and commit leaves partial state
2. **Double Transaction Commit:**
   - `propsManager.commitChanges()` (Line 199) - Properties committed
   - `commitSceneTreeTransaction()` (Line 203) - Scene tree committed
   - If first succeeds but second fails: properties committed, scene tree not committed

#### Element Updates (UPDATE) Flow

```
element.set('x', 10)
  → Setter.set() (utils/src/setter.ts:33)
    → this.data[key] = value  [IMMEDIATE MUTATION] ⚠️ STATE CHANGED NOW
    → addChangeCallback()
      → sceneTree.addChange() - Adds to changes array
```

**CRITICAL ISSUE: STATE MUTATED IMMEDIATELY, COMMIT DEFERRED**

```typescript
// setter.ts:33-46
set<K extends keyof T>(key: K, value: T[K], options?: EvnetOptions): void {
    if (key in this.data) {
        const before = cloneDeep(this.data[key])
        this.data[key] = value  // ⚠️ MUTATION HAPPENS IMMEDIATELY
        const after = cloneDeep(value)

        if (!isEqual(before, after)) {
            this.addChangeCallback({ ... })
        }
    }
}
```

**Transaction Safety Issues:**

1. **Immediate mutation before transaction boundary**
   - If `commitSceneTreeTransaction()` is never called, state IS STILL MUTATED
   - User sees the change, but cannot undo it
2. **Two-step pattern required:**

   ```typescript
   // Step 1: Mutate state
   element.set('x', 100) // State changed NOW

   // Step 2: Manually commit
   sceneTree.commitSceneTreeTransaction() // Required!
   ```

### 2.6 Missing Transaction Wrappers

| Operation                      | Location            | Issue                             |
| ------------------------------ | ------------------- | --------------------------------- |
| Props cleanup                  | props.ts:117-123    | No transaction wrapper            |
| Group.addElement/RemoveElement | group.ts:45         | Calls `this.set()` but no wrapper |
| Workspace.addNewElement        | workspace.ts:54-82  | Multiple mutations, no wrapper    |
| Workspace.removeElement        | workspace.ts:84-114 | Multiple mutations, no wrapper    |
| Setter.set()                   | setter.ts:33        | Immediate mutation, no wrapper    |

### 2.7 Anti-Patterns Found

#### Anti-Pattern 1: State Mutation Without Transaction Wrapper

```typescript
// ALL setter mutations are immediate
this.data[key] = value // State changed NOW, commit happens later (or never)
```

**Why dangerous:**

- State changes before transaction begins
- If commit is forgotten, changes are permanent but not undoable
- No rollback mechanism if operations fail

#### Anti-Pattern 2: Missing Error Handling

**Found in:** ALL transaction systems except `withTransaction`:

```typescript
// INTERACTION_CORE - NO ERROR HANDLING
startTransaction()
const result = this.registry.decide(...)  // Could throw
this.dispatchDecision(result)              // Could throw
endTransaction()  // Not in finally block - if decide() throws, never called
```

**Good Exception:** `withTransaction` wrapper

```typescript
// feature-system/src/utils/micro-features.ts
export const withTransaction = (packages: MicroFeaturePackages) => {
  return <T>(callback: () => T): T => {
    packages.factory?.startTransaction?.()
    try {
      return callback()
    } finally {
      // ✅ FINALLY ensures endTransaction is called
      packages.factory?.endTransaction?.()
    }
  }
}
```

#### Anti-Pattern 3: Required Manual Commits

**CRITICAL:** These commits CANNOT be automated - require manual placement:

1. `propsManager.commitChanges()`
2. `sceneTree.commitSceneTreeTransaction()`
3. `elementSelection.changes.forEach(updateTransaction)`
4. `startTransaction()` / `endTransaction()`

**Missing in:**

- Direct calls to `element.set()` - must manually commit
- Direct calls to `group.addElement/RemoveElement()` - must manually commit
- Direct calls to `workspace.addNewElement/removeElement()` - must manually commit

### 2.8 Validation and Completion Checks

**What Validates Transactions?** NONE

- **No validation** that transactions complete properly
- **No validation** that all mutations are committed
- **No validation** that undo/redo stacks are in sync
- **No validation** that state is consistent

**What IS checked:**

- `isTransacting` counter - prevents duplicate commits, but doesn't detect incomplete transactions
- `inUndo`/`inRedo` flags - prevents infinite undo/redo loops

**What Can Cause Abandoned Transactions:**

1. **Exceptions:**

   ```typescript
   startTransaction()
   throw new Error('Something failed') // Exception
   // endTransaction() never called → isTransacting stays > 0
   // Future transactions: isTransacting increments to 2, 3, 4...
   ```

2. **Early returns:**

   ```typescript
   // workspace.ts:59-62
   if (!workspace) {
     return '' // Early return, but what if mutations already happened?
   }
   ```

3. **Conditional commits:**
   ```typescript
   // sceneTree.ts:191-208
   if (newElement) {
     // ... mutations ...
     this.commitSceneTreeTransaction() // Only called if newElement exists
     // What if mutations succeed but commit fails?
     return newElement.get('id')
   }
   return '' // No cleanup of mutations before this line
   ```

### 2.9 Risk Summary by Severity

| Severity        | Risk                                           | Impact                                                           |
| --------------- | ---------------------------------------------- | ---------------------------------------------------------------- |
| 🔴 **Critical** | Immediate mutations before transaction         | User sees changes that cannot be undone                          |
| 🔴 **Critical** | No error handling in wrappers                  | Exceptions leave isTransacting > 0                               |
| 🔴 **Critical** | Multi-step mutations without rollback          | Partial state on failure (parent has child but child not in map) |
| 🔴 **Critical** | Props cleanup without transaction              | Property deletion not tracked in undo/redo                       |
| 🟠 **High**     | Required manual commits                        | Easy to forget, leads to untracked changes                       |
| 🟠 **High**     | No transaction completion validation           | Silent failures, inconsistent state                              |
| 🟠 **High**     | Three uncoordinated transaction systems        | Changes can be committed to one system but not others            |
| 🟡 **Medium**   | Nested transaction counter can get out of sync | Requires debugging to detect                                     |
| 🟡 **Medium**   | Undo/redo stacks not validated                 | Undo/redo may not work correctly on errors                       |
| 🟢 **Low**      | Y.js UndoManagers unused                       | Confusing architecture, but working with custom implementation   |

---

## 3. Singleton & Instance Management

### 3.1 Complete Singleton Inventory

**Total Singletons:** 19 instances across 14 packages

#### Package-Level Breakdown

| Package                     | Singletons   | Risk Level  | Notes                                                 |
| --------------------------- | ------------ | ----------- | ----------------------------------------------------- |
| **@asyra/factory**          | 6            | 🔴 Critical | Global YJS doc, undo/redo managers, transaction state |
| **@asyra/scene-tree**       | 2            | 🔴 Critical | Depends on 3 other singletons, massive mutation risk  |
| **@asyra/render**           | 2 + stores   | 🔴 Critical | PixiJS globals, DOM manipulation, no cleanup          |
| **@asyra/system-context**   | 6            | 🔴 Critical | Massive dependency chain                              |
| **@asyra/input-system**     | 1 + keymap   | 🔴 Critical | Global event listeners, browser dependency            |
| **@asyra/selection**        | 3            | 🟠 High     | Mutable selection state                               |
| **@asyra/ui-context**       | 3            | 🟠 High     | RxJS subscription management, memory leaks            |
| **@asyra/props-manager**    | 2            | 🟠 High     | Transaction state, change tracking                    |
| **@asyra/utils**            | 2            | 🟠 High     | Simple counters but testing issues                    |
| **@asyra/reactive-events**  | 1 + registry | 🟠 High     | Global event bus, memory leaks                        |
| **@asyra/interaction-core** | 1            | 🟡 Medium   | Deprecated                                            |

### 3.2 Critical Singleton Risks

#### Risk 1: Initialization Order Dependencies

**Most Critical Chain:**

```
factory.doc (Y.Doc)
  ↓
factory.sceneTreeChanges
factory.elementSelectionChanges
factory.sceneTreeChangesManager
factory.elementSelectionChangeManager
factory
  ↓
inputSystem (uses window events)
  ↓
propsManager (subscribes to factory YJS arrays)
selectionManager (registers elementSelection, vertexSelection)
sceneTree (depends on propsManager, factory)
  ↓
render (dependencies on renderSelection which depends on selectionManager)
uiContext.propertyRegistry
uiContext
  ↓
systemContext (depends on ALL 5 state singletons)
```

**The Problem:**

- ❌ Changing import order can break the app
- ❌ Tests that don't import in exact same order will fail
- ❌ Circular dependencies are hidden
- ❌ No validation that dependencies are ready

#### Risk 2: Memory Leaks

**RxJS Subscriptions:**

- `uiContext.propertyRegistry.subscriptions` Map - never cleaned up
- `ui-context` stores subscribe to YJS changes - no cleanup
- `reactive-events` event bus - subscribers must manually unsubscribe

**YJS Changes:**

- `factory.sceneTreeChanges` array grows indefinitely
- `factory.elementSelectionChanges` array grows indefinitely
- No cleanup mechanism for old changes

**PixiJS:**

- `render` ticker runs forever
- No dispose/cleanup methods

**Risk Timeline:**

```
Application启动 → Subscriptions accumulate → YJS arrays grow → PixiJS ticks
   ↓                 ↓                       ↓                    ↓
 100ms             1min                    10 min               24h
Low risk           Medium                  High                Critical
```

#### Risk 3: Test Isolation Failures

**Tests Cannot Run in Parallel:**

- All 19 singletons are shared across all tests
- Tests can't create isolated instances
- Tests interfere with each other's state

**Tests Cannot Clean Up:**

- Only `idCounter`, `nameCounter`, and `propertyRegistry` have `clear()` methods
- No global reset/unload mechanism

**State Pollution Example:**

```typescript
// Test file A (runs first)
import { idCounter } from '@asyra/utils'
test('creates ID 1', () => {
  const id = idCounter.increase('DEFAULT')
  expect(id).toBe('1') // ✅ Passes
})

// Test file B (runs second)
import { idCounter } from '@asyra/utils'
test('expects ID 1, gets different', () => {
  const id = idCounter.increase('DEFAULT')
  expect(id).toBe('1') // ❌ FAILS - gets '2' or higher!
  // Why? Singletons are module-level and persist across all tests
})
```

#### Risk 4: Mutable State Corruption

**Exposed Internal State:**

| Package      | Exposed State                              | Risk                              |
| ------------ | ------------------------------------------ | --------------------------------- |
| utils        | `IDCounter.counter`, `NameCounter.counter` | Direct manipulation, ID conflicts |
| selection    | `Selection.selectedIds`/Set                | Set references exposed            |
| scene-tree   | `_elements`, `_deletedMap`                 | Map references exposed            |
| input-system | `activeKeys`, `listeners`, `timers`        | Direct access, listener hijacking |

**Transaction State Corruption:**

- `SceneTree.changes`, `PropsManager.changes` - manually managed arrays
- If `cleanChanges()` isn't called, old transactions persist
- If `commitChanges()` isn't called, changes are lost

**Corruption Example:**

```typescript
// Thread 1
sceneTree.addElement({ id: '1', type: 'rect' }) // Adds to changes array
// But doesn't call commitSceneTreeTransaction() yet...

// Thread 2 (async callback fires)
sceneTree.addElement({ id: '2', type: 'rect' }) // Adds to same changes array

// Thread 1 calls commitSceneTreeTransaction()
// Both changes committed as one transaction

// Thread 2 calls commitSceneTreeTransaction()
// Changes already committed, but commitSceneTreeTransaction() calls again
// → Events fired twice, undo/redo corrupted
```

#### Risk 5: Locking and Race Conditions

**YJS Doc:**

- Single `Y.Doc` shared by entire app
- Multiple UndoManagers on same doc can interfere
- No locking mechanism for concurrent transactions

**Render Ticker:**

- PixiJS `Ticker.shared` used by render singleton
- Can't control tick rate or pause for certain operations

**Input System:**

- Global event listeners on `window`
- Mouse state can change during async operations
- No way to defer/suspend input processing

### 3.3 Safe Alternatives (Present but Not Used)

#### Constructor Injection Pattern

**Good examples (support DI but still instantiated as singletons):**

```typescript
// packages/ui-context/src/stores/selection.ts
export default class SelectionStore {
  constructor(
    public selectionManager: SelectionManager // Dependency
  ) {
    // Has proper factory pattern!
  }
}

// But singleton is still created:
export const selectionStore = new SelectionStore(selectionManager)
```

**Status:** Classes support DI, but singletons override this.

#### Factory Functions

**Good examples:**

```typescript
// packages/scene-tree/src/utils.ts
export const createElement = (elementData: Partial<ElementRawData>) => { ... }

// packages/props-manager/src/props-manager.ts
createProperty(propData: Partial<PropertyComponentRawData>) { ... }

// packages/reactive-events/src/event-bus.ts
export const createEventStream = <T extends AllEvent>(...) => { ... }
```

**Problem:** These factories create items but register them into singleton registries.

#### API Factory Pattern (Good Pattern)

```typescript
// packages/core/src/apis/index.ts
export const createAPIs = (sceneTree: SceneTree, render: Render): CoreAPIs => {
  return {
    sceneTreeInit: () => sceneTree.init()
    // ...
  }
}
```

**Status:** Proper dependency injection for core layer.

---

## 4. Flow Mapping

### 4.1 Core Forced Flows

Core flows are infrastructure that always runs regardless of user code.

#### Main App Bootstrap Flow

```typescript
// Entry Point: apps/asyra-design/src/init/init-app.ts
initApp() {
  // 1. Initialize property registry
  initPropertyRegistrations()
  // 2. Initialize input system listeners
  initInputSystem()
  // 3. Initialize features (triggers defineFeature registrations)
  initFeatures()
}

// Feature initialization triggers defineFeature registrations
// Features are auto-registered when imported!
```

#### Core System Initialization Flow

```typescript
// packages/core/src/core.ts - Core.start()
core.start(container, renderOptions) {
  // Phase 1: Initialize renderer
  await renderer.init(container, renderOptions)
  setupInputSystem(canvas)

  // Phase 2: Initialize UI contexts
  initDataContexts()

  // Phase 3: Load data from persistence
  await loadFromPersistence()

  // Phase 4: Initialize feature system
  initFeatureSystem({ inputSystem, systemContext, interactionCore })

  // Phase 5: Notify render system ready
  renderIsReady()
}
```

#### Feature System Initialization Flow

```typescript
// packages/core/src/feature-integration.ts
initFeatureSystem(coreDeps) {
  // CRITICAL: This triggers pending feature registrations
  setCorePackages(coreDeps)
}

// packages/feature-system/src/core/feature.ts
setCorePackages(packages) {
  // Flush pendingRegistrations → registers all features
  for (const registration of pendingRegistrations) {
    registerFeatureHandlers(
      registration.featureName,
      registration.keyConfig,
      registration.definition
    )
  }
}
```

#### Core Event Loops

**1. Render Loop (PixiJS Ticker)**

```typescript
// packages/render/src/render.ts
class Render {
  constructor() {
    this.run() // Start immediately
  }

  run() {
    ticker.add(() => {
      const animate = (time: number) => {
        this.updateLayers() // Update viewport and selection
      }
      animate(performance.now())
    })
  }
}

// This ticker runs continuously (PixiJS requestAnimationFrame loop)
```

**2. Input Processing Loop**

```typescript
// packages/input-system/src/input-system.ts
class InputSystem {
  constructor() {
    this.setupListeners() // Set up DOM event listeners IMMEDIATELY
  }

  private setupListeners() {
    // Global event listeners on window
    window.addEventListener('keydown', this.handleKeyDown)
    window.addEventListener('keyup', this.handleKeyUp)
    window.addEventListener('mousedown', this.handleMouseDown)
    window.addEventListener('mouseup', this.handleMouseUp)
    window.addEventListener('mousemove', this.handleMouseMove)
    window.addEventListener('wheel', this.handleWheel)
    window.addEventListener('contextmenu', (e) => e.preventDefault())
  }

  // When canvas is ready, switches to canvas element
  switchWatchedElement(watchedElement: HTMLElement) {
    // Remove window listeners, add canvas listeners
  }
}
```

**3. Automatic Registration Pipelines**

**Component Registration (defineComponent):**

```typescript
defineComponent(definition) {
  // When module containing defineComponent() is imported:
  // 1. Register properties with PropertyRegistry
  for (const prop of properties) {
    propertyRegistry.register(prop, type)
  }

  // 2. Create dynamic component class
  const ComponentClass = createDynamicComponent(type, idPrefix, ...)

  // 3. Register with ComponentRegistry
  componentRegistry.register({ type, constructor: ComponentClass, ... })

  // 4. Register render strategy if provided
  if (renderStrategy) renderRegistry.register(type, renderStrategy)
}
```

**Feature Registration (defineFeature):**

```typescript
// User defines a feature in a module
export const myFeature = defineFeature('myFeature', 'input.drag', { ... })

// Then in init-features.ts:
import '../features'  // ← Triggers ALL defineFeature() calls!

// defineFeature() does:
export function defineFeature<API, State>(name, keyConfig, definition) {
  // 1. Register API in FeatureRegistry
  const api = featureRegistry.register(name, definition)

  // 2. If core packages ready, register handlers IMMEDIATELY
  if (isPackagesSet) {
    registerFeatureHandlers(name, keyConfig, definition)
  } else {
    // 3. Otherwise queue for later
    pendingRegistrations.push({ featureName: name, keyConfig, definition })
  }

  return { api }
}
```

### 4.2 User-Defined Flow Mechanisms

#### Feature System (defineFeature)

**Feature Definition Structure:**

```typescript
interface FeatureDefinition<API, State> {
  // Public API for other features/UI to call
  api?: API

  // One-time execution (e.g., keyboard shortcuts)
  execution?: ExecutionHandler

  // Session-based execution (e.g., drag operations)
  session?: SessionHandler<State>

  // Priority settings
  priority?: number // Higher = runs first
  exclusive?: boolean // If true, stops lower priority features
}
```

**What Users Can Do:**

1. Define public API methods that can be imported via `importFeature('name')`
2. Register execution handlers for one-time events (keyboard shortcuts, clicks)
3. Register session handlers for multi-step interactions (drag, scroll)
4. Import other features and call their APIs
5. Set priority levels to control execution order
6. Mark exclusive to block lower-priority features

#### Component System (defineComponent)

**Component Definition Structure:**

```typescript
interface ComponentDefinition {
  type: string // Unique type identifier
  idPrefix: string // Prefix for ID generation
  namePrefix: string // Prefix for name generation
  properties: PropertyDefinition[]
  renderStrategy?: RenderStrategy // Custom rendering
  isContainer?: boolean // Can have children
}
```

**What Users Can Do:**

1. Register new component types that integrate with scene tree
2. Define custom properties with types and defaults
3. Provide custom render strategies for visual rendering
4. Mark as container to support children

### 4.3 Flow Integration

#### Input Event Flow with User Integration

```
User Action (e.g., key press)
  ↓
DOM Event Listener (input-system)
  ↓
handleKeyDown / checkCombinations
  ↓
triggerAction(eventName, raw)
  ↓
Feature System Event Handler (registered by defineFeature)
  ↓
sessionManager.handleStart / handleUpdate / handleEnd
OR
executionRegistry.execute
  ↓
User Feature Handlers (onStart / onUpdate / onEnd / execution)
  ↓
User API calls (feature.api.someMethod())
  ↓
Core Package Operations (sceneTree, render, etc.)
  ↓
EventBus Publication (reactive-events)
  ↓
Other Subscribers (render updates, persistence save, etc.)
```

### 4.4 ASCII Flowcharts

#### Application Initialization Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Application Bootstrap                        │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  1. Module Initialization (Module Load Time - AUTOMATIC)           │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ • input-system: Setup DOM event listeners (global)           │  │
│  │ • scene-tree: Initialize subscribe pipelines                 │  │
│  │ • factory: Initialize transaction system                     │  │
│  │ • props-manager: Initialize property system                  │  │
│  │ • selection: Initialize selection state                      │  │
│  │ • render: Start PixiJS ticker (render loop)                  │  │
│  │ • core: Create Core instance with all deps                  │  │
│  │ • core: Import built-in components (defineComponent runs)    │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  2. User Calls initApp()                                           │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  3. initPropertyRegistrations()                                    │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  4. initInputSystem()                                              │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  5. Import Features! ← CRITICAL USER EXTENSION POINT               │
│     import '../features'  ← Triggers ALL defineFeature() calls    │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  6. initFeatures() → setCorePackages() → flush pendingRegistrations │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─┬──────────────────────────────────────────────────────────────────┐
│ │  7. User Calls core.start(canvas, options)                       │
│ ├─┬────────────────────────────────────────────────────────────────┤
│ │ │  Phase 1: renderer.init() (PixiJS app, canvas)                │
│ │ │  Phase 2: setupInputSystem(canvas)                            │
│ │ │  Phase 3: initDataContexts()                                  │
│ │ │  Phase 4: loadFromPersistence()                               │
│ │ │  Phase 5: renderIsReady()                                     │
│ └─┴────────────────────────────────────────────────────────────────┤
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Application Running ✅                           │
│                                                                     │
│  Core Loops Active:                                                │
│  • Render ticker (continuous)                                       │
│  • Input event listeners (waiting for user)                        │
│  • EventBus subscribers (processing changes)                       │
└─────────────────────────────────────────────────────────────────────┘
```

#### Session Lifecycle Flow (Drag Example)

```
┌─────────────────────────────────────────────────────────────────────┐
│              input.drag.start Event Fires                           │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  1. Cancel Active Sessions                                          │
│     • Abort any existing drag sessions                              │
│     • Call onEnd for cancelled sessions                             │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  2. Start Transaction                                               │
│     startTransaction() ← For undo/redo                              │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  3. Priority-Based Feature Selection                               │
│                                                                     │
│  For each feature (HIGHEST priority first):                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ if (thisExclusive && previousExclusive) break;             │   │
│  │                                                            │   │
│  │ try {                                                       │   │
│  │   const state = feature.onStart(snapshot)                  │   │
│  │                                                            │   │
│  │   if (state !== null) {                                    │   │
│  │     participants.push({ feature, state })                 │   │
│  │     if (feature.exclusive) thisExclusive = true;          │   │
│  │   }                                                         │   │
│  │ } catch (error) {                                           │   │
│  │   console.error('Feature error:', error)                   │   │
│  │   // Continue to next feature (isolation!)                 │   │
│  │ }                                                           │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  4. Create Active Session with participants                        │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  Session Active 🟢                                 │
└─────────────────────────────────────────────────────────────────────┘
                               │
                 ┌─────────────┴─────────────┐
                 │                           │
                 ▼                           ▼
┌────────────────────────────┐    ┌────────────────────────────┐
│  input.drag.update Event   │    │  User releases mouse       │
│                            │    │  (or session cancelled)    │
│  For each participant:     │    └────────────────────────────┘
│  try {                     │                 │
│    feature.onUpdate(       │                 ▼
│      snapshot,             │    ┌────────────────────────────┐
│      state                 │    │  input.drag.end Event      │
│    )                       │    │                            │
│  } catch (error) {         │    │  For each participant:     │
│    console.error(...)      │    │  try {                     │
│    // Continue (isolation) │    │    feature.onEnd(         │
│  }                         │    │      snapshot,            │
│└────────────────────────────┘    │      state                │
             │                     │    )                       │
             │                     │  } catch (error) {         │
             │                     │    console.error(...)      │
             │                     │  }                         │
             │                     └────────────────────────────┘
             │                               │
             └───────────────┬───────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  End Transaction                                                   │
│     endTransaction() ← Commits changes for undo/redo                │
└─────────────────────────────────────────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Clear Session                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.5 Risks and Safety Mechanisms

#### Where User Failures Could Break the Kernel

| Risk Area                  | Location                | Risk                      | Mitigation                  | Status               |
| -------------------------- | ----------------------- | ------------------------- | --------------------------- | -------------------- |
| Synchronous handlers       | inputSystem.listeners   | Infinite loops, blocking  | ⚠️ Limited - no try-catch   | **Unsafe**           |
| Feature onStart/update/end | sessionManager          | Long-running ops block UI | ✅ 5-second timeout         | **Safe**             |
| Render strategies          | defineComponent render  | Infinite loops, errors    | ⚠️ No wrapping              | **Unsafe**           |
| Feature API methods        | importFeature() calls   | Errors propagate          | ✅ Callers can wrap         | **Safe** (by design) |
| Component class methods    | Dynamic component class | Errors in getters/setters | ⚠️ No wrapping              | **Unsafe**           |
| Session handlers           | sessionManager          | Errors in user code       | ✅ Try-catch with isolation | **Safe**             |
| Execution handlers         | executionRegistry       | Errors in user code       | ✅ Try-catch with isolation | **Safe**             |

#### Current Safety Mechanisms

1. **Priority-based session isolation**
   - Higher priority exclusive features stop lower priority features
   - Errors in one feature don't prevent other features from running

2. **Timeout protection**
   - All session handlers wrapped in 5-second timeout
   - Handlers exceeding timeout are terminated

3. **Feature-level error isolation**
   - Try-catch around each feature handler
   - Console.error logged but execution continues

4. **AbortController for session cancellation**
   - Sessions can be cancelled cleanly
   - onEnd handlers called with cancelled flag

5. **Transaction system**
   - Changes wrapped in transactions
   - Can undo/redo if needed

---

## 5. Recommendations

### 5.1 Kernel Integrity

#### Critical (Must Fix)

1. **Implement Read-Only State Protection**

   ```typescript
   // Instead of exposing Maps directly:
   class SceneTree {
     private _elements = new Map<string, Element>()
     private _elementsProxy: ReadonlyMap<string, Element>

     constructor() {
       this._elementsProxy = new Proxy(new Map(), {
         get: (target, prop) => Reflect.get(this._elements, prop),
         set: () => {
           throw new Error('Read-only')
         }
       })
     }

     get elements(): ReadonlyMap<string, Element> {
       return this._elementsProxy
     }
   }
   ```

2. **Protect YJS Document Access**

   ```typescript
   // packages/factory/src/data.ts
   import * as Y from 'yjs'

   class Factory {
     private _doc: Y.Doc

     constructor() {
       this._doc = new Y.Doc()
     }

     // Don't export doc directly, provide controlled access
     getSceneTreeChanges(): Y.Array<SceneTreeYjsChange> {
       return this._doc.getArray<SceneTreeYjsChange>('sceneTreeChanges')
     }
   }
   ```

3. **Protect Counter State**

   ```typescript
   // packages/utils/src/sid/idCounter.ts
   class IDCounter {
     private _counter: Record<string, string> = {}

     increase(type: string): string {
       // No direct access to counter
       this._counter[type] = this._counter[type] || '0'
       this._counter[type] = String(parseInt(this._counter[type]) + 1)
       return this._counter[type]
     }

     clear(): void {
       this._counter = {}
     }
   }
   ```

4. **Add Namespace Isolation for Events**

   ```typescript
   // Separate kernel events from user events
   interface KernelEvents {
     'kernel:scene-tree:add': SceneTreeAddEvent
     'kernel:scene-tree:remove': SceneTreeRemoveEvent
     // ... kernel-only events
   }

   interface UserEvents {
     // User-defined events go here
   }

   // Use separate event buses:
   const kernelEventBus = new ReplaySubject<KernelEvents>(1)
   const userEventBus = new ReplaySubject<UserEvents>(1)
   ```

#### High Priority

5. **Add Input Validation at Kernel Boundaries**

   ```typescript
   class SceneTree {
     addNewElement(data: Partial<ElementRawData>): string {
       // Validate input before mutations
       if (!data.type) throw new Error('Type is required')
       if (!data.id) throw new Error('ID is required')

       const validated = this.validateElementData(data)
       // ... proceed with mutations
     }
   }
   ```

6. **Implement Capability-Based Feature System**

   ```typescript
   interface FeatureCapabilities {
     readonly canModifySceneTree: boolean
     readonly canAccessSelection: boolean
     readonly canReadElements: boolean
   }

   interface FeatureDefinition {
     capabilities: FeatureCapabilities
     // ... other fields
   }

   // Enforce capabilities at runtime
   class SessionManager {
     handleStart(feature: FeatureDefinition) {
       if (!feature.capabilities.canModifySceneTree) {
         // Don't pass sceneTree to this feature
       }
     }
   }
   ```

### 5.2 Transaction Integrity

#### Critical (Must Fix)

1. **Add try-finally to ALL transaction wrappers**

   ```typescript
   // Fix in interaction-core.ts
   executeAction(...) {
     if (this._previousSession) {
       this.cancelPreviousSession()
     }

     startTransaction()
     try {
       const result = this.registry.decide(...)
       this.dispatchDecision(result)
     } catch (error) {
       console.error('Transaction failed:', error)
       // Optional: rollback or cleanup
       throw error
     } finally {
       endTransaction()  // ✅ Always called
     }
   }
   ```

2. **Implement rollback mechanism for multi-step mutations**

   ```typescript
   addNewElement(...) {
     const backupParent = cloneDeep(parent)
     const backupMap = new Map(sceneTree._elements)

     try {
       workspace.addNewElement(element, parent, index)
       sceneTree.addToMap(element)
       this.commitSceneTreeTransaction()
     } catch (error) {
       // Rollback
       parent.children = backupParent.children
       sceneTree._elements = backupMap
       throw error
     }
   }
   ```

3. **Make transaction commits automatic**

   ```typescript
   // Instead of requiring manual commitSceneTreeTransaction():
   class SceneTree {
     addNewElement(elementData): string {
       startTransaction('scene-tree')

       try {
         workspace.addNewElement(element, parent, index)
         sceneTree.addToMap(element)
         return commitTransaction('scene-tree') // ✅ Auto-commit
       } catch (error) {
         rollbackTransaction('scene-tree')
         throw error
       }
     }
   }
   ```

4. **Add transaction validation**

   ```typescript
   class DataTransact {
     end() {
       if (this.isTransacting <= 0) {
         console.warn('endTransaction called without matching startTransaction')
         return
       }

       this.isTransacting--

       if (this.isTransacting === 0) {
         if (this.changes.length === 0) {
           console.warn('Transaction ended with no changes')
         }
         this.commitUndo()
         this.changes = []
       }
     }
   }
   ```

#### High Priority

5. **Coordinate the three transaction systems**

   ```typescript
   // Create unified commit that coordinates all systems
   class UnifiedTransactionManager {
     commitAll() {
       const hasChanges =
         this.sceneTree.commitSceneTreeTransaction() ||
         this.props.commitChanges() ||
         this.selection.commitSelectionChanges()

       if (!hasChanges) {
         console.warn('Commit called with no changes across all systems')
       }
     }
   }
   ```

6. **Add transaction timeout**

   ```typescript
   class DataTransact {
     private transactionTimeoutMs = 10000
     private transactionTimer?: ReturnType<typeof setTimeout>

     start() {
       this.isTransacting++
       if (this.isTransacting > 1) {
         return
       }

       this.transactionTimer = setTimeout(() => {
         console.warn('Transaction timeout - forcing rollback')
         this.rollbackTransaction()
       }, this.transactionTimeoutMs)
     }

     end() {
       if (this.isTransacting === 0) {
         clearTimeout(this.transactionTimer)
       }
       this.isTransacting--
     }
   }
   ```

### 5.3 Singleton & Instance Management

#### Critical (Must Fix)

1. **Create Dependency Injection Container**

   ```typescript
   interface FrameworkDeps {
     sceneTree: SceneTree
     render: Render
     inputSystem: InputSystem
     selectionManager: SelectionManager
     propsManager: PropsManager
     // ... other dependencies
   }

   export function createFramework(deps?: Partial<FrameworkDeps>): Framework {
     const defaultDeps: FrameworkDeps = {
       sceneTree: new SceneTree(),
       render: new Render(),
       inputSystem: new InputSystem(),
       selectionManager: new SelectionManager(),
       propsManager: new PropsManager()
     }

     final = { ...defaultDeps, ...deps }
     return { ...final, apis: createAPIs(final) }
   }

   // In app:
   const framework = createFramework({
     sceneTree: new SceneTree() // Can override for testing
   })
   ```

2. **Add cleanup/dispose methods to all singletons**

   ```typescript
   class SceneTree {
     dispose() {
       this._elements.clear()
       this._deletedMap.clear()
       this.changes = []
       // Unsubscribe from all observables
       this.subscriptions.forEach((sub) => sub.unsubscribe())
     }
   }
   ```

3. **Make state singletons resettable**

   ```typescript
   class IDCounter {
     reset() {
       this.counter = {}
       this.init()
     }
   }

   class SystemContext {
     reset() {
       this.systemState.reset()
       this.primaryToolState.reset()
       this.mouseState.reset()
       // ... reset all state
     }
   }
   ```

#### High Priority

4. **Add memory limits to YJS arrays**

   ```typescript
   class Factory {
     private readonly MAX_SCENE_TREE_CHANGES = 10000
     private readonly MAX_SELECTION_CHANGES = 5000
     private readonly MAX_PROPS_CHANGES = 10000

     trimSceneTreeChanges() {
       const changes = this.getSceneTreeChanges()
       if (changes.length > this.MAX_SCENE_TREE_CHANGES) {
         changes.delete(0, changes.length - this.MAX_SCENE_TREE_CHANGES)
       }
     }
   }
   ```

5. **Validate initialization order**

   ```typescript
   class SceneTree {
     private _initialized = false

     init() {
       if (!propsManager) {
         throw new Error('PropsManager not initialized')
       }
       if (!factory) {
         throw new Error('Factory not initialized')
       }
       this._initialized = true
     }
   }
   ```

6. **Create test utilities**
   ```typescript
   export function resetAllSingletons() {
     idCounter.clear()
     nameCounter.reset()
     sceneTree.reset()
     propsManager.reset()
     selectionManager.reset()
     systemContext.reset()
     // ... reset all singletons
   }
   ```

### 5.4 Flow Architecture

#### Critical (Must Fix)

1. **Add error wrapping around inputSystem callbacks**

   ```typescript
   class InputSystem {
     private setupListeners() {
       window.addEventListener('keydown', (e) => {
         try {
           this.handleKeyDown(e)
         } catch (error) {
           console.error('Error in keydown handler:', error)
         }
       })
       // Same for all other listeners
     }
   }
   ```

2. **Add error wrapping around render strategies**
   ```typescript
   class Render {
     renderElement(graphic: PixiGraphic, data: ElementData, type: string) {
       const strategy = this.renderRegistry.get(type)
       try {
         strategy(graphic, data)
       } catch (error) {
         console.error(`Error rendering ${type}:`, error)
         // Render fallback/error indicator
       }
     }
   }
   ```

#### High Priority

3. **Document all flow risks**
   ```typescript
   /**
    * ⚠️ CRITICAL: This handler runs synchronously in the input event loop.
    * DO NOT perform long-running operations or blocking I/O.
    * If you need async operations, use session-based feature pattern instead.
    *
    * @see FeatureSystem docs for session pattern
    */
   execution: (snapshot: SystemContextSnapshot) => { ... }
   ```

---

## 6. Conclusion

### Overall Assessment

The Asyra framework demonstrates **strong architectural vision** with:

✅ **Excellent extensibility** - Feature and component systems provide clean APIs for user extensions
✅ **Good error isolation** - Feature handlers have try-catch and timeout protection
✅ **Priority-based execution** - Multiple features can coexist with controlled execution order
✅ **Event-driven architecture** - Clear separation between event emission and handling
✅ **Undo/redo system** - Transaction tracking for reversible operations

### Critical Structural Risks

However, the framework has **significant structural weaknesses**:

🔴 **No state protection** - Kernel state fully exposed, user code can corrupt it
🔴 **Transaction integrity gaps** - Immediate mutations, no error handling, missing commits
🔴 **Massive singleton usage** - 19 singletons with initialization dependencies and testing issues
🔴 **Memory leak risks** - RxJS subscriptions, YJS arrays, and PixiJS ticker never cleaned up
🔴 **Missing validation** - No runtime input validation or transaction completion checks

### Risk Tolerance

The framework operates on **implicit trust**:

- Trusts user-defined feature code to not block the UI
- Trusts user-defined render strategies to not crash the render loop
- Trusts all code to call required transaction commits
- Trusts all code to not corrupt singleton state

This is acceptable for a **single-user internal tool** but **unacceptable** for:

- Multi-user applications
- Public plugins/extensions
- Long-running production systems
- Systems that need to handle malicious code

### Recommended Path Forward

**Immediate (0-2 weeks):**

1. Add try-finally to all transaction wrappers
2. Make kernel state read-only (proxies, private fields)
3. Add error wrapping around inputSystem and render callbacks
4. Implement cleanup/dispose for all singletons

**Short-term (2-4 weeks):** 5. Implement rollback mechanism for multi-step mutations 6. Make transaction commits automatic (not manual) 7. Add input validation at kernel boundaries 8. Implement unified transaction manager

**Long-term (1-2 months):** 9. Design and implement dependency injection container 10. Replace singletons with DI pattern 11. Add namespace isolation for kernel vs user events 12. Implement capability-based feature system

### Final Scorecard

| Dimension            | Score      | Status                              |
| -------------------- | ---------- | ----------------------------------- |
| Kernel Integrity     | 5/10       | 🟡 Needs improvement                |
| Transaction Safety   | 4/10       | 🔴 Critical gaps                    |
| Singleton Management | 3/10       | 🔴 Critical issues                  |
| Flow Isolation       | 7/10       | 🟢 Good (with gaps)                 |
| Error Handling       | 6/10       | 🟡 Mixed (features good, rest poor) |
| Extensibility        | 9/10       | 🟢 Excellent                        |
| Testability          | 3/10       | 🔴 Critical issues                  |
| **Overall**          | **5.3/10** | **Needs significant work**          |

---

**Audit completed:** 2025-02-16
**Auditor:** Kernel Reality Audit Agent
**Version:** 0.5
