# PRD: Properties Panel

## Problem

Users need precise property editing that reflects current selection/mode state without exposing internal data complexity.

## Goals

- show correct panel content based on context
- support numeric editing for layout and vector points
- support repeatable fill editing for selected elements
- prevent invalid numeric updates

## Functional Requirements

1. Selected element -> show layout section (`X/Y/W/H/R`).
2. No selection -> hide layout fields.
3. Selected vector point in active path editing -> show point fields (`X/Y`) instead of layout section.
4. Selected vector anchor point exposes handle mode selection (`none`, `mirror-angle`, `mirror-angle-length`) and handle coordinate edits respect the selected mode.
5. Numeric input accepts finite values and rejects invalid values.
6. Selected element in element-properties mode -> show fills section with repeatable fill rows.
7. Selected vector element still shows fills in element-properties mode; only vector point editing routes to the point panel instead.
8. Fill row supports `visible`, `opacity`, `colorFormat`, `color`, and color-picker editing.
9. Color-picker open/close is controlled by the preview block, while color drag transactions begin on picker palette/slider pointer-down and end on pointer-up.
10. One color-picker drag session must produce exactly one undo commit even if many drag-frame color updates occur.
11. Fill edits write canonical color value using each fill entry `defaultColorFormat`.
12. Gradient fill entries carry descriptive metadata (`gradientType`, `gradientStops`, `gradientHandles`) and can be seeded/edited from the panel through a gradient-stop editor.
13. Successful edits update canvas state immediately.
14. `fills` panel data is selection-derived in ui-context; providers only select from the computed `fills` value and do not manage selection subscriptions themselves.
15. When a gradient fill is active for editing, the canvas should show gradient handles and allow direct handle dragging to update `gradientHandles`.
16. One canvas gradient-handle drag session must produce exactly one undo commit even if many drag-frame geometry updates occur.

## Data Flow

- UI reads from providers (`useX`, `useY`, `useFills`, `useFill`, `useSelectedVectorPoint`, etc.)
- UI writes through controllers/common APIs (`changeElementComputedData`, `updateVectorAnchorPointPosition`, direct fill child update helpers)

## Success Criteria

- `properties.spec.ts` scenarios pass
- no non-finite values are written to numeric computed fields from UI path
- fill updates are persisted through computed/property runtime (`fills`), not local-only UI state

## References

- `apps/asyra-design/src/properties/*`
- `apps/asyra-design/src/providers/*`
- `apps/asyra-design/src/controllers/scene-tree.ts`
