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

## Where this runs

Create one runtime inside the app Feature or service that owns the AI
invocation lifecycle. Provider credentials and vendor calls belong behind the
app's server boundary. Browser code receives a bounded provider adapter,
registered actions, permission policy, and the same transaction runner used by
ordinary product commands.

## Implementation

```ts
import {
  createAiAgentRuntime,
  type AiActionDefinition
} from '@asyra/ai-agent-runtime'

const setVisibilityAction: AiActionDefinition<{
  readonly visible: boolean
}> = {
  name: 'set_visibility',
  description: 'Set one selected record visibility.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['visible'],
    properties: { visible: { type: 'boolean' } }
  },
  execute: async ({ visible }) => {
    visibilityFeature.api.setVisible(visible)
    return { visible }
  }
}

const runtime = createAiAgentRuntime({
  provider: {
    requestActionBatch: async () => ({
      batchId: 'visibility-batch',
      actions: [{
        id: 'visibility-1',
        name: 'set_visibility',
        arguments: { visible: false },
        summary: { outcome: 'Hide the selected record' }
      }]
    })
  },
  actionDefinitions: [setVisibilityAction],
  contextProvider: {
    getContext: async () => ({ selectedIds: selectionFeature.api.ids() })
  },
  permissionPolicy: {
    evaluate: async ({ action }) =>
      action.name === 'set_visibility' ? 'allow' : 'deny'
  },
  confirmationHandler: {
    confirm: async () => true
  },
  transactionRunner: {
    run: async (_label, execute) => appTransactions.run(execute)
  }
})

await runtime.run({
  intent: 'Hide the selected record',
  signal: featureAbortController.signal
})
```

The deterministic provider above makes the orchestration readable. Replace it
with an app-approved provider adapter; keep the action schema, permission, and
executor boundaries unchanged.

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

## Expected result

One schema-backed visibility action executes, commits once, rolls back zero
times, and preserves the provider-prepared argument identity through permission
and execution. No provider call or AI work occurs merely by importing or
creating unrelated Framework capabilities.

Permission denial, confirmation cancellation, invalid control envelope, or
abort applies no canonical prefix. Executor failure propagates through the one
app transaction runner so its rollback contract owns reversal.

## Validate

Test default-deny permission, confirmation cancel, abort, provider failure,
invalid and duplicate actions, executor rollback, redaction, progress observer
containment, and disposal. Assert the canonical Feature result and the one
transaction boundary; provider output alone is not success evidence.

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
- [AI Agent Runtime package guide](../reference/packages/ai-agent-runtime.md)

## Next

- [Build app-owned retrieval and action](app-retrieval-action.md)
- [Read the AI Agent Runtime guide](../reference/packages/ai-agent-runtime.md)
