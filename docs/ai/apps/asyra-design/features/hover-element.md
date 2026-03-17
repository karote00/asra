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

1. Resolves hovered element from render hover payload.
2. Ignores locked or hidden elements (hovered id becomes `null`).
3. Writes hovered element id into system context (`hoveredElementId`).

## Contract

- Hover detection is render-instance-event-based.
- Locked or hidden element hover sets hovered id to `null`.
- Hover state is app interaction state mirrored into UI context (`hoveredElementId`) for UI consumers (for example, content panel row hover sync).
- Canvas hover outline rendering is handled by the registered selection overlay render layer (selected + hover visuals).
