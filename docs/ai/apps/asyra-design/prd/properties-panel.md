# PRD: Properties Panel

## Problem

Users need precise property editing that reflects current selection/mode state without exposing internal data complexity.

## Goals

- show correct panel content based on context
- support numeric editing for layout and vector points
- prevent invalid numeric updates

## Functional Requirements

1. Selected element -> show layout section (`X/Y/W/H/R`).
2. No selection -> hide layout fields.
3. Selected vector point in active path editing -> show point fields (`X/Y`) instead of layout section.
4. Numeric input accepts finite values and rejects invalid values.
5. Successful edits update canvas state immediately.

## Data Flow

- UI reads from providers (`useX`, `useY`, `useSelectedVectorPoint`, etc.)
- UI writes through controllers/common APIs (`changeElementComputedData`, `updateVectorAnchorPointPosition`)

## Success Criteria

- `properties.spec.ts` scenarios pass
- no non-finite values are written to numeric computed fields from UI path

## References

- `apps/asyra-design/src/properties/*`
- `apps/asyra-design/src/providers/*`
- `apps/asyra-design/src/controllers/scene-tree.ts`
