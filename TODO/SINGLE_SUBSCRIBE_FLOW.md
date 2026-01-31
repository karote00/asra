# Single Subscribe Flow Implementation

## Status: ✅ COMPLETED

## Implementation Summary

Successfully implemented the Single Subscribe Flow to preserve the Core Invariant (single final decision guarantee).

### What Was Changed

**Framework (`packages/core/src/`)**:

- ✅ Created `Workflow` interface + `WorkflowRegistry` type
- ✅ Created `WorkflowRegistryClass` for managing workflow definitions
- ✅ Created `initRegistryInputHandler()` - single framework subscribe point
- ✅ Modified `Core` class to have `workflowRegistry` property and `initEventHandlers()` method
- ✅ Exported `workflowRegistry` singleton
- ✅ **Removed** obsolete `subscribes/input-system/` folder (5 files deleted)

**Application (`apps/asyra-design/src/init/`)**:

- ✅ Created workflow definitions in `workflows/` folder:
  - `undo.ts` - undo/redo shortcut
  - `viewport.ts` - zoom fit, wheel scroll
  - `render.ts` - drag start/update/end
  - `primary-tool.ts` - switch primary tool
- ✅ Created `init-workflows.ts` - registers all workflows
- ✅ Modified `init-app.ts` to call `initWorkflows()` then `core.initEventHandlers()`

### Execution Flow

```
User Input (e.g., key press, mouse drag)
  ↓
InputSystem translates → event name (e.g., 'input.drag.start')
  ↓
Framework: initRegistryInputHandler (single subscribe point)
  ↓
Look up workflow by event name in WorkflowRegistry
  ↓
Execute workflow.contextUpdate(core, raw)
  ↓
Call workflow.coreAPI(core, ...args) → InteractionCore decision
  ↓
Final decision → Handlers execute side effects
```

### Key Features

✅ Core Invariant preserved - only one subscribe point in framework
✅ Extensible - users add workflows without touching framework
✅ No bypass possible - framework controls execution flow
✅ All tests passing (162 tests)
✅ Build successful
✅ Lint clean (only pre-existing warnings)

## Architecture After Implementation

### Framework (packages/core)

- **Single subscribe point**: `subscribes/registry-input-handler.ts`
- **Workflow registry**: `registries/workflow-registry.ts` (WorkflowRegistryClass)
- **Core APIs**: executeAction, startSession, updateSession, endSession
- **Handlers**: Execute side effects (subscribes/interaction-core/ only, input-system removed)

### App (apps/asyra-design)

- **Input mappings**: `src/constants.ts` + `init/input-system.ts`
- **Workflow definitions**: `init/workflows/*.ts`
- **Workflow registration**: `init/init-workflows.ts`
- **Rules, Behaviors, Selectors**: Existing (unchanged)

## Benefits

1. **Core Invariant Guaranteed** - Only one subscribe point, enforced by architecture
2. **Extensible** - Users add workflows without touching framework
3. **Clear Pattern** - Context update → core API, enforced by workflow structure
4. **No Bypass Possible** - Framework controls execution, users only configure workflow
5. **No Runtime Checks** - Architecture enforces rules, no warnings/errors needed

## Example Workflow Definition

```typescript
// apps/asyra-design/src/init/workflows/drag.ts
export const dragStartWorkflow: Workflow = {
  contextUpdate: (core, raw) => {
    const { clientX, clientY, button } = raw.pointer as PointerEventData
    core.updateMouseState({
      position: { x: clientX, y: clientY },
      down: true,
      button: button,
      dragging: false
    })
  },
  coreAPI: 'startSession',
  APIArgs: () => ['input.drag.start']
}
```
