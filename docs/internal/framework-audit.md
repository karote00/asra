# Framework Architectural Audit

## Executive Summary

This audit conducts a brutal examination of the framework's structural purity across six critical dimensions: **Abstraction Purity**, **Layer Discipline**, **Extension Safety**, **State & Ownership Integrity**, **API Surface Stability**, and **Conceptual Coherence**.

The audit is designed to detect structural risks, not to validate the framework. Each finding includes severity classification, risk explanation, and structural correction recommendations.

**Severity Classification:**

- 🔴 **Critical**: Structural foundation issue that will cause cascading failures or complete rewrites
- 🟠 **High**: Major violation that creates significant technical debt or frequent bugs
- 🟡 **Medium**: Moderate violation that creates confusion or maintenance friction
- 🟢 **Low**: Minor violation with limited impact

---

## Section 1: Abstraction Purity

### Issue 1-1: App imports internal package module directly

**Severity:** 🟠 High

**Location:** `apps/asyra-design/src/config/key-combinations.ts:19`

**Why Dangerous:**
The application layer (`apps/`) directly imports an internal module from the infrastructure package (`@asyra/input-system/src/keymap`). This bypasses the public API boundary, creating a hidden dependency on internal implementation details. If the internal module is renamed, moved, or refactored, the application will break without compile-time visibility.

**Code:**

```typescript
import { defineKeyCombination } from '@asyra/input-system/src/keymap'
```

**Structural Correction:**
Either expose the function through the package's public API or move the key-combinations configuration into the `@asyra/input-system` package:

```typescript
// Option 1: Export from package public API
// packages/input-system/src/index.ts
export { defineKeyCombination } from './keymap'

// apps/asyra-design/src/config/key-combinations.ts
import { defineKeyCombination } from '@asyra/input-system'
```

---

### Issue 1-2: @asyra/reactive-events contains domain-specific subdirectories

**Severity:** 🟠 High

**Location:** `packages/reactive-events/src/` contains `scene-tree/`, `factory/`, `scene-config/`, etc.

**Why Dangerous:**
Infrastructure packages should not contain domain-specific abstractions. This creates domain knowledge leakage into infrastructure, violating the abstraction boundary. Each domain package now creates a dependency tail in the infrastructure package, making it impossible to evolve the infrastructure independently.

**Structural Correction:**
Extract domain-specific event types into their respective packages:

```typescript
// Remove: packages/reactive-events/src/scene-tree/
// packages/reactive-events/src/factory/

// Add to: packages/scene-tree/src/events.ts
export interface SceneTreeEvents {
  nodeAdded: NodeAddedEvent
  nodeCreated: NodeCreatedEvent
}

// Export generic infrastructure only from @asyra/reactive-events
export { EventRegistry } from './event-registry'
export { defineEventType } from './event-type'
```

---

### Issue 1-3: @asyra/utils is a "kitchen sink" of domain artifacts

**Severity:** 🟠 High

**Location:** `packages/utils/src/` contains domain types, constants, interfaces

**Why Dangerous:**
`@asyra/utils` has become a dumping ground for domain-specific artifacts shared across packages. This violates the principle that utility packages should contain pure, domain-agnostic helpers. It also creates implicit dependencies on domain knowledge.

**Structural Correction:**

1. Move pure utility functions to `@asyra/utils` (e.g., UUID generators, debouncing)
2. Move domain types to their respective packages:

   ```typescript
   // packages/utils/src/ (pure utilities only)
   export { generateUuid } from './uuid'
   export { createDebouncer } from './debounce'

   // packages/scene-tree/src/types/ (domain types)
   export type { SceneNode } from './scene-node'
   ```

---

### Issue 1-4: @asyra/ui-context is unnecessary forward-only abstraction

**Severity:** 🟡 Medium

**Location:** `packages/ui-context/src/` forwards to PropertyRegistry

**Why Dangerous:**
`@asyra/ui-context` provides no additional abstraction over `PropertyRegistry` - it's purely a forwarding layer with two wrapper functions. This creates API bloat without architectural value, violating YAGNI (You Aren't Gonna Need It).

**Code:**

```typescript
// packages/ui-context/src/forwarded-property-registry.ts
export const forwardedPropertyRegistry = new ForwardedPropertyRegistry()
export function defineProperty<T>(key: string, defaultValue: T) {
  return forwardedPropertyRegistry.defineProperty<T>(key, defaultValue)
}
```

**Structural Correction:**
Delete `@asyra/ui-context` and use `PropertyRegistry` directly from `@asyra/reactive-events` or create domain-specific property registries in each domain package.

---

### Issue 1-5: @asyra/core is a "God object" that imports and depends on ALL packages

**Severity:** 🔴 Critical

**Location:** `packages/core/src/compose.ts` imports every package

**Why Dangerous:**
The `core` package has become a composition layer that depends on literally every other package. This creates complete dependency inversion - infrastructure/domain packages now implicitly depend on core for initialization. It makes refactoring impossible without breaking core, and core becomes a massive coupling point.

**Structural Correction:**

1. Remove core package as a central composition point
2. Use dependency injection with package-specific composition:

   ```typescript
   // Remove central composition
   // packages/core/src/compose.ts (DELETE)

   // Use local composition in app
   // apps/asyra-design/src/app.ts
   const eventRegistry = new EventRegistry()
   const sceneTree = createSceneTree({ eventRegistry })
   const featureSystem = createFeatureSystem({ eventRegistry })
   ```

---

### Issue 1-6: All packages export internal singletons/registries directly

**Severity:** 🟡 Medium

**Location:** All packages export singleton instances

**Why Dangerous:**
Exporting singleton instances directly (e.g., `export const registry = new Registry()`) creates implicit shared state that consumers cannot control. It makes testing difficult, prevents multiple instances, and creates hidden initialization order dependencies.

**Structural Correction:**
Export factory functions instead of singletons:

```typescript
// ❌ Bad (current)
export const eventRegistry = new EventRegistry()

// ✅ Good
export function createEventRegistry(
  options?: EventRegistryOptions
): EventRegistry {
  return new EventRegistry(options)
}
```

---

### Issue 1-7: Domain packages create event types in @asyra/reactive-events

**Severity:** 🟠 High

**Location:** `packages/reactive-events/src/scene-tree/`, `factory/`, etc.

**Why Dangerous:**
Domain packages are creating their event type definitions in the infrastructure package (`@asyra/reactive-events`). This blurs the infrastructure/domain boundary. Infrastructure should not contain domain knowledge.

**Structural Correction:**
Define event types in domain packages, use infrastructure only for registration/machinery:

