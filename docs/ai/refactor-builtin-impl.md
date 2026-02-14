# Refactor Builtin Components to `defineComponent` Plan

**Status:** Completed
**Date:** 2026-02-14

## Goal
Refactor `scene-tree`, `props-manager`, and `render` to remove hardcoded component implementations (`Rectangle`, `Frame`, etc.) and instead use the generic `defineComponent` API to register them as "built-in" components.

## Implementation Steps

### 1. Built-in Components Definition (Core)
- Created `packages/core/src/components/` directory.
- Implemented `rectangle.ts`, `oval.ts`, `frame.ts`, `group.ts` using `defineComponent`.
- Registered render strategies (e.g., `rect`, `ellipse`) and properties (`position`, `dimension`) declaratively.
- Handled container logic (`isContainer: true`) for `Frame` and `Group`.
- Imported components in `packages/core/src/core.ts` to ensure registration on startup.

### 2. Scene Tree Refactoring
- Updated `createDynamicComponent.ts` to support `isContainer` flag, extending `Group` instead of `Element` when true.
- Updated `createElement` in `utils.ts` to rely solely on `componentRegistry`, removing the hardcoded `entityClassMap`.
- Removed legacy classes `packages/scene-tree/src/components/rectangle.ts` and `frame.ts`.
- Updated `sceneTree.test.ts` to remove dependency on `Rectangle` class.
- Updated `Computed.ts` to be dynamic, accepting list of property names instead of hardcoded `PROPS_MAP`.
- Updated `Element.ts` to pass default property names (`position`, `dimension`) to `Computed`.

### 3. Props Manager Refactoring
- Implemented `CustomComponent` in `packages/props-manager/src/components/custom.ts` to handle generic properties (using `type: 'custom'` or unknown types).
- Updated `createProperty` in `utils.ts` to fallback to `CustomComponent` for any unmapped property type, enabling extensibility.

### 4. Render Refactoring
- Verified `render-layer.ts` uses `renderRegistry` to look up render strategies.
- Built-in components now register their strategies via `defineComponent`, which populate `renderRegistry`.

## Verification
- Usage of `Rectangle` class removed from codebase.
- `props-manager` supports dynamic properties.
- `render` supports dynamic strategies.
- `scene-tree` supports dynamic component instantiation including containers.
