# @asyra/preset

## 0.5.5

### Patch Changes

- Republish the affected Framework packages with publishable internal dependency
  ranges instead of monorepo-only `workspace:*` metadata.
- Updated dependencies
  - @asyra/core@0.5.5
  - @asyra/reactive-events@0.5.3
  - @asyra/render-engine-pixi@0.5.2
  - @asyra/ui-context@0.5.3

## 0.5.4

### Patch Changes

- Exceptional synchronized patch release for the fixed 19-package Framework set.
- Updated dependencies
  - @asyra/core@0.5.4
  - @asyra/reactive-events@0.5.2
  - @asyra/render-engine@0.5.1
  - @asyra/render-engine-pixi@0.5.1
  - @asyra/ui-context@0.5.2
  - @asyra/utils@0.5.1

## 0.5.3

### Patch Changes

- @asyra/core@0.5.3

## 0.5.2

### Patch Changes

- Updated dependencies [889f7b4]
  - @asyra/reactive-events@0.5.1
  - @asyra/core@0.5.2
  - @asyra/ui-context@0.5.1

## 0.5.1

### Patch Changes

- 6559efc: Route app runtime and collaboration through Core, restore fast authoritative collaboration synchronization, and refresh the standalone Asyra Design template.

  Initialize document connection state at `none`, publish only actual state changes, and notify every connection transition except the initial `none` to `connected` transition.

- Updated dependencies [6559efc]
  - @asyra/core@0.5.1

## 0.5.0

### Minor Changes

- Exceptional synchronized minor release for the fixed 19-package Framework set.

### Patch Changes

- Updated dependencies
  - @asyra/core@0.5.0
  - @asyra/reactive-events@0.5.0
  - @asyra/render-engine@0.5.0
  - @asyra/render-engine-pixi@0.5.0
  - @asyra/ui-context@0.5.0
  - @asyra/utils@0.5.0