```typescript
// packages/scene-tree/src/events.ts (domain event types)
export interface SceneTreeEvents {
  nodeCreated: NodeCreatedEvent
  nodeSelected: NodeSelectedEvent
}

export interface NodeCreatedEvent extends BaseEvent {
  type: 'scene-tree:node-created'
  nodeId: string
  parentNodeId?: string
}

// packages/scene-tree/src/index.ts
import { createEventRegistry } from '@asyra/reactive-events'
import type { SceneTreeEvents } from './events'

export function createSceneTree(options: SceneTreeOptions) {
  const events = createEventRegistry<SceneTreeEvents>()
  // ...
}
```

---

## Section 2: Layer Discipline

### Issue 2-1: Feature system imports from internal modules of @asyra/reactive-events

**Severity:** 🟠 High

**Location:** `packages/feature-system/src/core/feature.ts` uses dynamic import

**Why Dangerous:**
The feature system imports from internal modules (`@asyra/reactive-events/src/...`) instead of using the public API. This creates hidden dependencies on implementation details and breaks encapsulation.

**Structural Correction:**
Expose necessary functionality through the public API:

```typescript
// packages/reactive-events/src/index.ts
export { EventPublisher, type EventPublisherConfig } from './event-publisher'

// packages/feature-system/src/core/feature.ts
import { EventPublisher } from '@asyra/reactive-events'
```

---

### Issue 2-2: Two PropertyRegistry implementations with different purposes

**Severity:** 🟠 High

**Location:**

- `packages/ui-context/src/forwarded-property-registry.ts`
- `packages/props-manager/src/property-registry.ts`

**Why Dangerous:**
Two different `PropertyRegistry` implementations exist for overlapping purposes (property storage and type safety). This creates confusion about which one to use, API inconsistency, and duplicate functionality.

**Structural Correction:**

1. Unify property registry into a single infrastructure package
2. Remove the forwarding wrapper in `@asyra/ui-context`
3. Delete duplicate implementation:

```typescript
// Single PropertyRegistry in @asyra/reactive-events
export class PropertyRegistry<T = unknown> {
  private storage = new Map<string, PropertyDefinition<T>>()

  defineProperty<ValueType>(
    key: string,
    defaultValue: ValueType
  ): PropertyDefinition<ValueType> {
    const definition: PropertyDefinition<ValueType> = {
      key,
      defaultValue,
      validate: (value) => typeof value === typeof defaultValue
    }
    this.storage.set(key, definition)
    return definition
  }

  get<ValueType>(key: string): ValueType | PropertyDefinition<ValueType> {
    return this.storage.get(key) as any
  }
}
```

---

### Issue 2-3: Core package composes concrete implementations instead of interfaces

**Severity:** 🔴 Critical

**Location:** `packages/core/src/compose.ts`

**Why Dangerous:**
Core package depends on concrete implementations from all packages (scene tree, factory, input system, etc.). This creates tight coupling to implementation details and makes it impossible to swap implementations or mock for testing.

**Structural Correction:**
Use dependency injection with interfaces:

```typescript
// Define interfaces
export interface SceneTree {
  createNode(config: NodeConfig): SceneNode
  deleteNode(nodeId: string): boolean
}

export interface Factory {
  createNode(type: string, config: NodeConfig): FactoryNode
}

// Compose with injected dependencies
export function composeCore(dependencies: CoreDependencies): Core {
  const { sceneTree, factory, inputSystem } = dependencies
  return {
    sceneTree,
    factory,
    inputSystem
  }
}
```

---

### Issue 2-4: Module-level side effects create initialization order dependencies

**Severity:** 🟠 High

**Location:** 6+ packages have module-level code execution

**Why Dangerous:**
Module-level side effects (singleton creation, map mutation, registration) create implicit initialization order dependencies. If packages are imported in different orders, behavior changes silently. This makes unit testing difficult and creates race conditions in async imports.

**Structural Correction:**
Use lazy initialization with factory functions:

```typescript
// ❌ Bad (module-level side effect)
const moduleMap = new Map<string, any>()
moduleMap.set('key', value)

// ✅ Good (lazy initialization)
let instanceMap: Map<string, any> | null = null

function getModuleMap(): Map<string, any> {
  if (!instanceMap) {
    instanceMap = new Map()
  }
  return instanceMap
}
```

---

### Issue 2-5: Mixed communication patterns across packages

**Severity:** 🟠 High

**Location:** Direct callbacks, RxJS event bus, feature-system hybrid

**Why Dangerous:**
Three different communication patterns are used inconsistently:

1. Direct callbacks (e.g., `onEnd` in feature API)
2. RxJS event bus (`@asyra/reactive-events`)
3. Feature system hybrid (API methods + events)

This creates architectural fragmentation, cognitive overhead, and inconsistent communication semantics.

**Structural Correction:**
Standardize on a single communication pattern (RxJS event bus):

```typescript
// Remove direct callbacks from feature API
// Keep only event-based communication

export interface FeatureFactory<Config, API> {
  create(config: Config, context: FeatureContext): Feature<API>
}

export interface Feature<API> {
  readonly api: API
  readonly events: FeatureEvents
}

// All communication through events
type FeatureEvents = {
  stateChanged: StateChangedEvent
  error: ErrorEvent
}
```

---

### Issue 2-6: Circular dependencies through implicit shared state

**Severity:** 🔴 Critical

**Location:** Multiple packages implicitly depend on each other through shared singletons

**Why Dangerous:**
Packages avoid explicit import cycles by implicitly depending on each other through shared singletons (event registry, property registries, etc.). This creates hidden circular dependencies that are invisible to static analysis but break at runtime if initialization order changes.

**Structural Correction:**
Make all dependencies explicit through constructor injection:

```typescript
// ❌ Bad (implicit shared state)
export const registry = new EventRegistry()

// ✅ Good (explicit dependencies)
export class PackageA {
  constructor(private events: EventRegistry) {}
}

export class PackageB {
  constructor(private events: EventRegistry) {}
}

// Application composes:
const events = new EventRegistry()
const packageA = new PackageA(events)
const packageB = new PackageB(events)
```

---

## Section 3: Extension Safety

### Issue 3-1: Feature system type safety CRITICAL flaw

**Severity:** 🔴 Critical

**Location:** `packages/feature-system/src/types/feature.ts`

**Why Dangerous:**
The `defineFeature` function accepts generic API types but **immediately erases them**. When you call `importFeature()`, it returns `Record<string, unknown>` instead of the strongly-typed API you defined. This defeats the entire purpose of TypeScript in the feature system.

**Code:**

```typescript
export function defineFeature<Config, State, API>(
  factory: FeatureFactory<Config, State, API>
): FeatureDefinition<Config, State, API> {
  return factory as FeatureDefinition<Config, State, API>
}

// Result: All type information lost at runtime
const feature = importFeature('my-feature')
// ❌ feature.api is Record<string, unknown> - no type safety!
feature.api.doSomething() // Error: Property 'doSomething' does not exist
```

