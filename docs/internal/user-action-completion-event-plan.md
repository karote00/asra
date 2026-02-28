# User-Action Completion Event Plan

## Goal

Provide a deterministic "user action completed" event that is emitted when one undoable action unit is finalized in factory transaction flow.

## Trigger Point

- Source: `packages/factory/src/data-transact.ts`
- Publish when `commitUndo()` commits a non-empty action unit to undo history.

## Ownership Contract

- Preset owns event name/definition.
- `@asyra/reactive-events` remains infra-only (event registration + publish/subscribe).
- Core exposes app-facing subscribe API (`core.xxx`) for post-action hooks.

## Behavioral Contract

1. Emit exactly once per finalized user action unit.
2. Do not emit for no-op transactions (no undoable changes).
3. Preserve existing undo/redo semantics and transaction boundaries.
4. Payload should include minimal action metadata needed for subscribers (e.g., action id/type/timestamp), finalized during implementation.

## Implementation Outline

1. Define preset-owned event definition for action completion.
2. Register the event via existing preset/core event registration path.
3. Publish from `DataTransact.commitUndo()` after successful commit.
4. Add core subscribe helper (`core.xxx`) that returns disposer/unsubscribe.
5. Add tests for emit timing, no-op suppression, and subscriber delivery.
