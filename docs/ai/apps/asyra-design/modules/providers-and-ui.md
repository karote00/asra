# Module: Providers and UI

## Provider Layer

Primary files:

- `src/hooks/useProperty.ts`
- `src/providers/*`

### `useProperty` pattern

- Uses `@preact/signals-react` for reactive subscription.
- Creates one signal per ui-context key.
- Subscribes via `uiContext.onChange(key, callback)`.

### Provider intent

- isolate UI from low-level runtime reads
- provide typed hooks (`useZoom`, `usePrimaryTool`, `useX`, etc.)
- keep selection-derived aggregation in ui-context/property registration, not in provider-local subscription effects

## UI Composition

- `src/app/index.tsx`

  - layout shell + canvas anchor

- `src/toolbar/*`

  - tool switch controls
  - zoom display
  - `theme-toggle.tsx` is currently hidden (`display: none`)

- `src/contents/*`

  - scene list virtualization
  - element selection from content panel
  - hovered row follows app hover target (`hoveredElementId`)

- `src/properties/*`
  - element layout editing
  - element appearance editing (`fills` repeatable list with color picker)
  - vector point editing mode panel
  - numeric parse guard via `number-input.ts`

## Property Panel File Map

- `header.tsx`: section header renderer
- `position.tsx`, `dimension.tsx`, `rotation.tsx`: layout fields
- `fills/*`: repeatable fill item editor (`visible`, `opacity`, `colorFormat`, `color`, color picker, gradient metadata seed/type)
- `providers/properties.ts`: thin selectors over ui-context values; `useFills()` / `useFill()` read from computed ui-context `fills`
- `vector-point.tsx`: point editing panel in path editing mode
  - supports selected target (`anchor` / `inHandle` / `outHandle`) coordinate editing
  - supports anchor point type control (`sharp` / `smooth`)
  - supports handle mode control (`none` / `mirror-angle` / `mirror-angle-length`)
- `number-input.ts`: finite-number parser for layout edits

## Rules

- Components should use providers/hooks for state.
- Input handlers should call controllers/common APIs.
- Keep UI mode switches derived from app state, not local component assumptions.

## Property Panel Contract

- No selection -> no layout fields shown.
- Element selection -> layout + fills fields shown.
- Selected vector element in element-properties mode -> fills section shown.
- Selected vector point in active path editing -> point panel shown.
- Invalid numeric input must not write computed data.