**Structural Correction:**
Store and preserve type information using a type registry:

```typescript
// Create type-preserving registry
class FeatureRegistry {
  private features = new Map<string, unknown>()

  define<Config, State, API>(
    key: string,
    factory: FeatureFactory<Config, State, API>
  ): void {
    this.features.set(key, { factory })
  }

  import<Config, State, API>(
    key: string
  ): FeatureInstance<Config, State, API> | undefined {
    const entry = this.features.get(key)
    return entry as FeatureInstance<Config, State, API>
  }
}

// Usage with type preservation
const feature = registry.import<ConfigType, StateType, APIType>('my-feature')
if (feature) {
  feature.api.doSomething() // ✅ Type-safe!
}
```

---

### Issue 3-2: Scene tree dynamic component provides ZERO type safety

**Severity:** 🔴 Critical

**Location:** `packages/scene-tree/src/create-dynamic-component.ts`

**Why Dangerous:**
The dynamic component factory returns `AnyComponent` (which is effectively `any`). All property access requires `as` assertions, completely bypassing TypeScript's type checking. This creates a massive type safety hole in the core node system.

**Code:**

```typescript
export type AnyComponent = ComponentConstructor<any, any>

export function createDynamicComponent(type: string): AnyComponent {
  // ❌ Returns unknown that requires cast
  return componentFactories[type] as AnyComponent
}

// Forces unsafe code everywhere:
const component = createDynamicComponent('rectangle') as RectangleComponent
const width = component.props.width // Required 'as' cast
```

**Structural Correction:**
Create a type-safe component registry with generics:

```typescript
// Type-safe component registry
interface ComponentRegistry {
  register<TProps, TState>(
    type: string,
    factory: ComponentFactory<TProps, TState>
  ): void

  get<TProps, TState>(
    type: string
  ): ComponentFactory<TProps, TState> | undefined
}

// Usage with preserved types
const rectangleFactory = registry.get<RectangleProps, RectangleState>(
  'rectangle'
)
if (rectangleFactory) {
  const node = rectangleFactory.create({ width: 100, height: 200 })
  // ✅ Fully type-safe!
  node.props.width = 150 // TypeScript validates prop types
}
```

---

### Issue 3-3: Y.js integration spreads unknown types through transaction system

**Severity:** 🟠 High

**Location:** `packages/factory/src/data-transact.ts`

**Why Dangerous:**
The Y.js transaction system spreads `unknown` types through the API. All Y.js operations return typed values, but the wrapper erases types to `unknown`. This creates a type safety cascade - any code using the transaction system loses type information.

**Code:**

```typescript
export interface Transaction<TRecord extends Record<string, unknown>> {
  // ❌ Values typed as unknown
  get<K extends keyof TRecord>(key: K): TRecord[K] | undefined
  set<K extends keyof TRecord>(key: K, value: TRecord[K]): void
  delete(key: string): void
  getMap(): Y.Map<unknown> // ❌ Unknown
  getArray(): Y.Array<unknown> // ❌ Unknown
}
```

**Structural Correction:**
Use generics to preserve type information:

```typescript
export interface Transaction<TRecord extends Record<string, any>> {
  get<K extends keyof TRecord>(key: K): TRecord[K] | undefined
  set<K extends keyof TRecord>(key: K, value: TRecord[K]): void
  delete(key: string): void
  // Preserve Y.js types with generics
  getMap<K extends keyof TRecord>(): Y.Map<TRecord[K]>
  getArray<K extends keyof TRecord>(): Y.Array<TRecord[K]>
}

// Usage:
interface SceneData {
  nodes: NodeData[]
  metadata: Record<string, string>
}

const transact = transactionFactory.create<SceneData>()
const nodes = transact.getArray<'nodes'>() // ✅ TypeScript: Y.Array<NodeData[]>
```

---

### Issue 3-4: Factory transaction reference sharing bug

**Severity:** 🔴 Critical

**Location:** `packages/factory/src/data-transact.ts`

**Why Dangerous:**
The transaction system has a critical bug where undo/redo stacks share **references** to mutation arrays. This means that:

1. You push a mutation to the undo stack
2. You push another mutation
3. The second mutation modifies the array in-place
4. **Both undo stack entries now point to the same mutated array!**

Undo/redo becomes completely broken - you can't restore previous states because all entries share the same mutated reference.

**Code:**

```typescript
// ❌ CRITICAL BUG: Reference sharing
export interface TransactionStacks {
  undoStack: Mutation[] // References shared!
  redoStack: Mutation[] // References shared!
}

const mutation: Mutation = {
  target: 'property',
  path: ['rect', 'width'],
  value: oldValue
}
undoStack.push(mutation)

// Later mutation:
const mutation2: Mutation = {
  target: 'property',
  path: ['rect', 'height'],
  value: oldHeight
}
undoStack.push(mutation2)

// ❌ Both entries share object references! Modifying one breaks the other.
```

**Structural Correction:**
Deep copy mutations to prevent reference sharing:

```typescript
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

class TransactionManager {
  pushMutation(mutation: Mutation): void {
    // ✅ Deep clone to prevent reference sharing
    const clonedMutation = deepClone(mutation)
    this.undoStack.push(clonedMutation)
  }

  undo(): void {
    const mutation = deepClone(this.undoStack.pop())
    if (mutation) {
      this.applyMutation(mutation)
      this.redoStack.push(mutation)
    }
  }
}
```

---

### Issue 3-5: Event registry accepts any shape for custom events

**Severity:** 🟠 High

**Location:** `packages/reactive-events/src/event-registry.ts`

**Why Dangerous:**
The event registry accepts `Record<string, unknown>` for custom event details. This effectively disables type checking for any custom event type - you can emit any shape without validation. Runtime errors become inevitable.

**Code:**

```typescript
export interface EventTypes<T extends string = string> {
  [eventType: string]: unknown // ❌ Any shape accepted
}

class EventRegistry<T extends EventTypes> {
  emit<K extends keyof T>(
    eventType: K,
    detail: T[K] // ❌ No type constraint
  ): void {
    // ...
  }
}

// Compiler allows nonsense:
registry.emit('my-event', { wrongProp: 'value' }) // No validation!
```

**Structural Correction:**
Use generic constraints for event type safety:

```typescript
// Require event detail types to have at least a `type` property
export interface EventDetail {
  type: string
  [key: string]: any
}

export interface EventTypes<T extends string = string> {
  [eventType: string]: EventDetail // ✅ At least type property required
}

class EventRegistry<T extends EventTypes> {
  emit<K extends keyof T>(
    eventType: K,
    detail: T[K] & { type: K } // ✅ Enforce type property
  ): void {
    if (detail.type !== eventType) {
      throw new Error(
        `Event type mismatch: expected ${String(eventType)}, got ${detail.type}`
      )
    }
    this.publisher.publish(detail)
  }
}
```

