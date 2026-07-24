# Feature: Hover Element

## Sources

- `src/features/hover-element/index.ts`
- `src/common-apis/element/apis.ts`
- `src/common-apis/system-context.ts`

## Trigger

- events: `input.mouse.move`, `render.pointer.hover`, `render.pointer.leave`
- mode: execution
- priority: `0` for input mouse movement and `10` for passive Render events
- exclusive: `false`

## Behavior

1. While `mouseDragging=true`, ignores mouse-move, Render hover, and Render
   leave execution and keeps the existing `hoveredElementId` unchanged.
2. On each input mouse movement, resolves the identity-safe raw Render hit
   through the canonical hierarchy target policy.
3. When the raw Render hit is missing and no `Meta`/`Ctrl` modifier is active,
   tests official Group canonical bounds in reverse flattened order through
   each Group's current identity-safe Render transform.
4. The existing workspace or exact selected-`parentId` scope determines the
   final Group hover target. A candidate equal to the selected parent scope may
   resolve to that Group.
5. Visible raw Render hits take precedence. `Meta`/`Ctrl` bypasses Group bounds
   candidates and retains first non-Group raw-hit access.
6. Passive Render hover continues resolving its explicit raw payload; an
   eligible Render leave clears hover state.
7. Ignores locked or hidden resolved targets (hovered id becomes `null`).
8. Writes hovered element id into system context (`hoveredElementId`).

## Contract

- Visible-geometry hover remains based on identity-safe Render hits.
- Official Group empty-bounds hover is an app-owned, hover-only query over
  canonical computed bounds and the current identity-safe Render transform; it
  does not add Render hit geometry or a second hierarchy.
- Group bounds candidates are not used by click selection, pointer-down move,
  or create-parent targeting.
- The render engine may continue hit testing during a drag, but crossed
  elements must not become product hover targets until the active drag ends.
- Locked or hidden element hover sets hovered id to `null`.
- Hover state is app interaction state mirrored into UI context (`hoveredElementId`) for UI consumers (for example, content panel row hover sync).
- Canvas hover outline rendering is handled by the registered selection overlay render layer (selected + hover visuals).
