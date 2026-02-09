# Rule: Use Direct Imports, Not `core.deps.xxx`

## Overview

**ALWAYS import core packages directly from their contexts, NEVER use `core.deps.packageName`.**

## Why This Rule Exists

1. **Loose coupling**: Direct imports reduce dependencies on the `core` object
2. **Type safety**: Better TypeScript support with direct imports
3. **Explicit dependencies**: Clearer what each file actually needs
4. **Flexibility**: Easier to refactor and modify core architecture

## Correct Usage ✓

```typescript
// Import directly from app contexts
import { systemContext, inputSystem, interactionCore, render, sceneTree } from '../contexts'

// Use them directly
systemContext.updateMouseState({ ... })
inputSystem.on('input.drag.start', handler)
render.addElement({ ... })
sceneTree.addNewElement({ ... })
```

## Incorrect Usage ✗

```typescript
// BAD: Access via core.deps
import core from '../contexts'

core.deps.systemContext.updateMouseState({ ... })
core.deps.inputSystem.on('input.drag.start', handler)
core.deps.render.addElement({ ... })
core.deps.sceneTree.addNewElement({ ... })
```

## Contexts Available

Located at `apps/asyra-design/src/contexts/index.ts`:

```typescript
export const core = AsyraCore
export const systemContext = AsyraSystemContext
export const inputSystem = AsyraInputSystem
export const interactionCore = AsyraInteractionCore
export const render = AsyraRender
export const sceneTree = AsyraSceneTree
export const factory = AsyraFactory
export const selection = AsyraSelection
export const props = AsyraPropsManager
```

## When to Use `core`

The `core` object is ONLY for:

1. **Framework-level APIs**: `core.initFeatureSystem()`
2. **Legacy APIs**: During migration from old workflow system (to be removed)

## Examples

### In Key Combinations

```typescript
import { systemContext } from '../contexts'
import type { RawInputEvent } from '@asyra/utils'

export const keyCombinations = {
  [InputSystemEvents.INPUT_DRAG_START]: [
    {
      type: InputType.POINTER,
      keys: [PointerKey.LEFT_MOUSE_DOWN],
      callback: (raw: RawInputEvent) => {
        systemContext.updateMouseState({ ... })
        systemContext.updateKeyState({ ... })
      }
    }
  ]
}
```

### In Features

```typescript
import { systemContext, sceneTree, render } from '../../contexts'

export const myFeature = defineFeature('myFeature', {
  api: {
    doSomething() {
      // Use direct imports
      systemContext.switchPrimaryTool('select')
      sceneTree.addNewElement({ ... })
      render.addElement({ ... })
    }
  }
})
```

## Enforcement

- ✅ Linting rule (TODO: add ESLint rule)
- ✅ Code review checklist
- ✅ Documentation requirement

## Related Documents

- `docs/ai/project/CODING_STANDARDS.md` - Overall coding standards
- `docs/ai/project/ARCHITECTURE.md` - Architecture overview
- `apps/asyra-design/src/contexts/index.ts` - Available contexts
