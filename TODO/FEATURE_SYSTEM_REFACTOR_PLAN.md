# Feature-System Key Combinations Config Implementation Plan

## Overview

Implement a centralized key combinations configuration that:

1. Registers all input-system event combinations
2. Passes relevant keys to each feature definition
3. Enables users to customize key mappings without changing feature code

## API Changes

### New `defineFeature` Signature

```typescript
defineFeature<API>(
  name: string,                    // 1st: Feature name
  keyConfig: FeatureKeyMap | undefined,  // 2nd: Key combinations for this feature
  definition: FeatureDefinition<API>      // 3rd: API and define block
): { api: FeatureAPI<API> }
```

### Key Config Structure (FeatureKeyMap)

```typescript
type FeatureKeyMap = Record<
  string, // Key identifier (e.g., "R", "V", "CMD+Z")
  {
    keys: KeyboardKey[] // Key codes from keyMap
    modifiers?: ModifierKey[] // Optional modifiers
    event: string // Event name (with "feature." prefix)
    detail?: DetailType // Optional payload detail
  }
>
```

---

## User Decisions

1. **Event Naming**: Feature events MUST use `feature.` prefix (e.g., `feature.switchPrimaryTool.action`)
2. **Config Organization**:
   - Framework events: Direct array `{ eventName: [combos] }`
   - Feature events: Organized by feature using named keys
3. **Features Without Keys**: `keyConfig` can be `undefined` (e.g., transaction feature)
4. **Backward Compatibility**: **NONE** - old API dropped completely
5. **Duplicate Keys**: Last one wins with console warning

---

## Implementation Steps

### Step 1: Create Key Combinations Config

**File**: `apps/asyra-design/src/config/key-combinations.ts`

```typescript
import { InputType, ModifierKey, PointerKey } from '@asyra/utils'
import keyMap from '@asyra/input-system/src/keymap'
import { InputSystemEvents } from '../constants'
import { PrimaryToolType } from '../constants'

export const keyCombinations = {
  // === Framework Events (direct array structure) ===
  [InputSystemEvents.INPUT_DRAG_START]: [
    { type: InputType.POINTER, keys: [PointerKey.LEFT_MOUSE_DOWN] }
  ],
  [InputSystemEvents.INPUT_DRAG_UPDATE]: [
    {
      type: InputType.POINTER,
      keys: [PointerKey.LEFT_MOUSE_DOWN, PointerKey.LEFT_MOUSE_MOVE]
    }
  ],
  [InputSystemEvents.INPUT_DRAG_END]: [
    { type: InputType.POINTER, keys: [PointerKey.LEFT_MOUSE_UP] }
  ],
  [InputSystemEvents.INPUT_MOUSE_MOVE]: [
    { type: InputType.POINTER, keys: [PointerKey.LEFT_MOUSE_MOVE] }
  ],
  [InputSystemEvents.INPUT_WHEEL_SCROLL]: [
    { type: InputType.WHEEL, keys: [PointerKey.WHEEL] }
  ],
  [InputSystemEvents.INPUT_SHORTCUT_ARROW]: [
    { type: InputType.KEYBOARD, keys: [keyMap.keys.ArrowUp] },
    { type: InputType.KEYBOARD, keys: [keyMap.keys.ArrowDown] },
    { type: InputType.KEYBOARD, keys: [keyMap.keys.ArrowLeft] },
    { type: InputType.KEYBOARD, keys: [keyMap.keys.ArrowRight] }
  ],
  [InputSystemEvents.INPUT_SHORTCUT_UNDOREDO]: [
    {
      type: InputType.KEYBOARD,
      keys: [keyMap.keys.KeyZ],
      modifiers: [ModifierKey.META]
    },
    {
      type: InputType.KEYBOARD,
      keys: [keyMap.keys.KeyZ],
      modifiers: [ModifierKey.CTRL]
    }
  ],
  [InputSystemEvents.INPUT_SHORTCUT_ZOOM_PRESET]: [
    {
      type: InputType.KEYBOARD,
      keys: [keyMap.keys.Digit1],
      modifiers: [ModifierKey.META]
    }
  ],

  // === Feature Events (organized by feature) ===

  // Switch Primary Tool Feature
  switchPrimaryTool_action: [
    {
      type: InputType.KEYBOARD,
      keys: [keyMap.keys.KeyR],
      event: 'feature.switchPrimaryTool.action',
      detail: { primaryTool: PrimaryToolType.RECTANGLE }
    },
    {
      type: InputType.KEYBOARD,
      keys: [keyMap.keys.KeyV],
      event: 'feature.switchPrimaryTool.action',
      detail: { primaryTool: PrimaryToolType.SELECT }
    }
  ]
}
```