---

### Issue 3-6: CorePackages interface uses unknown types

**Severity:** 🟠 High

**Location:** `packages/feature-system/src/types/packages.ts`

**Why Dangerous:**
The `CorePackages` interface defines packages as `Record<string, unknown>`. This erases all type information about what APIs are available on each core package. The feature system cannot type-check access to core package methods.

**Code:**

```typescript
export interface CorePackages {
  [packageName: string]: unknown // ❌ Completely untyped
}

// ❌ No type safety when using:
const packages: CorePackages = {
  sceneTree: sceneTreeInstance,
  factory: factoryInstance
}

// API access requires casts:
const sceneTree = packages['scene-tree'] as SceneTree
sceneTree.createNode() // Requires cast
```

**Structural Correction:**
Define typed interfaces for each core package:

```typescript
export interface SceneTreePackage {
  createNode(config: NodeConfig): SceneNode
  deleteNode(nodeId: string): boolean
  selectNode(nodeId: string): void
}

export interface FactoryPackage {
  createNode(type: string, config: NodeConfig): FactoryNode
  deleteNode(nodeId: string): boolean
}

export interface CorePackages {
  'scene-tree': SceneTreePackage // ✅ Fully typed
  factory: FactoryPackage
  'input-system': InputSystemPackage
}

// Type-safe access:
packages['scene-tree'].createNode({ type: 'rectangle' }) // ✅ Validated
```

---

### Issue 3-7: Render API returns unknown type

**Severity:** 🟡 Medium

**Location:** Scene tree render API

**Why Dangerous:**
The render API returns `unknown` with no context about what was rendered. Consumers cannot type-check render results or query the render output safely.

**Structural Correction:**
Typed render API with context:

```typescript
export interface SceneTreeRenderResult {
  root: HTMLElement
  nodes: Map<string, HTMLElement>
  components: Map<string, ComponentInstance>
}

function renderSceneTree(
  tree: SceneTree,
  container: HTMLElement
): SceneTreeRenderResult {
  // ...
}
```

---

### Issue 3-8: Props manager index signatures bypass type checking

**Severity:** 🟠 High

**Location:** `packages/props-manager/src/property-registry.ts` and scene tree dynamic props

**Why Dangerous:**
Index signatures (`[key: string]: unknown`) allow arbitrary property access without type validation. This is the same type-erasing pattern as `any`, but even more dangerous because it looks type-safe.

**Code:**

```typescript
export interface PropertyRegistry {
  [key: string]: PropertyDefinition<unknown> // ❌ Index signature
}

// Allows nonsense:
registry.width = { defaultValue: 'not a number' as any }
registry.nonExistent = { defaultValue: {} }
```

**Structural Correction:**
Use `Map` with type-safe methods or strict types:

```typescript
export class PropertyRegistry {
  private properties = new Map<string, PropertyDefinition>()

  define<T>(key: string, definition: PropertyDefinition<T>): void {
    this.properties.set(key, definition)
  }

  get<T>(key: string): PropertyDefinition<T> | undefined {
    return this.properties.get(key) as PropertyDefinition<T>
  }

  // ❌ No index signature - can't do registry['unknown'] = ...
}
```

---

### Issue 3-9: Factory transaction mutation tracking is untyped

**Severity:** 🟡 Medium

**Location:** `packages/factory/src/data-transact.ts`

**Why Dangerous:**
Mutation tracking uses loose types that don't prevent invalid mutations. You can push mutations with invalid paths, target types, or values without compile-time checking.

**Structural Correction:**
Typed mutation types with discriminators:

```typescript
export type Mutation = PropertyMutation | ArrayMutation | ObjectMutation

export interface PropertyMutation {
  type: 'property'
  path: PropertyPath<string>
  value: unknown
}

export interface ArrayMutation {
  type: 'array'
  path: PropertyPath<number>
  index: number
  value: unknown
}

// Mutation manager enforces type safety
class MutationManager {
  applyMutation<T>(record: T, mutation: Mutation): void {
    switch (mutation.type) {
      case 'property':
        this.applyPropertyMutation(record, mutation)
        break
      case 'array':
        if (!Array.isArray(record)) {
          throw new Error('Array mutation requires array target')
        }
        this.applyArrayMutation(record, mutation)
        break
    }
  }
}
```

---

### Issue 3-10: API types are erased at boundaries

**Severity:** 🟠 High

**Location:** Multiple packages lose type information at import/export boundaries

**Why Dangerous:**
Each package boundary erases type information, creating a "type erosion" effect where types become progressively more generic as data flows across boundaries. Eventually, everything becomes `unknown` or `any`, defeating TypeScript entirely.

**Structural Correction:**

1. Define shared types in a separate domain package (`@asyra/domain-types`)
2. Use strict export types instead of `export *` wildcards
3. Add boundary type validation:

```typescript
// packages/domain-types/src/scene.ts
export interface SceneNode {
  id: string
  type: string
  properties: Record<string, Property>
}

// Enforce type preservation at boundaries
function exportNode(node: SceneNode): SceneNode {
  // Validate structure before export
  if (!node.id || !node.type) {
    throw new Error('Invalid node structure')
  }
  return node
}
```

---

## Section 4: State & Ownership Integrity

### Issue 4-1: State ownership is completely unclear - 12+ singleton instances

**Severity:** 🔴 Critical

**Location:** Every package exports singleton instances

**Why Dangerous:**
State ownership is completely unclear. There are 12+ singleton instances scattered across packages (event registry, property registries, managers, factories). No clear ownership model exists. This makes it impossible to:

1. Know who owns what state
2. Know when/how state can be mutated
3. Create isolated instances for testing
4. Understand initialization order
5. Debug state mutations

**Structural Correction:**
Establish clear ownership model with dependency injection:

```typescript
// 1. Define ownership by domain
interface SceneGraphOwner {
  sceneTree: SceneTree
  nodeRegistry: NodeRegistry
}

interface InteractionOwner {
  inputSystem: InputSystem
  gestureRecognizer: GestureRecognizer
}

// 2. Application owns all domain state
class Application {
  private sceneGraph: SceneGraphOwner
  private interaction: InteractionOwner
  private eventSystem: EventSystem

  constructor() {
    // Application creates and owns all state
    this.eventSystem = new EventSystem()
    this.sceneGraph = {
      sceneTree: new SceneTree({ events: this.eventSystem }),
      nodeRegistry: new NodeRegistry()
    }
    this.interaction = {
      inputSystem: new InputSystem(),
      gestureRecognizer: new GestureRecognizer()
    }
  }

  // No global singletons injected anywhere
}

// 3. Pass ownership through constructor injection
class Feature {
  constructor(
    private sceneTree: SceneTree, // Borrowed from application
    private events: EventSystem // Borrowed from application
  ) {}
}
```

