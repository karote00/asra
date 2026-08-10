# Validate at every write and load boundary

Schema validation protects canonical state regardless of where a value comes
from. Local UI, an AI action, a collaboration message, a stored document, and a
test fixture must all satisfy the same owner contract.

Props Manager owns property definitions and runtime/load validation. Persistence
coordinates storage adapters. Your app owns document versions, domain
interpretation, migration rules, and the decision to reject unsupported data.

## Write behavior

A valid write is accepted by the canonical owner and becomes part of the
enclosing transaction. An invalid write fails before it can become owner state.
Do not coerce unknown values in UI code, accept them into a shadow store, or
replace them with visually convenient defaults.

Defaults belong to property definitions. A missing optional value may receive
its declared default; an explicitly invalid value is not equivalent to a
missing value.

## Load behavior

The app reads the document envelope and decides whether its version is current,
migratable, or unsupported. It produces a candidate canonical representation,
then Core and the canonical owners validate that representation before the
document becomes active.

Run the maintained proof:

```shell
yarn examples:run app-versioned-load-migration
```

The example demonstrates app-owned version migration followed by Framework
validation. It does not give Persistence package knowledge of the app's schema
history.

## Failure behavior

Unsupported versions and invalid canonical values must produce explicit load
failure. The previous active document must not be partially overwritten. An
app may present recovery choices, but recovery UI cannot silently broaden the
accepted schema.

The same rule applies to collaboration checkpoints and AI-produced values:
transport origin does not bypass validation.

## Validate the path

- every property type has one current schema and explicit defaults;
- invalid runtime writes fail before commit;
- version migration is deterministic and app-owned;
- the migrated candidate is validated before activation;
- a failing load leaves prior canonical state intact; and
- stored, remote, undo/redo, and AI paths use the same owner validators.

## Canonical sources

- [Props Manager contract](../../ai/framework/packages/props-manager.md)
- [Persistence contract](../../ai/framework/packages/persistence.md)
- [Verified versioned-load example](../../examples/app-owned-versioned-load-migration.mjs)

## Next

- [Build persistence and migration](../build/persistence-migration.md)
- [Read the Persistence package guide](../reference/packages/persistence.md)
