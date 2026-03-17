# Feature System Quick Start

This tutorial shows how to use the new Feature System in `@asyra/asyra-design`.

---

## Step 1: Initialize Feature System

Add this to your app initialization:

```typescript
// apps/asyra-design/src/init/foundation/init-features.ts
import { initFeatureSystem } from '@asyra/core'
import core from './contexts'

export const initFeatures = () => {
  // Initialize the feature system connections
  initFeatureSystem({
    inputSystem: core.deps.inputSystem,
    systemContext: core.deps.systemContext
  })
}
```

Then call it in your main init:

```typescript
// apps/asyra-design/src/init/index.ts
import { initFeatures } from './foundation/init-features'

export const initApp = () => {
  // ... your existing initialization
  initFeatures()
}
```

---

## Step 2: Use Existing Features

### Transaction Feature

```typescript
import { getFeature } from '@asyra/feature-system'

const transaction = getFeature('transaction')

// Wrap operations in transaction
transaction.wrap(() => {
  // do something...
})

// Or manually:
transaction.start()
// ... operations ...
transaction.end()

// Undo/Redo
transaction.undo()
transaction.redo()
```

### Selection Feature

```typescript
const selection = getFeature('selection')

// Select elements
selection.selectElements(['element-1', 'element-2'])

// Get selected IDs
const ids = selection.getSelectedIds()

// Toggle selection
selection.toggleSelection('element-1')

// Clear selection
selection.clearSelection()
```

---

## Step 3: Create Your Own Feature

### Example: Delete Elements Feature

```typescript
// apps/asyra-design/src/features/delete/index.ts
import core from '../../contexts'
import { defineFeature, getFeature } from '@asyra/feature-system'

const packages = core.deps

export const deleteFeature = defineFeature(
  'delete',
  ({ packages, getFeature }: any) => ({
    api: {
      delete: (ids: string[]) => {
        const txn = getFeature('transaction')
        txn.start()
        packages.sceneTree.deleteElements(ids)
        txn.end()
      }
    },
    define: ({ keys, on }: any) => {
      keys([{ keys: ['Backspace', 'Delete'] }])

      on('delete.elements', ({ ids }: any) => {
        const api = deleteFeature.api as any
        api.delete(ids)
      })
    }
  })
)

export default deleteFeature
```

---

## Step 4: Use Feature in UI Component

```typescript
import { getFeature } from '@asyra/feature-system'

export function DeleteButton({ selectedElements }: { selectedElements: string[] }) {
  const deleteFeature = getFeature('delete')

  return (
    <button
      onClick={() => deleteFeature.api.delete(selectedElements)}
      disabled={selectedElements.length === 0}
    >
      Delete ({selectedElements.length})
    </button>
  )
}
```

---

## Step 5: Use Priority-Based Sessions

### Example: Rectangle Tool with Priority

```typescript
// apps/asyra-design/src/features/rectangle-tool/index.ts
import core from '../../contexts'
import { defineFeature } from '@asyra/feature-system'

const packages = core.deps

export const rectangleToolFeature = defineFeature(
  'rectangleTool',
  ({ packages, session }: any) => ({
    api: {
      create: (position: any, size: any) => {
        packages.factory.startTransaction()
        const id = packages.sceneTree.addRectangle({ position, size })
        packages.factory.endTransaction()
        return id
      }
    },
    define: ({ session }: any) => {
      // Priority 100 = highest, exclusive = true
      session.start(
        'input.drag',
        { priority: 100, exclusive: true },

        // onStart
        (snapshot: any) => {
          if (snapshot.primaryTool !== 'rectangle') return null

          packages.factory.startTransaction()
          const id = packages.sceneTree.addRectangle({
            position: snapshot.mouse.position,
            size: { width: 0, height: 0 }
          })
          return { id, start: snapshot.mouse.position }
        },

        // onUpdate
        (snapshot: any, state: any) => {
          if (!state) return
          const size = {
            width: snapshot.mouse.position.x - state.start.x,
            height: snapshot.mouse.position.y - state.start.y
          }
          packages.sceneTree.updateComputedData(state.id, { size })
        },

        // onEnd
        (snapshot: any, state: any) => {
          if (!state) return
          packages.factory.endTransaction()
        }
      )
    }
  })
)
```

---

## Step 6: Use Templates (One-Liner Features)

### Shortcut Template

```typescript
import { shortcutTemplate } from '@asyra/feature-system'

export const zoomFitFeature = shortcutTemplate({
  name: 'zoomFit',
  keys: 'CmdOrCtrl+0',
  action: () => {
    // Zoom to fit functionality
    console.log('Zoom to fit!')
  }
})
```

### Transactional Template

```typescript
import { transactionalTemplate } from '@asyra/feature-system'
import core from './contexts'

export const deleteFeature = transactionalTemplate({
  name: 'delete',
  shortcut: 'Backspace',
  action: (packageDeps: any) => {
    packageDeps.sceneTree.deleteElements(packageDeps.selectedElements)
  }
})
```

---

## Complete Example: Delete Button

```typescript
// apps/asyra-design/src/features/delete/index.ts
import core from '../../contexts'
import { defineFeature, getFeature } from '@asyra/feature-system'

const packages = core.deps

const deleteFeature = defineFeature('delete', ({ packages, getFeature }: any) => ({
  api: {
    delete: (ids: string[]) => {
      const txn = getFeature('transaction')
      txn.start()
      packages.sceneTree.deleteElements(ids)
      txn.end()
    }
  },
  define: ({ keys, on }: any) => {
    keys([{ keys: ['Backspace', 'Delete'] }])
  }
}))

// apps/asyra-design/src/components/DeleteButton.tsx
import { getFeature } from '@asyra/feature-system'

export function DeleteButton({ selected }: { selected: string[] }) {
  const deleteFeature = getFeature('delete')

  return (
    <button
      onClick={() => deleteFeature.api.delete(selected)}
      disabled={selected.length === 0}
      className="px-4 py-2 bg-red-500 text-white rounded"
    >
      Delete {selected.length > 0 && `(${selected.length})`}
    </button>
  )
}
```

---

## Testing Your Setup

```typescript
// Test file
import {
  defineFeature,
  getFeature,
  getFeatureRegistry
} from '@asyra/feature-system'

// 1. Test feature creation
defineFeature('test', ({ packages }: any) => ({
  api: { value: 42 },
  define: ({ on }: any) => {}
}))

// 2. Test import
const testFeature = getFeature('test')
console.log(testFeature.value) // 42

// 3. Test registry
const registry = getFeatureRegistry()
console.log('Features:', registry.getFeatureNames())
```

---

## Key Points

1. **Initialize once** - Call `initFeatureSystem()` during app startup
2. **Features auto-register** - Call `defineFeature()` anywhere to register
3. **Get features** - Use `getFeature('name')` to access feature API
4. **Use APIs** - Call `feature.api.method()` to execute
5. **Priority sessions** - Higher priority runs first, exclusive stops lower

That's it! You should be able to start using the feature system now. Try creating a simple feature and test it out! 🚀
