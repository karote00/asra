# Feature: Hover Element

## Sources

- `src/features/hover-element/index.ts`
- `src/common-apis/element/index.ts`
- `src/common-apis/system-context.ts`

## Trigger

- event: `input.mouse.move`
- mode: execution
- priority: `0`
- exclusive: `false`

## Behavior

1. Reads current client mouse position from system snapshot.
2. Resolves hovered element by bounds hit-test (`getElementIdAtClientPos`).
   - when path editing mode is active, only the current `pathEditingVectorId` can remain hovered
   - non-editing elements are forced to `null` hover state
3. Writes hovered element id into system context (`hoveredElementId`).

## Contract

- Hover detection is bounds-based, not render-instance-event-based.
- Empty canvas hover sets hovered id to `null`.
- Hover state is app interaction state mirrored into UI context (`hoveredElementId`) for UI consumers (for example, content panel row hover sync).
- Canvas hover outline rendering is handled by the registered selection overlay render layer (selected + hover visuals).
