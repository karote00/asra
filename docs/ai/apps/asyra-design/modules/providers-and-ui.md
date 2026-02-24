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

- `src/properties/*`
  - element layout editing
  - vector point editing mode panel
  - numeric parse guard via `number-input.ts`
  - fills panel files (`fills/*`) are placeholders, not wired to domain behavior yet

## Property Panel File Map

- `header.tsx`: section header renderer
- `position.tsx`, `dimension.tsx`, `rotation.tsx`: layout fields
- `vector-point.tsx`: point editing panel in path editing mode
- `number-input.ts`: finite-number parser for layout edits

## Rules

- Components should use providers/hooks for state.
- Input handlers should call controllers/common APIs.
- Keep UI mode switches derived from app state, not local component assumptions.

## Property Panel Contract

- No selection -> no layout fields shown.
- Element selection -> layout fields shown.
- Selected vector point in active path editing -> point panel shown.
- Invalid numeric input must not write computed data.