**Note**: All feature events use `feature.` prefix to prevent conflicts with framework events

---

### Step 2: Update InputSystemRegistry

**File**: `packages/input-system/src/registry.ts`

Add method to register multiple events from config:

```typescript
export class InputSystemRegistry {
  private mappings: Map<string, InputEventCombo[]> = new Map()

  register(eventName: string, combos: InputEventCombo[]): void {
    this.mappings.set(eventName, combos)
  }

  // NEW: Register multiple events from config object
  registerKeyCombinations(
    combinations: Record<string, InputEventCombo[]>
  ): void {
    for (const [eventName, combos] of Object.entries(combinations)) {
      this.register(eventName, combos)
    }
  }

  getEventNames(): string[] {
    return Array.from(this.mappings.keys())
  }

  getCombinations(eventName: string): InputEventCombo[] | undefined {
    return this.mappings.get(eventName)
  }

  hasEvent(eventName: string): boolean {
    return this.mappings.has(eventName)
  }

  unregister(eventName: string): void {
    this.mappings.delete(eventName)
  }

  clear(): void {
    this.mappings.clear()
  }
}
```

---

### Step 3: Add FeatureKeyMap Type

**File**: `packages/feature-system/src/types/feature.ts`

Add after existing imports:

```typescript
import type { SystemContextSnapshot } from '@asyra/utils'
import { KeyboardKey, ModifierKey, DetailType } from '@asyra/utils'

// NEW: Type for feature key configuration
export type FeatureKeyMap = Record<
  string, // Key identifier (e.g., "R", "V", "CMD+Z")
  {
    keys: KeyboardKey[] // Key codes from keyMap.keys
    modifiers?: ModifierKey[] // Optional modifiers
    event: string // Event name to trigger (with "feature." prefix)
    detail?: DetailType // Optional payload detail
  }
>
```

Update KeyCombo in FeatureBuilder interface:

```typescript
export interface KeyCombo {
  keys: KeyboardKey[] | string[] // Support both key codes and key names
  type?: InputType
  meta?: any
}
```

---

### Step 4: Update `defineFeature` Function

**File**: `packages/feature-system/src/core/feature.ts`

Complete rewrite with new signature:

