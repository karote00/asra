# Plan: Explicit Vector Topology Model

## Scope

Replace vector runtime data flow with topology-first model:
- `points: Record<string, VectorPointNode>`
- `segments: Record<string, VectorSegment>`
- `networks: Record<string, VectorNetwork>`

Remove runtime geometry conversion from flat/nested `anchorPoints` models.

## Steps

1. contract definition
- define topology (`points/segments/networks`) as canonical app/runtime vector geometry contract
- default all three properties to empty objects (non-optional in computed model contracts)

2. boundary-first API migration
- migrate `elementApis` vector mutations to topology-native writes (append/move/type/handle/close/remove-subpath)
- keep feature handlers and UI callers on `elementApis` only

3. geometry/render migration
- update vector bounds/normalization to compute from topology segments and controls
- update vector render strategy and vector editing overlay to consume topology directly

4. pen feature migration
- update add-point, connected-point detection, drag-handle updates, and escape split behavior on topology mutations
- keep existing bezier drag behavior and handle selection semantics

## Validation

- `yarn workspace @asyra/asyra-design react:build` passes
- `yarn workspace @asyra/preset test:local src/__tests__/vector-component.test.ts` passes
- `yarn workspace @asyra/asyra-design test:e2e e2e/pen-tool.spec.ts` passes

## Result

Completed on 2026-03-02.

- vector runtime is topology-native (`points/segments/networks`)
- point add/remove/update operations mutate topology directly
- `anchorPoints` runtime conversion paths and subpath conversion helper were removed