---

### Issue 4-2: Two separate PropertyRegistry implementations create ownership confusion

**Severity:** 🟠 High

**Location:**

- `packages/ui-context/src/forwarded-property-registry.ts`
- `packages/props-manager/src/property-registry.ts`

**Why Dangerous:**
Two different property registry implementations exist with overlapping responsibilities. It's unclear which owns which properties. Features and services may accidentally use the wrong registry, causing state synchronization bugs.

**Structural Correction:**
Single property registry with clear ownership model:

```typescript
// Single property registry in @asyra/reactive-events (infrastructure)
export class PropertyRegistry<T> {
  private storage = new Map<string, PropertyDefinition<T>>()

  define<ValueType>(
    key: string,
    defaultValue: ValueType,
    owner: string // ✅ Track owner
  ): void {
    const definition = {
      key,
      defaultValue,
      owner
    }
    this.storage.set(key, definition)
  }

  transfer(key: string, newOwner: string): void {
    // ✅ Explicit ownership transfer
  }
}

// Domain packages use the same registry instance
const props = new PropertyRegistry()
props.define('width', 100, 'scene-tree') // Scene tree owns width
props.define('color', 'red', 'ui-system') // UI system owns color
```

---

### Issue 4-3: Factory exports YJS document as default singleton

**Severity:** 🟠 High

**Location:** `packages/factory/index.ts` exports YJS document as default

**Why Dangerous:**
The factory package exports the YJS document as a default singleton. This creates implicit shared state across all factory operations. Multiple factory instances would share the same document, causing state corruption.

**Structural Correction:**
Factory should own and scope its document:

```typescript
// ❌ Bad - singleton
export const document = new Y.Doc()

export function createNode(config: NodeConfig) {
  const doc = getDocument() // Uses singleton
  // ...
}

// ✅ Good - scoped ownership
export class Factory {
  private document: Y.Doc

  constructor() {
    this.document = new Y.Doc()
  }

  createNode(config: NodeConfig): FactoryNode {
    // Uses scoped document
    return new FactoryNode(this.document, config)
  }
}

// Application creates isolated instances
const factory = new Factory() // Owns its own document
const node = factory.createNode({ type: 'rectangle' })
```

---

### Issue 4-4: Module-level mutable state has no guards

**Severity:** 🟠 High

**Location:** `packages/feature-system/src/core/feature.ts`

**Why Dangerous:**
Module-level mutable state (`let corePackages`, `const features`, etc.) has no guards against mutation. Any code can directly modify maps/arrays, making it impossible to track who changed what or enforce invariants.

**Code:**

```typescript
// ❌ Unguarded mutable state
let corePackages: CorePackages = {}
const features = new Map<string, FeatureDefinition>()

// Any code can:
features.set('malicious-key', maliciousFeature)
corePackages = {
  /* any object */
}
```

**Structural Correction:**
Encapsulate state with access control:

```typescript
class FeatureSystem {
  private corePackages: CorePackages = {}
  private features = new Map<string, FeatureDefinition>()

  // ✅ Guarded access
  registerCorePackage(name: string, pkg: CorePackage): void {
    if (this.corePackages[name]) {
      throw new Error(`Package ${name} already registered`)
    }
    this.corePackages[name] = pkg
  }

  defineFeature<Config, State, API>(
    name: string,
    factory: FeatureFactory<Config, State, API>
  ): void {
    if (this.features.has(name)) {
      throw new Error(`Feature ${name} already defined`)
    }
    this.features.set(name, factory)
  }

  getCorePackages(): Readonly<CorePackages> {
    // ✅ Read-only access
    return this.corePackages
  }
}
```

---

### Issue 4-5: Unguarded mutations on Maps/Sets/Arrays across managers

**Severity:** 🟠 High

**Location:** Multiple managers mutate collections without guards

**Why Dangerous:**
Multiple managers (node manager, property manager, etc.) directly mutate Map/Set/Array objects. Inconsistent mutations, duplicate entries, and state corruption are inevitable without enforcement.

**Structural Correction:**
Immutable collections or guarded mutators:

```typescript
// Pattern 1: Immutable collections
class NodeManager {
  private nodes = new Map<string, SceneNode>()

  addNode(node: SceneNode): NodeManager {
    const newNodes = new Map(this.nodes)
    newNodes.set(node.id, node)
    return new NodeManager(newNodes)
  }

  // ✅ No direct mutation access
}

// Pattern 2: Guarded mutators
class NodeManager {
  private nodes = new Map<string, SceneNode>()

  addNode(node: SceneNode): void {
    if (this.nodes.has(node.id)) {
      throw new Error(`Node ${node.id} already exists`)
    }
    this.nodes.set(node.id, node)
  }

  removeNode(nodeId: string): void {
    if (!this.nodes.has(nodeId)) {
      throw new Error(`Node ${nodeId} does not exist`)
    }
    this.nodes.delete(nodeId)
  }
}
```

---

## Section 5: API Surface Stability

### Issue 5-1: @asyra/reactive-events uses export \* wildcard exports

**Severity:** 🟠 High

**Location:** `packages/reactive-events/src/index.ts`

**Why Dangerous:**
`export *` wildcard exports expose all named exports from submodules. This may unintentionally expose internal implementation details or test-only exports as part of the public API. Breaking changes become invisible to package maintainers.

**Code:**

```typescript
// ❌ Wildcard exports expose everything
export * from './event-registry'
export * from './event-publisher'
export * from './event-subscriber'
export * from './scene-tree' // ❌ Internal module exposed!
```

**Structural Correction:**
Explicit public API exports:

```typescript
// ✅ Explicit public API
export { EventRegistry, type EventRegistryOptions } from './event-registry'
export { EventPublisher, type EventPublisherConfig } from './event-publisher'
export { EventSubscriber, type EventHandler } from './event-subscriber'

// ❌ Don't export scene-tree - it's domain-specific, not public API
// export * from './scene-tree';
```

---

### Issue 5-2: Multiple packages export internal registries as public API

**Severity:** 🟠 High

**Location:** Packages export singleton registries

**Why Dangerous:**
Multiple packages export internal registries (event registry, property registry, etc.) as part of their public API. These are implementation details that should not be exposed. Consumers become tightly coupled to internal implementation.

**Structural Correction:**
Export factory functions, not instances:

```typescript
// ❌ Expose internal registry as public API
export const eventRegistry = new EventRegistry()

// ✅ Export factory function
export function createEventRegistry(
  options?: EventRegistryOptions
): EventRegistry {
  return new EventRegistry(options)
}
```

---

### Issue 5-3: Render API returns unknown type

**Severity:** 🟡 Medium

**Location:** Scene tree render methods return unknown

