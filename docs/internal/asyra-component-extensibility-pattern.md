## Component Extensibility Pattern

**Framework-First Philosophy: Users extend through APIs, not code modifications.**

### User-Level Component Registration

When users create custom components (like `Oval`, `Rectangle`, etc.), they use `defineComponent()` from their app code:

```typescript
// User code (no framework modifications!)
import { defineComponent } from '@asyra/core'
import { PropertyTypes } from '@asyra/utils'

defineComponent({
  type: 'oval',
  idPrefix: 'oval',
  namePrefix: 'Oval',
  properties: [
    {
      name: PropertyTypes.POSITION,
      type: PropertyTypes.POSITION,
      alias: ['x', 'y']
    },
    {
      name: PropertyTypes.DIMENSION,
      type: PropertyTypes.DIMENSION,
      alias: ['width', 'height']
    }
  ],
  renderStrategy: (graphic, data) => {
    // Custom oval rendering logic
  }
})
```

### Auto-Registration Process

`defineComponent()` automatically registers the component with the framework's naming and ID systems:

```typescript
// define-component.ts (framework code)
export function defineComponent(definition: ComponentDefinition): void {
  const { type, idPrefix, namePrefix, properties, renderStrategy, isContainer } = definition

  // 0. Register type with nameCounter for auto-numbering
  // This allows app-level components to register without modifying framework NameTypes
  nameCounter.registerType(type, namePrefix)

  // 1. Register type with idCounter for auto-numbering
  // This allows app-level components to register without modifying framework IDTypes
  idCounter.registerType(type, idPrefix)

  // 2. Register properties with PropertyRegistry
  // ...

  // 3. Create dynamic component class
  const ComponentClass = createDynamicComponent(
    type,
    idPrefix,
    namePrefix,
    properties,
    defaults,
    isContainer
  )

  // 4. Register component with ComponentRegistry
  componentRegistry.register({ type, idPrefix, namePrefix, constructor: ComponentClass, ... })

  // 5. Register render strategy if provided
  if (renderStrategy) {
    renderStrategyRegistry.register(type, renderStrategy)
  }
}
```

### Registration APIs in Counter Classes

#### nameCounter.registerType()

```typescript
// nameCounter.ts (framework code)
class NameCounter {
  registerType(
    type: string,
    namePrefix: string,
    initialValue: number = 1
  ): void {
    const baseName = namePrefix.replace(/\s+/g, '')
    const typeName = `${baseName}${CODE_SPLIT}${initialValue}`
    this.counter[type] = typeName
  }
}
```

**Usage:**

```typescript
nameCounter.registerType('oval', 'Oval')
// counter['oval'] = 'Oval 1' (internal representation)
```

#### idCounter.registerType()

```typescript
// idCounter.ts (framework code)
class IDCounter {
  registerType(type: string, idPrefix: string, initialValue: number = 1): void {
    const prefixId = `${idPrefix}${CODE_SPLIT}${initialValue}`
    this.counter[type] = prefixId
  }
}
```

**Usage:**

```typescript
idCounter.registerType('oval', 'oval')
// counter['oval'] = 'oval 1' (internal representation)
```

### Dynamic Component Type Propagation

`createDynamicComponent` returns a class that extends Element or Group:

```typescript
// create-dynamic-component.ts (framework code)
export function createDynamicComponent(
  type: string,
  idPrefix: string,
  namePrefix: string,
  properties: PropertyDefinition[],
  defaults: Record<string, unknown>,
  isContainer = false
) {
  const DynamicPropsClass = createDynamicPropsClass(properties)
  const BaseClass = (isContainer ? Group : Element) as typeof Element

  return class DynamicComponent extends BaseClass {
    constructor(data?: Partial<ElementRawData>) {
      // Pass idPrefix and namePrefix to Element constructor
      super(data, idPrefix, namePrefix)
    }

    _init(): void {
      // IMPORTANT: Set idType and nameType BEFORE calling super._init()
      // These are used by the utils id() and name() helpers
      this._idType = idPrefix // e.g., 'oval'
      this._nameType = namePrefix // e.g., 'Oval'

      super._init()

      // Override type with our component's actual type
      this.data.type = type // e.g., 'oval'
    }

    // ... other methods
  }
}
```

### Element Constructor with Prefix Support

Element base class now supports optional `idPrefix` and `namePrefix` parameters:

```typescript
// element.ts (framework code)
class Element<T extends ElementAttrs = ElementAttrs> {
  _idType: string = ''
  _nameType: string = ''

  constructor(
    data?: Partial<ElementRawData>,
    idPrefix?: string,
    namePrefix?: string
  ) {
    super(elementChangeHandler.addChange)

    // Set types BEFORE _init() (used by _init() for ID/name generation)
    this._idType = idPrefix || IDTypes.ELEMENT
    this._nameType = namePrefix || NameTypes.ELEMENT

    this._init()

    if (data && Object.keys(data).length) {
      this.load(data)
    }

    this.setupProps(data?.props)
  }

  _init(): void {
    this.data = {
      id: id(this._idType), // Uses this._idType for ID generation
      type: EntityTypes.UNDEFINED,
      name: name(this._nameType), // Uses this._nameType for name generation
      visible: true,
      lock: false
    } as T
  }
}
```

