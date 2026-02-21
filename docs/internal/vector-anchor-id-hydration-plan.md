# Vector Anchor ID Hydration Plan

## Context

Current vector point ID continuity after reload is handled by a runtime fallback (`hydrateVectorAnchorIdCounter`) that scans scene tree elements after load.

Target direction: move anchor-point ID hydration into the **props load phase**, because `anchorPoints` belongs to custom props data.

## Current Conclusions

1. Props "register" status
- We have `uiPropertyRegistry.register(...)` in `@asyra/props-manager`.
- That registry is for property definition metadata (UI/introspection), not for load-time data hydration behavior.
- We currently do **not** have a dedicated load-hydration extension point in props-manager.

2. Feasibility in current implementation
- Yes, it is feasible to hydrate anchor point IDs during props loading.
- `PropsManager.load(...)` -> `createProperty(...)` -> `CustomComponent.load(...)` already receives custom data (`anchorPoints` included).
- Today, only prop-component IDs are loaded into `idCounter` (`IDTypes.PROPS`). Nested IDs (vector anchor IDs) are not.

## Proposed Future Direction

- Add a props-load hydration extension point (registerable hook).
- Use that hook to hydrate nested custom IDs (starting with vector `anchorPoints[].id`).
- Keep vector/domain-specific hydration out of generic props core logic as much as possible.
- Remove `hydrateVectorAnchorIdCounter` after props-load hydration is in place and verified.

## Why This Direction

- Aligns with ownership: `anchorPoints` is props data.
- Avoids post-load scene scan workaround.
- Better framework extensibility for future custom components with nested IDs.

## Not In Scope Now

- No implementation in this pass.
- This is a recorded follow-up design note for future refactor.
