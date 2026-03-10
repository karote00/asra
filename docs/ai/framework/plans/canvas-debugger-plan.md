# Canvas Debugger Plan

## Goal

Provide a framework-level canvas debugger so developers can verify whether render output is correct and isolate coordinate-space, layer-order, and render-state issues without relying on ad hoc app-specific logging.

## Scope

In scope:
- optional debugger overlay and inspection surfaces for render/runtime validation
- render-layer visibility and ordering inspection
- pointer/viewport/element coordinate-space inspection
- deterministic hooks to inspect element render state and overlay state

Out of scope:
- app-specific design/debug UI styling
- product-facing authoring features
- renderer-specific debugging APIs exposed directly to apps

## Why Framework-Level

- Render correctness problems are cross-cutting and not app-specific.
- Apps need a common way to inspect framework/runtime behavior without importing renderer internals.
- The debugger must respect the render-engine boundary so future engines can support the same contract.

## Target Areas

1. Render output inspection
- Inspect what the runtime believes should be drawn for one element or one frame.

2. Coordinate-space inspection
- Show client, canvas, workspace, and element-local coordinates for the current pointer and selected targets.

3. Render-layer inspection
- Show active render layers, z-order, visibility, and whether a layer updated in the current frame.

4. Element render diagnostics
- Inspect renderable element bounds, transforms, and relevant computed render inputs.

5. Debug-session control
- Enable/disable debugger state without affecting persisted document data or normal app behavior.

## Implementation Slices

1. Define debugger contract
- Add framework-owned types/APIs for optional render debugging.
- Keep the public surface renderer-agnostic.

2. Add render-debug data providers
- Expose safe inspection hooks from render orchestration and registered layers.
- Avoid direct app access to renderer-native objects.

3. Add optional debugger overlay registration
- Allow a debugger layer to be registered/enabled without changing normal render flow.
- Keep it opt-in and non-persistent.

4. Add snapshot/inspection APIs
- Support deterministic reads for element bounds, pointer-space conversions, and active layer metadata.

5. Validate with focused scenarios
- Verify pan/zoom, overlay alignment, element transforms, and multi-layer rendering behavior.

## Constraints

- Must preserve render-engine replaceability.
- Must not require Pixi imports outside `@asyra/render`.
- Must not mutate document/runtime state as part of inspection.
- Must remain optional and safe to exclude from production app wiring.

## Exit Criteria

- Framework exposes a renderer-agnostic canvas-debug contract.
- Apps can opt into a debugger overlay without importing renderer internals.
- Developers can inspect coordinate conversions and render-layer state deterministically.
- The debugger helps isolate incorrect render output without app-specific one-off tools.
