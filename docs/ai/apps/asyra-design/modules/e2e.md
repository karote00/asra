# Module: E2E Coverage

## Location

- `apps/asyra-design/e2e/*`

## Current Suites

- `app.spec.ts`
  - app load/layout smoke

- `tool-switching.spec.ts`
  - keyboard and toolbar tool switching

- `element-creation.spec.ts`
  - rectangle creation flows

- `oval.spec.ts`
  - oval tool behavior

- `selection.spec.ts`
  - select/deselect via canvas and contents panel

- `delete-element.spec.ts`
  - Delete/Backspace behavior for selected element and path-editing point delete branch

- `properties.spec.ts`
  - property panel visibility/editing

- `viewport-navigation.spec.ts`
  - zoom behavior

- `undo-redo.spec.ts`
  - history behavior

- `pen-tool.spec.ts`
  - pen tool and path-editing core flow
  - drag-to-bezier handle creation
  - curve-handle selection and point-target property visibility

## Contract Notes

- tests rely on stable `data-testid` selectors
- tests assume layout constants for safe canvas click positions
- tests currently use keyboard shortcuts heavily to drive interaction state

## When Updating Behavior

If you change:
- tool semantics
- path editing flow
- panel visibility logic
- selector attributes

then update E2E tests in the same work.
