# Plan: SelectionManager Multi-Channel Selection Architecture

> Completed on 2026-03-03.
> Archive: `docs/ai/apps/asyra-design/plans/completed/selection-manager-multi-channel-plan.md`.

## Goal

Establish `SelectionManager` as the single source of truth for all canvas selection channels with concurrent selection support:
- `ELEMENT`
- `VECTOR_POINT`
- `VECTOR_SEGMENT`

Target behavior:
- channels are independent and can be selected at the same time
- system-context/render/ui-context react to selection changes from `SelectionManager`
- feature flows mutate selection through shared selection APIs/events

## Why This Change

- Current implementation is split:
  - element selection is managed by `SelectionManager`
  - vector point selection is app-owned (`selectedVectorPoint` in system-context)
- Existing selection internals are element-biased, making extension inconsistent.
- Multi-channel architecture gives deterministic ownership and package-level consistency.

## Scope

In scope:
- selection channel model and registration rules
- reactive-events + core API support for point/segment selection
- selection package subscribe process for all channels
- app migration of vector point selection to selection channels
- vector segment selection channel foundation (selection semantics + API/event flow)

Out of scope:
- full UX for advanced multi-select editing behaviors beyond current parity
- geometry editing algorithm changes unrelated to selection ownership

## Channel Model

1. Channel registry
- keep explicit channel registration through `core.registerSelection(...)`
- preset registers default channels:
  - `SELECTION_TYPES.ELEMENT`
  - `SELECTION_TYPES.VECTOR_POINT`
  - `SELECTION_TYPES.VECTOR_SEGMENT`

2. Concurrency rule
- selections in different channels do not clear each other by default
- a feature may explicitly clear one or more channels when mode semantics require it

3. ID contracts
- `ELEMENT`: existing element id
- `VECTOR_POINT`: encoded id (example) `${elementId}:${pointId}:${target}`
- `VECTOR_SEGMENT`: encoded id (example) `${elementId}:${segmentId}`
- add canonical encode/decode helpers (single utility ownership, no ad-hoc string parsing)

## Architecture Changes

1. `@asyra/utils`
- extend `SELECTION_TYPES` with `VECTOR_POINT`, `VECTOR_SEGMENT`
- extend `SELECTION_ACTIONS` with channel-specific actions
- extend selection change type contracts to support channel/action metadata

2. `@asyra/reactive-events`
- add publish/subscribe events for point/segment selection mutations
- preserve current transaction option behavior

3. `@asyra/core`
- add selection APIs mirroring existing `selectElements(...)`:
  - `selectVectorPoints(...)`
  - `selectVectorSegments(...)`
- keep feature-side API usage consistent through core facade

4. `@asyra/selection`
- generalize `BaseSelection` change emission to be channel-configurable
  - avoid hardcoded element action/event/owner
- add subscribe modules for vector point and vector segment channels
- keep `SelectionManager` generic over channel keys (no element-only assumptions)

5. `@asyra/ui-context` and `@asyra/render`
- wire selection subscriptions for new actions/channels
- update stores to set:
  - `elementSelection`
  - `vectorPointSelection` (or `vertexSelection` alias during transition)
  - `vectorSegmentSelection`

6. `apps/asyra-design`
- migrate feature writes from `selectedVectorPoint` ownership to point-channel selection APIs
- keep compatibility bridge during migration:
  - derive/update old `selectedVectorPoint` from point channel until all readers are migrated
- introduce segment selection state consumption path (panel/overlay hooks) without forcing full UX changes immediately

## Implementation Slices (Concrete)

### Slice 1: Contracts and Constants
- update selection constants/types in `@asyra/utils`
- add/adjust type tests for new channel/action coverage
- no behavior change yet

### Slice 2: Event + API Surfaces
- implement reactive-events publish/subscribe for point/segment selection
- expose core API methods for point/segment selection
- add focused API tests (event payload + transaction options)

### Slice 3: Selection Package Generalization
- parameterize `BaseSelection` change metadata per channel
- add point/segment subscribe pipelines and commit logic
- ensure channel updates are independent (no cross-channel auto-clear)

### Slice 4: UI/Render Channel Consumption
- add `vectorPointSelection` and `vectorSegmentSelection` ui properties
- update ui-context/render selection stores and subscribes for new actions

### Slice 5: App Migration (Point Channel)
- features write/read point selection through selection APIs/helpers
- keep mirror to `selectedVectorPoint` for compatibility
- migrate property panel/overlay readers to new channel data

### Slice 6: App Migration (Segment Channel Foundation)
- add segment select/clear behavior path in features/common-apis
- expose selected segment in panel/provider contracts
- maintain current behavior where segment editing actions are not yet expanded

### Slice 7: Cleanup
- remove obsolete point-selection source-of-truth from system-context
- keep system-context only for mode/session state (e.g., `pathEditingVectorId`)
- remove compatibility bridge code

## Subscribe Process Design

1. Selection event arrives (`selectElements` / `selectVectorPoints` / `selectVectorSegments`)
2. Selection package channel subscribe updates matching channel state
3. Transaction emits channel-aware selection change payload
4. ui-context/render observers route by channel/action and update corresponding UI properties
5. app providers consume channel-specific selection sets

## Validation Matrix

1. Unit/contract
- channel registration/get/clear works for all three channels
- channel-specific actions produce correct change payloads
- no unintended cross-channel clearing

2. Integration
- point selection updates overlay/panel selection correctly
- segment selection updates channel state and readers
- element selection behavior remains unchanged

3. E2E
- point select + delete in path editing still passes
- point/element concurrent selection state is stable when multi-selection is enabled
- segment selection channel smoke test

## Risks and Mitigations

1. Backward compatibility drift
- mitigate with temporary `selectedVectorPoint` mirror bridge and phased migration

2. ID encoding inconsistencies
- mitigate by central helpers + contract tests

3. Event/action proliferation complexity
- mitigate by channel-config table-driven subscribe wiring and shared helper utilities

## Exit Criteria

- all three channels are managed by `SelectionManager`
- app no longer owns selected vector point as source-of-truth in system-context
- selection subscribe process covers all channel actions across packages
- existing selection and vector-editing regressions remain green
