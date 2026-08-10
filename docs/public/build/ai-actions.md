# Build registered AI actions

Use `@asyra/ai-agent-runtime` to turn provider-prepared intent into a bounded,
schema-described set of app actions. The runtime orchestrates; your app retains
domain meaning, permission, confirmation, transaction, and canonical mutation.

## Prerequisites

- an app-owned `AiProvider`
- a bounded context provider
- registered `AiActionDefinition` values with JSON-compatible input schemas
- explicit permission and optional confirmation policy
- one app transaction runner and Feature-owned `AbortSignal`

## Ownership

AI Runtime owns provider sequencing, small control-envelope validation, action
resolution, permission/confirmation order, transaction invocation, redaction,
progress, and terminal results. The provider owns model/backend preparation.
The app owns schemas, action executors, permission decisions, Feature lifecycle,
domain prompt, provider credentials, and canonical common APIs.

## Public APIs

- `createAiAgentRuntime(...)` and `AiAgentRuntime`
- `createAiActionRegistry()` and `AiActionDefinition`
- `AiProvider.requestActionBatch(...)`
- `runtime.run(...)` and `runtime.resolveAiActionBatch(...)`
- context, permission, confirmation, and transaction adapters
- `redactAiValue(...)` and `createAiRuntimeAudit(...)`
- `createGenericHttpAiProvider(...)` for an app-selected safe endpoint

## Flow

1. A Feature starts one explicit AI invocation with an abort signal.
2. The app supplies bounded context and public action descriptions.
3. The provider returns one ordered, server-prepared `AiActionBatch`.
4. Runtime validates the control envelope and registered names.
5. App permission evaluates every exact prepared action.
6. Required confirmation receives a bounded redacted preview.
7. One app transaction runs registered executors in order.
8. Executors call the same app common APIs used by human interactions.
9. Runtime returns a detached bounded result and audit.

Use the deterministic, credential-free
[`ai-registered-action`](../../examples/ai-agent-runtime.mjs) proof.

## Expected result

One schema-backed visibility action executes, commits once, rolls back zero
times, and preserves the provider-prepared argument identity through permission
and execution. No provider call or AI work occurs merely by importing or
creating unrelated Framework capabilities.

Permission denial, confirmation cancellation, invalid control envelope, or
abort applies no canonical prefix. Executor failure propagates through the one
app transaction runner so its rollback contract owns reversal.

## Validate

```shell
yarn examples:run ai-registered-action
yarn workspace @asyra/ai-agent-runtime test:local
```

Test default-deny permission, confirmation cancel, abort, provider failure,
invalid and duplicate actions, executor rollback, redaction, progress observer
containment, and disposal.

## Forbidden shortcuts

- no model/vendor SDK or credential lookup in the generic runtime
- no unregistered action or direct model-to-canonical write
- no action arguments in preview, audit, progress, or terminal error output
- no second AI-only transaction/session queue
- no retry after canonical execution begins
- no visual preview requirement as mutation authority

## Canonical sources

- [AI Agent Runtime contract](../../ai/framework/packages/ai-agent-runtime.md)
- [Composition golden path](../../ai/framework/golden-paths/compose-ai-agent-runtime.md)
- [Executable registered-action example](../../examples/ai-agent-runtime.mjs)

## Next

- [Build app-owned retrieval and action](app-retrieval-action.md)
- [Read the AI Agent Runtime guide](../reference/packages/ai-agent-runtime.md)
