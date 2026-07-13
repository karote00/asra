# Render-Engine Boundary Plan

## Goal

Split render orchestration from concrete renderer implementation so engine choice is swappable without changing non-render packages.

## Context

Today, `@asyra/render` provides render orchestration and uses Pixi as the default concrete engine.
This works for current apps, but future domains (design, whiteboard, BIM, 4D simulation, signaling) need a stricter engine boundary and explicit render-engine contracts.

## Scope

In scope:
- define render-engine package contract for drawing primitives, textures, materials, and shaders
- keep `@asyra/render` focused on render instances, render layers, and render-facing APIs
- move Pixi-specific implementation behind a concrete engine package as default engine
- wire engine injection through core/preset startup flow
- preserve current app-facing behavior through compatibility adapters where needed

Out of scope:
- full multi-engine parity in the first phase
- app-specific visual style policy
- scene-tree or feature-system ownership changes

## Target Behavior

1. Orchestration boundary
- `@asyra/render` owns layer lifecycle, subscriptions, and state-to-render routing.
- `@asyra/render` does not directly depend on engine-specific primitives.

2. Engine boundary
- render-engine contract exposes engine-agnostic APIs for geometry, textures, materials, and shader programs.
- concrete engines (Pixi default first) implement this contract.

3. Swappable runtime
- app/preset can provide a concrete engine implementation via explicit startup wiring.
- swapping engine does not require changes in non-render packages.

4. Compatibility
- existing app flows continue to work with the Pixi-backed default engine.
- current core facade behavior remains stable unless explicitly versioned.

## Proposed Contract Direction

1. Engine adapter contract
- define a typed adapter interface for:
  - surface/context creation
  - draw command submission
  - texture/material/shader resource lifecycle
  - capability querying (for example `supports3D`, `supportsShaderGraph`)

2. Layer-runtime handshake
- render layers target engine-agnostic draw APIs, not engine internals.
- missing capability behavior is explicit and deterministic (fail-fast or fallback policy).

3. Startup and ownership
- core/preset owns default engine registration and initialization order.
- app can override default engine registration without patching framework internals.

## Implementation Slices

1. Contract extraction
- define adapter types and ownership boundaries
- add minimal compatibility shim for current render usage

2. Pixi engine implementation split
- move Pixi-specific code to concrete engine implementation package
- keep stable entrypoints for current default bootstrapping

3. Render package refactor
- make `@asyra/render` consume only adapter contracts
- remove direct engine-specific dependencies from orchestration code

4. Core/preset integration
- register default engine in preset
- expose explicit override hooks for app-level engine selection

5. Validation and hardening
- add integration tests for engine swap, undo/redo, load/save, CRDT sync paths
- document fallback behavior for unsupported capabilities

## Success Criteria

- swapping concrete render engine requires no non-render package changes
- existing app behavior remains stable with default Pixi-backed engine
- render contracts remain deterministic across load/undo/redo/collaboration paths
- import boundaries enforce no engine-specific leaks outside render boundary packages

## Risks

1. Abstraction mismatch
- too-thin contracts leak engine assumptions; too-thick contracts slow development

2. Performance regressions
- adapter indirection can add overhead if draw batching/resource lifecycle is not tuned

3. Capability fragmentation
- engines may differ in shader/material/3D support; fallback behavior must be explicit

4. Migration complexity
- existing render strategies/layers may rely on implicit Pixi behavior and need staged migration