```typescript
import type {
  FeatureDefinition,
  FeatureAPI,
  FeatureBuilder,
  FeatureKeyMap
} from '../types/feature'
import { FeatureRegistry } from './feature-registry'
import { SessionManager } from './session-manager'
import {
  createFeatureBuilder,
  setCorePackages
} from '../builders/feature-builder'

const featureRegistry = new FeatureRegistry()
const sessionManager = new SessionManager()

async function registerFeatureEventHandlers(
  featureName: string,
  keyConfig: FeatureKeyMap,
  builder: FeatureBuilder
) {
  const { packages } = builder
  const inputSystem = packages?.inputSystem
  const interactionCore = packages?.interactionCore
  const systemContext = packages?.systemContext

  if (!interactionCore?.registry || !inputSystem?.on || !systemContext) {
    console.warn(
      `[defineFeature] Cannot register handlers for "${featureName}": missing required packages`
    )
    return
  }

  const registeredEvents = new Set<string>()

  for (const [keyId, config] of Object.entries(keyConfig)) {
    const { event, keys, modifiers } = config

    // Check for duplicate event keys
    if (registeredEvents.has(event)) {
      console.warn(
        `[defineFeature] Feature "${featureName}" has duplicate key config for event "${event}" (key: ${keyId}). Last one wins.`
      )
    }
    registeredEvents.add(event)

    // Register decision handler with interactionCore
    // Note: This just registers - actual handler comes from feature's define block
    interactionCore.registry.register(event, (snapshot: any, detail?: any) => {
      // Return null to let feature's handler take over
      return null
    })

    // Subscribe to input system event to trigger interactionCore
    inputSystem.on(event, (raw: any) => {
      console.log(`[InputEvent] ${event} triggered:`, raw)
      const snapshot = systemContext.getSystemContextSnapshot?.() || raw

      // Decide through interactionCore
      const result = interactionCore.registry.decide(
        event,
        snapshot,
        raw.detail
      )

      // Execute handler if result has one
      if (result?.handler) {
        result.handler(result.payload, result.options)
      }
    })
  }
}

export function defineFeature<API>(
  name: string,
  keyConfig: FeatureKeyMap | undefined,
  definition: FeatureDefinition<API>
): { api: FeatureAPI<API> } {
  const builder = createFeatureBuilder({
    name,
    packages: {},
    sessionManager,
    featureRegistry,
    keyConfig
  })

  // Execute feature's define block
  definition.define(builder)

  // Register feature
  const api = featureRegistry.register(name, definition as any)

  // Register event handlers with interactionCore and inputSystem if keyConfig provided
  if (keyConfig && Object.keys(keyConfig).length > 0) {
    registerFeatureEventHandlers(name, keyConfig, builder).catch((error) => {
      console.error(
        `[defineFeature] Failed to register handlers for "${name}":`,
        error
      )
    })
  }

  return { api: api as FeatureAPI<API> }
}

export function importFeature(featureName: string): FeatureAPI {
  const api = featureRegistry.getAPI(featureName)
  if (!api) {
    throw new Error(`Feature "${featureName}" not found`)
  }
  return api
}

export function registerFeature(feature: { api: FeatureAPI }): void {}

export function unregisterFeature(featureName: string): boolean {
  return featureRegistry.unregister(featureName)
}

export function getFeatureRegistry(): FeatureRegistry {
  return featureRegistry
}

export function getSessionManager(): SessionManager {
  return sessionManager
}

export { FeatureRegistry } from './feature-registry'
export { SessionManager } from './session-manager'
export { setCorePackages } from '../builders/feature-builder'
```

---

### Step 5: Update FeatureBuilder Implementation

**File**: `packages/feature-system/src/builders/feature-builder.ts`

Update to accept keyConfig:

```typescript
import type { FeatureBuilder, FeatureKeyMap } from '../types/feature'
import type { SessionConfig } from '../types/feature'
import { InputType, ModifierKey } from '@asyra/utils'
import keyMap from '@asyra/input-system/src/keymap'

let corePackages: any = {}

export function setCorePackages(packages: any) {
  corePackages = packages
}

export function createFeatureBuilder(context: {
  name: string
  packages: any
  sessionManager: any
  featureRegistry: any
  keyConfig?: FeatureKeyMap
}): FeatureBuilder {
  const { name, sessionManager, featureRegistry, keyConfig } = context

  const packages =
    Object.keys(context.packages).length > 0 ? context.packages : corePackages

  return {
    packages,

    events: {
      register: (eventName: string) => ({
        eventName,
        publish: (payload?: unknown, options?: unknown) => {},
        subscribe: (handler: any) => ({ unsubscribe: () => {} })
      }),
      emit: (eventName: string, payload?: unknown, options?: unknown) => {},
      subscribe: (eventName: string, handler: (payload: unknown) => void) => ({
        unsubscribe: () => {}
      })
    },

    keys: (combos) => {
      console.warn(
        `keys() builder is deprecated for Feature "${name}". Use defineFeature(name, keyConfig, definition) instead.`
      )
    },

    handle: (eventName: string, handler) => {
      const interactionCore = packages?.interactionCore
      if (interactionCore?.registry) {
        interactionCore.registry.register(eventName, handler)
      }
    },

    on: (eventName: string, handler) => {
      console.log(`[On] Feature "${name}" listening to: ${eventName}`)
    },

    importFeature: (featureName: string) => {
      const api = featureRegistry.getAPI(featureName)
      if (!api) {
        return {}
      }
      return api
    },

    session: {
      start: <T>(
        sessionName: string,
        config?: SessionConfig,
        onStart?: any,
        onUpdate?: any,
        onEnd?: any
      ) => {
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

### Step 6: Update Exports

**File**: `packages/feature-system/src/index.ts`

```typescript
export {
  defineFeature,
  importFeature,
  registerFeature,
  unregisterFeature,
  getFeatureRegistry,
  getSessionManager,
  setCorePackages
} from './core/feature'

