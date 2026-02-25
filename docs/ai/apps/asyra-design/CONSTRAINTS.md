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

## Current Functional Limitations

1. Auto-layout
- not implemented in app behavior

2. Pen tool advanced controls
- bezier handle editing is reserved/not implemented yet

3. Theme toggle
- component exists but is hidden in current UI

4. Keyboard mapping source
- key map should be consumed from the `@asyra/core` facade (`keyMap` re-export)

## Testing Limitations

- E2E covers core flows, not every edge interaction combination.
- some nuanced interaction behavior still needs manual validation after refactors.
