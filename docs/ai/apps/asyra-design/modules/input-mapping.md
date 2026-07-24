# Module: Input Mapping and Event Routing

## Source

- `src/config/key-combinations.ts`
- `src/constants/*` (`InputSystemEvents`, `FeatureNames`)
- `src/init/foundation/init-input-system.ts`

## Purpose

Define how raw keyboard/pointer/wheel input is normalized into app events and system snapshot updates.

## Current Event Map

### Pointer/Mouse

- `input.drag.start`

  - keys: left mouse down
  - updates mouse `dragStart`, `position`, `down=true`, `dragging=false`

- `input.drag.update`

  - keys: left mouse down + move
  - updates mouse delta from drag start, `dragging=true`

- `input.drag.end`

  - keys: left mouse up
  - updates final delta, `down=false`

- `input.double.click`

  - keys: mouse double click

- `input.mouse.move`

  - keys: mouse move
  - updates hover pointer position

- native canvas `contextmenu`

  - remains a canvas-host DOM event rather than an Input System product event
  - Asyra Design accepts and suppresses browser default only for the handled
    canvas invocation
  - editable fields and non-canvas app surfaces retain native or existing
    behavior

- `input.layerHierarchyMove`

  - driven directly by normalized Layers DOM pointer start/update/end phases
  - begins pointer capture only after the app-owned movement threshold
  - carries ids, pointer coordinates, advisory row zone, and cancel reason
  - never carries a second hierarchy or geometry-derived parent guess

- `input.wheel.scroll`
  - keys: wheel
  - updates mouse delta for zoom/pan features

### Keyboard Shortcuts

- `input.shortcut.switchPrimaryTool`

  - `R` -> rectangle
  - `V` -> select
  - `O` -> oval
  - `P` -> pen

- `input.shortcut.cancel`

  - `Escape`

- `input.shortcut.enter`

  - `Enter`

- `input.shortcut.arrow`

  - arrow keys (reserved/available)

- `input.shortcut.undoredo`

  - `Meta+Z` or `Ctrl+Z`

- `input.shortcut.zoomPreset`

  - `Meta+1` or `Ctrl+1`

- `input.shortcut.group`

  - `Meta+G` or `Ctrl+G` -> Group
  - `Meta+Shift+G` or `Ctrl+Shift+G` -> Ungroup
  - editable targets bypass the shortcut

## Routing Contract

Input mapping callbacks should:

1. update `systemContext` key/mouse snapshot
2. keep payload detail minimal and explicit
3. avoid app business logic in input mapping layer

Business logic belongs to feature handlers.

## Boundary Note

Key mapping should use `@asyra/core` facade exports (e.g. `keyMap`)
instead of internal package paths.