export { FeatureRegistry } from './core/feature-registry'
export { SessionManager } from './core/session-manager'

export * from './types'
export type { FeatureKeyMap } from './types/feature'

export * from './utils'

export type {
  FeatureDefinition,
  FeatureAPI,
  FeatureBuilder,
  SessionConfig,
  ActiveSession
} from './types/feature'
```

---

### Step 7: Update `init-input-system.ts`

**File**: `apps/asyra-design/src/init/init-input-system.ts`

```typescript
import inputSystem from '@asyra/input-system'
import { keyCombinations } from '../config/key-combinations'

export const initInputSystem = () => {
  inputSystem.registry.registerKeyCombinations(keyCombinations)
}
```

All existing registration code removed - now uses the centralized config.

---

### Step 8: Update Switch-Primary-Tool Feature

**File**: `apps/asyra-design/src/features/switch-primary-tool/index.ts`

```typescript
import core from '../../contexts'
import { PrimaryToolType } from '../../constants'
import keyMap from '@asyra/input-system/src/keymap'
import { defineFeature } from '@asyra/feature-system'

// Key config for this feature (uses "feature." prefix)
const switchPrimaryToolKeyConfig = {
  R: {
    keys: [keyMap.keys.KeyR],
    event: 'feature.switchPrimaryTool.action',
    detail: { primaryTool: PrimaryToolType.RECTANGLE }
  },
  V: {
    keys: [keyMap.keys.KeyV],
    event: 'feature.switchPrimaryTool.action',
    detail: { primaryTool: PrimaryToolType.SELECT }
  }
}

export const switchPrimaryToolFeature = defineFeature(
  'switchPrimaryTool',
  switchPrimaryToolKeyConfig,
  {
    name: 'switchPrimaryTool',
    api: {
      switch: (tool: PrimaryToolType) => {
        console.log('[switchPrimaryTool] Switching to tool:', tool)
        core.deps.systemContext.switchPrimaryTool(tool)
      }
    },
    define: ({ handle }: any) => {
      handle('feature.switchPrimaryTool.action', (snapshot: any) => {
        console.log(
          '[switchPrimaryTool] Handler called with snapshot:',
          snapshot
        )
        return {
          type: 'INTERACTION_SWITCH_PRIMARY_TOOL',
          payload: { tool: snapshot.detail?.primaryTool },
          handler: ({ tool }: any) => {
            console.log('[switchPrimaryTool] Handler executing:', tool)
            const api = switchPrimaryToolFeature.api
            if (api?.switch) {
              api.switch(tool)
            }
          }
        }
      })
    }
  }
)

export default switchPrimaryToolFeature
```

---

### Step 9: Update Other Feature Definitions

**File**: `apps/asyra-design/src/features/transaction/index.ts`

```typescript
import core from '../../contexts'
import { defineFeature } from '@asyra/feature-system'

export const transactionFeature = defineFeature(
  'transaction',
  undefined, // No keyboard shortcuts
  {
    name: 'transaction',
    api: {
      start: () => core.deps.factory.startTransaction(),
      update: (change: any) => core.deps.factory.updateTransaction(change),
      end: () => core.deps.factory.endTransaction(),
      undo: () => core.deps.factory.undo(),
      redo: () => core.deps.factory.redo()
    },
    define: ({ keys, handle }: any) => {}
  }
)

