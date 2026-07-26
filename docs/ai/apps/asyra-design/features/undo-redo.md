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
- An explicit Mock AI mutating turn may correlate its committed canonical
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
actionable history control.
