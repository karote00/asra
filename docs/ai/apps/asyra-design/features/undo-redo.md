# Feature: Undo/Redo

## Source

- `src/features/undo-redo/index.ts`
- `src/common-apis/history.ts`

## Trigger

- event: `input.shortcut.undoredo`
- priority: `100`
- exclusive: `true`

## Behavior

- Shift + Undo shortcut -> redo
- Undo shortcut without Shift -> undo
- Shortcut and current AI Message Bar controls await the reusable framework
  render policy, whose default mode is `progressive`.
- Progressive replay preserves exact recorded progressive boundaries. For
  immediate source publications it keeps every publication ordered but
  coalesces completed projection into render slices with a default budget of
  1,024 distinct canonical ids; the complete operation remains one History
  transition and one outer transaction.
- An explicit `atomic` option skips intermediate host/paint yields for a bulk
  interaction whose next dependent mutation must wait for the complete
  canonical mutation and projection.
- An explicit Agent mutating turn may correlate its committed canonical
  action id with one app-root-local Message Bar.
- The Message Bar offers Undo only while that AI action remains current, then
  offers Redo after its successful Undo.
- A later committed action or a second Undo invalidates the older AI control
  before it can affect unrelated history.

## Contract

User-visible action grouping depends on how each mutation path groups transactions.
When refactoring features/common APIs, keep intended undo granularity stable.

The AI projection observes canonical action/undo/redo events and invokes only
`historyApis`. It does not own or copy Factory's history stack, inverse events,
canonical snapshots, or replay patches. Failed, cancelled, denied,
provider-disabled, unsupported, and zero-mutation AI turns create no new
actionable history control. While a requested replay is pending, the projection
rejects a second request and the Message Bar control stays disabled; its
Undo/Redo direction changes only after the canonical completion event.