export default transactionFeature
```

**File**: `apps/asyra-design/src/features/selection/index.ts`

```typescript
import core from '../../contexts'
import { defineFeature } from '@asyra/feature-system'

export const selectionFeature = defineFeature(
  'selection',
  undefined, // No keyboard shortcuts
  {
    name: 'selection',
    api: {
      selectElements: (ids: string[]) => {
        const current = core.deps.selection.getElementSelectionIds()
        const newSelected = [
          ...current,
          ...ids.filter((id) => !current.includes(id))
        ]
        core.deps.selection.setElementSelection(newSelected)
      },
      toggleSelection: (id: string) => {
        const current = core.deps.selection.getElementSelectionIds()
        if (current.includes(id)) {
          const idx = current.indexOf(id)
          const newSelected = [
            ...current.slice(0, idx),
            ...current.slice(idx + 1)
          ]
          core.deps.selection.setElementSelection(newSelected)
        } else {
          core.deps.selection.setElementSelection([...current, id])
        }
      },
      clearSelection: () => {
        core.deps.selection.setElementSelection([])
      },
      getSelectedIds: () => core.deps.selection.getElementSelectionIds()
    },
    define: ({ on }: any) => {
      on('select_single', ({ elementId }: any) => {
        const api = selectionFeature.api as any
        api.selectElements([elementId])
      })

      on('toggle_selection', ({ elementId }: any) => {
        const api = selectionFeature.api as any
        api.toggleSelection(elementId)
      })

      on('clear_selection', () => {
        const api = selectionFeature.api as any
        api.clearSelection()
      })
    }
  }
)

export default selectionFeature
```

**Note**: Features without keyboard shortcuts pass `undefined` for keyConfig

---

### Step 10: Update Features Index

**File**: `apps/asyra-design/src/features/index.ts`

```typescript
// Import features to register them via defineFeature()
import './switch-primary-tool'

// Temporarily comment out features with errors during development
// import './transaction'
// import './selection'

export function registerAllFeatures() {
  console.log('Features registered via defineFeature')
}

export default {
  registerAllFeatures
}
```

---

## Files to Modify

| Priority | File                                                          | Change Type                         |
| -------- | ------------------------------------------------------------- | ----------------------------------- |
| High     | `packages/input-system/src/registry.ts`                       | Add `registerKeyCombinations()`     |
| High     | `packages/feature-system/src/types/feature.ts`                | Add `FeatureKeyMap` type            |
| High     | `packages/feature-system/src/core/feature.ts`                 | New signature, handler registration |
| High     | `packages/feature-system/src/builders/feature-builder.ts`     | Add `keyConfig` parameter           |
| Medium   | `packages/feature-system/src/index.ts`                        | Export `FeatureKeyMap`              |
| High     | `apps/asyra-design/src/config/key-combinations.ts`            | Create new config file              |
| High     | `apps/asyra-design/src/init/init-input-system.ts`             | Use new config                      |
| High     | `apps/asyra-design/src/features/switch-primary-tool/index.ts` | Update to new API                   |
| Medium   | `apps/asyra-design/src/features/transaction/index.ts`         | Update signature                    |
| Medium   | `apps/asyra-design/src/features/selection/index.ts`           | Update signature                    |
| Medium   | `apps/asyra-design/src/features/index.ts`                     | Update imports                      |

---

## Testing Plan

After implementation, verify:

1. **Build check**: All packages build successfully
2. **App starts**: Dev server runs without errors
3. **Keyboard shortcuts**: R and V keys switch tools
4. **Toolbar buttons**: Click to switch tools still works
5. **E2E tests**: `yarn workspace @asyra/asyra-design test:e2e --grep="switch"`

---

## Migration Notes

This is a complete rewrite of the feature-system with no backward compatibility.

**For old features**: Update to use new signature:

- Add `keyConfig` parameter or pass `undefined`
- Remove `keys()` calls from `define()` block (deprecated)
- Use `handle()` to register interaction handlers

**For key config**: Copy relevant keys from `init-input-system.ts` to `key-combinations.ts`
