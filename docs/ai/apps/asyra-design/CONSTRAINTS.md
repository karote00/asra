# App Constraints and Limitations

## Hard Constraints

1. App is framework-composed
- Asyra Design must follow framework contracts from `docs/ai/framework/*`.

2. Feature runtime ownership
- active interaction flow is feature-system based.

3. Tool semantics
- primary tool values are constrained to current tool set:
  - `select`, `rect`, `oval`, `pen`

4. Property panel behavior
- panel shows element layout properties for element selection
- panel shows vector point properties only when point is selected in path-editing context

5. Property key naming
- persisted/high-frequency model keys should favor compact naming by default
- when adding new app schema keys/types, existing shared contracts must be checked and reused first when equivalent

## Current Functional Limitations

1. Auto-layout
- not implemented in app behavior

2. Pen tool advanced controls
- drag-to-bezier handle creation is supported for connected points
- handle-mode constraints support `mirror-angle` and `mirror-angle-length`
- additional constraint variants beyond mirror modes remain future work

3. Theme toggle
- component exists but is hidden in current UI

4. Keyboard mapping source
- key map should be consumed from the `@asyra/core` facade (`keyMap` re-export)

## Testing Limitations

- E2E covers core flows, not every edge interaction combination.
- some nuanced interaction behavior still needs manual validation after refactors.
