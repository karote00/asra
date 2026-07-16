# Feature: Hover Element

## Sources

- `src/features/hover-element/index.ts`
- `src/common-apis/element/index.ts`
- `src/common-apis/system-context.ts`

## Trigger

- events: `render.pointer.hover`, `render.pointer.leave`
- mode: execution
- priority: `10`
- exclusive: `false`

## Behavior

1. While `mouseDragging=true`, ignores render hover and leave events and keeps
   the existing `hoveredElementId` unchanged.
2. Resolves hovered element from render hover payload.
3. Ignores locked or hidden elements (hovered id becomes `null`).
4. Writes hovered element id into system context (`hoveredElementId`), and
   clears it on an eligible render leave event.

## Contract

- Hover detection is render-instance-event-based.
- The render engine may continue hit testing during a drag, but crossed
  elements must not become product hover targets until the active drag ends.
- Locked or hidden element hover sets hovered id to `null`.
- Hover state is app interaction state mirrored into UI context (`hoveredElementId`) for UI consumers (for example, content panel row hover sync).
- Canvas hover outline rendering is handled by the registered selection overlay render layer (selected + hover visuals).
