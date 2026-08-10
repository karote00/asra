# `@asyra/ai-agent-runtime`

Optional orchestration for turning natural-language intent into registered,
app-approved actions.

## Owns

- provider request, small control-envelope validation, and ordered action
  resolution
- permission and optional confirmation sequencing
- one app transaction-runner invocation around accepted executors
- bounded redaction, progress observation, audit, terminal results, and cleanup

## Does not own

Model vendors, credentials, app-domain actions, Feature sessions, canonical
state, transaction implementation, collaboration, or provider retry after
execution begins.

## Compose when

Compose it when an app wants model-assisted intent behind explicit action
schemas, permission, and canonical app APIs. Do not compose it for ordinary
deterministic commands or as a substitute for Feature System. Import and
construction are inert until the app creates and runs a runtime.

## Public entrypoints and prerequisites

The public entrypoint is `@asyra/ai-agent-runtime`. Provide an `AiProvider`,
context provider, `AiActionDefinition` catalog, permission policy, confirmation
handler, transaction runner, and Feature-owned `AbortSignal`. Important
surfaces include `createAiAgentRuntime(...)`, `createAiActionRegistry()`,
`runtime.run(...)`, and `createGenericHttpAiProvider(...)`.

## Lifecycle, inputs, outputs, and failure

One run obtains bounded context, requests one provider-prepared batch, resolves
registered actions, evaluates permission, optionally confirms, and executes in
one app transaction. Results are `executed`, `cancelled`, or `failed` with
bounded detached evidence. Invalid batches, denial, cancellation, or abort
apply no canonical prefix. Executor failure reaches the app transaction's
rollback. `dispose()` aborts active work and disposes only explicitly owned
resources.

## Relationships

Feature System owns the invocation session. App executors call Core/common APIs.
Factory owns actual transaction settlement. Collaboration and Persistence
observe ordinary canonical commits; the AI runtime creates no parallel path.

## Maintained use path

Run `yarn examples:run ai-registered-action`, then follow
[Build registered AI actions](../../build/ai-actions.md). The related
[app retrieval example](../../build/app-retrieval-action.md) keeps search
read-only and mutation behind a Feature API.

## Replacement and disabled behavior

`AiProvider` is replaceable. Apps may replace context, permission,
confirmation, transaction, audit, and HTTP adapters. If the package is not
composed, no provider request, model connection, credential read, or AI state
exists. A provider failure must not fall back to an unregistered action.

## Support, migration, and deprecation

Current support is the browser composition with app-owned provider/backend
policy. There is no current Headless Core service runtime. The root API is
current; no compatibility wrapper or alternate client payload mode is
supported. Migration must preserve action schemas, prepared argument identity,
permission defaults, and one-transaction behavior.

## Canonical sources and release inventory

- [Package contract](../../../ai/framework/packages/ai-agent-runtime.md)
- [Package manifest](../../../../packages/ai-agent-runtime/package.json)
- [Executable source](../../../examples/ai-agent-runtime.mjs)

Version and exported-entry facts are generated from this package manifest into
`docs/public/generated/package-reference.json`. The documentation gate reviews
this page against the exact 19-package release inventory.