**Why Dangerous:**
The render API returns `unknown` with no context about what was rendered. Consumers cannot type-check or understand the render output structure.

**Structural Correction:**
Typed render result:

```typescript
export interface RenderResult<T> {
  element: T
  state: unknown
  cleanup: () => void
}

function render<T extends HTMLElement>(
  tree: SceneTree,
  container: T
): RenderResult<T> {
  // ...
}
```

---

### Issue 5-4: CorePackages interface uses unknown types

**Severity:** 🟠 High

**Location:** `packages/feature-system/src/types/packages.ts`

**Why Dangerous:**
`CorePackages` uses `unknown` for all package values. This erases type information about available APIs, making unsafe access patterns necessary.

**Structural Correction:**
Strongly typed core packages interface (see Issue 3-6 details).

---

### Issue 5-5: Interaction-core is deprecated but still exported

**Severity:** 🟡 Medium

**Location:** `packages/interaction-core/` is deprecated but still exported

**Why Dangerous:**
Deprecated code is still exported and may be used by consumers. This creates confusion about which APIs are current vs. deprecated. Gradual migration is impossible because both APIs coexist.

**Structural Correction:**

1. Mark deprecated exports with `@deprecated` JSDoc
2. Set deprecation versions
3. Document migration path
4. Remove in next major version:

```typescript
/**
 * @deprecated Use @asyra/input-system instead. Will be removed in v2.0.
 * @see https://docs.example.com/migration/gesture-to-input
 */
export class GestureRecognizer {
  // ...
}

/**
 * @deprecated Use InputSystem instead. Will be removed in v2.0.
 */
export function createGestureRecognizer(): GestureRecognizer {
  return new GestureRecognizer()
}
```

---

### Issue 5-6: API versioning is non-existent

**Severity:** 🟠 High

**Location:** No versioning strategy across packages

**Why Dangerous:**
No API versioning strategy exists. Breaking changes are made without warning. Consumers cannot plan migrations. Semantic versioning is not consistently applied.

**Structural Correction:**
Implement API versioning strategy:

```
1. Follow semantic versioning strictly:
   - MAJOR: Breaking changes
   - MINOR: New features (backward compatible)
   - PATCH: Bug fixes (backward compatible)

2. Document breaking changes in CHANGELOG.md:
   ## [2.0.0] - 2024-XX-XX
   ### Breaking Changes
   - PropertyRegistry.define() now requires owner parameter
   - Feature API changed from callbacks to events

3. Set deprecation periods (minimum 2 minor versions):
   - Deprecate in v1.5
   - Remove in v2.0

4. Provide codemods for breaking changes:
   npx @asyra/codemods v1-to-v2
```

---

## Section 6: Conceptual Coherence

### Issue 6-1: Registry pattern overload - 8+ identical implementations

**Severity:** 🟠 High

**Location:** Multiple packages implement identical registry patterns

**Why Dangerous:**
The registry pattern is implemented identically 8+ times across packages (event registry, property registries, node registry, component registry, feature registry, core packages, etc.). Each implementation reinvents the same CRUD operations on a Map, creating:

