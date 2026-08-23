# Give every state one canonical owner

Correct Asyra products distinguish four kinds of state:

1. **Canonical state** - durable product information owned by its Framework
   package and app schema.
2. **Local derived state** - UI or computation results that can be rebuilt.
3. **Projection state** - engine handles, render resources, and interaction
   indexes derived from canonical information.
4. **Transport state** - presence, receipts, connection status, and encoded
   messages used to move canonical changes.

Only canonical state participates as product truth. The other forms may be
cached or synchronized for their own purpose, but they cannot independently
decide the document.

## Canonical owners

Props Manager owns registered property values and their validation. Scene Tree
owns element hierarchy and relations. System Context owns registered
system-level managed properties. Factory owns transaction history and replay.
Core coordinates these owners through public facades; it does not turn UI,
Render, Collaboration, or a backend into a second owner.

The app still owns domain meaning. A Framework owner can guarantee a field is a
valid number or a hierarchy operation is structurally valid; only the app knows
whether that number is a temperature limit or whether moving a BIM subsystem
is allowed.

## Write route

Enter canonical changes through the app's Feature or common API, open one
Factory transaction for one intended action, validate with the canonical owner,
and let ordinary publication/projection adapters observe the committed result.

Do not:

- write directly to CRDT internals from UI code;
- let a render engine update canonical geometry as a side effect;
- treat collaboration presence as document state;
- accept a server response by replacing local owners without validation; or
- mirror a canonical object into component state and write both copies.

## Load and remote changes

Load and remote collaboration use the same canonical owner rules as local
intent. The app validates versions and policy, then passes ordered canonical
changes through the public coordination boundary. Remote origin affects
transport and history policy; it does not create a different model.

## Validate ownership

- each field, relation, order, and history entry names one canonical owner;
- every projection can be destroyed and rebuilt;
- local, remote, load, undo, redo, and AI changes converge through declared
  owner APIs;
- disabled adapters leave no partial duplicate state; and
- tests assert owner state, not only rendered pixels or UI labels.

## Canonical sources

- [Framework architecture](../../ai/framework/ARCHITECTURE.md)
- [System Context contract](../../ai/framework/packages/system-context.md)
- [Props Manager contract](../../ai/framework/packages/props-manager.md)

## Next

- [Learn transactions and durability](transactions-and-durability.md)
- [Learn validation, load, and migration](validation-load-migration.md)
