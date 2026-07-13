# Plan: Render Data-Channel Shared Routing

## Status

- Accepted on March 3, 2026.
- Completed on March 3, 2026.
- Delivered:
  - `updateTransaction` shared routing now uses `options.shared` only.
  - factory shared-channel registry + default channel registration moved to preset initialization.
  - render observer registration moved to channel-based handlers (`name + channel + onChange`) with preset default observers.
  - render package subscribe internals removed; registration/wiring moved to preset + core APIs.

## Goal

Build a consistent data-channel flow where transaction changes are always local first, and only mirrored to shared YJS data when a channel is explicitly declared.

## Agreed Decisions

1. Local is default for all transaction changes.
2. Shared sync is opt-in with one metadata field: `{ shared: "<channelName>" }`.
3. No backward compatibility path for legacy owner-based shared routing.
4. Render package should not hardcode subscribe wiring.
5. Preset provides default channel registrations and default subscription processes.
6. Framework should expose registration APIs so app/framework users can define channel handlers without directly passing YJS instances.

## Scope

1. Core transaction routing and channel registry contracts.
2. Preset default registrations for render-facing channels.
3. Render observer registration lifecycle (already moved out of render internals).
4. Documentation and tests for new channel semantics.

## Implementation Steps

1. Define channel registry API in framework core/factory boundary.
- Register YJS-backed channels by name.
- Keep YJS instances internal to framework factories.

2. Add/update transaction metadata contract.
- Support `{ shared: "<channelName>" }` as the only shared-routing signal.
- Keep local mutation path unchanged.

3. Update `updateTransaction` shared flow.
- Always apply local updates.
- If `shared` channel is present and registered, append mirrored changes to that channel's YJS object.
- If no channel match, keep local-only behavior (no error).

4. Remove legacy owner-based shared routing branches.
- Delete fallback logic and compatibility-only code paths.

5. Finalize observer registration surface.
- Register render observers by channel name + handler.
- Keep render package focused on rendering primitives/stores only.

6. Move default channel observer wiring into preset.
- Register default scene-tree/selection (and related) observers in preset initialization.
- Keep these as default settings, not app-level hardcoding.

7. Add regression tests.
- Local-only transactions (no `shared` field).
- Shared channel route success.
- Unknown channel name remains local only.
- Preset default observer registration and teardown lifecycle.

8. Sync docs and decision history.
- Update framework package docs (`core`, `render`, `preset`) and workflow guidance.
- Add/update release decision rationale in `docs/ai/framework/decisions/releases/unreleased.md`.

## Exit Criteria

1. No render-internal subscribe folder or hardcoded YJS subscribe flow.
2. Shared routing only happens through `{ shared: "<channelName>" }`.
3. Channel registration and handler wiring are configurable through framework/preset APIs.
4. All related tests pass and docs reflect ownership boundaries (`user`, `preset`, `framework`).