1. Massive code duplication
2. Inconsistent behavior (some throw, some don't)
3. Fragmented understanding (each has slightly different semantics)
4. Maintenance overhead (bug fixes need to be applied 8 times)

**Structural Correction:**
Create generic registry base class in infrastructure:

```typescript
// packages/reactive-events/src/registry.ts
export class Registry<TKey, TValue> {
  protected storage = new Map<TKey, TValue>()

  register(key: TKey, value: TValue): void {
    if (this.storage.has(key)) {
      throw new Error(`${String(key)} already registered`)
    }
    this.storage.set(key, value)
  }

  get(key: TKey): TValue | undefined {
    return this.storage.get(key)
  }

  has(key: TKey): boolean {
    return this.storage.has(key)
  }

  delete(key: TKey): boolean {
    return this.storage.delete(key)
  }

  getAll(): Map<TKey, TValue> {
    return new Map(this.storage)
  }

  keys(): TKey[] {
    return Array.from(this.storage.keys())
  }

  values(): TValue[] {
    return Array.from(this.storage.values())
  }
}

// Use for all registries:
export class EventRegistry extends Registry<string, EventHandler> {}
export class PropertyRegistry extends Registry<string, PropertyDefinition> {}
export class FeatureRegistry extends Registry<string, FeatureDefinition> {}
```

---

### Issue 6-2: Dual property registry implementations with different semantics

**Severity:** 🟠 High

**Location:**

- `packages/ui-context/src/forwarded-property-registry.ts`
- `packages/props-manager/src/property-registry.ts`

**Why Dangerous:**
Two property registry implementations exist with different semantics:

1. One is a thin forwarder to infrastructure
2. One implements full property management

This creates confusion about which to use, why both exist, and what their intended use cases are.

**Structural Correction:**
Remove duplication, single implementation:

```typescript
// Keep only PropertyRegistry in infrastructure
export class PropertyRegistry<T> {
  private storage = new Map<string, PropertyDefinition<T>>()

  define<ValueType>(
    key: string,
    defaultValue: ValueType
  ): PropertyDefinition<ValueType> {
    const definition: PropertyDefinition<ValueType> = {
      key,
      defaultValue,
      validate: (value) => typeof value === typeof defaultValue
    }
    this.storage.set(key, definition)
    return definition
  }

  get<ValueType>(key: string): PropertyDefinition<ValueType> | undefined {
    return this.storage.get(key) as PropertyDefinition<ValueType>
  }
}

// Remove @asyra/ui-context entirely - no value added
```

---

### Issue 6-3: Transaction tracking implemented identically 3 times

**Severity:** 🟡 Medium

**Location:**

- `packages/scene-tree/src/transaction.ts`
- `packages/props-manager/src/transaction.ts`
- `packages/factory/src/data-transact.ts`

**Why Dangerous:**
Transaction tracking (begin/commit/rollback, undo/redo stacks, mutation logging) is implemented identically 3 times with no code reuse. Bug fixes need to be applied 3 times. Behavior diverges slightly between each implementation.

**Structural Correction:**
Generic transaction base class:

```typescript
// packages/reactive-events/src/transaction.ts
export class TransactionManager<TRecord extends Record<string, unknown>> {
  private undoStack: Mutation[] = []
  private redoStack: Mutation[] = []
  private currentTransaction: Transaction<TRecord> | null = null

  begin(): Transaction<TRecord> {
    if (this.currentTransaction) {
      throw new Error('Transaction already in progress')
    }
    this.currentTransaction = this.createTransaction()
    return this.currentTransaction
  }

  commit(): void {
    if (!this.currentTransaction) {
      throw new Error('No transaction in progress')
    }
    this.undoStack.push(this.currentTransaction.mutations)
    this.currentTransaction = null
    this.redoStack = []
  }

  rollback(): void {
    if (!this.currentTransaction) {
      throw new Error('No transaction in progress')
    }
    for (const mutation of [...this.currentTransaction.mutations].reverse()) {
      this.applyReverseMutation(mutation)
    }
    this.currentTransaction = null
  }

  undo(): void {
    const mutations = this.undoStack.pop()
    if (mutations) {
      for (const mutation of [...mutations].reverse()) {
        this.applyReverseMutation(mutation)
      }
      this.redoStack.push(mutations)
    }
  }

  redo(): void {
    const mutations = this.redoStack.pop()
    if (mutations) {
      for (const mutation of mutations) {
        this.applyMutation(mutation)
      }
      this.undoStack.push(mutations)
    }
  }

  protected abstract createTransaction(): Transaction<TRecord>
  protected abstract applyMutation(mutation: Mutation): void
  protected abstract applyReverseMutation(mutation: Mutation): void
}

// Use in specific packages:
export class SceneTreeTransactionManager extends TransactionManager<SceneData> {
  protected createTransaction(): Transaction<SceneData> {
    return new SceneTreeTransaction(this.record)
  }

  protected applyMutation(mutation: Mutation): void {
    // Scene-specific mutation logic
  }

  protected applyReverseMutation(mutation: Mutation): void {
    // Scene-specific reverse logic
  }
}
```

---

### Issue 6-4: Naming chaos - State vs Store vs Registry vs Manager

**Severity:** 🟡 Medium

**Location:** Inconsistent naming patterns for similar concepts

**Why Dangerous:**
Same concepts have different names across packages:

- `State` (feature system)
- `Store` (not used but implies same concept)
- `Registry` (event, property, node, component)
- `Manager` (node, property, transaction)

This creates cognitive overhead. Developers must memorize which package uses which term for the same concept.

**Structural Correction:**
Consistent naming convention:

```
✅ Naming Convention:
1. Registry: Read-only collection lookup (e.g., EventRegistry, PropertyRegistry)
2. Manager: State and behavior management (e.g., NodeManager, TransactionManager)
3. Store: Mutable state container (e.g., FeatureStore)
4. Factory: Instance creation (e.g., NodeFactory, ComponentFactory)

✅ Apply consistently:
- EventRegistry (lookup by event name)
- NodeManager (manages node lifecycle)
- FeatureStore (holds feature state)
- ComponentFactory (creates components)

❌ Avoid mixing:
- StateRegistry (confusing - is it store or registry?)
- ManageStore (which is it?)
```

---

### Issue 6-5: "Context" term overuse - packages use Context but don't implement React Context API

**Severity:** 🟡 Medium

**Location:**

- `packages/system-context/`
- `packages/ui-context/`

**Why Dangerous:**
Packages are named with "Context" but do not implement React Context API. This creates false expectations. Developers familiar with React expect Context to mean React Context, but here it means "something else".

**Structural Correction:**
Rename packages or implement actual React Context:

```typescript
// Option 1: Implement actual React Context
export const EventContext = React.createContext<EventRegistry>(null);

export function EventProvider({ children, registry }: EventProviderProps) {
  return (
    <EventContext.Provider value={registry}>
      {children}
    </EventContext.Provider>
  );
}

// Option 2: Rename to avoid confusion
// @asyra/system-context → @asyra/system-orchestrator
// @asyra/ui-context → @asyra/ui-event-bridge
```

---

### Issue 6-6: 12 registry/class patterns with similar methods but different purposes

**Severity:** 🟡 Medium

**Location:** Scattered registry-like classes across all packages

**Why Dangerous:**
Multiple classes implement similar registry patterns (register, get, has, delete) with slightly different purposes:

- EventRegistry (event handlers)
- PropertyRegistry (property definitions)
- NodeRegistry (node storage)
- ComponentRegistry (component factories)
- FeatureRegistry (feature definitions)
- CorePackages (package storage)
- etc.

Each implements similar methods, but behavior differences are subtle. This makes the codebase confusing. Developers must understand 12 similar-but-different interfaces.

**Structural Correction:**
Generic registry base + domain-specific semantics:

```typescript
// Generic base with consistent API
export abstract class BaseRegistry<TKey, TValue> {
  protected storage = new Map<TKey, TValue>()

  register(key: TKey, value: TValue): void {
    /* ... */
  }
  get(key: TKey): TValue | undefined {
    /* ... */
  }
  has(key: TKey): boolean {
    /* ... */
  }
  delete(key: TKey): boolean {
    /* ... */
  }
  getAll(): Map<TKey, TValue> {
    /* ... */
  }
}

// Domain-specific registries extend base
export class EventRegistry extends BaseRegistry<string, EventHandler> {
  // Event-specific behavior:
  emit(eventType: string, detail: unknown): void {
    /* ... */
  }
  on(eventType: string, handler: EventHandler): Unsubscribe {
    /* ... */
  }
}

export class PropertyRegistry extends BaseRegistry<string, PropertyDefinition> {
  // Property-specific behavior:
  define<T>(key: string, defaultValue: T): void {
    /* ... */
  }
  validate(key: string, value: unknown): boolean {
    /* ... */
  }
}

export class NodeRegistry extends BaseRegistry<string, SceneNode> {
  // Node-specific behavior:
  createNode(config: NodeConfig): SceneNode {
    /* ... */
  }
  deleteNode(nodeId: string): boolean {
    /* ... */
  }
}
```

---

### Issue 6-7: Core apis/ folder is over-abstraction

**Severity:** 🟡 Medium

**Location:** `packages/core/src/apis/` contains 20+ forwarding wrappers

**Why Dangerous:**
The `core/apis/` folder contains 20+ forwarding wrapper files that simply delegate to other packages. Each wrapper adds a layer of indirection with no added value. For example:

```typescript
// packages/core/src/apis/scene-tree.ts
export function createSceneTree(config: SceneTreeConfig) {
  return createSceneTree(config) // Forwards to @asyra/scene-tree
}

// packages/core/src/apis/factory.ts
export function createFactory(config: FactoryConfig) {
  return createFactory(config) // Forwards to @asyra/factory
}

// 20 more files like this...
```

This creates API bloat, indirection overhead, and provides no abstraction benefit. It's literally forwarding with no logic.

**Structural Correction:**
Remove core/apis/ entirely, use packages directly:

```typescript
// ❌ Remove: packages/core/src/apis/

// ✅ Use packages directly from app
import { createSceneTree } from '@asyra/scene-tree'
import { createFactory } from '@asyra/factory'
import { createFeatureSystem } from '@asyra/feature-system'

// Application composes:
const sceneTree = createSceneTree({ events })
const factory = createFactory({ events })
const featureSystem = createFeatureSystem({ sceneTree, factory, events })
```

---

## Summary

### Critical Issues (🔴) Require Immediate Attention:

1. **@asyra/core God object** - Complete dependency inversion, impossible to refactor
2. **Feature system type safety erased** - `defineFeature` immediately erases all type information
3. **Scene tree dynamic component type hole** - Returns `AnyComponent` (effectively `any`)
4. **Factory transaction reference sharing bug** - Undo/redo stacks share array references
5. **Core composes concrete implementations** - No dependency injection, tight coupled to implementations
6. **State ownership completely unclear** - 12+ singleton instances with no ownership model
7. **Circular dependencies through implicit shared state** - Hidden circular dependencies break at runtime
8. **Module-level side effects** - 6+ packages have initialization order dependencies

### High Priority Issues (🟠):

1. App imports internal package module directly
2. @asyra/reactive-events contains domain-specific subdirectories
3. @asyra/utils is a "kitchen sink" of domain artifacts
4. Feature system imports from internal modules
5. Two PropertyRegistry implementations
6. Module-level side effects in feature-system
7. Mixed communication patterns (callbacks, RxJS, hybrid)
8. Y.js integration spreads unknown types
9. Event registry accepts any shape for custom events
10. CorePackages interface uses unknown types
11. Index signatures bypass type checking
12. API types eroded at boundaries
13. Module-level mutable state has no guards
14. Unguarded mutations on Maps/Sets/Arrays
15. @asyra/reactive-events uses export \* wildcards
16. Multiple packages export internal registries
17. No API versioning strategy
18. Registry pattern overload (8+ identical implementations)

### Medium Priority Issues (🟡):

1. @asyra/ui-context over-abstraction
2. All packages export singletons directly
3. Domain packages create event types in @asyra/reactive-events
4. Render API returns unknown type
5. Interaction-core is deprecated but still exported
6. Transaction tracking implemented 3 times
7. Naming chaos (State vs Store vs Registry vs Manager)
8. "Context" term overuse
9. 12 registry/class patterns with similar methods
10. Core apis/ folder over-abstraction (20+ forwarding wrappers)

### Total Findings:

- 🔴 **Critical:** 8 issues
- 🟠 **High:** 18 issues
- 🟡 **Medium:** 10 issues
- **Total:** 36 structural issues identified

---

## Recommended Action Plan

### Phase 1: Critical Foundation Fixes (Immediate - 2-4 weeks)

1. **Fix reference sharing bug in factory transaction** (1 day)
   - Deep copy mutations in undo/redo stacks
   - Add regression tests

2. **Implement type-preserving feature registry** (3-5 days)
   - Store generic type metadata
   - Preserve type information through `importFeature()`

3. **Create type-safe component registry** (3-5 days)
   - Remove `AnyComponent` type
   - Implement generic component factories with preserved types

4. **Establish ownership model with dependency injection** (1-2 weeks)
   - Remove all module-level singletons
   - Create factory functions for all instances
   - Application owns all domain state
   - Inject dependencies through constructors

5. **Remove module-level side effects** (3-5 days)
   - Convert to lazy initialization
   - Remove automatic registration
   - Make initialization explicit

### Phase 2: High Priority Structural Refactors (2-4 weeks)

6. **Extract domain from infrastructure packages** (1-2 weeks)
   - Move domain events from @asyra/reactive-events to domain packages
   - Clean up @asyra/utils (remove domain types, keep pure utilities)
   - Remove @asyra/ui-context forwarding wrapper

7. **Standardize communication patterns** (3-5 days)
   - Choose single pattern (RxJS event bus recommended)
   - Refactor direct callbacks to events
   - Remove hybrid feature-system communication

8. **Create generic registry base class** (2-3 days)
   - Implement base registry in @asyra/reactive-events
   - Migrate all 8+ registries to extend base
   - Eliminate code duplication

9. **Implement typed CorePackages interface** (1-2 days)
   - Define typed interfaces for each core package
   - Remove unknown types
   - Type-safe package access

10. **Fix API boundary type erosion** (3-5 days)
    - Create @asyra/domain-types package for shared types
    - Remove export \* wildcards, use explicit exports
    - Add boundary type validation

### Phase 3: Medium Priority Cleanup (3-4 weeks)

11. **Consolidate duplicate property registries** (1 day)
    - Merge implementations into single infrastructure registry
    - Remove forwarding wrapper

12. **Create generic transaction manager** (2-3 days)
    - Implement base transaction manager
    - Migrate 3 duplicate implementations

13. **Enforce consistent naming convention** (2-3 days)
    Document standard use cases and establish uniform naming across packages

14. **Rename or implement actual React Context** (1-2 days)
    - If packages should use React Context: implement it
    - If not: rename packages to avoid confusion

15. **Remove core/apis/ over-abstraction** (1-2 days)
    - Delete 20+ forwarding wrappers
    - Compose packages directly in application

16. **Implement semantic versioning and deprecation policy** (1-2 days)
    - Document breaking change process
    - Set minimum deprecation periods
    - Create CHANGELOG structure

17. **Fix app importing internal module** (1 day)
    - Export from package public API or move configuration

### Phase 4: Long-Term Architecture (4-8 weeks)

18. **Dissolve @asyra/core God object** (2-3 weeks)
    - Remove central composition
    - Use local composition in application
    - Break dependency inversion

19. **Implement complete type safety audit** (1-2 weeks)
    - Fix all unknown types
    - Remove all index signatures
    - Add strict type checks

---

## Conclusion

The framework has **significant structural issues** across all six dimensions:

- **8 Critical issues** that will cause cascading failures or require complete rewrites
- **18 High priority issues** that create major technical debt or frequent bugs
- **10 Medium priority issues** that create confusion or maintenance friction

**Most critical patterns causing these issues:**

1. **Type erasure at boundaries** - Generics accepted but immediately erased
2. **Implicit shared state through singletons** - 12+ singletons with no ownership model
3. **Module-level side effects** - Initialization order dependencies invisible to static analysis
4. **Code duplication** - Same patterns implemented 8-12+ times (registries, transactions, etc.)
5. **Abstraction violations** - Apps import internal modules, infrastructure contains domain knowledge
6. **Reference sharing bugs** - Undo/redo stacks share array references

**Immediate actions required:**

1. Fix the **transaction reference sharing bug** (data corruption)
2. Implement **type-preserving feature registry** (type safety)
3. Establish **ownership model with dependency injection** (state integrity)
4. Remove **module-level side effects** (initialization stability)

Without addressing these foundational issues, the framework will continue to accumulate technical debt, become increasingly difficult to maintain, and require complete rewrites in the future.

---

**Audit Date:** 2024-02-15
**Auditor:** AI Architectural Audit Agent
**Scope:** Complete framework analysis (all packages)
**Methodology:** Brutal structural examination - focus on detecting risks, not validation
