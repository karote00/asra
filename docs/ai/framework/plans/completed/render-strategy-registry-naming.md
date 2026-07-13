# Completed Plan: Render Strategy Registry Naming Clarity

## Status

- Completed on March 3, 2026.

## Goal

Remove naming ambiguity between:

1. component render-strategy registry (`type -> strategy`)
2. custom render-layer registry (`name -> layer registration`)

## Scope

1. Rename render strategy registry file and symbol.
2. Update cross-package imports/exports.
3. Update affected tests/docs references.

## Delivered

1. Renamed `packages/render/src/render-registry.ts` to `packages/render/src/render-strategy-registry.ts`.
2. Renamed public symbol `renderRegistry` to `renderStrategyRegistry`.
3. Updated render/core/preset usages and test files.
4. Updated framework/app/internal docs references to the new naming.
5. Kept `render-layer-registry` naming unchanged for layer registration flow.

## Result

API naming now clearly distinguishes strategy registration from layer registration, reducing framework extension confusion without changing runtime behavior.