### Initialization Flow

When creating an Oval element:

```typescript
// 1. User defines component
defineComponent({
  type: 'oval',
  idPrefix: 'oval',
  namePrefix: 'Oval'
  // ...
})

// 2. defineComponent registers with counters
nameCounter.registerType('oval', 'Oval') // counter['oval'] = 'Oval 1' (internal)
idCounter.registerType('oval', ' Oval') // counter['oval'] = 'oval 1' (internal)

// 3. User creates element
const oval = new Oval({ x: 100, y: 100, width: 200, height: 150 })

// 4. Oval constructor → Element constructor with idPrefix='oval', namePrefix='Oval'
// 5. Element constructor:
//    - sets this._idType = 'oval'
//    - sets this._nameType = 'Oval'
//    - calls _init()

// 6. Element._init():
//    - generates ID: id('oval') → 'oval 1'
//    - generates name: name('Oval') → 'Oval 1'

// 7. DynamicComponent._init():
//    - sets this._idType = 'oval' (redundant but safe)
//    - sets this._nameType = 'Oval' (redundant but safe)
//    - calls super._init()
//    - sets this.data.type = 'oval'

// 8. Result:
//    - element.data.id = 'oval-1'
//    - element.data.name = 'Oval 1'
//    - element.data.type = 'oval'
```

### Group and Workspace Support

Group and Workspace classes also support the prefix pattern:

```typescript
// group.ts
class Group<T extends GroupAttrs = GroupAttrs> extends Element<T> {
  constructor(
    data?: Partial<ElementRawData>,
    idPrefix?: string,
    namePrefix?: string
  ) {
    super(data, idPrefix || IDTypes.GROUP, namePrefix || NameTypes.GROUP)
  }
}

// workspace.ts
class Workspace extends Group {
  constructor(registry: ISceneTreeRegistry) {
    super({}, IDTypes.WORKSPACE, NameTypes.WORKSPACE)
    this.registry = registry
  }
}
```

### Benefits

- ✅ **No framework modifications** - Users define components at app level
- ✅ **Consistent naming** - "Oval 1", "Rectangle 1", etc.
- ✅ **Stable IDs** - "oval-1", "rectangle-1", etc.
- ✅ **Extensibility** - New element types work automatically
- ✅ **Framework-first** - APIs support user needs, not code changes
- ✅ **Type safety** - Constructor signatures maintain type information

### Key Implementation Details

1. **Registration happens at definition time, not instantiation**
   - `defineComponent()` registers with counters immediately
   - First element created gets ID 1, name "Type 1"

2. **Prefix parameters flow through constructor chain**
   - `new Oval(data)` → `super(data, 'oval', 'Oval')` → Element sets `this._idType`, `this._nameType`

3. **Type is set AFTER parent \_init() is called**
   - Parent `Element._init()` uses `this._idType`/`this._nameType` for ID/name
   - Then `DynamicComponent._init()` sets `this.data.type = type`

4. **Workspace uses dependency injection**
   - `Workspace` constructor receives `ISceneTreeRegistry` instead of importing sceneTree singleton
   - Removes circular dependency

### Example: Complete User Component

```typescript
// User code (app level)
import { defineComponent } from '@asyra/core'
import { PropertyTypes } from '@asyra/utils'

// Define Oval component
defineComponent({
  type: 'oval',
  idPrefix: 'oval',
  namePrefix: 'Oval',
  properties: [
    {
      name: PropertyTypes.POSITION,
      type: PropertyTypes.POSITION,
      alias: ['x', 'y']
    },
    {
      name: PropertyTypes.DIMENSION,
      type: PropertyTypes.DIMENSION,
      alias: ['width', 'height']
    }
  ],
  renderStrategy: (graphic, data) => {
    graphic.clear()

    // Set explicit dimensions for E2E hit detection
    graphic.width = data.width
    graphic.height = data.height

    // Set position before drawing
    graphic.x = data.x
    graphic.y = data.y

    // Draw ellipse
    graphic.ellipse(
      data.width / 2,
      data.height / 2,
      data.width / 2,
      data.height / 2
    )
    graphic.fill(0xcccccc)

    // Ensure rendering in E2E
    graphic.renderable = true
    graphic.visible = true
  }
})

// Usage elsewhere in app
const oval1 = createDynamicComponent('oval', 'oval', 'Oval', [...])
console.log(oval1.data.id)    // 'oval-1'
console.log(oval1.data.name)  // 'Oval 1'
console.log(oval1.data.type)  // 'oval'
```
