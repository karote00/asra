# Architecture

Asyra Design is an App-level composition over Asyra Framework. Its canonical
intent path is:

```text
UI / input / automation / accepted AI intent
-> src/features
-> src/common-apis
-> public Asyra API inside one intended transaction
-> canonical Framework state owner
-> UI / render / serialization / service projection
```

Loading, undo/redo, and accepted collaboration changes use the Framework's
validation-and-apply path. They must not re-enter product intent as new UI or
Feature decisions.

## Ownership boundaries

- Framework owns deterministic execution, registration, transactions,
  validation, canonical state mechanics, and replaceable output boundaries.
- Preset owns optional official defaults and the `2D` profile baseline.
- This App owns design schemas, tools, interaction policy, permissions, UI,
  AI action definitions, and collaboration domain policy.
- Services own transport and durable storage policy. The browser never becomes
  an alternate durable-document owner.

## Startup

`src/startup.ts` coordinates App startup. `src/init/init-app.ts` applies Preset
and App registrations before Core composition closes. `src/contexts/core.ts`
is the App's public Framework composition boundary. Add registrations before
startup; do not mutate composition after `core.start()`.

## Transactions

One intended user action maps to one intended undo commit. Long-lived gestures
may start, update, and end one transaction; finite commands should use the
bounded transaction helper. Validation and inverse behavior belong with the
canonical owner, not only in UI handlers.

## Collaboration and persistence

The App uses one required, non-empty `fileId` as document/session identity. It
remains locally editable in the declared disconnected state, but local recovery
is not durable backend persistence. The socket service accepts and orders live
publications; the document backend owns materialized durability. Production
authentication, authorization, backup, and retention are intentionally left to
the product owner.
