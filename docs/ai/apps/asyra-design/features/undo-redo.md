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

## Contract

User-visible action grouping depends on how each mutation path groups transactions.
When refactoring features/common APIs, keep intended undo granularity stable.
