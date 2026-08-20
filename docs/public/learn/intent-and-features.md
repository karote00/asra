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

## Maintained implementation path

Follow [Build a transaction-safe Feature](../build/feature-session.md) for the
copyable session registration, call site, owner flow, expected result, and
failure behavior. The guide keeps public Feature and Factory boundaries
separate from app-domain mutation meaning.

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
- [Transaction-safe Feature guide](../build/feature-session.md)

## Next

- [Learn transactions and durability](transactions-and-durability.md)
- [Build a transaction-safe Feature](../build/feature-session.md)
