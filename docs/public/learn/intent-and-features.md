# Intent enters through Features

Input describes what happened; a Feature decides whether and how the product
responds. This keeps keyboard, pointer, UI, collaboration, and AI adapters from
becoming hidden business-logic owners.

A Feature registration declares explicit priority, exclusivity, conditions,
and lifecycle. A session can then map one intended interaction through
`start`, zero or more `update` operations, and one `end` or cancellation path.

## Ownership route

```text
human or agent intent
→ environment/app adapter
→ Feature condition and priority
→ Feature session
→ app common API
→ one Factory transaction
→ canonical owner
```

Input System normalizes input and manages its explicit browser attachment. It
does not decide which tool wins, what a drag means, whether a command is
allowed, or which canonical element changes. Those are Feature and app-domain
decisions.

## Executable path

Run:

```shell
yarn examples:run feature-session-undo
```

The example proves a successful session produces one undoable value, Undo and
Redo replay it, and a failing session restores the last commit without adding
history. It uses the public Feature and Factory boundaries rather than directly
calling another package's state owner.

Use the Feature package registration APIs documented by its public entrypoint.
Do not invent an app-local session manager when Feature System already owns the
lifecycle, and do not put canonical mutations in event listeners or React
effects.

## Failure and disabled behavior

A condition that does not match should leave the Feature inactive. An
exclusive higher-priority Feature may prevent a lower-priority one from
starting. Handler failure must follow the declared cancellation/rollback path;
it must not leave an open transaction or a partial canonical mutation.

When Feature System or an app Feature is not composed, an adapter must not
silently perform the action through a fallback route.

## Validate a Feature

- priority, exclusivity, and conditions are explicit;
- `start`, `update`, `end`, and cancellation are ordered and bounded;
- one intended session creates at most one intended undo commit;
- errors release session resources and restore canonical state;
- input, UI, collaboration, and AI adapters do not own the mutation; and
- the Feature uses public Core/common APIs only.

## Canonical sources

- [Framework workflow](../../ai/framework/WORKFLOW.md)
- [Feature System contract](../../ai/framework/packages/feature-system.md)
- [Verified Feature session](../../examples/feature-session-undo.mjs)

## Next

- [Learn transactions and durability](transactions-and-durability.md)
- [Build a transaction-safe Feature](../build/feature-session.md)
