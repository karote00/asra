# Plan: Render YJS Change Registration (No Hardcoded Package Observers)

## Goal

Make render-side YJS change wiring registration-driven, so `@asyra/render` does not hardcode specific observed maps or change handlers in package internals.

Target outcome:
- render can register YJS change observers via explicit APIs
- default preset wiring remains available
- app/framework extensions can add/remove render observers without editing render package internals

## Problem

Current render data-context subscriptions are hardcoded in `@asyra/render`:
- direct observe wiring to `factory.sceneTreeMap`
- direct observe wiring to `factory.elementSelectionMap`
- switch/branch logic embedded in package subscribe modules

This conflicts with extension-first architecture and makes render-side change handling less composable.

## Scope

In scope:
- render-side observer registration abstraction for YJS changes
- migration of existing scene-tree/selection observers to registration path
- default registration provided by preset/init path
- lifecycle-safe subscribe/unsubscribe ownership

Out of scope:
- changing scene-tree/selection data model semantics
- changing feature behavior
- broad refactor of non-render packages unless required for adapter parity

## Proposed Design

1. Introduce a render observer registry
- package: `@asyra/render`
- contract example:
  - `registerYjsChangeObserver(name, observer, options?)`
  - `unregisterYjsChangeObserver(name)`
  - `initRegisteredYjsObservers()`
  - `disposeRegisteredYjsObservers()`
- each observer defines:
  - source resolver (which YJS map/array to observe)
  - change handler
  - optional init/reload hooks

2. Move hardcoded observers into default registrations
- convert current scene-tree/selection subscriptions into reusable observer definitions
- default definitions live in render package but are registered via explicit bootstrap function

3. Allow preset/app-level registration
- preset registers default render observers during `applyPreset(...)`/render init
- apps can override/extend observer registration without patching `@asyra/render` internals

4. Lifecycle handling
- each registered observer returns an unsubscribe/cleanup function
- render startup initializes all registered observers once
- teardown path disposes all active observers deterministically

## Implementation Slices

### Slice 1: Contracts
- add render observer types/interfaces
- add registry utility with duplicate-key protection and cleanup ownership

### Slice 2: Scene-tree observer migration
- port current `scene-tree` observe logic to registered observer definition
- preserve existing reload behavior on file-load complete

### Slice 3: Selection observer migration
- port current selection observe logic to registered observer definition
- keep channel routing behavior unchanged

### Slice 4: Bootstrap integration
- wire default observer registration in render/preset startup path
- remove hardcoded direct observe calls from legacy init functions

### Slice 5: Extensibility + docs
- document how apps register custom render YJS observers
- update framework package docs/contracts (`packages/render.md`, API map if needed)

## Validation

1. Behavioral parity
- render updates still reflect scene-tree add/remove/computed updates
- selection highlight updates remain correct for element/point/segment channels

2. Lifecycle safety
- multiple init calls do not duplicate observers
- teardown/unregister cleans up all observers

3. Extensibility
- can add one custom observer from app/preset without touching render package internals

## Risks and Mitigations

1. Missed cleanup causing duplicate updates
- mitigate with centralized observer lifecycle ownership and idempotent init guards

2. Registration order bugs
- mitigate with deterministic registration ordering and explicit priority/order option if required

3. Silent behavior drift during migration
- mitigate with parity tests around scene-tree + selection render updates

## Exit Criteria

- `@asyra/render` no longer hardcodes YJS observe wiring in internal init path
- default scene-tree/selection observers are registered through registry API
- preset/app can register render observers explicitly
- existing render behavior and tests stay green
