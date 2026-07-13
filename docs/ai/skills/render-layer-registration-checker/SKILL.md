---
name: render-layer-registration-checker
description: Validate render-layer registration path, z-order/update integration, and render-engine abstraction boundaries. Use when requests add/move overlays or custom render layers.
---


# Skill: render-layer-registration-checker

## Trigger Signals

Use this skill when requests include:
- "register render layer"
- "custom overlay"
- "vector editing layer"
- "render abstraction"
- "pixi import boundary"

## Do Not Use When

- Request is unrelated to rendering/layers.
- Request is pure app-state logic without canvas representation.

## Required Inputs

- Layer behavior goal.
- Layer owner (app vs core builtins).
- Rules:
  - `docs/ai/framework/packages/render.md`
  - `docs/ai/framework/packages/core.md`
  - `docs/ai/framework/CODING_STANDARDS.md`

## Preflight

1. Identify current registration point(s).
2. Verify engine-specific imports in non-render packages.
3. Map lifecycle: register, update, unregister.

## Deterministic Procedure

1. Ensure registration path uses `core.registerRenderLayer(...)`.
2. Keep engine coupling inside render package abstractions.
3. For non-render packages:
- use render abstractions/interfaces only
- do not import Pixi/engine classes directly

4. Verify layer ordering (`zIndex`) and update timing.
5. Ensure cleanup path exists (`unregisterRenderLayer`).
6. Update docs if owner/registration contract changed.

## Validation Matrix

- Overlay appears/disappears as expected.
- No non-render package imports `pixi.js`.
- Layer update loop remains deterministic.

## Required Output Format

1. `Registration Path`
2. `Abstraction Compliance`
3. `Validation`
4. `Exceptions`

## Guardrails

- Do not implement new layer by bypassing core registration.
- Do not leak engine primitives to app/common APIs.
- Do not commit/push unless user explicitly asks.

## Failure Policy

If abstraction is missing:
- add minimal render-side abstraction plan
- avoid shipping engine-coupled workaround in app/core
